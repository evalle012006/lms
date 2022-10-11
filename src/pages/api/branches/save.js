import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name, code, phoneNumber, email, address } = req.body;

    const { db } = await connectToDatabase();

    const branches = await db
        .collection('branches')
        .find({ code: code })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (branches.length > 0) {
        response = {
            error: true,
            fields: ['code'],
            message: `Branch with the code "${code}" already exists`
        };
    } else {
        const branch = await db.collection('branches').insertOne({
            name: name,
            code: code,
            email: email,
            phoneNumber: phoneNumber,
            address: address,
            dateAdded: moment(new Date()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            branch: branch
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}