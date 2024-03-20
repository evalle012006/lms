import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateSystemSettings,
    get: getSystemSettings
});

async function getSystemSettings(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};
    const system = await db.collection('settings').find().toArray();

    response = {
        success: true,
        system: system[0]
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateSystemSettings(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const system = req.body;
    const systemId = system._id;
    delete system._id;

    const systemResp = await db
        .collection('settings')
        .updateOne(
            { _id: new ObjectId(systemId) }, 
            {
                $set: { ...system }
            }, 
            { upsert: false });

    response = { success: true, system: systemResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}