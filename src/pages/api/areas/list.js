import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const areas = await db
            .collection('areas')
            .aggregate([
                { $addFields: { 
                    areaIdStr: { $toString: '$_id' }
                } },
                {
                    $lookup: {
                        from: "branches",
                        localField: "areaIdStr",
                        foreignField: "areaId",
                        pipeline: [
                            {
                                $project: {
                                    name: '$name',
                                    code: '$code'
                                }
                            }
                        ],
                        as: "branches"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "areaIdStr",
                        foreignField: "areaId",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'area_admin']} } },
                            {
                                $project: {
                                    firstName: '$firstName',
                                    lastName: '$lastName',
                                    email: '$email'
                                }
                            }
                        ],
                        as: "managers"
                    }
                },
                { $project: { areaIdStr: 0 } }
            ])
            .toArray();


    response = {
        success: true,
        areas: areas
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}