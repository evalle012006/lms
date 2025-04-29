import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const regions = await db
            .collection('regions')
            .aggregate([
                { $addFields: { 
                    regionIdStr: { $toString: '$_id' }
                } },
                {
                    $lookup: {
                        from: "areas",
                        localField: "regionIdStr",
                        foreignField: "regionId",
                        pipeline: [
                            {
                                $project: {
                                    name: '$name'
                                }
                            }
                        ],
                        as: "areas"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "regionIdStr",
                        foreignField: "regionId",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'regional_manager']} } },
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
                { $project: { regionIdStr: 0 } }
            ])
            .toArray();


    response = {
        success: true,
        regions: regions
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}