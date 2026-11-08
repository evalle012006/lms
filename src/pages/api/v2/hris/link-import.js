/**
 * POST /api/v2/hris/link-import
 * -----------------------------
 * OPTIONAL bulk pairing. Day-one linking is normally done one by one from the HRIS staff form
 * (GET seats + POST assign). Use this when the client hands you a spreadsheet instead.
 *
 * Body
 *   {
 *     "rows": [
 *       { "email": "juan@ambercash.ph", "employee_no": "EMP-0001" },              // link
 *       { "loNo": 12,                   "employee_no": "EMP-0042" },              // link, found by LO number
 *       { "user_id": "abc-123",         "employee_no": "EMP-0100" },              // link, found by _id
 *       { "email": "unused.lo@ambercash.ph", "action": "open" }                   // mark seat vacant (RESETS it)
 *     ],
 *     "dry_run": true,      // DEFAULT true. Nothing is written until you send false.
 *     "confirm": false,     // must be true to run any "open" row for real
 *     "relink":  false      // must be true to change an existing employee_no
 *   }
 *
 * link : sets users.employee_no and opens a seat-history row. Nothing else changes.
 * open : the destructive one. Resets the seat exactly like a vacate (name, picture, password,
 *        biometrics...) and marks it isVacant = true so HRIS can offer it in the dropdown.
 *
 * Only managed roles can be linked/opened (never admin, cashier, finance, root).
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { queryQl, updateQl, createGraphType } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { hrisHandler } from '@/services/hris-handler';
import { MANAGED_ROLES } from '@/lib/hris-role-map';
import {
    USER_REF, HISTORY_REF, SEAT_FIELDS, NOT_ROOT, loadBranches, vacateStatements, historyInsert,
    removeProfileFile, sendJson, normalizeEmployeeNo, today, seatBranchCode,
} from '@/lib/hris-seat';

const graph = new GraphProvider();
const MAX_ROWS = 2000;

export default hrisHandler({ post: linkImport });

async function linkImport(req, res) {
    const { rows, dry_run = true, confirm = false, relink = false, actor = 'link-import' } = req.body ?? {};

    if (!Array.isArray(rows) || rows.length === 0) {
        return sendJson(res, { success: false, code: 'NO_ROWS', message: 'rows must be a non-empty array' });
    }
    if (rows.length > MAX_ROWS) {
        return sendJson(res, { success: false, code: 'TOO_MANY_ROWS', message: `Max ${MAX_ROWS} rows per request` });
    }
    const hasOpen = rows.some((r) => r?.action === 'open');
    if (hasOpen && dry_run === false && confirm !== true) {
        return sendJson(res, {
            success: false, code: 'CONFIRM_REQUIRED',
            message: '"open" rows reset accounts. Re-send with confirm:true after reviewing the dry run.',
        });
    }

    const [users, branches] = await Promise.all([
        graph
            .query(queryQl(createGraphType('users', SEAT_FIELDS)('all_users'), { where: NOT_ROOT }))
            .then((r) => r.data?.all_users ?? []),
        loadBranches(graph),
    ]);

    const byId = new Map(users.map((u) => [u._id, u]));
    const byEmail = new Map();
    const byLoNo = new Map();
    const ownerByEmployeeNo = new Map();
    users.forEach((u) => {
        const e = String(u.email ?? '').trim().toLowerCase();
        if (e) byEmail.set(e, [...(byEmail.get(e) ?? []), u]);
        if (u.loNo !== null && u.loNo !== undefined) byLoNo.set(Number(u.loNo), [...(byLoNo.get(Number(u.loNo)) ?? []), u]);
        if (u.employee_no) ownerByEmployeeNo.set(u.employee_no, u);
    });

    const locate = (row) => {
        if (row.user_id) return byId.has(row.user_id) ? [byId.get(row.user_id)] : [];
        if (row.email) return byEmail.get(String(row.email).trim().toLowerCase()) ?? [];
        if (row.loNo !== undefined && row.loNo !== null && row.loNo !== '') return byLoNo.get(Number(row.loNo)) ?? [];
        return [];
    };

    const results = [];
    const seenEmployeeNos = new Set();
    const planned = [];

    rows.forEach((row, index) => {
        const action = row?.action === 'open' ? 'open' : 'link';
        const ref = row?.employee_no ?? row?.email ?? row?.loNo ?? row?.user_id ?? `row ${index + 1}`;
        const bad = (code, message) => results.push({ index, ref, action, status: 'error', code, message });

        const found = locate(row ?? {});
        if (found.length === 0) return bad('NOT_FOUND', 'No LMS user matches this row');
        if (found.length > 1) return bad('AMBIGUOUS', 'More than one LMS user matches this row; use user_id');
        const user = found[0];

        if (!MANAGED_ROLES.includes(user.role?.shortCode)) {
            return bad('NOT_MANAGED', `Role "${user.role?.shortCode}" is not managed by HRIS`);
        }

        if (action === 'link') {
            const empNo = normalizeEmployeeNo(row.employee_no);
            if (!empNo) return bad('NO_EMPLOYEE_NO', 'employee_no is required to link');
            if (seenEmployeeNos.has(empNo)) return bad('DUPLICATE_IN_FILE', `${empNo} appears more than once in this file`);
            seenEmployeeNos.add(empNo);
            if (user.isVacant === true) return bad('SEAT_IS_VACANT', 'Vacant seats are filled with assign, not link');
            if (user.employee_no === empNo) {
                return results.push({ index, ref, action, status: 'skipped', code: 'ALREADY_LINKED', seat_id: user._id });
            }
            if (user.employee_no && !relink) {
                return bad('LINKED_TO_OTHER', `Already linked to ${user.employee_no}. Send relink:true to change it`);
            }
            const owner = ownerByEmployeeNo.get(empNo);
            if (owner && owner._id !== user._id) return bad('EMPLOYEE_NO_IN_USE', `${empNo} is already linked to ${owner.email}`);
            planned.push({ index, ref, action, user, empNo });
            return results.push({ index, ref, action, status: dry_run ? 'would_link' : 'pending', seat_id: user._id });
        }

        // open
        if (user.employee_no) return bad('LINKED', 'This account is linked to a person; HRIS vacates it automatically');
        if (user.isVacant === true) {
            return results.push({ index, ref, action, status: 'skipped', code: 'ALREADY_VACANT', seat_id: user._id });
        }
        planned.push({ index, ref, action, user });
        return results.push({ index, ref, action, status: dry_run ? 'would_open' : 'pending', seat_id: user._id });
    });

    if (!dry_run) {
        for (const p of planned) {
            const slot = results.find((r) => r.index === p.index);
            try {
                const now = new Date().toISOString();
                if (p.action === 'link') {
                    await graph.mutation(
                        updateQl(USER_REF('lnk_user'), {
                            where: { _id: { _eq: p.user._id } },
                            set: { employee_no: p.empNo, dateModified: today() },
                        }),
                        updateQl(HISTORY_REF('lnk_close'), {
                            where: { seat_id: { _eq: p.user._id }, vacated_at: { _is_null: true } },
                            set: { vacated_at: now, vacated_reason: 'relinked', vacated_by: actor },
                        }),
                        historyInsert('lnk_hist', {
                            _id: generateUUID(),
                            seat_id: p.user._id,
                            employee_no: p.empNo,
                            staff_name: `${p.user.firstName ?? ''} ${p.user.lastName ?? ''}`.trim(),
                            role_short_code: p.user.role?.shortCode ?? null,
                            branch_code: seatBranchCode(p.user),
                            assigned_at: now,
                            assigned_by: actor,
                        }),
                    );
                    slot.status = 'linked';
                } else {
                    await graph.mutation(...vacateStatements({
                        seat: p.user,
                        reason: 'import_open',
                        actor,
                        branchCode: seatBranchCode(p.user),
                        alias: 'op',
                    }));
                    removeProfileFile(p.user.profile);
                    slot.status = 'opened';
                }
            } catch (err) {
                slot.status = 'error';
                slot.code = 'WRITE_FAILED';
                slot.message = String(err?.message ?? err);
            }
        }
    }

    const count = (s) => results.filter((r) => r.status === s).length;
    return sendJson(res, {
        success: true,
        dry_run,
        summary: {
            rows: rows.length,
            linked: count('linked'), opened: count('opened'),
            would_link: count('would_link'), would_open: count('would_open'),
            skipped: count('skipped'), errors: count('error'),
        },
        results,
    });
}
