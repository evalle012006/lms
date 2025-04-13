import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

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
        // .find({ _id: new ObjectId(_id)})
        .aggregate([
            { $match: { _id: new ObjectId(_id) } },
            {
                $lookup: {
                    from: "branches",
                    localField: "_id",
                    foreignField: "branchid",
                    as: "branch"
                }
            },
            {
                $lookup: {
                    from: "groups",
                    localField: "_id",
                    foreignField: "groupId",
                    as: "group"
                }
            },
            {
                $lookup: {
                    from: "clients",
                    localField: "_id",
                    foreignField: "clientId",
                    as: "client"
                }
            }
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

    const loanResp = await db
        .collection('loans')
        .updateOne(
            { _id: new ObjectId(loanId) }, 
            {
                $set: { ...loan }
            }, 
            { upsert: false });

    response = { success: true, loan: loanResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}