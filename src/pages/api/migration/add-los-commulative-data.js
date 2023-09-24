import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: addLOSCommulative
});

async function addLOSCommulative(req, res) {
    const { db } = await connectToDatabase();

    const data = req.body;

    const result = await db.collection('losTotals').insertOne({...data});

    response = { success: true, result: result };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}