import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;

export default apiHandler({
    post: updateStatus
});

async function updateStatus(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const groups = await db.collection('groups')
            .aggregate([
                // { $match: { _id: new ObjectId('6508e41a561728d9075160f7') } },
                { $addFields: { groupIdStr: { $toString: '$_id' } } },
                {
                    $lookup: {
                        from: "loans",
                        localField: 'groupIdStr',
                        foreignField: 'groupId',
                        pipeline: [
                            { $match: { $expr: { $or: [ {$eq: ['$status', 'active']}, {$eq: ['$status', 'completed']}, {$eq: ['$status', 'pending']} ] } } }
                        ],
                        as: "loans"
                    }
                },
                { $project: { groupIdStr: 0 } }
            ])
            .toArray();

    groups.map(async group => {
        let temp = {...group};
        const loans = temp.loans;
        delete temp.loans;
        
        const loanSlotNumbers = loans.map(loan => loan.slotNo);
        const noOfClients = loanSlotNumbers.length;
        temp.availableSlots = temp.availableSlots.filter(s => !loanSlotNumbers.includes(s));
        temp.noOfClients = noOfClients;
        if (temp.capacity === noOfClients) {
            temp.status = 'full';
        }
        
        const groupId = group._id;
        delete temp._id;
        await db.collection('groups').updateOne({ _id: groupId }, { $set: {...temp} });
    });
    

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}