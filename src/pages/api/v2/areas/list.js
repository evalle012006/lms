import { AREA_FIELDS, BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const AREA_TYPE = (alias) => createGraphType('areas', `
${AREA_FIELDS}
managers (where: {
    role: {
        _contains: {
            shortCode: "area_admin"
        }
    }
}) { _id firstName lastName email }
branches { _id name code }

`)(alias ?? 'areas');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const areas = await graph.query(
        queryQl(AREA_TYPE(), {})
    ).then(res => res.data.areas.map(a => ({
        ... a,
        managerIds: a.managers.map(a => a._id),
        branchIds: a.branches.map(b => b._id),
    })))
    response = {
        success: true,
        areas: areas
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}