import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: resetLO
});

async function resetLO(req, res) {
    const { db } = await connectToDatabase();
    const { loId } = req.query;

    let statusCode = 200;
    let response = {};

    await db.collection('loans').deleteMany({ insertedBy: "migration", loId: loId });
    await db.collection('client').deleteMany({ insertedBy: "migration", loId: loId });
    await db.collection('losTotals').deleteMany({ insertedBy: "migration", userId: loId });

    response = {
        success: true
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}