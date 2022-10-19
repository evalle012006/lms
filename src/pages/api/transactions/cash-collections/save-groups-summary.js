import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

let response = {};
let statusCode = 200;


export default apiHandler({
    post: saveUpdate,
    get: list
});

async function list(req, res) {
    const { db } = await connectToDatabase();
    const data = req.query;


    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function saveUpdate(req, res) {
    const { db } = await connectToDatabase();
    const data = req.body;

    if (data.hasOwnProperty('_id')) {
        console.log('updating');
        await update(data);
    } else {
        console.log('saving');
        await save(data);
    }
    console.log(response)
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

    const groupCC = data._id;
    delete data._id;

    const groups = await db.collection('groupCashCollections')
        .updateOne(
            { _id: ObjectId(groupCC) }, 
            {
                $set: { ...data }
            }, 
            { upsert: false }
        );
    
    response = { success: true, groups };
}