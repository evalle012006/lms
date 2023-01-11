import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getWeekDaysCount } from '@/lib/utils';
import moment from 'moment';

export default apiHandler({
    post: updateCCData
});

async function updateCCData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};

    const loans = await db.collection('cashCollections').find().toArray();

    if (loans.length > 0) {
        loans.map(async loan => {
            let temp = {...loan};
            let loanGroup = await db.collection('groups').find({_id: ObjectId(loan.groupId)}).toArray();

            if (loanGroup.length > 0) {
                loanGroup = loanGroup[0];

                temp.loId = loanGroup.loanOfficerId;
                temp.groupName = loanGroup.name;

                await updateLoan(temp);
            }
        });
    }

    response = { success: true, loans: loans };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateLoan(loan) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const loanId = loan._id;
    delete loan._id;

    const loanResp = await db
        .collection('cashCollections')
        .updateOne(
            { _id: ObjectId(loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false });

    return loanResp;
}
