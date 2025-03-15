import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateGroup
});

// async function updateGroup(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;
//     let response;
//     let statusCode = 200;

//     const groups = await db.collection('groups').find().toArray();

//     groups.map(async group => {
//         let temp = {...group};

//         let availableSlots = [];
//         for (let i = 1; i <= 40; i++) {
//             availableSlots.push(i);
//         }
//         temp.availableSlots = availableSlots;
//         temp.noOfClients = 0;
//         temp.status = "available";

//         await db.collection('groups').updateOne({ _id: group._id }, {$set: {...temp}});
//     });

//     response = { success: true };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

async function updateGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let response;
    let statusCode = 200;

    const groups = await db.collection('groups').find().toArray();

    groups.map(async group => {
        let temp = {...group};

        const loans = await db.collection('loans').find({ groupId: temp._id + '', status: { $in: ['active', 'pending', 'completed'] } }).toArray();

        // if (loans.length > 0) {
            temp.noOfClients = loans.length;

            if (loans.length > 0) {
                let availableSlots = [];
                for (let i = 1; i <= 40; i++) {
                    availableSlots.push(i);
                }
                
                loans.map(loan => {
                    availableSlots = availableSlots.filter(as => as != loan.slotNo);
                })

                temp.availableSlots = availableSlots;
            }

            if (temp.noOfClients == temp.capacity) {
                temp.status = 'full';
            } else {
                temp.status = 'available';
            }


            delete temp._id;
            await db.collection('groups').updateOne(
                { _id: new ObjectId(group._id) },
                { $set: { ...temp } },
                { upsert: false }
            );
        // }
    });

    response = { success: true };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}