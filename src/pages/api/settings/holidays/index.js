import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getHoliday,
    post: updateHoliday
});

async function getHoliday(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};

    let holiday = await db.collection('holidays')
            .find({ _id: ObjectId(_id)})
            .toArray();
    
    response = { success: true, holiday: holiday[0] };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateHoliday(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};

    const holiday = req.body;
    const holidayId = holiday._id;
    delete holiday._id;

    const holidayResp = await db
        .collection('holidays')
        .updateOne(
            { _id: ObjectId(holidayId) }, 
            {
                $set: { ...holiday }
            }, 
            { upsert: false });

    response = { success: true, holiday: holidayResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}