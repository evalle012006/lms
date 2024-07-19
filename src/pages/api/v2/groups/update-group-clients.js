import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

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

const GROUP_MUTATION_TYPE = createGraphType('groups', `_id`);

export default apiHandler({
    post: updateGroup
});

async function updateGroup(req, res) {
    let response;
    let statusCode = 200;

    const groups = await graph.query(
        queryQl(GROUP_TYPE, {})
    ).then(res => res.data.groups ?? []);

    const mutationQl = [];
    const updates = groups.map(async group => {
        const loans = group.loans;

        const update = {
            status: group.status,
            noOfClients: group.loans.length,
            availableSlots: group.availableSlots,
        }

        
        if (loans.length > 0) {
            let availableSlots = [];
            for (let i = 1; i <= 40; i++) {
                availableSlots.push(i);
            }
            
            loans.map(loan => {
                availableSlots = availableSlots.filter(as => as != loan.slotNo);
            })

            update.availableSlots = availableSlots;
        }

        if (update.noOfClients == group.capacity) {
            update.status = 'full';
        } else {
            update.status = 'available';
        }

        mutationQl.push(
            updateQl(GROUP_MUTATION_TYPE('group_' + (mutationQl.length + 1)), {
                set: {
                    ... update,
                },
                where: {
                    _id: { _eq: group._id }
                }
            })
        )
        
    });

    await Promise.all(updates);
    await graph.mutation( ... mutationQl );

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}