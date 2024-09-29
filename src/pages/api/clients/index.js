import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import formidable from "formidable";

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
            { $match: { _id: new ObjectId(clientId) } },
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

async function updateClient(req, res) {
    const { db } = await connectToDatabase();
    const ObjectId = require('mongodb').ObjectId;
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            let clientData = await db.collection('client').find({ _id: new ObjectId(fields._id) }).toArray();
            clientData = clientData.length > 0 && clientData[0];

            let file = fields.profile;

            if (err) {
                resolve({ formError: true })
            }

            const profile = file ? file : clientData.profile;

            clientData = { ...clientData, 
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
                profile: profile,
            };

            if (fields.hasOwnProperty('archived')) {
                clientData.archived = (fields.archived == true || fields.archived == 'true') ? true : false;
                clientData.archivedDate = new Date();
                clientData.archivedBy = fields.archivedBy;
            }

            const clientResponse = await db
                .collection('client')
                .updateOne(
                    { _id: new ObjectId(clientData._id) },
                    {
                        $set: { ...clientData, dateModified: new Date()},
                    }
                );

            resolve({ success: true, client: clientData });
        });
    });

    response = { ...response, success: true, ...promise };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

export const config = {
    api: {
        bodyParser: false,
    },
}