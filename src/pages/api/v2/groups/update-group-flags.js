import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    get: updateGroup
});

async function updateGroup(req, res) {
    let response;
    let statusCode = 200;

    // await db.collection('groups').updateMany({ submitted: true }, {$set: { submitted: false }});
    console.log('running...')

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}