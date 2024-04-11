import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', `
${GROUP_FIELDS}
branch {
    name
}
loans (where: { status: { _in: ["active", "pending", "completed"] } }) {
    slotNo
}
`)('groups');

const LOAN_TYPE = createGraphType('loans', `
slotNo
`)

export default apiHandler({
    post: updateGroup,
    get: getAllGroups
});

async function updateGroup(req, res) {
    let statusCode = 200;
    let response = {};
    let groupResp;

    const { groupId, oldGroupId } = req.body;

    if (oldGroupId) {
        const [group] = await graph.query(
            queryQl(GROUP_TYPE, { where: { _id: { _eq: oldGroupId } } })
        ).then(res => res.data.groups)

        const noOfClients = group.noOfClients - 1;
        const capacity = group.capacity;

        let status = group.status;

        if (noOfClients === capacity) {
            status = 'full';
        }

        const groupData = group;
        delete groupData._id;

        await graph.mutation(
            updateQl(GROUP_TYPE, {
                _set: {
                    status,
                    noOfClients
                },
                where: {
                    _id: { _eq: oldGroupId }
                }
            })
        )
    }

    
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, { where: { _id: { _eq: groupId } } })
    ).then(res => res.data.groups)

    let status = group.status;
    let noOfClients = group.noOfClients;
    const capacity = group.capacity;

    if (status === 'full' || noOfClients >= capacity) {
        response = {
            error: true,
            message: `"${group.name}" is already full. Please select another group.`
        };
    } else {
        noOfClients = noOfClients + 1;

        if (noOfClients === capacity) {
            status = 'full';
        }

        await graph.mutation(
            updateQl(GROUP_TYPE, {
                _set: {
                    status,
                    noOfClients
                },
                where: {
                    _id: { _eq: groupId }
                }
            })
        )
    }

    response = { success: true, group: groupResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getAllGroups(req, res) {
    let statusCode = 200;
    let response = {};

    const branchId = "639e80c8aeb5b756302b6cf6";

    const groups = await graph.query(
        queryQl(GROUP_TYPE, {
            where: {
                branchId: { _eq: branchId },
                occurence: {  _eq: "daily" }
            }
        })
    ).then(res => res.data.groups ?? [])
    

    response = { success: true, groups };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}