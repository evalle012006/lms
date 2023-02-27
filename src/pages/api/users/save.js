import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { email, firstName, lastName, number, position, designatedBranch, role, loNo, transactionType } = req.body;

    const { db } = await connectToDatabase();

    const users = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (users.length > 0) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" already exists`
        };
    } else {
        // const role = await db.collection('platformRoles').find({ rep: 1 }).project({ _id: 0 }).toArray();

        const user = await db.collection('users').insertOne({
            firstName: firstName,
            lastName: lastName,
            email: email,
            number: number,
            position: position,
            logged: false,
            // status: 'verification',
            lastLogin: null,
            dateAdded: moment(new Date).format('YYYY-MM-DD'),
            role: JSON.parse(role),
            loNo: loNo,
            designatedBranch: designatedBranch,
            transactionType: transactionType
        });

        response = {
            success: true,
            user: user,
            email: email
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}