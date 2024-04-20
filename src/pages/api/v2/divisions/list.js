import { DIVISION_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const DIVISION_TYPE = (alias) => createGraphType('divisions', `
${DIVISION_FIELDS}
regions { _id name }
managers (where: {  
    role: {
        _contains: {
            shortCode: "deputy_director"
        }
    }
}) { _id firstName lastName email }
`)(alias ?? 'divisions');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const divisions = await graph.query(
        queryQl(DIVISION_TYPE(), {})
    ).then(res => res.data.divisions)
     .then(divisions => divisions.map(d => ({
        ... d,
        managerIds: d.managers.map(u => u._id),
        regionIds: d.regions.map(r => r._id),
     })))


    response = {
        success: true,
        divisions: divisions
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}