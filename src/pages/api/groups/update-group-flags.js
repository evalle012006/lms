import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: updateGroup
});

async function updateGroup(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    // await db.collection('groups').updateMany({ submitted: true }, {$set: { submitted: false }});
    console.log('running...')

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}