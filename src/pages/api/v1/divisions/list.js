import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const divisions = await db
            .collection('divisions')
            .aggregate([
                { $addFields: { 
                    divisionIdStr: { $toString: '$_id' }
                } },
                {
                    $lookup: {
                        from: "regions",
                        localField: "divisionIdStr",
                        foreignField: "divisionId",
                        pipeline: [
                            {
                                $project: {
                                    name: '$name'
                                }
                            }
                        ],
                        as: "regions"
                    }
                },
                {
                    $lookup: {
                        from: "users",
                        localField: "divisionIdStr",
                        foreignField: "divisionId",
                        pipeline: [
                            { $match: { $expr: {$eq: ['$role.shortCode', 'deputy_director']} } },
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
        divisions: divisions
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}