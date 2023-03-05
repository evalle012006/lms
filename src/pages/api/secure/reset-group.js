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

    const { groupId } = req.body;
    console.log(groupId)
    // delete transactionals tables
    await db.collection('cashCollections').deleteMany({groupId: groupId});
    await db.collection('groupCashCollections').deleteMany({groupId: groupId});
    await db.collection('loans').deleteMany({groupId: groupId});
    await db.collection('losTotals').deleteMany({groupId: groupId});


    // reset tables
    await db.collection('client').updateMany({groupId: groupId}, {
        $set: { status: 'pending', delinquent: false, mcbuHistory: [] }
    });

    await db.collection('groups').updateMany({_id: ObjectId(groupId)}, {
        $set: { 
            status: 'available',
            noOfClients: 0,
            availableSlots: [
                1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
                21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40
              ]
        }
    });
    

    response = {success: true};

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}