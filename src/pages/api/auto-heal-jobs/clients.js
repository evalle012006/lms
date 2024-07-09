import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: updateClients
});

async function updateClients(req, res) {
    const { db } = await connectToDatabase();

    const clients = await db.collection('client').aggregate([
        { $match: { $expr: { $and: [
            {$eq: ['$status', 'closed']},
            {$or: [{$eq: ['$oldLoId', null]}, {$eq: ['$oldGroupId', null]}]}
        ] } } },
        { $addFields: { clientIdStr: { $toString: '$_id' }} },
        {
            $lookup: {
                from: "loans",
                let: { clientId: '$clientIdStr' },
                pipeline: [
                    { $match: { $expr: { $and: [ {$eq: ['$clientId', '$$clientId']}, {$eq: ['$status', 'closed']} ] } } }
                ],
                as: "allLoans"
            }
        }
    ]).toArray();

    const promise = await new Promise(async (resolve) => {
        const response = await Promise.all(clients.map(async (client) => {
            const clientId = client._id;
            const allLoans = client.allLoans;
            if (allLoans.length > 0) {
                const loan = allLoans[allLoans.length - 1];
                await db.collection('client').updateOne({ _id: clientId }, { $set: { oldLoId: loan.loId, oldGroupId: loan.groupId } });
            }
        }));

        resolve(response);
    });

    if (promise) {
        response = { success: true };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// update active client no groupId and loId
// async function updateClients(req, res) {
//     const { db } = await connectToDatabase();

//     const clients = await db.collection('client').aggregate([
//         { $match: { $expr: { $and: [
//             {$eq: ['$status', 'active']},
//             {$or: [{$eq: ['$loId', null]}, {$eq: ['$groupId', null]}]}
//         ] } } },
//         {
//             $lookup: {
//                 from: "loans",
//                 let: { clientId: '$_id' },
//                 pipeline: [
//                     { $match: { $expr: { $and: [ {$eq: ['$clientId', '$$clientId']}, {$ne: ['$status', 'closed']} ] } } }
//                 ],
//                 as: "allLoans"
//             }
//         }
//     ]).toArray();

//     const promise = await new Promise(async (resolve) => {
//         const response = await Promise.all(clients.map(async (client) => {
//             const clientId = client._id;
//             const allLoans = client.allLoans;

//             if (allLoans.length > 0) {
//                 const loan = allLoans[0];
//                 await db.collection('client').updateOne({ _id: clientId }, { $set: { loId: loan.loId, groupId: loan.groupId, branchId: loan.branchId, remediated: true } });
//             } else {
//                 await db.collection('client').updateOne({ _id: clientId }, { $set: { oldLoId: client.loId, oldGroupId: client.groupId, loId: null, groupId: null, status: "closed", remediated: true } });
//             }
//         }));

//         resolve(response);
//     });

//     if (promise) {
//         response = { success: true };
//     }

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }