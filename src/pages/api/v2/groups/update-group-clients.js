import { GROUP_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';

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

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default apiHandler({
    post: updateGroup
});

async function updateGroup(req, res) {
    let response;
    let statusCode = 200;

    logger.debug({cron: `start fetching groups`});
    const groups = await graph.query(
        queryQl(GROUP_TYPE, {})
    ).then(res => res.data.groups ?? []);

    logger.debug({cron: `fetch groups count`, count: groups.length});
    logger.debug({cron: 'start group update'});

    (async () => {
        let batch_update = [];

        for(const group of groups) {
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

            batch_update.push(
                updateQl(GROUP_MUTATION_TYPE('group_update_' + batch_update.length), {
                    set: {
                        ... update,
                    },
                    where: {
                        _id: { _eq: group._id }
                    }
                })
            );

            if(batch_update.length == 2000) {
                logger.debug({cron: 'start upddate batch groups', batch_count: batch_update.length});
                const update_res = await graph.mutation(
                    ... batch_update
                )
                batch_update = [];
                await sleep(500);

                logger.debug({cron: 'done update batch groups', error_count: update_res.errors?.length ?? 0 });
            }

        }

        if(batch_update.length > 0) {
            logger.debug({cron: 'start upddate batch groups', batch_count: batch_update.length});
            const update_res = await graph.mutation(
                ... batch_update
            )
            batch_update = [];
            await sleep(500);

            logger.debug({cron: 'done update batch groups', error_count: update_res.errors?.length ?? 0 });
        }

        logger.debug({cron: 'completed batch update groups'});
    })();
    
    
    response = { success: true, message: 'update groups run in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}