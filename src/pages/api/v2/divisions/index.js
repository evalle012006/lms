import { DIVISION_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const AREA_TYPE = (alias) => createGraphType('areas', '_id')(alias ?? 'areas');
const BRANCH_TYPE = (alias) => createGraphType('branches', '_id')(alias ?? 'branches');
const USER_TYPE  = (alias) => createGraphType('users', '_id')(alias ?? 'users');
const REGION_TYPE = (alias) => createGraphType('regions', '_id')(alias ?? 'regions');
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
    get: getDivision,
    post: updateDivision
});

async function getDivision(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const [division] = await graph.query(
        queryQl(DIVISION_TYPE(), {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.divisions)
     .then(divisions => divisions.map(d => ({
        ... d,
        managerIds: d.managers.map(u => u._id),
        regionIds: d.regions.map(r => r._id)
     })));

    response = { success: true, division };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateDivision(req, res) {
    const { _id, ... division } = req.body;
    const resp = await graph.mutation(
        updateQl(DIVISION_TYPE(), {
            set: {
                name: division.name
            },
            where: {
                _id: { _eq: _id }
            }
        })
    );

    // log resp
    console.log(resp)

    getDivision({
        query: { _id }
    }, res)
}