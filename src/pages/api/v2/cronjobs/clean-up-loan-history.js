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

    const currentDate = getCurrentDate();
    const to_date = moment(currentDate).subtract(2, 'd');

    await graph.mutation(
        deleteQl(createGraphType('loans_history', '_id')('result'), {
            created_dt: {
                _lt: moment(to_date).format('YYYY-MM-DD')
            }
        })
    );


    response = { success: true, message: 'done clean up loan history in background' };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}