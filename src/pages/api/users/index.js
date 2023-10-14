import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    get: getUser,
    post: updateUser
});

async function getUser(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};
    const user = await findUserByID(_id)

    response = { success: true, user: user };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateUser(req, res) {
    const { db } = await connectToDatabase();
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            const userData = await findUserByEmail(fields.email);

            let file;
            if (files.file) {
                file = await saveFile(files.file, userData._id);
            }

            if (err) {
                resolve({ formError: true })
            }

            const profile = file ? file : userData.profile;
            const role = JSON.parse(fields.role);
            let designatedBranch = fields.designatedBranch;
            if (role.rep === 2) {
                designatedBranch = JSON.parse(fields.designatedBranch);
            }

            if (role.rep === 3) {
                await db
                    .collection('users')
                    .updateOne(
                        { email: fields.email },
                        {
                            $set: {
                                firstName: fields.firstName,
                                lastName: fields.lastName,
                                number: fields.number,
                                position: fields.position,
                                profile: profile,
                                role: role,
                                designatedBranch: designatedBranch,
                                loNo: fields.loNo,
                                transactionType: fields.transactionType,
                                branchManagerName: fields.branchManagerName
                            },
                            $currentDate: { dateModified: true }
                        }
                    );
            } else {
                await db
                    .collection('users')
                    .updateOne(
                        { email: fields.email },
                        {
                            $set: {
                                firstName: fields.firstName,
                                lastName: fields.lastName,
                                number: fields.number,
                                position: fields.position,
                                profile: profile,
                                role: role,
                                designatedBranch: designatedBranch,
                                loNo: fields.loNo,
                                transactionType: fields.transactionType
                            },
                            $currentDate: { dateModified: true }
                        }
                    );
            }
            // userData.profile = file ? file : userData.profile;
            delete userData._id;
            delete userData.password;
            resolve({ success: true, user: userData });
        });
    });

    response = { ...response, success: true, ...promise };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const saveFile = async (file, uid) => {
    if (file) {
        const data = fs.readFileSync(file.filepath);
        const fileName = 'profile-00.' + file.originalFilename.split('.').pop();
        if (!fs.existsSync(`./public/images/profiles/`)) {
            fs.mkdirSync(`./public/images/profiles/`, { recursive: true });
        }

        if (fs.existsSync(`./public/images/profiles/${uid}/`)) {
            // check if file exists 
            fs.existsSync(`./public/images/profiles/${uid}/${fileName}`) && fs.unlinkSync(`./public/images/profiles/${uid}/${fileName}`);
        } else {
            fs.mkdirSync(`./public/images/profiles/${uid}/`);
        }

        fs.writeFileSync(`./public/images/profiles/${uid}/${fileName}`, data);
        await fs.unlinkSync(file.filepath);

        return uid + '/' + fileName;
    } else {
        return false;
    }
}

const findUserByID = async (id) => {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    const condition = id ? { _id: new ObjectId(id) } : {};
    
    const users = await db
        .collection('users')
        .find(condition)
        .project({ password: 0 })
        .toArray();
    return users.length > 0 && users[0];
}

const findUserByEmail = async (email) => {
    const { db } = await connectToDatabase();
    const condition = { email: email };

    const users = await db
        .collection('users')
        .find(condition)
        .project({ password: 0 })
        .toArray();

    return users.length > 0 && users[0];
}

export const config = {
    api: {
        bodyParser: false,
    },
}