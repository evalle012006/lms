/**
 * GET /api/v2/hris/users
 * ----------------------
 * Original requirement #1 (part 1): HRIS reads LMS users' _id and email.
 * Extended with the seat state so HRIS (or an admin) can see who is linked.
 *
 * Query params (optional): ?state=linked|vacant|unlinked
 *   linked   = employee_no is set
 *   vacant   = isVacant = true
 *   unlinked = legacy accounts: no employee_no and not vacant
 *
 * Never returns password hashes or biometric data. Root accounts are excluded.
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { hrisHandler } from '@/services/hris-handler';
import { sendJson, NOT_ROOT } from '@/lib/hris-seat';

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
    _id email firstName lastName status position loNo role
    designatedBranch employee_no isVacant
`)('users');

export default hrisHandler({ get: listUsers });

async function listUsers(req, res) {
    const { state } = req.query;
    const where = { ...NOT_ROOT };

    if (state === 'linked')   where.employee_no = { _is_null: false };
    if (state === 'vacant')   where.isVacant = { _eq: true };
    if (state === 'unlinked') { where.employee_no = { _is_null: true }; where.isVacant = { _eq: false }; }

    const users = await graph
        .query(queryQl(USER_TYPE, { where, order_by: [{ lastName: 'asc' }] }))
        .then((r) => r.data?.users ?? []);

    return sendJson(res, {
        success: true,
        count: users.length,
        users: users.map((u) => ({
            lms_id: u._id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            status: u.status,
            position: u.position,
            loNo: u.loNo === null || u.loNo === undefined ? null : Number(u.loNo),
            roleShortCode: u.role?.shortCode ?? null,
            designatedBranch: u.designatedBranch ?? null, // branch code (area admins: a JSON list)
            employee_no: u.employee_no ?? null,
            isVacant: u.isVacant === true,
        })),
    });
}
