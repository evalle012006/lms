import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { withRetry } from '@/lib/retry';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

// Hasura cron: delete loans_history snapshots older than 3 days.
export default apiHandler({
    post: (req, res) => handleCron(req, res, 'clean-up-loan-history', () => cleanup(req), { message: 'done clean up loan history in background' }),
});

async function cleanup(req) {
    // scheduled_time from the Hasura payload gives an accurate date reference (no locale/timezone edge cases)
    const scheduledTime = req.body?.scheduled_time;
    const currentDate = (scheduledTime ? moment(scheduledTime) : moment()).utcOffset('+08:00').format('YYYY-MM-DD');
    // keep 3 days of history
    const to_date = moment(currentDate).subtract(3, 'd').format('YYYY-MM-DD');

    await withRetry(() => graph.mutation(
        deleteQl(createGraphType('loans_history', '_id')('result'), { created_dt: { _lt: to_date } })
    ));
    return { before: to_date };
}
