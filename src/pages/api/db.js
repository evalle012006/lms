// sample API response 
import { connectToDatabase } from "@/lib/mongodb";

export default async function handler(req, res) {
    const jsonData = {
        message: 'This is a test message'
    }

    const { db } = await connectToDatabase();
    const settings = await db
        .collection('settings')
        .find()
        .toArray();

    const data = {
        ...settings,
        note: 'This is a sample data. If blank, just add documents to the collection in Mongo Atlas',
        collection: 'settings'
    }

    res.status(200).json(data);
}