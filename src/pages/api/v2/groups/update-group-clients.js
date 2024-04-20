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

const LOAN_TYPE = createGraphType('loans', `
slotNo
`)

export default apiHandler({
    post: updateGroup
});

async function updateGroup(req, res) {
    let response;
    let statusCode = 200;

    const groups = await graph.query(
        queryQl(GROUP_TYPE, {})
    ).then(res => res.data.groups ?? []);

    const updates = groups.map(async group => {
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

        await graph.mutation(
            updateQl(LOAN_TYPE, {
                _set: update,
                where: {
                    _id: { _eq: group._id }
                }
            })
        );
    });

    await Promise.all(updates);

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}