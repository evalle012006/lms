import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    post: processLOSTotals
});

async function processLOSTotals(req, res) {
    const { db } = await connectToDatabase();

    const { branchId, loIds, currentDate } = req.body;

    const checkLos = await db.collection('users')
                        .aggregate([
                            { $addFields: { userIdStr: { $toString: '$_id' } } },
                            { $match: { $expr: { $in: ['$userIdStr', loIds] } } },
                            {
                                $lookup: {
                                    from: 'losTotals',
                                    localField: 'userIdStr',
                                    foreignField: 'userId',
                                    pipeline: [
                                        { $match: { losType: 'daily', dateAdded: currentDate, userType: 'lo' } },
                                        {
                                            $group: {
                                                _id: '$_id',
                                                count: { $sum: 1 }
                                            }
                                        }
                                    ],
                                    as: 'losTotal'
                                }
                            },
                            { $project: { userIdStr: 0 } }
                        ])
                        .toArray();

    let response = {};
    if (checkLos) {
        const noLOS = checkLos.filter(los => los.losTotal.length === 0);
        if (noLOS.length > 0) {
            let errorMsg = '';
            noLOS.map(lo => {
                errorMsg += `${lo.firstName} ${lo.lastName} have not submitted LOS yet. \n`;
            });

            response = { error: true, message: errorMsg };
        } else {
            const los = await db.collection('losTotals').updateMany(
                { losType: 'daily', dateAdded: currentDate, branchId: branchId, userType: 'lo' },
                { $set: {
                    status: 'approved',
                    dateApproved: currentDate
                } }
            );
        
            response = { success: true, data: los };
        }
    }

    res.send(response);
}