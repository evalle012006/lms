import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();
    const data = req.body;

    switch (data.losType) {
        case 'year-end':
            await saveUpdateYearEnd(data);
            break;
        case 'daily':
            const filter = data.data.day === data.currentDate ? false : true;
            const cashCollections = await db.collection('cashCollections').find({ loId: data.userId, dateAdded: data.data.day, occurence: data.occurence }).toArray();

            if (cashCollections.length === 0) {
                response = { error: true, message: "One or more group/s have no transaction for today."};
            } else {
                await saveUpdateDaily(data, filter);
            }
            break;
        case 'commulative':
            await saveUpdateCommulative(data);
            break;
        default:
            break;
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


async function saveUpdateYearEnd(total) {
    const { db } = await connectToDatabase();
    const currentDateStr = total.currentDate;
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, month: 12, year: total.year, losType: 'year-end', occurence: total.occurence }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        resp = await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDateStr
            } }
        );
    } else {
        const finalData = {...total};
        delete finalData.currentDate;
        resp = await db.collection('losTotals').insertOne(
            { ...finalData, dateAdded: currentDateStr }
        );
    }

    response = { success: true, response: resp };
}


async function saveUpdateDaily(total, filter) {
    const { db } = await connectToDatabase();
    const currentDateStr = total.currentDate;
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, dateAdded: total.data.day, losType: 'daily', occurence: total.occurence }).toArray();

    if (filter) {
        if (losTotal.length > 0) {
            losTotal = losTotal[0];
            await db.collection('losTotals').updateOne(
                { _id: losTotal._id},
                { $set: {
                    ...losTotal,
                    data: total.data,
                    dateModified: total.data.day,
                    modifiedBy: 'admin',
                    modifiedDate: currentDateStr
                } }
            );
        } else {
            const finalData = {...total};
            delete finalData.currentDate;
            await db.collection('losTotals').insertOne(
                { 
                    ...finalData, 
                    dateAdded: total.data.day, 
                    insertedBy: 'admin',
                    insertedDate: currentDateStr
                }
            );
        }
    } else {        
        if (losTotal.length > 0) {
            losTotal = losTotal[0];
            await db.collection('losTotals').updateOne(
                { _id: losTotal._id},
                { $set: {
                    ...losTotal,
                    data: total.data,
                    dateModified: currentDateStr
                } }
            );
        } else {
            const finalData = {...total};
            delete finalData.currentDate;
            await db.collection('losTotals').insertOne(
                { ...finalData, dateAdded: currentDateStr }
            );
        }
    }

    response = { success: true, response: resp };
}

async function saveUpdateCommulative(total) {
    const { db } = await connectToDatabase();
    const currentDateStr = total.currentDate;
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, month: total.month, year: total.year, losType: 'commulative', occurence: total.occurence }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDateStr
            } }
        );
    } else {
        const finalData = {...total};
        delete finalData.currentDate;
        await db.collection('losTotals').insertOne(
            { ...finalData, dateAdded: currentDateStr }
        );
    }

    response = { success: true, response: resp };
}
