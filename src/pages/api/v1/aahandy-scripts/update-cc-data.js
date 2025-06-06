import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateCCData
});

async function updateCCData(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};


    const cashCollections = await db.collection('cashCollections').aggregate([
        { $match: { dateAdded: "2024-09-23", loanId: "undefined" } },
        {
            $lookup: {
                from: 'loans',
                localField: "clientId",
                foreignField: "clientId",
                pipeline: [
                    { $match: { status: { $in: ['active', 'completed', 'pending'] } } }
                ],
                as: 'loans'
            }
        }
    ]).limit(100).toArray();
    cashCollections.map(async cc => {
        let temp = {...cc};
        const activeLoan = cc.loans.find(l => l.status == 'active');
        const completedLoan = cc.loans.find(l => l.status == 'completed');
        const pendingLoan = cc.loans.find(l => l.status == 'pending');
        if (activeLoan) {
            temp.loanId = activeLoan._id + '';
            delete temp._id;
            await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
            console.log('Remediatted active loan for client: ', temp.clientId, 'cc _id: ', cc._id)
        } else if (completedLoan) {
            temp.loanId = completedLoan._id + '';
            delete temp._id;
            await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
            console.log('Remediatted completed loan for client: ', temp.clientId, 'cc _id: ', cc._id)
        } else if (pendingLoan) {
            temp.loanId = pendingLoan._id + '';
            delete temp._id;
            await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
            console.log('Remediatted pending loan for client: ', temp.clientId, 'cc _id: ', cc._id)
        } else {
            console.log('No active/completed loan for client: ', temp.clientId, 'cc _id: ', cc._id)
        }
    });

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections').aggregate([
//         { $match: { transferred: true, dateAdded: "2024-06-28" } },
//         { $addFields: { "loanIdObj": { $toObjectId: "$loanId" }, transferIdObj: { $toObjectId: "" } } },
//     ]).toArray();
//     cashCollections.map(async cc => {
//         let temp = {...cc};

//         // temp.oldLoanId = cc.oldLoanId + '';
//         temp.loanId = cc.loanId + '';
//         delete temp._id;
//         await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
//     });

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections').find({branchId: "651e1f85fe9e9b760e604bb0", slotNo: {$in: [4,5,6,7,8,9,10,12]}, dateAdded: {$in: ["2024-03-06", "2024-03-07"]} }).toArray();
//     console.log(cashCollections.length)
//     cashCollections.map(async cc => {
//         let temp = {...cc};

//         if (temp.dateAdded == '2024-03-06') {
//             delete temp._id;

//             if (temp.status !== 'closed' && temp.status !== 'pending') {
//                 if (temp.paymentCollection > 0 && temp.excess == 0 && temp.status == 'active') {
//                     temp.noOfPayments += 1;
//                     temp.mcbu += 10;
//                     temp.loanBalance = temp.loanBalance - temp.paymentCollection;

//                     if (temp.noOfPayments == 60) {
//                         temp.status = 'completed';
//                         temp.fullPaymentDate = '2024-03-07';
//                     }
//                 }
    
//                 temp.dateAdded = "2024-03-07";
//                 temp.modifiedRemarks = "wrong_delete";
    
//                 await db.collection('cashCollections').insertOne(temp);
//             }
//         }
//     });

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// fixed no currentReleaseAmount and loanCycle
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections')
//         .aggregate([
//             { $match: { "remarks.value": {$regex: /^reloaner/}, currentReleaseAmount: 0, status: "tomorrow" } },
//             // { $addFields: { "loanIdObj": { $toObjectId: "$loanId" } } },
//             {
//                 $lookup: {
//                     from: 'loans',
//                     localField: 'clientId',
//                     foreignField: 'clientId',
//                     pipeline: [
//                         {$match: { status: "active" }}
//                     ],
//                     as: 'loans'
//                 }
//             }
//         ]).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             delete temp.loans;
//             temp.loanCycle = cc.loans[0].loanCycle;
//             temp.currentReleaseAmount = cc.loans[0].loanRelease;
//             temp.modifiedRemarks = "remediated";

//             await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// adding groupDay on weekly transactions
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections')
//         .aggregate([
//             { $match: { occurence: 'weekly' } },
//             { $addFields: { "groupIdObj": { $toObjectId: "$groupId" } } },
//             {
//                 $lookup: {
//                     from: 'groups',
//                     localField: 'groupIdObj',
//                     foreignField: '_id',
//                     as: 'groups'
//                 }
//             }
//         ]).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             delete temp.groups;
//             delete temp.groupIdObj;
//             temp.groupDay = cc.groups[0].day;

//             await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }


// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections').find({ $expr: { 
//         $and: [
//             {$eq: ['$dateAdded', '2023-02-14']}, 
//             {$eq: ['$currentReleaseAmount', 6000]},
//             {$gt: ['$paymentCollection', 0]},
//             {$ne: ['$remarks.value', 'reloaner']}
//         ] 
//     } }).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             temp.currentReleaseAmount = 0;
//             temp.status = 'active';

//             await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }


// update amount release from history
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};


//     const cashCollections = await db.collection('cashCollections').find({ $expr: { $and: [{$eq: ['$history.amountRelease', 0]}, {$eq: ['$fullPaymentDate', '2023-02-20']}] } }).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             temp.history.amountRelease = temp.fullPayment;
//             temp.history.loanBalance = temp.paymentCollection;

//             await db.collection('cashCollections').updateOne({_id: cc._id}, {$set: {...temp}});
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// corrupted:
// taguig 1 lo2 1-31

// updating corrupted data on a date
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};

//     const newDate = '2023-01-31';

//     const cashCollections = await db.collection('cashCollections').find({groupId: '639e860636491596e49ed893', dateAdded: '2023-02-01' }).toArray();

//     if (cashCollections.length > 0) {
//         const newCollections = [];
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             // const exist = await db.collection('cashCollections').find({ clientId: cc.clientId, dateAdded: newDate }).toArray();

//             // if (exist.length === 0) {
//                 temp.dateAdded = newDate;
//                 temp.automated = 'fixes';
//                 delete temp._id;
//                 newCollections.push(temp);
//             // }
//         });

//         if (newCollections.length > 0) {
//             await db.collection('cashCollections').insertMany(newCollections);
//         }
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};

//     const cashCollections = await db.collection('cashCollections').find({ status: "completed" }).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};

//             const loans = await db.collection('loans').find({clientId: cc.clientId}).toArray();

//             if (loans.length > 0) {
//                 const active = loans.find(loan => loan.status === 'active' || loan.status === 'pending');

//                 if (active) {

//                     temp.status = active.status === "active" ? 'tomorrow' : 'pending';

//                     await db.collection('cashCollections').updateOne({ _id: cc._id }, { $set: {...temp} });
//                 }
//             }
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};

//     const cashCollections = await db.collection('cashCollections').find({ $expr: {$eq: ['$remarks.value', 'past due']} }).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};
//             const loans = await db.collection('loans').find({clientId: cc.clientId}).toArray();

//             if (loans.length > 0) {
//                 const active = loans.find(loan => loan.status === 'active' || loan.status === 'pending');
//                 if (active) {
//                     temp.currentReleaseAmount = active.amountRelease;

//                     await db.collection('cashCollections').updateOne({ _id: cc._id }, { $set: {...temp} });
//                 }
//             }
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// updating the current release amount
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};

//     const cashCollections = await db.collection('cashCollections').find({ status: 'tomorrow', currentReleaseAmount: 0 }).toArray();

//     if (cashCollections.length > 0) {
//         cashCollections.map(async cc => {
//             let temp = {...cc};
//             const loans = await db.collection('loans').find({clientId: cc.clientId}).toArray();

//             if (loans.length > 0) {
//                 const active = loans.find(loan => loan.status === 'active' || loan.status === 'pending');
//                 if (active) {
//                     temp.currentReleaseAmount = active.amountRelease;

//                     await db.collection('cashCollections').updateOne({ _id: cc._id }, { $set: {...temp} });
//                 }
//             }
//         });
//     }

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }


// adding new field
// async function updateCCData(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     let statusCode = 200;
//     let response = {};

//     const loans = await db.collection('cashCollections').find().toArray();

//     if (loans.length > 0) {
//         loans.map(async loan => {
//             let temp = {...loan};
//             let loanGroup = await db.collection('groups').find({_id: new ObjectId(loan.groupId)}).toArray();

//             if (loanGroup.length > 0) {
//                 loanGroup = loanGroup[0];

//                 temp.loId = loanGroup.loanOfficerId;
//                 temp.groupName = loanGroup.name;

//                 await updateLoan(temp);
//             }
//         });
//     }

//     response = { success: true, loans: loans };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

// async function updateLoan(loan) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;

//     const loanId = loan._id;
//     delete loan._id;

//     const loanResp = await db
//         .collection('cashCollections')
//         .updateOne(
//             { _id: new ObjectId(loanId) }, 
//             {
//                 $set: { ...loan }
//             }, 
//             { upsert: false });

//     return loanResp;
// }
