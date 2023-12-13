import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();

    const { groupId } = req.query;

    let statusCode = 200;
    let response = {};
    const data = await db.collection('loans')
                        .aggregate([
                            { $match: { groupId: groupId, maturedPD: true, status: 'closed', pastDue: { $gt: 0 } } },
                            { $addFields: { clientIdObj: { $toObjectId: '$clientId' } } },
                            {
                                $lookup: {
                                    from: 'client',
                                    localField: 'clientIdObj',
                                    foreignField: '_id',
                                    pipeline: [
                                        { $project: { _id: '$_id', name: '$fullName' } }
                                    ],
                                    as: 'client'
                                }
                            },
                            { $project: { clientIdObj: 0 } }
                        ])
                        .toArray();
    
    response = {
        success: true,
        data: data
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

export const config = {
    api: {
      bodyParser: {
        sizeLimit: '20mb',
      },
    },
}