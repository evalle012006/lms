import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getProgramTemplate
});

let statusCode = 200;
let response = {};
let success = true;

async function getProgramTemplate(req, res) {
    const { db } = await connectToDatabase();
    const { program } = req.query;

    const condition = program ? { code: program } : {};
    const data = await db
        .collection('programTemplates')
        .find(condition)
        .project({ _id: 0 })
        .toArray();

    response = { ...response, success, program: program ? data[0] : data };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}