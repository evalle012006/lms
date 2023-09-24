import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: processLOSummary,
    get: getLOSummary
});

async function processLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { loId, mode, currentDate } = req.body;

    if (loId) {
        const cashCollectionCounts = await checkLoTransactions(loId, currentDate);
        if (cashCollectionCounts) {
            const noCollections = cashCollectionCounts.filter(cc => { 
                if (cc.cashCollections.length === 0) {
                    return cc;
                }
            });
            const hasDrafts = cashCollectionCounts.filter(cc => { 
                if ( cc.cashCollections.length > 0 && cc.cashCollections[0].hasDrafts > 0 ) {
                    return cc;
                }
            });

            if (mode === 'close' && noCollections?.length > 0) {
                response = { error: true, message: "Some groups have no current transactions for the selected Loan Officer." };
            } else if (mode === 'close' && hasDrafts?.length > 0) {
                response = { error: true, message: "Some groups have draft transactions for the selected Loan Officer." };
            } else {
                const result = await db.collection('cashCollections').updateMany(
                    {
                        loId: loId,
                        dateAdded: currentDate
                    }, {
                        $set: { groupStatus: mode === 'close' ? 'closed' : 'pending' }
                    });
        
                if (result.modifiedCount === 0) {
                    response = { error: true, message: "No transactions found for this Loan Officer." };
                } else {
                    response = { success: true };
                }
            }
        }
    } else {
        response = { error: true, message: "Loan Office Id not found." };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function getLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { groupIds, currentDate } = req.query;
    const ids = groupIds.split(',');

    const groups = await db.collection('cashCollections')
                            .find({ $expr: {
                                $and: [
                                    { $in: ['$groupId', ids] },
                                    { $eq: ['$dateAdded', currentDate] }
                                ]
                            } }).toArray();

    response = { success: true, data: groups }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const checkLoTransactions = async (loId, currentDate) => {
    const { db } = await connectToDatabase();

    return await db.collection('groups')
                    .aggregate([
                        { $match: { $expr: { $and: [ {$eq: ['$loanOfficerId', loId]}, {$gt: ['$noOfClients', 0]} ] } } },
                        { $addFields: { "groupIdStr": { $toString: "$_id" } } },
                        {
                            $lookup: {
                                from: "cashCollections",
                                let: { groupName: '$name' },
                                localField: "groupIdStr",
                                foreignField: "groupId",
                                pipeline: [
                                    { $match: { dateAdded: currentDate } },
                                    { $group: {
                                        _id: '$$groupName',
                                        count: { $sum: 1 },
                                        hasDrafts: { $sum: {
                                            $cond: {
                                                if: { $eq: ['$draft', true] },
                                                then: 1,
                                                else: 0
                                            }
                                        } }
                                    } }
                                ],
                                as: "cashCollections"
                            }
                        }
                    ])
                    .toArray();
}