import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchCode } = req.query;
    let users;

    if (branchCode) {
        users = await db
            .collection('users')
            .aggregate( [
                { $match: {designatedBranch: branchCode } },
                {
                    $addFields: { "loId": { $toString: "$_id" } }
                },
                {
                    $lookup: {
                        from: 'groups',
                        localField: 'loId',
                        foreignField: "loanOfficerId",
                        pipeline: [
                            { $group: { _id: null, count: { $sum: 1 } } }
                        ],
                        as: 'groupCount'
                    }
                },
                { $project: { loId: 0 } }
            ])
            .project({ password: 0 })
            .toArray();
    }
    
    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
