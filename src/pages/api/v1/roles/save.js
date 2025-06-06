import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/date-utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { name, shortCode } = req.body;

    const { db } = await connectToDatabase();

    const roles = await db
        .collection('roles')
        .find({ shortCode: shortCode })
        .toArray();

    const counter = await db
        .collection('counters')
        .find({ tableName: 'roles' })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (roles.length > 0) {
        response = {
            error: true,
            fields: ['shortCode'],
            message: `Role with the short code "${shortCode}" already exists`
        };
    } else {
        const role = await db.collection('roles').insertOne({
            name: name,
            shortCode: shortCode,
            rep: counter[0].lastCounter + 1,
            system: false,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            rep: counter[0].lastCounter + 1,
            role: role
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}