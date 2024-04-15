import { AREA_FIELDS, REGION_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const USER_TYPE = (alias) => createGraphType('users', `_id`)(alias ?? 'users');
const AREA_TYPE = (alias) => createGraphType('areas', `_id`)(alias ?? 'areas');
const BRANCHES_TYPE = (alias) => createGraphType('branches', '_id')(alias ?? 'branches');
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

    await graph.mutation(
        updateQl(REGION_TYPE(), {
            set: { name: region.name },
            where: { _id: { _eq: region._id } }
        }),
        updateQl(USER_TYPE('delete_region_managers'), {
            set: { regionId: null },
            where: { regionId: { _eq: region._id } }
        }),
        updateQl(USER_TYPE('update_region_managers'), {
            set: { regionId: region._id },
            where: { _id: { _in: region.managerIds } }
        }),

        updateQl(AREA_TYPE('delete_region_areas'), {
            set: { regionId: null },
            where: { regionId: { _eq: region._id } }
        }),
        updateQl(AREA_TYPE('update_region_areas'), {
            set: { regionId: region._id },
            where: { _id: { _in: region.areaIds } }
        }),

        // update branches base from regions
        updateQl(BRANCHES_TYPE('delete_region_branch'), {
            set: { regionId: null },
            where: { regionId: { _eq: region._id } }
        }),
        updateQl(BRANCHES_TYPE('update_region_branch'), {
            set: { regionId: region._id },
            where: { areaId: { _in: region.areaIds } }
        }),
    )
    .then(res => res.data.regions.returning)

    await getRegion({
        query: { _id: region._id }
    }, res)
}