import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: reset
});

async function reset(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response = {};
    let statusCode = 200;

    const { loId } = req.body;
    
    // delete transactionals tables
    await db.collection('cashCollections').deleteMany({loId: loId});
    await db.collection('groupCashCollections').deleteMany({loId: loId});
    await db.collection('loans').deleteMany({loId: loId});
    await db.collection('losTotals').deleteMany({userId: loId});
    await db.collection('client').deleteMany({branchId: branchId});


    // reset tables
    // await db.collection('client').updateMany({loId: loId}, {
    //     $set: { status: 'pending', delinquent: false, mcbuHistory: [] }
    // });

    await db.collection('groups').updateMany({loanOfficerId: loId}, {
        $set: { 
            status: 'available',
            noOfClients: 0,
            availableSlots: [
                1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
                21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40
              ]
        }
    });

    // await db.collection('users').updateMany({ _id: new ObjectId(loId) }, {
    //     $unset: {
    //         transactionType: 1
    //     }
    // });

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}