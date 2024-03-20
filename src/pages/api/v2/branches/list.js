import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    let branches;

    const { branchCode, branchCodes } = req.query;

    if (branchCode) {
        branches = await db
            .collection('branches')
            // .find({ code: branchCode })
            // .sort({ code: 1 })
            .aggregate([
                { $match: { code: branchCode } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 4]} } },
                            { $group: {
                                _id: null,
                                count: { $sum: 1 }
                            } }
                        ],
                        as: "noOfLO"
                    }
                },
                { $unwind: '$noOfLO' },
                {
                    $sort: { code: 1 }
                }
            ])
            .toArray();
    } else if (branchCodes) {
        const codes = branchCodes.trim().split(",");
        branches = await db.collection('branches')
            // .find({ $expr: {$in: ["$code", codes]} })
            // .sort({ code: 1 })
            .aggregate([
                { $match: { $expr: {$in: ["$code", codes]} } },
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 4]} } },
                            { $group: {
                                _id: null,
                                count: { $sum: 1 }
                            } }
                        ],
                        as: "noOfLO"
                    }
                },
                { $unwind: '$noOfLO' },
                {
                    $sort: { code: 1 }
                }
            ])
            .toArray();
    } else {
        branches = await db
            .collection('branches')
            .aggregate([
                {
                    $lookup: {
                        from: "users",
                        localField: "code",
                        foreignField: "designatedBranch",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.rep', 4]} } },
                            { $group: {
                                _id: null,
                                count: { $sum: 1 }
                            } }
                        ],
                        as: "noOfLO"
                    }
                },
                { $unwind: '$noOfLO' },
                {
                    $sort: { code: 1 }
                }
            ])
            // .find()
            // .sort({ code: 1 })
            .toArray();

    }
    
    response = {
        success: true,
        branches: branches
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
