import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import fs from "fs";
import logger from '@/logger';

export default apiHandler({
    post: deleteUser
});

async function deleteUser(req, res) {
    const { _id, email } = req.body;
    const ObjectId = require('mongodb').ObjectId;

    const { db } = await connectToDatabase();

    let statusCode = 200;
    let response = {};

    const user = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    if (user.length > 0) {
        await db
            .collection('users')
            .deleteOne({ _id: ObjectId(_id) });

        removeFile.removeFile(user[0].profile);

        response = {
            success: true
        }
    } else {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" not exists`
        };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}


const removeFile = async (fileName) => {
    if (fileName) {
        const dir = `./public/images/profiles/${fileName}`;
        fs.rmdirSync(dir, { recursive: true });
        logger.debug(`User file ${fileName} deleted!`);
    } else {
        return false;
    }
}