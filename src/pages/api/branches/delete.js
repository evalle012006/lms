import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: deleteBranch
});

async function deleteBranch(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const { _id } = req.body;

    let statusCode = 200;
    let response = {};

    const branches = await db
        .collection('branches')
        .find({ _id: ObjectId(_id) })
        .toArray();

    if (branches.length > 0) {
        const groups = await db.collection('groups').find({ branchId: branches[0]._id + '' }).toArray();

        if (groups.length > 0) {
            response = {
                error: true,
                message: `Can't delete branch ${branches[0].name} it is currently used in groups.`
            };
        } else {
            await db
                .collection('branches')
                .deleteOne({ _id: ObjectId(_id) });

            response = {
                success: true
            }
        }
    } else {
        response = {
            error: true,
            message: `Branch with id: "${_id}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
