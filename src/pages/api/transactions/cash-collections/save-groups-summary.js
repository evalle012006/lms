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
    const { _id, groupSummaryIds, status, mode, currentUser } = req.body;

    groupSummaryIds.map(async gs => {
        const data = {
            _id: gs._id,
            status: status,
            modifiedBy: currentUser
        };

        await update(data);
    });

    const groups = await db.collection('groups').find({ loanOfficerId: _id }).toArray();

    if (groups.length > 0) {
        groups.map(async group => {
            const exist = await db.collection('groupCashCollections').find({ dateAdded: moment(new Date()).format('YYYY-MM-DD'), groupId: group._id + '' }).toArray();

            if (exist.length === 0) {
                const data = {
                    branchId: group.branchId,
                    groupId: group._id + '',
                    groupName: group.name,
                    loId: _id,
                    dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                    insertBy: currentUser,
                    mode: mode,
                    status: status
                };
    
                await save(data);
            }
            // const hasData = groupSummaryIds.find(gs => gs.groupId === group._id+'');
            // if (!hasData) {
                
            // }
        });
    }

    response = { success: true };

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

async function update(data) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;

    let groupCC = await db.collection('groupCashCollections').find({ _id: ObjectId(data._id) }).toArray();

    if (groupCC.length > 0) {
        groupCC = {...groupCC[0], status: data.status, modifiedBy: data.modifiedBy, dateModified: moment(new Date()).format('YYYY-MM-DD')};
        
        delete groupCC._id;

        await db.collection('groupCashCollections')
            .updateOne(
                { _id: ObjectId(data._id) }, 
                {
                    $set: { ...groupCC }
                }, 
                { upsert: false }
            );
    }
    
    response = { success: true };
}