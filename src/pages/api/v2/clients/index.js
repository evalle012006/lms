import { CLIENT_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";
import fs from "fs";
import moment from 'moment';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', `
${CLIENT_FIELDS}
loans (order_by: [{ dateGranted: desc }]) {
    ${LOAN_FIELDS}
}
`)('clients');

export default apiHandler({
    post: updateClient,
    get: getClient
});

async function getClient(req, res) {
    const { clientId = null } = req.query;

    let statusCode = 200;
    let response = {};

    const client = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                _id: { _eq: clientId }
            }
        })
    )
     .then(res => res.data.clients);

    response = {
        success: true,
        client: client
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateClient(req, res) {
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, fields, files) {
            let [clientData] = await graph.query(
                queryQl(CLIENT_TYPE, {
                    where: {
                        _id: { _eq: fields._id ?? null }
                    }
                })
            ).then(res => res.data.clients);
        
            let file = fields.profile;

            if (err) {
                resolve({ formError: true })
            }

            const profile = file ? file : clientData.profile;

            clientData = { 
                ... clientData, 
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
                groupName: fields.groupName,
                groupId: fields.groupId,
                duplicate: fields.duplicate,
                groupLeader: fields.groupLeader,
                profile: profile,
                archived: fields.archived,
                archivedBy: fields.archivedBy,
                // archivedDate: fields.archivedDate || null,
            };

            await graph.mutation(
                updateQl(CLIENT_TYPE, {
                    set: {
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
                        groupName: fields.groupName,
                        groupId: fields.groupId,
                        profile: profile,
                        ciName: files.ciName,
                        duplicate: fields.duplicate,
                        groupLeader: fields.groupLeader,
                        archived: fields.archived,
                        archivedBy: fields.archivedBy,
                        // archivedDate: fields.archivedDate || null,
                        dateModified: moment(getCurrentDate()).format('YYYY-MM-DD')
                    },
                    where: {
                        _id: { _eq: clientData._id }
                    }
                })
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