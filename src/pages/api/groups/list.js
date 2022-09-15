import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: updateGroup,
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { branchId, loId } = req.query;
    let groups;

    if (branchId && loId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, status: 'available', loanOfficerId: loId })
            .toArray();
    } else if (branchId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, status: 'available' })
            .toArray();
    } else {
        groups = await db
            .collection('groups')
            .find({ status: 'available' })
            .toArray();
    }
    
    response = {
        success: true,
        groups: groups
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateGroup(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = {};
    let groupResp;

    const { groupId, oldGroupId } = req.body;

    if (oldGroupId) {
        const group = await db.collection('groups').find({ _id: ObjectId(oldGroupId) }).toArray();
        const noOfClients = group.length > 0 && group[0].noOfClients - 1;
        const capacity = group.length > 0 && group[0].capacity;
        let status = group.length > 0 && group[0].status;

        if (noOfClients === capacity) {
            status = 'full';
        }

        const groupData = group[0];
        delete groupData._id;

        const oldGroupResp = await db
            .collection('groups')
            .updateOne(
                { _id: ObjectId(oldGroupId) }, 
                {
                    $set: {
                        ...groupData,
                        status: status,
                        noOfClients: noOfClients
                    }
                }, 
                { upsert: false }
            );
    }

    const group = await db.collection('groups').find({ _id: ObjectId(groupId) }).toArray();
    let status = group.length > 0 && group[0].status;
    let noOfClients = group.length > 0 && group[0].noOfClients;
    const capacity = group.length > 0 && group[0].capacity;

    if (status === 'full' || noOfClients >= capacity) {
        response = {
            error: true,
            message: `"${group[0].name}" is already full. Please select another group.`
        };
    } else {
        noOfClients = noOfClients + 1;

        if (noOfClients === capacity) {
            status = 'full';
        }

        const groupData = group[0];
        delete groupData._id;

        groupResp = await db
            .collection('groups')
            .updateOne(
                { _id: ObjectId(groupId) }, 
                {
                    $set: {
                        ...groupData,
                        status: status,
                        noOfClients: noOfClients
                    }
                }, 
                { upsert: false });
    }

    response = { success: true, group: groupResp };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}