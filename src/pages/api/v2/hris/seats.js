/**
 * GET /api/v2/hris/seats?position=<HRIS position>&branch_code=<code>&employee_no=<optional>
 * -----------------------------------------------------------------------------------------
 * Feeds the HRIS "LMS account" dropdown: every LMS account a staff member could be linked to,
 * for their position and branch. Two kinds (field `kind`):
 *   vacant   = an open seat (already reset; assigning it issues a temp password)
 *   unlinked = an existing LMS account nobody has linked to HRIS yet (linked as-is, password kept)
 * Accounts already linked to someone (employee_no set) are never offered. LMS owns the position -> role
 * map, so HRIS only sends the raw position text.
 *
 *   branch_manager / loan_officer: filtered by branch code. The code is the same in HRIS branches.code,
 *     LMS branches.code and LMS users.designatedBranch.
 *   area_admin / regional_manager / deputy_director: not branch-scoped. All accounts of that role are
 *     returned, labelled with their area/region/division, and the HRIS admin chooses.
 *
 * Response
 *   { success, syncable, reason?, role, branch_found?, seats: [...], current: seat|null }
 *   current = the seat this employee_no already holds (if any)
 *
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { hrisHandler } from '@/services/hris-handler';
import { resolveLmsRole, BRANCH_SCOPED_ROLES } from '@/lib/hris-role-map';
import {
    loadBranches, SEAT_FIELDS, NOT_ROOT, seatView, sendJson, normalizeCode, normalizeEmployeeNo, branchFilter,
} from '@/lib/hris-seat';

const graph = new GraphProvider();

export default hrisHandler({ get: listSeats });

async function loadScopeNames(ids) {
    const names = new Map();
    if (!ids.length) return names;
    const run = (table, alias) =>
        graph
            .query(queryQl(createGraphType(table, '_id name')(alias), { where: { _id: { _in: ids } } }))
            .then((r) => r.data?.[alias] ?? []);
    const [areas, regions, divisions] = await Promise.all([
        run('areas', 'scope_areas'), run('regions', 'scope_regions'), run('divisions', 'scope_divisions'),
    ]);
    [...areas, ...regions, ...divisions].forEach((x) => names.set(x._id, x.name));
    return names;
}

async function listSeats(req, res) {
    const { position, branch_code } = req.query;
    const empNo = normalizeEmployeeNo(req.query.employee_no);
    const resolved = resolveLmsRole(position);
    const branches = await loadBranches(graph);

    // The seat this person already holds, if any
    let current = null;
    if (empNo) {
        const [u] = await graph
            .query(queryQl(createGraphType('users', SEAT_FIELDS)('current_seat'), {
                where: { employee_no: { _eq: empNo } },
            }))
            .then((r) => r.data?.current_seat ?? []);
        if (u) current = seatView(u, { branchesByCode: branches.byCode });
    }

    if (!resolved.role) {
        return sendJson(res, {
            success: true, syncable: false, reason: resolved.reason, role: null, seats: [], current,
        });
    }

    const and = [
        NOT_ROOT,
        { employee_no: { _is_null: true } }, // vacant seats AND unlinked legacy accounts
        { role: { _contains: { shortCode: resolved.role } } },
    ];

    if (BRANCH_SCOPED_ROLES.includes(resolved.role)) {
        const branch = branches.byCode.get(normalizeCode(branch_code));
        if (!branch) {
            return sendJson(res, {
                success: true, syncable: true, role: resolved.role, branch_found: false, seats: [], current,
            });
        }
        and.push(branchFilter(branch));
    }

    const rows = await graph
        .query(queryQl(createGraphType('users', SEAT_FIELDS)('open_seats'), {
            where: { _and: and },
            order_by: [{ isVacant: 'desc' }, { loNo: 'asc' }, { email: 'asc' }],
        }))
        .then((r) => r.data?.open_seats ?? []);

    const scopeIds = [...new Set(rows.flatMap((u) => [u.areaId, u.regionId, u.divisionId]).filter(Boolean))];
    const namesById = BRANCH_SCOPED_ROLES.includes(resolved.role) ? new Map() : await loadScopeNames(scopeIds);

    return sendJson(res, {
        success: true,
        syncable: true,
        role: resolved.role,
        branch_found: BRANCH_SCOPED_ROLES.includes(resolved.role) ? true : undefined,
        count: rows.length,
        vacant: rows.filter((u) => u.isVacant === true).length,
        unlinked: rows.filter((u) => u.isVacant !== true).length,
        seats: rows.map((u) => seatView(u, { branchesByCode: branches.byCode, namesById })),
        current,
    });
}
