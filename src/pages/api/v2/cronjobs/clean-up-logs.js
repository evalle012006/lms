import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import moment from 'node_modules/moment/moment';

const graph = new GraphProvider();

export default apiHandler({
    post: updateLoans
});

async function updateLoans(req, res) {
    let response;
    let statusCode = 200;

    // FIX: Use scheduled_time from payload — avoids locale string parsing
    const scheduledTime = req.body?.scheduled_time;
    const currentDate = scheduledTime
        ? moment(scheduledTime).utcOffset('+08:00').format('YYYY-MM-DD')
        : moment().utcOffset('+08:00').format('YYYY-MM-DD');

    const to_date = moment(currentDate).subtract(3, 'd').format('YYYY-MM-DD');

    await graph.mutation(
        deleteQl(createGraphType('lms_logs', 'id')('result'), {
            created_dt: {
                _lt: to_date
            }
        })
    );

    response = { success: true, message: 'done clean up logs in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}