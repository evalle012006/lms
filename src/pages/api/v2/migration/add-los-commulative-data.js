import { LOS_TOTALS_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();
const LOS_TOTAL_TYPE = createGraphType('los_totals', LOS_TOTALS_FIELDS) ('los_totals');

let response = {};
let statusCode = 200;

export default apiHandler({
    post: addLOSCommulative
});

async function addLOSCommulative(req, res) {
    const data = req.body;

    const [los] = await graph.query(
        queryQl(LOS_TOTAL_TYPE, {
            where: { 
                user_id: { _eq: data.userId },
                month: { _eq: data.month },
                year: { _eq: data.year },
             }
        })
    ).then(res => res.data.los_totals ?? []);

    let result;
    if (los) {
        result = await graph.mutation(
            updateQl(LOS_TOTAL_TYPE, {
                _set: {
                    data: data.data,
                    modifiedDateTime: new Date(),
                },
                where: {
                    id: { _eq: los._id }
                }
            })
        );
        
    } else {
        result = await graph.mutation(
            insertQl(LOS_TOTAL_TYPE, {
                objects: [{ ... data, _id: generateUUID(), }]
            })
        );
    }

    response = { success: true, result: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}