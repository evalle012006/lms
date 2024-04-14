import { AREA_FIELDS, BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();

const USER_TYPE = (alias) => createGraphType('users', '_idd')( alias ?? 'users');
const BRANCH_TYPE = (alias) => createGraphType('branches', '_id')( alias ?? 'branches');

const AREA_TYPE = (alias) => createGraphType('areas', `
${AREA_FIELDS}
managers (where: {
    role: {
        _contains: {
            shortCode: "area_admin"
        }
    }
}) {
    ${USER_FIELDS}
}
branches { 
    ${BRANCH_FIELDS}
}

`)(alias ?? 'areas');

export default apiHandler({
    get: getArea,
    post: updateArea
});

async function getArea(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    const [area] = await graph.query(
        queryQl(AREA_TYPE(), {
            where: {
                _id: { _eq: _id }
            }
        })
    ).then(res => res.data.areas.map(area => ({
        ... area,
        managerIds: area.managers.map(u => u._id),
        branchids: area.branches.map(b => b_id),
    })));

    response = { success: true, area };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateArea(req, res) {

    const area = req.body;
    const areaId = area._id;
    delete area._id;


    await graph.mutation(
        updateQl(AREA_TYPE('update_area'), {
            set: {
                name: area.name,
                regionId: area.regionId,
                managerIds: area.managerIds,
                branchIds: area.branchIds,
            },
            where: {
                _id: { _eq: _id }
            }
        }),
        updateQl(USER_TYPE('delete_area_users'), {
            set: {
                areaId: null
            },
            where: {
                areaId: { _eq: areaId }
            }
        }),
        updateQl(USER_TYPE('update_area_users'), {
            set: {
                areaId
            },
            where: {
                _id: { _in: area.managerIds }
            }
        }),
        updateQl(BRANCH_TYPE('delete_branch_users'), {
            set: {
                branchId: null
            },
            where: {
                areaId: { _eq: areaId }
            }
        }),
        updateQl(BRANCH_TYPE('update_branch_users'), {
            set: {
                branchId
            },
            where: {
                _id: { _in: area.branchIds }
            }
        }),
    );

    await getArea({ query: { _id: areaId } }, res);
}