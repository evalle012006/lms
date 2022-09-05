import { connectToDatabase } from "@/lib/mongodb";
import { apiHandler } from '@/services/api-handler';

export default apiHandler({
    post: activate
});

async function activate(req, res) {
    const { db } = await connectToDatabase();
    const { email } = req.body;

    const response = await db
        .collection('users')
        .updateOne(
            { email: email },
            {
                $set: { status: 'active' },
                $currentDate: { dateModified: true }
            }
        );

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}