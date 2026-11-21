/**
 * GET /api/v2/hris/branches
 * -------------------------
 * Original requirement #1 (part 2): HRIS reads the LMS branch list so it can
 * map its own branch codes to LMS branches.
 *
 * Auth: x-hris-api-key (see src/services/hris-handler.js)
 */
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { hrisHandler } from '@/services/hris-handler';
import { sendJson } from '@/lib/hris-seat';

const graph = new GraphProvider();

const BRANCH_TYPE = createGraphType('branches', `
    _id code name address email phoneNumber areaId regionId divisionId
`)('branches');

export default hrisHandler({ get: listBranches });

async function listBranches(req, res) {
    const branches = await graph
        .query(queryQl(BRANCH_TYPE, { order_by: [{ code: 'asc' }] }))
        .then((r) => r.data?.branches ?? []);

    return sendJson(res, {
        success: true,
        count: branches.length,
        branches: branches.map((b) => ({
            lms_id: b._id,
            code: b.code,
            name: b.name,
            address: b.address ?? null,
            email: b.email ?? null,
            phone: b.phoneNumber ?? null,
            areaId: b.areaId ?? null,
            regionId: b.regionId ?? null,
            divisionId: b.divisionId ?? null,
        })),
    });
}
