import { REGION_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const REGION_TYPE = (alias) => createGraphType('regions', `
${REGION_FIELDS}
areas {
    _id name
}
managers (where: {
    role: {
        _contains: {
            shortCode: "regional_manager"
        }
    }
}) { _id firstName lastName email }
`)(alias ?? 'regions');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const regions = await graph.query(
        queryQl(REGION_TYPE(), {})
    ).then(res => res.data.regions.map(r => ({
        ... r,
        managerIds: r.managers.map(u => u._id),
        areaIds: r.areas.map(a => a._id),
    })));
    

    response = {
        success: true,
        regions: regions
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}