/**
 * POST /api/v2/hris/assign
 * ------------------------
 * HRIS admin picked an account in the dropdown. This links it to the staff member.
 *   mode 'assign' : the account is a VACANT seat. It is already reset; the new holder gets a temp password.
 *   mode 'link'   : the account is an existing UNLINKED account. It is linked as-is: password, biometrics
 *                   and settings are kept; name/phone/position are refreshed from HRIS. No password issued.
 *
 * Body
 *   {
 *     "seat_id": "<users._id of a vacant seat>",
 *     "actor":   "admin@ambercash"            // optional, for the audit trail
 *     "staff": { id, employee_no, first_name, last_name, position, branch_code,
 *                status, contact, email, ... }  // HRIS snapshot, same shape sync.js takes
 *   }
 *
 * Guards (all server-side, HRIS cannot bypass them)
 *   - staff must be Active and have an employee_no
 *   - staff.position must map to an LMS role (hris-role-map.js)
 *   - the account must be unlinked, managed (not admin/cashier/finance), and have THAT role
 *   - branch-scoped roles: the account's branch code (users.designatedBranch) must equal the staff member's branch code
 *
 * If the staff member already holds another seat, that seat is vacated in the SAME
 * transaction (one person, one seat).
 *
 * Response (mode 'assign') includes `temp_password` ONCE. It is not stored or logged: the
 * HRIS admin relays it, and the user must change it on first login. Mode 'link' returns none.
 *
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { generateTempPassword } from '@/lib/generate-password';
import { hrisHandler } from '@/services/hris-handler';
import { resolveLmsRole, MANAGED_ROLES, BRANCH_SCOPED_ROLES } from '@/lib/hris-role-map';
import {
    USER_REF, HISTORY_REF, SEAT_FIELDS, loadBranches, loadSeatById, vacateStatements, historyInsert,
    mirrorRowFor, mirrorUpsert, assignSet, refreshSet, seatBranchCode, seatView, removeProfileFile, sendJson,
    normalizeEmployeeNo, normalizeCode,
} from '@/lib/hris-seat';

const bcrypt = require('bcryptjs');
const graph = new GraphProvider();

export default hrisHandler({ post: assignSeat });

const fail = (res, code, message, extra = {}) => sendJson(res, { success: false, code, message, ...extra });

async function assignSeat(req, res) {
    const { seat_id, staff, actor = 'hris' } = req.body ?? {};

    if (!seat_id || !staff?.id) return fail(res, 'BAD_REQUEST', 'seat_id and staff.id are required');

    const employeeNo = normalizeEmployeeNo(staff.employee_no);
    if (!employeeNo) return fail(res, 'NO_EMPLOYEE_NO', 'This staff member has no employee_no in HRIS');

    if (String(staff.status ?? '').trim().toLowerCase() !== 'active') {
        return fail(res, 'STAFF_NOT_ACTIVE', 'Only Active staff can be given an LMS seat');
    }

    const resolved = resolveLmsRole(staff.position);
    if (!resolved.role) {
        return fail(res, 'POSITION_NOT_SYNCABLE',
            `Position "${staff.position}" is not mapped to an LMS role`, { reason: resolved.reason });
    }

    const [branches, seat] = await Promise.all([loadBranches(graph), loadSeatById(graph, seat_id)]);
    if (!seat) return fail(res, 'SEAT_NOT_FOUND', 'Seat not found');

    const seatRole = seat.role?.shortCode;
    if (!MANAGED_ROLES.includes(seatRole) || seat.root === true) {
        return fail(res, 'SEAT_NOT_MANAGED', 'That account is not managed by HRIS');
    }

    const viewCtx = { branchesByCode: branches.byCode };

    // Idempotent: the same person already has this account
    if (seat.employee_no === employeeNo) {
        return sendJson(res, { success: true, already_assigned: true, seat: seatView(seat, viewCtx) });
    }

    // Target is either a VACANT seat (reset, gets a temp password) or an existing UNLINKED account
    // (linked as-is). An account linked to someone else is never available.
    if (seat.employee_no) return fail(res, 'SEAT_NOT_AVAILABLE', 'That account is already linked to another person');
    const mode = seat.isVacant === true ? 'assign' : 'link';
    if (seatRole !== resolved.role) {
        return fail(res, 'ROLE_MISMATCH', `Seat role is ${seatRole}, staff position maps to ${resolved.role}`);
    }

    if (BRANCH_SCOPED_ROLES.includes(seatRole)) {
        const branch = branches.byCode.get(normalizeCode(staff.branch_code));
        if (!branch) return fail(res, 'BRANCH_NOT_FOUND', `Branch code "${staff.branch_code}" does not exist in LMS`);
        const seatCode = seatBranchCode(seat);
        if (!seatCode) return fail(res, 'SEAT_BRANCH_UNKNOWN', 'That account has no branch set in LMS');
        if (seatCode !== normalizeCode(branch.code)) {
            return fail(res, 'BRANCH_MISMATCH', 'That account belongs to a different branch than the staff member');
        }
    }

    // The seat this person holds today (moves are vacate + assign in one transaction)
    const [current] = await graph
        .query(queryQl(createGraphType('users', SEAT_FIELDS)('current_seat'), {
            where: { employee_no: { _eq: employeeNo } },
        }))
        .then((r) => r.data?.current_seat ?? []);

    const tempPassword = mode === 'assign' ? generateTempPassword() : null;
    const passwordHash = tempPassword ? bcrypt.hashSync(tempPassword, bcrypt.genSaltSync(8), null) : null;
    const now = new Date().toISOString();
    const normalizedStaff = { ...staff, employee_no: employeeNo };
    const staffName = `${staff.first_name ?? ''} ${staff.last_name ?? ''}`.trim();

    const statements = [];

    if (current && current._id !== seat._id) {
        if (!MANAGED_ROLES.includes(current.role?.shortCode) || current.root === true) {
            return fail(res, 'CURRENT_SEAT_NOT_MANAGED', 'The staff member is linked to an account HRIS may not move');
        }
        statements.push(...vacateStatements({
            seat: current,
            reason: 'reassigned',
            actor,
            branchCode: seatBranchCode(current),
            alias: 'old',
        }));
    }

    statements.push(
        // defensive: close any stray open history row on the target seat
        updateQl(HISTORY_REF('hist_close'), {
            where: { seat_id: { _eq: seat._id }, vacated_at: { _is_null: true } },
            set: { vacated_at: now, vacated_reason: 'superseded', vacated_by: actor },
        }),
        // claim: only succeeds while the account is still in the state we read it in
        updateQl(USER_REF('claim'), {
            where: mode === 'assign'
                ? { _id: { _eq: seat._id }, isVacant: { _eq: true } }
                : { _id: { _eq: seat._id }, isVacant: { _eq: false }, employee_no: { _is_null: true } },
            set: mode === 'assign'
                ? assignSet({ staff: normalizedStaff, passwordHash })
                : { ...refreshSet(normalizedStaff), employee_no: employeeNo },
        }),
        historyInsert('hist_new', {
            _id: generateUUID(),
            seat_id: seat._id,
            hris_id: String(staff.id),
            employee_no: employeeNo,
            staff_name: staffName,
            role_short_code: seatRole,
            branch_code: seatBranchCode(seat),
            assigned_at: now,
            assigned_by: actor,
        }),
        mirrorUpsert('mirror', [mirrorRowFor(normalizedStaff, now)]),
    );

    const result = await graph.mutation(...statements);

    if ((result.data?.claim?.affected_rows ?? 0) !== 1) {
        // Someone else took the seat between our read and our write. If this was a move,
        // the old seat is already vacated (that was intended); pick another seat and retry.
        return fail(res, 'SEAT_TAKEN', 'That account was taken by someone else. Pick another one.');
    }

    if (current && current._id !== seat._id) removeProfileFile(current.profile);

    return sendJson(res, {
        success: true,
        mode,
        seat: seatView({ ...seat, isVacant: false, employee_no: employeeNo, firstName: staff.first_name, lastName: staff.last_name },
            viewCtx),
        temp_password: tempPassword,
        must_change_password: mode === 'assign',
        vacated_previous: current && current._id !== seat._id ? seatView(current, viewCtx) : null,
    });
}
