import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";
import fs from "fs";

export default apiHandler({
    post: updateClient,
    get: getClient
});

async function getClient(req, res) {
    const { db } = await connectToDatabase();
    const { clientId } = req.query;
    const ObjectId = require('mongodb').ObjectId;

    let statusCode = 200;
    let response = {};
    const clients = await db
        .collection('client')
        .aggregate([
            { $match: { _id: ObjectId(clientId) } },
            {
                $addFields: {
                    "clientId": { $toString: "$_id" }
                }
            },
            {
                $lookup: {
                    from: "loans",
                    localField: "clientId",
                    foreignField: "clientId",
                    as: "loans"
                }
            },
            {
                $sort: { dateGranted: -1 }
            }
        ])
        .toArray();

    response = {
        success: true,
        client: clients
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// async function updateClient(req, res) {
//     const { db } = await connectToDatabase();
//     const ObjectId = require('mongodb').ObjectId;
//     let statusCode = 200;
//     let response = {};

//     const client = req.body;
//     const clientId = client._id;
//     delete client._id;

//     const clientResp = await db
//         .collection('client')
//         .updateOne(
//             { _id: ObjectId(clientId) }, 
//             {
//                 $set: { ...client }
//             }, 
//             { upsert: false });

//     response = { success: true, client: clientResp };

//     res.status(statusCode)
//         .setHeader('Content-Type', 'application/json')
//         .end(JSON.stringify(response));
// }

async function updateClient(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            let clientData = await db.collection('client').find({ _id: ObjectId(fields._id) }).toArray();
            clientData = clientData.length > 0 && clientData[0];

            let file;
            if (files.file) {
                file = await saveFile(files.file, clientData._id);
            }

            if (err) {
                resolve({ formError: true })
            }

            const profile = file ? file : clientData.profile;

            const clientResponse = await db
                .collection('client')
                .updateOne(
                    { _id: ObjectId(clientData._id) },
                    {
                        $set: {
                            firstName: fields.firstName,
                            middleName: fields.middleName,
                            lastName: fields.lastName,
                            birthdate: fields.birthdate,
                            addressStreetNo: fields.addressStreetNo,
                            addressBarangayDistrict: fields.addressBarangayDistrict,
                            addressMunicipalityCity: fields.addressMunicipalityCity,
                            addressProvince: fields.addressProvince,
                            addressZipCode: fields.addressZipCode,
                            contactNumber: fields.contactNumber,
                            branchId: fields.branchId,
                            status: fields.status,
                            delinquent: fields.delinquent,
                            loId: fields.loId,
                            groupId: fields.groupId,
                            profile: profile
                        },
                        $currentDate: { dateModified: true }
                    }
                );
            // clientData.profile = file ? file : clientData.profile;
            delete clientData._id;
            resolve({ success: true, client: clientData });
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

        if (!fs.existsSync(`./public/images/clients/`)) {
            fs.mkdirSync(`./public/images/clients/`, { recursive: true });
        }

        if (fs.existsSync(`./public/images/clients/${uid}/`)) {
            // check if file exists 
            fs.existsSync(`./public/images/clients/${uid}/${file.originalFilename}`) && fs.unlinkSync(`./public/images/clients/${uid}/${file.originalFilename}`);
        } else {
            fs.mkdirSync(`./public/images/clients/${uid}/`);
        }

        fs.writeFileSync(`./public/images/clients/${uid}/${file.originalFilename}`, data);
        await fs.unlinkSync(file.filepath);

        return uid + '/' + file.originalFilename;
    } else {
        return false;
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
}