import { AREA_FIELDS, BRANCH_FIELDS, USER_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
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
        branchIds: area.branches.map(b => b._id),
    })));

    response = { success: true, area };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateArea(req, res) {

    const updateArea = req.body;

    await graph.mutation(
        updateQl(AREA_TYPE(), {
            set: {
                name: updateArea.name
            },
            where: { _id: { _eq: updateArea._id } }
        })
    );

    await getArea({ query: { _id: updateArea._id } }, res);
}