import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: getComaker
});

async function getComaker(req, res) {
    const { db } = await connectToDatabase();
    const { groupId } = req.query;
    let statusCode = 200;
    let response = {};
    
    const data = await db.collection('loans')
                    .find({ $expr: { 
                        $and: [
                            {$eq: ['$groupId', groupId]},
                            {$ne: ['$status', 'closed']},
                            {$ne: ['$status', 'reject']}
                        ] 
                    } })
                    .toArray();

    const slotNumbers = data.map(d => d.slotNo);
        
    response = { success: true, data: slotNumbers };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}