import { BRANCH_COH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';

const graph = new GraphProvider();
const BRANCH_COH_TYPE = createGraphType('branchCOH',`${BRANCH_COH_FIELDS}`)('results');

export default apiHandler({
    post: save
});

async function save(req, res) {
    const data = req.body;
    
    const branchCOH = await graph.query(
        queryQl(BRANCH_COH_TYPE, {
            where: { branchId: { _eq: data.branchId },  dateAdded: { _eq: data.dateAdded } }
        })
    ).then(res => res.data.results);

    let response = {};
    let statusCode = 200;

    let updatedData;

    if (branchCOH.length > 0) {
        const cohId = branchCOH[0]._id;

        [updatedData] = await graph.mutation(
            updateQl(BRANCH_COH_TYPE, {
                set: { amount: data.amount, modifiedBy: data.modifiedBy, modifiedDateTime: new Date() },
                where: { _id: { _eq: cohId } },
            })
        ).then(res => res.data.results.returning);
    } else {
        [updatedData] = await graph.mutation(
            insertQl(BRANCH_COH_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    amount: data.amount,
                    branchId: data.branchId,
                    insertedBy: data.insertedBy,
                    dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD'),
                }]
            })
        ).then(res => res.data.results.returning);
    }

    response = {
        success: true,
        data: updatedData
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}