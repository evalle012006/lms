import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import logger from '@/logger';
import moment from 'moment';
import { getCurrentDate } from '@/lib/date-utils';

export default apiHandler({
    get: getLoan,
    post: updateLoan
});

async function getLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};
    const loan = await db
        .collection('loans')
        .aggregate([
            { $match: { _id: new ObjectId(_id) } },
            {
                $addFields: {
                    "branchIdObj": { $toObjectId: "$branchId" },
                    "groupIdObj": { $toObjectId: "$groupId" },
                    "clientIdObj": { $toObjectId: "$clientId" }
                }
            },
            {
                $lookup: {
                    from: "branches",
                    localField: "branchIdObj",
                    foreignField: "_id",
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "groupIdObj",
                    foreignField: "_id",
                    as: "group"
                }
            },
            {
                $unwind: "$group"
            },
            {
                $lookup: {
                    from: "client",
                    localField: "clientIdObj",
                    foreignField: "_id",
                    as: "client"
                }
            },
            {
                $unwind: "$client"
            },
            { $project: { branchIdObj: 0, groupIdObj: 0, clientIdObj: 0 } }
        ])
        .toArray();
        
    response = { success: true, loan: loan[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const loan = req.body;
    const loanId = loan._id;
    delete loan._id;
    delete loan.group;
    logger.debug({page: `Updating Loan: ${loan.clientId}`, data: loan});
    let loanResp;
    const currentDate = moment(getCurrentDate()).format('YYYY-MM-DD');

    if (loan?.loanFor == 'tomorrow') {
        const tomorrowDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
        loan.dateOfRelease = tomorrowDate;
        
        loanResp = await db
            .collection('loans')
            .updateOne(
                { _id: new ObjectId(loanId) }, 
                {
                    $set: { ...loan }
                }, 
                { upsert: false });
    } else {
        loanResp = await db
            .collection('loans')
            .updateOne(
                { _id: new ObjectId(loanId) }, 
                {
                    $unset: { dateOfRelease: 1 },
                    $set: { ...loan }
                }, 
                { upsert: false });
    }

    await db.collection('cashCollections').updateMany({ loanId: loanId, status: { $in: ['tomorrow', 'pending'] } }, { $set: {currentReleaseAmount: loan.amountRelease} });

    response = { success: true, loan: loanResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}