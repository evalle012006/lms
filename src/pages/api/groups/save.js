import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { getCurrentDate } from '@/lib/utils';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const ObjectId = require('mongodb').ObjectId;
    // const { name, branchId, day, dayNo, time, groupNo, capacity, loanOfficerId, loanOfficerName, occurence, availableSlots } = req.body;
    const groupData = req.body;

    const { db } = await connectToDatabase();

    const branch = await db
        .collection('branches')
        .find({_id: ObjectId(groupData.branchId)})
        .toArray();

    const groups = await db
        .collection('groups')
        .find({ name: groupData.name, branchId: groupData.branchId })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (groups.length > 0) {
        response = {
            error: true,
            fields: ['name', 'branchId'],
            message: `Group with the name "${groupData.name}" already exists in branch "${branch[0].name}"`
        };
    } else {
        const group = await db.collection('groups').insertOne({
            ...groupData,
            dateAdded: moment(getCurrentDate()).format('YYYY-MM-DD')
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