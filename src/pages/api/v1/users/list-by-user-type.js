import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = {};

    const { userType } = req.query;

    const users = await db
        .collection('users')
        .find({ $expr: {
            $or: [
                {$cond: {
                    if: { $eq: [userType, 'area'] },
                    then: { $eq: ['$role.shortCode', 'area_admin'] },
                    else: null
                }},
                {$cond: {
                    if: { $eq: [userType, 'region'] },
                    then: { $eq: ['$role.shortCode', 'regional_manager'] },
                    else: null
                }},
                {$cond: {
                    if: { $eq: [userType, 'deputy'] },
                    then: { $eq: ['$role.shortCode', 'deputy_director'] },
                    else: null
                }}
            ]
        } } )
        .project({ password: 0 })
        .toArray();
    
    response = {
        success: true,
        users: users
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}
