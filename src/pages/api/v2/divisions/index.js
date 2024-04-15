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
        }),

        updateQl(USER_TYPE('remove_division_managers'), {
            set: { divisionId: null },
            where: { divisionId: { _eq: _id } }
        }),
        updateQl(USER_TYPE('update_division_managers'), {
            set: { divisionId: _id },
            where: { _id: { _in: division.managerIds } }
        }),

        updateQl(REGION_TYPE('remove_division_regions'), {
            set: { divisionId: null },
            where: { divisionId: { _eq: _id } }
        }),
        updateQl(REGION_TYPE('update_division_regions'), {
            set: { divisionId: _id },
            where: { _id: { _in: division.regionIds } }
        }),

        updateQl(AREA_TYPE('remove_division_areas'), {
            set: { divisionId: null },
            where: { divisionId: { _eq: _id } }
        }),
        updateQl(AREA_TYPE('update_division_areas'), {
            set: { divisionId: _id },
            where: { regionId: { _in: division.regionIds } }
        }),

        updateQl(BRANCH_TYPE('remove_division_branches'), {
            set: { divisionId: null },
            where: { divisionId: { _eq: _id } }
        }),
        updateQl(BRANCH_TYPE('update_division_branches'), {
            set: { divisionId: _id },
            where: { regionId: { _in: division.regionIds } }
        })
    );

    // log resp
    console.log(resp)

    getDivision({
        query: { _id }
    }, res)
}