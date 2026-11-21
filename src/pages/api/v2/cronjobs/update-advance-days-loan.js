import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { withRetry } from '@/lib/retry';
import logger from '@/logger';
import { LOAN_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType('loans', `${LOAN_FIELDS}`)('loans');
const LOAN_MUTATION_TYPE = createGraphType('loans', `_id`);

const BATCH_SIZE = 2000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Hasura cron: zero out advanceDays on every loan that has some. Runs in the background; result in cron_runs.
export default apiHandler({
    post: (req, res) => handleCron(req, res, 'update-advance-days-loan', updateLoans, {
        background: true, staleMinutes: 60, message: 'update loans run in background',
    }),
});

async function updateLoans() {
    logger.debug({ cron: 'start fetching loans' });
    const loans = await withRetry(() => graph.query(
        queryQl(LOAN_TYPE, { where: { advanceDays: { _gt: 0 } } })
    )).then(r => r.data.loans ?? []);
    logger.debug({ cron: 'fetch loans count', count: loans.length });

    let errors = 0;
    for (let i = 0; i < loans.length; i += BATCH_SIZE) {
        const batch = loans.slice(i, i + BATCH_SIZE).map((loan, n) =>
            updateQl(LOAN_MUTATION_TYPE('loan_update_' + n), { set: { advanceDays: 0 }, where: { _id: { _eq: loan._id } } })
        );
        logger.debug({ cron: 'start update batch loans', batch_count: batch.length });
        const res = await withRetry(() => graph.mutation(...batch));
        errors += res.errors?.length ?? 0;
        logger.debug({ cron: 'done update batch loans', error_count: res.errors?.length ?? 0 });
        await sleep(500);
    }

    logger.debug({ cron: 'completed batch update loans' });
    return { loans: loans.length, errors };
}
