import { getCurrentDate } from '@/lib/date-utils';
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

    const currentDate = getCurrentDate();
    const to_date = moment(currentDate).subtract(3, 'd');

    await graph.mutation(
        deleteQl(createGraphType('lms_logs', '_id')('result'), {
            create_dt: {
                _lt: moment(to_date).format('YYYY-MM-DD')
            }
        })
    );


    response = { success: true, message: 'done clean up logs in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}