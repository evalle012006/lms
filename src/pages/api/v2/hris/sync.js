/**
 * POST /api/v2/hris/sync
 * ----------------------
 * HRIS pushes a batch of staff snapshots (max 500). Idempotent: send the same
 * batch twice and the second run changes nothing. Original requirement #2.
 *
 * For every staff member this endpoint
 *   1. upserts the mirror row in hris_user_sync (skipped when nothing changed), then
 *   2. if the staff member holds a seat (users.employee_no = employee_no), applies the rules:
 *        status Inactive                         -> VACATE   (reason: inactive)
 *        position is an EXCLUDED position        -> VACATE   (reason: position_not_syncable)
 *        position maps to a different role       -> VACATE   (reason: position_changed)
 *        branch-scoped role, different branch    -> VACATE   (reason: branch_changed)
 *        on leave                                -> BLOCK    (seat status = inactive, no reset)
 *        back from leave                         -> UNBLOCK  (seat status = active)
 *        name / phone / position differ          -> REFRESH  (kept in step with HRIS)
 *
 * Safety rails
 *   - allow_vacate defaults to FALSE. Vacates are only REPORTED ("would_vacate") until
 *     the caller passes allow_vacate:true. Use this for the first go-live runs.
 *   - dry_run:true plans everything and writes nothing.
 *   - UNKNOWN positions (typos not in the role map) and unknown branch codes never vacate
 *     anyone; they come back as warnings.
 *   - Seats whose role is not managed (admin, cashier, finance) and root accounts are never touched.
 *
 * Body
 *   { staff: [snapshot, ...], dry_run?: bool, allow_vacate?: bool, refresh_profile?: bool, actor?: string }
 *
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { hrisHandler } from '@/services/hris-handler';
import { resolveLmsRole, MANAGED_ROLES, BRANCH_SCOPED_ROLES } from '@/lib/hris-role-map';
import {
    USER_REF, MIRROR_REF, loadBranches, loadSeatsByEmployeeNos, vacateStatements, mirrorRowFor,
    mirrorUpsert, refreshSet, removeProfileFile, sendJson, normalizeEmployeeNo, normalizeCode, nz, stableHash,
    mirrorBase, seatBranchCode,
} from '@/lib/hris-seat';

const graph = new GraphProvider();
const MAX_BATCH = 500;
const UPSERT_CHUNK = 100;
const MAX_ACTIONS_RETURNED = 300;

export default hrisHandler({ post: syncStaff });

async function loadMirrors(hrisIds) {
    if (!hrisIds.length) return new Map();
    const rows = await graph
        .query(queryQl(createGraphType('hris_user_sync', 'hris_id payload_hash access_blocked')('mirrors'), {
            where: { hris_id: { _in: hrisIds } },
        }))
        .then((r) => r.data?.mirrors ?? []);
    return new Map(rows.map((m) => [m.hris_id, m]));
}

/** Decide what (if anything) must happen to the seat this staff member holds. */
function evaluate(row, seat, mirror, ctx) {
    const seatRole = seat.role?.shortCode;
    if (!MANAGED_ROLES.includes(seatRole) || seat.root === true) {
        return { warning: 'seat_role_not_managed' };
    }

    const status = String(row.status ?? '').trim().toLowerCase();
    const resolved = resolveLmsRole(row.position);

    let vacateReason = null;
    let warning = null;

    if (status === 'inactive') {
        vacateReason = 'inactive';
    } else if (resolved.reason === 'excluded') {
        vacateReason = 'position_not_syncable';
    } else if (resolved.role && resolved.role !== seatRole) {
        vacateReason = 'position_changed';
    } else if (resolved.role && BRANCH_SCOPED_ROLES.includes(seatRole)) {
        const code = nz(row.branch_code);
        const branch = code ? ctx.branches.byCode.get(normalizeCode(code)) : null;
        const seatCode = seatBranchCode(seat);
        if (!branch || !seatCode) warning = 'branch_unknown_in_lms';
        else if (seatCode !== normalizeCode(branch.code)) vacateReason = 'branch_changed';
    } else if (resolved.reason === 'unknown') {
        warning = 'unknown_position';
    }

    if (vacateReason) return { vacate: vacateReason };

    const actions = [];
    const onLeave = row.on_leave === true;
    if (onLeave && !mirror?.access_blocked) actions.push({ type: 'block' });
    if (!onLeave && mirror?.access_blocked) actions.push({ type: 'unblock' });

    if (ctx.refreshProfile) {
        const want = {
            firstName: nz(row.first_name) ?? '',
            lastName: nz(row.last_name) ?? '',
            number: nz(row.contact),
            position: nz(row.position),
        };
        const have = {
            firstName: nz(seat.firstName) ?? '',
            lastName: nz(seat.lastName) ?? '',
            number: nz(seat.number),
            position: nz(seat.position),
        };
        if (stableHash(want) !== stableHash(have)) actions.push({ type: 'refresh' });
    }

    return { actions, warning };
}

async function syncStaff(req, res) {
    const {
        staff,
        dry_run = false,
        allow_vacate = false,
        refresh_profile = true,
        actor = 'hris-sync',
    } = req.body ?? {};

    if (!Array.isArray(staff) || staff.length === 0) {
        return sendJson(res, { success: false, code: 'NO_STAFF', message: 'staff must be a non-empty array' });
    }
    if (staff.length > MAX_BATCH) {
        return sendJson(res, { success: false, code: 'BATCH_TOO_LARGE', message: `Max ${MAX_BATCH} staff per request` });
    }

    const errors = [];
    const rows = [];
    for (const s of staff) {
        if (s?.id === undefined || s?.id === null) {
            errors.push({ ref: s?.employee_no ?? null, reason: 'missing id' });
            continue;
        }
        rows.push({ ...s, employee_no: normalizeEmployeeNo(s.employee_no) });
    }

    const [branches, seatsByNo, mirrors] = await Promise.all([
        loadBranches(graph),
        loadSeatsByEmployeeNos(graph, rows.map((r) => r.employee_no).filter(Boolean)),
        loadMirrors(rows.map((r) => String(r.id))),
    ]);
    const ctx = { branches, refreshProfile: refresh_profile !== false };

    const summary = {
        received: staff.length, mirror_upserted: 0, mirror_unchanged: 0,
        vacated: 0, would_vacate: 0, blocked: 0, unblocked: 0, refreshed: 0, errors: 0,
    };
    const warnings = [];
    const actionsLog = [];
    const plan = []; // executable work: { type, seat, row, reason? }
    const upserts = [];

    for (const row of rows) {
        // 1. mirror
        const mirror = mirrors.get(String(row.id));
        const hash = stableHash(mirrorBase(row));
        if (!mirror || mirror.payload_hash !== hash) upserts.push(mirrorRowFor(row));
        else summary.mirror_unchanged += 1;

        // 2. seat rules
        const seat = row.employee_no ? seatsByNo.get(row.employee_no) : null;
        if (!seat) continue;

        const verdict = evaluate(row, seat, mirror, ctx);
        if (verdict.warning) warnings.push({ employee_no: row.employee_no, seat_id: seat._id, warning: verdict.warning });

        if (verdict.vacate) {
            if (allow_vacate) plan.push({ type: 'vacate', seat, row, reason: verdict.vacate });
            else {
                summary.would_vacate += 1;
                actionsLog.push({ employee_no: row.employee_no, seat_id: seat._id, action: 'would_vacate', reason: verdict.vacate });
            }
            continue;
        }
        (verdict.actions ?? []).forEach((a) => plan.push({ type: a.type, seat, row }));
    }

    if (dry_run) {
        summary.mirror_upserted = upserts.length;
        plan.forEach((p) => {
            summary[{ vacate: 'vacated', block: 'blocked', unblock: 'unblocked', refresh: 'refreshed' }[p.type]] += 1;
            actionsLog.push({ employee_no: p.row.employee_no, seat_id: p.seat._id, action: p.type, reason: p.reason });
        });
        return sendJson(res, {
            success: true, dry_run: true, summary, warnings, errors,
            actions: actionsLog.slice(0, MAX_ACTIONS_RETURNED),
        });
    }

    // ── execute: mirror first (so block/unblock can flag the mirror row) ──────
    for (let i = 0; i < upserts.length; i += UPSERT_CHUNK) {
        const chunk = upserts.slice(i, i + UPSERT_CHUNK);
        try {
            await graph.mutation(mirrorUpsert(`mirror_${i}`, chunk));
            summary.mirror_upserted += chunk.length;
        } catch (err) {
            summary.errors += chunk.length;
            errors.push({ ref: `mirror chunk ${i}`, reason: String(err?.message ?? err) });
        }
    }

    // ── execute: seat changes, one transaction each so one failure can't hurt the rest ─
    for (const p of plan) {
        const ref = p.row.employee_no;
        try {
            const now = new Date().toISOString();
            if (p.type === 'vacate') {
                await graph.mutation(...vacateStatements({
                    seat: p.seat,
                    reason: p.reason,
                    actor,
                    branchCode: seatBranchCode(p.seat),
                    alias: 'v',
                }));
                removeProfileFile(p.seat.profile);
                summary.vacated += 1;
            } else if (p.type === 'block') {
                await graph.mutation(
                    updateQl(USER_REF('blk_user'), {
                        where: { _id: { _eq: p.seat._id } }, set: { status: 'inactive', logged: false },
                    }),
                    updateQl(MIRROR_REF('blk_mirror'), {
                        where: { hris_id: { _eq: String(p.row.id) } }, set: { access_blocked: true, modified_date: now },
                    }),
                );
                summary.blocked += 1;
            } else if (p.type === 'unblock') {
                await graph.mutation(
                    updateQl(USER_REF('unb_user'), {
                        where: { _id: { _eq: p.seat._id } }, set: { status: 'active' },
                    }),
                    updateQl(MIRROR_REF('unb_mirror'), {
                        where: { hris_id: { _eq: String(p.row.id) } }, set: { access_blocked: false, modified_date: now },
                    }),
                );
                summary.unblocked += 1;
            } else if (p.type === 'refresh') {
                await graph.mutation(
                    updateQl(USER_REF('ref_user'), { where: { _id: { _eq: p.seat._id } }, set: refreshSet(p.row) }),
                );
                summary.refreshed += 1;
            }
            actionsLog.push({ employee_no: ref, seat_id: p.seat._id, action: p.type, reason: p.reason });
        } catch (err) {
            summary.errors += 1;
            errors.push({ ref, action: p.type, reason: String(err?.message ?? err) });
        }
    }

    return sendJson(res, {
        success: summary.errors === 0,
        dry_run: false,
        summary,
        warnings,
        errors,
        actions: actionsLog.slice(0, MAX_ACTIONS_RETURNED),
    });
}
