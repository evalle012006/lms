import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getUser
});

async function getUser(req, res) {
    let statusCode = 200;

    const {id} = req.body;

    const response = {
        test: 'testing'
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}