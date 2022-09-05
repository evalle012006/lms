import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';

export default apiHandler({
    get: fetchNutrients
});

let statusCode = 200;
let response = {};
let success = true;

async function fetchNutrients(req, res) {
    const { db } = await connectToDatabase();

    const soilNutrients = await db
        .collection('soilNutrients')
        .aggregate([
            { $sort: { order: 1 } }
        ])
        // .find({})
        .toArray();

    const leafNutrients = await db
        .collection('leafNutrients')
        .aggregate([
            { $sort: { order: 1 } }
        ])
        // .find({})
        .toArray();
    const nutrients = { soil: soilNutrients, leaf: leafNutrients };
    response = { success, nutrients };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}