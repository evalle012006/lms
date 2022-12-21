import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchId, groupId, loId } = req.query;
    const date = moment(new Date()).format('YYYY-MM-DD');

    const loans = await db
        .collection('loans')
        .aggregate([
            { $match: {$expr: { $and: [
                {$or: [{$eq: ['$dateGranted', date]}, {$eq: ['$status', 'pending']}]}, {$eq: ['$groupId', groupId]}
            ]}} },
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

    response = {
        success: true,
        loans: loans
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
