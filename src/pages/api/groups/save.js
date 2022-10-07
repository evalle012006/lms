import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { findUserByEmail } from './index';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    const { name, branchId, day, dayNo, time, groupNo, loanOfficerId, loanOfficerName, occurence, availableSlots } = req.body;

    const { db } = await connectToDatabase();

    const branch = await db
        .collection('branches')
        .find({_id: ObjectId(branchId)})
        .toArray();

    const groups = await db
        .collection('groups')
        .find({ name: name, branchId: branchId })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (groups.length > 0) {
        response = {
            error: true,
            fields: ['name', 'branchId'],
            message: `Group with the name "${name}" already exists in branch "${branch[0].name}"`
        };
    } else {
        const group = await db.collection('groups').insertOne({
            name: name,
            branchId: branchId,
            branchName: branch[0].name,
            day: day,
            dayNo: dayNo,
            time: time,
            groupNo: groupNo,
            loanOfficerId: loanOfficerId,
            loanOfficerName: loanOfficerName,
            occurence: occurence,
            status: 'available',
            capacity: occurence === 'daily' ? 25 : 30,
            noOfClients: 0,
            availableSlots: availableSlots,
            dateAdded: new Date()
        });

        response = {
            success: true,
            group: group
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}