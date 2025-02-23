import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import { LOAN_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)('loans');
const LOAN_MUTATION_TYPE = createGraphType('loans', `_id`);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default apiHandler({
    post: updateLoans
});

async function updateLoans(req, res) {
    let response;
    let statusCode = 200;

    logger.debug({cron: `start fetching loans`});
    const loans = await graph.query(
        queryQl(LOAN_TYPE, {
            where: {
                advanceDays: { _gt: 0 }
            }
        })
    ).then(res => res.data.loans ?? []);

    logger.debug({cron: `fetch loans count`, count: loans.length});
    logger.debug({cron: 'start loans update'});

    (async () => {
        let batch_update = [];

        for(const loan of loans) {
            batch_update.push(
                updateQl(LOAN_MUTATION_TYPE('loan_update_' + batch_update.length), {
                    set: {
                        advanceDays: 0
                    },
                    where: {
                        _id: { _eq: loan._id }
                    }
                })
            );

            if(batch_update.length == 2000) {
                logger.debug({cron: 'start upddate batch loans', batch_count: batch_update.length});
                const update_res = await graph.mutation(
                    ... batch_update
                )
                batch_update = [];
                await sleep(500);

                logger.debug({cron: 'done update batch loans', error_count: update_res.errors?.length ?? 0 });
            }

        }

        if(batch_update.length > 0) {
            logger.debug({cron: 'start upddate batch loans', batch_count: batch_update.length});
            const update_res = await graph.mutation(
                ... batch_update
            )
            batch_update = [];
            await sleep(500);

            logger.debug({cron: 'done update batch loans', error_count: update_res.errors?.length ?? 0 });
        }

        logger.debug({cron: 'completed batch update loans'});
    })();
    
    
    response = { success: true, message: 'update loans run in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}