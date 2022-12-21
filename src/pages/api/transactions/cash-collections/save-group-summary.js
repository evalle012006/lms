import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: save
});

async function save(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    const loan = req.body;

    const groupSummary = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: loan.groupId }).toArray();

    if (groupSummary.length === 0) {
        let group = await db.collection('groups').find({ _id: ObjectId(loan.groupId) }).toArray();

        if (group.length > 0) {
            group = group[0];

            const data = {
                branchId: loan.branchId,
                groupId: loan.groupId,
                groupName: group.name,
                loId: group.loanOfficerId,
                dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                insertBy: loan.insertedBy,
                mode: group.occurence,
                status: "pending"
            };
            
            await db.collection('groupCashCollections').insertOne({ ...data });

            response = { success: true, data: data };
        }
    }
    
    response = { success: true, data: groupSummary };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}