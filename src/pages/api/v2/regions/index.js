import { AREA_FIELDS, BRANCH_FIELDS, REGION_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const BRANCH_TYPE = (alias) => createGraphType('branches', '_id')(alias);
const USER_TYPE = (alias) => createGraphType('users', '_id') (alias);
const AREA_TYPE = (alias) => createGraphType('areas', `_id`)(alias);
const REGION_TYPE = (alias) => createGraphType('regions', `

${REGION_FIELDS}

areas {
    ${AREA_FIELDS}
}

managers (where: {
    role: {
        _contains: {
            shortCode: "regional_manager"
        }
    }
}) {
    ${USER_FIELDS}
}
`)(alias ?? 'regions');

export default apiHandler({
    get: getRegion,
    post: updateRegion
});

async function getRegion(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const [region] = await graph.query(
        queryQl(REGION_TYPE(), {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.regions)
     .then(regions => regions.map(region => ({
        ... region,
        managerIds: region.managers.map(u => u._id),
        areaIds: region.areas.map(a => a._id),
     })))
    

    response = { success: true, region };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateRegion(req, res) {
    const region = req.body;

    console.log(region);

    await graph.mutation(
        updateQl(REGION_TYPE(), {
            set: { 
                name: region.name,
                divisionId: region.divisionId,
            },
            where: { _id: { _eq: region._id } }
        }),
        updateQl(AREA_TYPE(), {
            set: {
                divisionId: region.divisionId,
            },
            where: { regionId: { _eq: region._id } }
        }),
        updateQl(BRANCH_TYPE(), {
            set: {
                divisionId: region.divisionId,
            },
             where: { regionId: { _eq: region._id } }
        }),
        updateQl(USER_TYPE(), {
            set: {
                divisionId: region.divisionId,
            },
            where: { regionId: { _eq: region._id } }
        })
    )
    .then(res => res.data.regions.returning)

    await getRegion({
        query: { _id: region._id }
    }, res)
}