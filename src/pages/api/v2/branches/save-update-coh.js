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

    // ADDED: server-side is the authoritative gate for "at least 0" —
    // the client's cohValid check (BranchClosingDocumentsModal.js) is UX
    // only and can be bypassed by a direct API call. Reject anything that
    // isn't a valid non-negative number before touching the DB.
    const numericAmount = Number(data.amount);
    if (data.amount === null || data.amount === undefined || data.amount === '' || isNaN(numericAmount) || numericAmount < 0) {
        return res.status(200).json({
            success: false,
            message: 'A valid Cash on Hand amount (0 or greater) is required.'
        });
    }

    if (!data.branchId || !data.dateAdded) {
        return res.status(200).json({
            success: false,
            message: 'branchId and dateAdded are required.'
        });
    }

    const branchCOH = await graph.query(
        queryQl(BRANCH_COH_TYPE, {
            where: { branchId: { _eq: data.branchId },  dateAdded: { _eq: data.dateAdded } }
        })
    ).then(res => res.data.results);

    let response = {};
    let statusCode = 200;

    let updatedData;

    // ADDED: breakdown is optional — the confirmed design keeps `amount`
    // as the directly-typed, authoritative total. breakdown is supporting
    // detail only, never validated against amount, and can be null/empty.
    const breakdown = Array.isArray(data.breakdown) ? data.breakdown : null;

    if (branchCOH.length > 0) {
        const cohId = branchCOH[0]._id;

        [updatedData] = await graph.mutation(
            updateQl(BRANCH_COH_TYPE, {
                set: {
                    amount: numericAmount,
                    breakdown,
                    modifiedBy: data.modifiedBy,
                    modifiedDateTime: new Date(),
                },
                where: { _id: { _eq: cohId } },
            })
        ).then(res => res.data.results.returning);
    } else {
        [updatedData] = await graph.mutation(
            insertQl(BRANCH_COH_TYPE, {
                objects: [{
                    _id: generateUUID(),
                    amount: numericAmount,
                    breakdown,
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