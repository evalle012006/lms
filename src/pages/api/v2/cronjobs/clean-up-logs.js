import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { handleCron } from '@/lib/cron-guard';
import { withRetry } from '@/lib/retry';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

// Hasura cron: delete lms_logs older than 3 days. (The DB logger transport is currently disabled in logger.js,
// so this only clears rows written before that.)
export default apiHandler({
    post: (req, res) => handleCron(req, res, 'clean-up-logs', () => cleanUp(req), { message: 'done clean up logs in background' }),
});

async function cleanUp(req) {
    // scheduled_time comes from the Hasura payload — avoids locale string parsing
    const scheduledTime = req.body?.scheduled_time;
    const currentDate = (scheduledTime ? moment(scheduledTime) : moment()).utcOffset('+08:00').format('YYYY-MM-DD');
    const to_date = moment(currentDate).subtract(3, 'd').format('YYYY-MM-DD');

    await withRetry(() => graph.mutation(
        deleteQl(createGraphType('lms_logs', 'id')('result'), { created_dt: { _lt: to_date } })
    ));
    return { before: to_date };
}
