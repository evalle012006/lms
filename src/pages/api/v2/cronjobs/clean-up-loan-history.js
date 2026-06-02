import { getCurrentDate } from '@/lib/date-utils';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

export default apiHandler({
    post: cleanup
});

async function cleanup(req, res) {
    let response;
    let statusCode = 200;

    // FIX 1: Use scheduled_time from payload for accurate date reference
    // This avoids locale string parsing issues and timezone edge cases
    const scheduledTime = req.body?.scheduled_time;
    const currentDate = scheduledTime
        ? moment(scheduledTime).utcOffset('+08:00').format('YYYY-MM-DD')
        : moment().utcOffset('+08:00').format('YYYY-MM-DD');

    // FIX 2: Keep 3 days of history (was 2)
    const to_date = moment(currentDate).subtract(3, 'd').format('YYYY-MM-DD');

    await graph.mutation(
        deleteQl(createGraphType('loans_history', '_id')('result'), {
            created_dt: {
                _lt: to_date
            }
        })
    );

    response = { success: true, message: 'done clean up loan history in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}