import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { generateUUID, getCurrentDate } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';


const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', `
${GROUP_FIELDS}
branch {
    name
}
`)('groups');

export default apiHandler({
    post: save
});

async function save(req, res) {
    // const { name, branchId, day, dayNo, time, groupNo, capacity, loanOfficerId, loanOfficerName, occurence, availableSlots } = req.body;
    const groupData = req.body;
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: { name: { _eq: groupData.name }, branchId: { _eq: groupData.branchId } }
        })
    ).then(res => res.data.groups);

    let response = {};
    let statusCode = 200;

    if (!!group) {
        response = {
            error: true,
            fields: ['name', 'branchId'],
            message: `Group with the name "${groupData.name}" already exists in branch "${group.branch.name}"`
        };
    } else {
        const group = await graph.mutation(
            insertQl(GROUP_TYPE, {
                objects: [
                    {
                        ... groupData,
                        _id: generateUUID(),
                        dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
                    }
                ]
            })
        ).then(res => res.data.groups.returning?.[0]);

        response = {
            success: true,
            group: group
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}