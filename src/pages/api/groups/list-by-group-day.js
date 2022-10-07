import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { day, branchId, loId, occurence } = req.query;
    let groups;

    if (branchId && loId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, status: 'available', loanOfficerId: loId, day: day, occurence: occurence })
            .toArray();
    } else if (branchId) {
        groups = await db
            .collection('groups')
            .find({ branchId: branchId, status: 'available', day: day, occurence: occurence })
            .toArray();
    } else {
        groups = await db
            .collection('groups')
            .find({ status: 'available', day: day, occurence: occurence })
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