import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const data = req.body;

    const lo = await db.collection('users').find({ _id: new ObjectId(data.userId) }).toArray();
    let officeType;
    if (lo.length > 0) {
        if (lo[0].role.rep == 4) {
            officeType = parseInt(lo[0].loNo) < 11 ? 'main' : 'ext';
        }
    }

    switch (data.losType) {
        case 'year-end':
            await saveUpdateYearEnd(data, officeType);
            break;
        case 'daily':
            const filter = data.data.day === data.currentDate ? false : true;
            const cashCollections = await db.collection('cashCollections').find({ loId: data.userId, dateAdded: data.data.day, occurence: data.occurence }).toArray();

            if (cashCollections.length === 0) {
                response = { error: true, message: "One or more group/s have no transaction for today."};
            } else {
                await saveUpdateDaily(data, filter, officeType);
            }
            break;
        case 'commulative':
            await saveUpdateCommulative(data, officeType);
            break;
        default:
            break;
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


async function saveUpdateYearEnd(total, officeType) {
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
            { ...finalData, dateAdded: currentDateStr, officeType: officeType }
        );
    }

    response = { success: true, response: resp };
}


async function saveUpdateDaily(total, filter, officeType) {
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
                    insertedDate: currentDateStr,
                    officeType: officeType
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
                { ...finalData, dateAdded: currentDateStr, officeType: officeType }
            );
        }
    }

    response = { success: true, response: resp };
}

async function saveUpdateCommulative(total, officeType) {
    const { db } = await connectToDatabase();
    const currentDateStr = total.currentDate;
    let resp;
    let loGroup = officeType;
    
    if (officeType == null || officeType == undefined) { // it means it is BM
        loGroup = total.officeType;
    }

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, month: total.month, year: total.year, losType: 'commulative', officeType: loGroup }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        if (losTotal.hasOwnProperty('insertedBy') && losTotal.insertedBy === 'migration') {
            // don't override...
        } else {
            await db.collection('losTotals').updateOne(
                { _id: losTotal._id},
                { $set: {
                    ...losTotal,
                    data: total.data,
                    dateModified: currentDateStr
                } }
            );
        }
    } else {
        const finalData = {...total};
        delete finalData.currentDate;
        await db.collection('losTotals').insertOne(
            { ...finalData, dateAdded: currentDateStr, officeType: loGroup }
        );
    }

    response = { success: true, response: resp };
}
