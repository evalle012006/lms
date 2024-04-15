import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, deleteQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: resetLO
});

const graph = new GraphProvider();
const GROUP_TYPE = createGraphType('groups', '_id')('groups');
const CLIENT_TYPE = createGraphType('client', '_id')('client');
const LOS_TOTALS_TYPE = createGraphType('losTotals', '_id')('losTotals');

async function resetLO(req, res) {
    const { loId } = req.query;

    let statusCode = 200;
    let response = {};

    const where = { insertedBy: { _eq: "migration" }, loId: { _eq: loId } };
    await graph.mutation(
        deleteQl(GROUP_TYPE, where),
        deleteQl(CLIENT_TYPE, where),
        deleteQl(LOS_TOTALS_TYPE, where)
    );

    response = {
        success: true
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}