import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;

const currentDate = moment().format('YYYY-MM-DD');

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    // const { db } = await connectToDatabase();
    // const { summary, ids } = req.body;
    const data = req.body;

    // let error = false;

    // const promise = await new Promise(async (resolve) => {
    //     const response = await Promise.all(ids.map(async (id) => {
    //         const groupSummary = await db.collection('groupCashCollections').find({ groupId: id, dateAdded: currentDate }).toArray();

    //         if (groupSummary.length > 0) {
    //             if (groupSummary[0].status === 'pending') {
    //                 error = true;
    //             }
    //         }
    //     }));

    //     resolve(response);
    // });

    // if (promise) {
    //     if (error) {
    //         response = { error: true, message: "One or more group/s transaction is not yet closed."};
    //     } else {
            switch (data.losType) {
                case 'year-end':
                    await saveUpdateYearEnd(data);
                    break;
                case 'daily':
                    await saveUpdateDaily(data);
                    break;
                case 'commulative':
                    await saveUpdateCommulative(data);
                    break;
                default:
                    break;
            }
        // }
    // }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


async function saveUpdateYearEnd(total) {
    const { db } = await connectToDatabase();
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, month: 12, year: total.year, losType: 'year-end' }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        resp = await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDate
            } }
        );
    } else {
        resp = await db.collection('losTotals').insertOne(
            { ...total, dateAdded: moment().format('YYYY-MM-DD') }
        );
    }

    response = { success: true, response: resp };
}


async function saveUpdateDaily(total) {
    const { db } = await connectToDatabase();
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, dateAdded: currentDate, losType: 'daily' }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDate
            } }
        );
    } else {
        await db.collection('losTotals').insertOne(
            { ...total, dateAdded: moment().format('YYYY-MM-DD') }
        );
    }

    response = { success: true, response: resp };
}

async function saveUpdateCommulative(total) {
    const { db } = await connectToDatabase();
    let resp;

    let losTotal = await db.collection('losTotals').find({ userId: total.userId, month: total.month, year: total.year, losType: 'commulative' }).toArray();

    if (losTotal.length > 0) {
        losTotal = losTotal[0];
        await db.collection('losTotals').updateOne(
            { _id: losTotal._id},
            { $set: {
                ...losTotal,
                data: total.data,
                dateModified: currentDate
            } }
        );
    } else {
        await db.collection('losTotals').insertOne(
            { ...total, dateAdded: moment().format('YYYY-MM-DD') }
        );
    }

    response = { success: true, response: resp };
}
