import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: processLOSummary
});

async function processLOSummary(req, res) {
    const { db } = await connectToDatabase();
    const { mode, currentUser, branchId } = req.body;
    
    if (branchId) {
        const groups = await db.collection('groups').find({ $expr: { $and: [{$eq: ['$branchId', branchId] }, {$gt: ['$noOfClients', 0]}] } }).toArray();

        if (groups.length > 0) {
            groups.map(async group => {
                const exist = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: group._id + '' }).toArray();
                if (exist.length === 0 && (group.noOfClients && group.noOfClients > 0)) {
                    const data = {
                        branchId: group.branchId,
                        groupId: group._id + '',
                        groupName: group.name,
                        loId: group.loanOfficerId,
                        dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                        insertBy: currentUser,
                        mode: group.occurence,
                        status: 'pending'
                    };
        
                    await save(data);
                }
            });
        }
    
        response = { success: true };
    } else {
        const branches = await db.collection('branches').find().toArray();
        
        if (branches) {
            branches.map(async branch => {
                const groups = await db.collection('groups').find({ $expr: { $and: [{$eq: ['$branchId', branch._id + ''] }, {$gt: ['$noOfClients', 0]}] } }).toArray();

                if (groups.length > 0) {
                    groups.map(async group => {
                        const exist = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: group._id + '' }).toArray();
                        if (exist.length === 0 && (group.noOfClients && group.noOfClients > 0)) {
                            const data = {
                                branchId: group.branchId,
                                groupId: group._id + '',
                                groupName: group.name,
                                loId: group.loanOfficerId,
                                dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                                insertBy: currentUser,
                                mode: group.occurence,
                                status: 'pending'
                            };
                
                            await save(data);
                        }
                    });
                }
            
                response = { success: true };
            });
        }
        
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function save(data) {
    const { db } = await connectToDatabase();
    const groups = await db.collection('groupCashCollections')
        .insertOne({
            ...data
        });
    
    response = { success: true, groups };
}