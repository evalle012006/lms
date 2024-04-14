import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};
    let branches;

    const { currentUserId, branchCode } = req.query;

    if (branchCode) {
        const data = await db
            .collection('branches')
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
                {
                    $sort: { code: 1 }
                }
            ])
            .toArray();

        branches = data.map(branch => {
            let temp = {...branch};
            temp.noOfLO = temp.noOfLO.length > 0 ? temp.noOfLO[0] : {};
            delete temp.noOfLO;

            return temp;
        });
    } else if (currentUserId) {
        // const codes = branchCodes.trim().split(",");
        const user = await db.collection('users').find({ _id: new ObjectId(currentUserId) }).toArray();
        if (user.length > 0) {
            let codes = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await db.collection('branches').find({ areaId: user[0].areaId }).toArray();
                codes = branches.map(branch => branch.code);
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await db.collection('branches').find({ regionId: user[0].regionId }).toArray();
                codes = branches.map(branch => branch.code);
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await db.collection('branches').find({ divisionId: user[0].divisionId }).toArray();
                codes = branches.map(branch => branch.code);
            }

            const data = await db.collection('branches')
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
                    {
                        $sort: { code: 1 }
                    }
                ])
                .toArray();

            branches = data.map(branch => {
                let temp = {...branch};
                temp.noOfLO = temp.noOfLO.length > 0 ? temp.noOfLO[0] : {};
                delete temp.noOfLO;
    
                return temp;
            });
        }
    } else {
        const data = await db
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
                {
                    $sort: { code: 1 }
                }
            ])
            .toArray();

        branches = data.map(branch => {
            let temp = {...branch};
            temp.noOfLO = temp.noOfLO.length > 0 ? temp.noOfLO[0] : {};
            delete temp.noOfLO;

            return temp;
        });

    }
    
    response = {
        success: true,
        branches: branches
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
