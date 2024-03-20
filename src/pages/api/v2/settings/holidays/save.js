import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const holidayData = req.body;

    const { db } = await connectToDatabase();

    const holiday = await db
        .collection('holiday')
        .find({ date: holidayData.date })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (holiday.length > 0) {
        response = {
            error: true,
            fields: ['date'],
            message: `Holiday with date "${holidayData.date}" already exists`
        };
    } else {
        const holiday = await db.collection('holidays').insertOne({
            ...holidayData,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
        });

        response = {
            success: true,
            holiday: holiday
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}