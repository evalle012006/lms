import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS) ('groups');

export default apiHandler({
    get: getGroup,
    post: updateGroup
});

async function getGroup(req, res) {
    const { _id = null } = req.query;
    
    let statusCode = 200;
    let response = {};

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: { _id: { _eq: _id } }
        })
    ).then(res => res.data.groups);

    response = { success: true, group };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateGroup(req, res) {
    
    let statusCode = 200;
    let response = {};

    const group = req.body;
    const groupId = group._id ?? null;
    delete group._id;

    await graph.mutation(
        updateQl(GROUP_TYPE, {
            set: {
                ... group
            },
            where: {
                _id: { _eq: groupId }
            }
        })
    )

    response = { success: true, group };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}