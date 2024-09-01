import { connectToDatabase } from '@/lib/mongodb';
import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";
import fs from "fs";

import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { USER_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

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
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            console.log(fields.email);
            const userData = await findUserByEmail(fields.email);

            let file;
            if (files.file) {
                file = await saveFile(files.file, userData._id);
            }

            if (err) {
                resolve({ formError: true })
            }

            const profile = file ? file : userData.profile;
            const role = fields.role;
            let designatedBranch = fields.designatedBranch;
            // if (role.rep === 2) {
            //     designatedBranch = JSON.parse(fields.designatedBranch);
            // }

            const forUpdate = {
                firstName: fields.firstName,
                lastName: fields.lastName,
                number: fields.number,
                position: fields.position,
                profile: profile,
                role: role,
                designatedBranch: designatedBranch,
                loNo: fields.loNo,
                transactionType: fields.transactionType
            };

            if(role.respe === 3) {
                forUpdate.branchManagerName = fields.branchManagerName;
            }

            const resp = await graph.mutation(
                updateQl(USER_TYPE, {
                    set: {
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
                    where: {
                        email: { _eq: fields.email }
                    }
                })
            );


            console.log(resp);
            if(resp.errors) {
                reject(resp.errors);
                return;
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
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                _id: { _eq: id }
            }
        })
    ).then(res => res.data.users);
    
    return user;
}

const findUserByEmail = async (email) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, {
            where: {
                email: { _eq: email }
            }
        })
    ).then(res => res.data.users);
    
    return user;
}

export const config = {
    api: {
        bodyParser: false,
    },
}