import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', `
${GROUP_FIELDS}
`)('groups');


export default apiHandler({
    post: deleteGroup
});

async function deleteGroup(req, res) {
    const { _id = null } = req.body;

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            _id: { _eq: _id  }
        })
    ).then(res => res.data.groups);

    let statusCode = 200;
    let response = {};

    if(!group) {
        response = {
            error: true,
            message: `Group with id: "${_id}" not exists`
        };
    } else if(group.noOfClients > 0) {
        response = {
            error: true,
            message: `Groups has associated clients. Can't remove.`
        };
    } else {
        await graph.mutation(
            deleteQl(GROUP_TYPE, {
                _id: { _eq: _id }
            })
        );
        response = {
            success: true
        }
    }
    

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
