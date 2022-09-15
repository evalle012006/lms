import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();

    const {groupId, branchId} = req.query;

    let statusCode = 200;
    let response = {};
    let clients;

    if (groupId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { groupId: groupId } },
                {
                    $lookup: {
                        from: "loans",
                        localField: "_id",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "loans"
                    }
                }
            ])
            .toArray();
    } else if (branchId) {
        clients = await db
            .collection('client')
            .aggregate([
                { $match: { branchId: branchId } },
                {
                    $lookup: {
                        from: "loans",
                        localField: "_id",
                        foreignField: "clientId",
                        pipeline: [
                            { $match: { "status": "active" } }
                        ],
                        as: "loans"
                    }
                }
            ])
            .toArray();
    } else {
        clients = await db
            .collection('client')
            .aggregate([
                {
                    $lookup: {
                        from: "loans",
                        localField: "_id",
                        foreignField: "clientId",
                        as: "loans"
                    }
                }
            ])
            .toArray();
    }
    
    response = {
        success: true,
        clients: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
