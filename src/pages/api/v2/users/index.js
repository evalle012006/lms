import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";
import fs from "fs";

import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { USER_FIELDS } from '@/lib/graph.fields';
import logger from '@/logger';

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
        form.parse(req, async function (err, payload, files) {
            const userData = await findUserByEmail(payload.email);

            let file = payload.profile;
            // if (files.file) {
            //     file = await saveFile(files.file, userData._id).catch(err => {
            //         console.error(err);
            //         logger.error({page: 'User Page', message: `Error in uploading file ${JSON.stringify(err)}`});
            //         return false;
            //     });

            //     if(!file) {
            //         resolve({ formError: true });
            //         return;
            //     }
            // }

            if (err) {
                resolve({ formError: true });
                return;
            }

            const profile = file ? file : userData.profile;
            const role = JSON.parse(payload.role);
            let designatedBranch = payload.designatedBranch;
            // if (role.rep === 2) {
            //     designatedBranch = JSON.parse(payload.designatedBranch);
            // }

            const forUpdate = {
                firstName: payload.firstName,
                lastName: payload.lastName,
                number: payload.number,
                position: payload.position,
                profile: profile,
                designatedBranch: designatedBranch,
                loNo: +payload.loNo,
                transactionType: payload.transactionType
            };

            if(role.rep === 3) {
                forUpdate.branchManagerName = payload.branchManagerName;
            }

            const resp = await graph.mutation(
                updateQl(USER_TYPE, {
                    set: forUpdate,
                    where: {
                        email: { _eq: payload.email }
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
    console.log('file:', file)
    if (file) {
        const data = fs.readFileSync(file.filepath);
        console.log('filename: ', file.originalFilename)
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