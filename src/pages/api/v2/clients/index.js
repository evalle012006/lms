import { CLIENT_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";
import fs from "fs";
import moment from 'moment';
import { notifyGroupLeaderUpdated, notifyClientDelinquent, isNotificationEnabled } from '@/lib/notification-service';
import { findBranches, findGroups } from '@/lib/graph.functions';

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

            const isNotificationEnabledFlag = await isNotificationEnabled();
            // Save previous values for comparison
            const existingClient = clientData?.[0];
            const previousGroupLeader = existingClient?.groupLeader || false;
            const previousDelinquent = existingClient?.delinquent || false;
        
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

            if (isNotificationEnabledFlag) {
                // Check for group leader change and create notification
                const newGroupLeader = fields.groupLeader || false;
                if (previousGroupLeader !== newGroupLeader) {
                    try {
                        const branches = await findBranches({ _id: { _eq: fields.branchId || existingClient?.branchId } });
                        const groups = await findGroups({ _id: { _eq: fields.groupId || existingClient?.groupId } });
                        const branch = branches?.[0];
                        const group = groups?.[0];

                        if (branch) {
                            await notifyGroupLeaderUpdated({
                                clientName: existingClient?.fullName || `${fields.firstName} ${fields.lastName}`,
                                clientId: fields._id || existingClient?._id,
                                groupId: fields.groupId || existingClient?.groupId,
                                groupName: group?.name || fields.groupName || existingClient?.groupName,
                                branchId: fields.branchId || existingClient?.branchId,
                                areaId: branch.areaId,
                                regionId: branch.regionId,
                                divisionId: branch.divisionId,
                                loId: fields.loId || existingClient?.loId,
                                createdBy: req?.auth?.sub,
                                createdByName: 'System',
                                isGroupLeader: newGroupLeader
                            });
                            
                            console.log(`Group leader notification created: ${existingClient?.fullName} - ${newGroupLeader ? 'assigned' : 'removed'}`);
                        }
                    } catch (notifError) {
                        console.error('Failed to create group leader notification:', notifError.message);
                    }
                }

                // Check for delinquent status change and create notification
                const newDelinquent = fields.delinquent || false;
                if (previousDelinquent !== newDelinquent) {
                    try {
                        const branches = await findBranches({ _id: { _eq: fields.branchId || existingClient?.branchId } });
                        const branch = branches?.[0];

                        if (branch) {
                            await notifyClientDelinquent({
                                clientName: existingClient?.fullName || `${fields.firstName} ${fields.lastName}`,
                                clientId: fields._id || existingClient?._id,
                                groupId: fields.groupId || existingClient?.groupId,
                                branchId: fields.branchId || existingClient?.branchId,
                                areaId: branch.areaId,
                                regionId: branch.regionId,
                                divisionId: branch.divisionId,
                                loId: fields.loId || existingClient?.loId,
                                createdBy: req?.auth?.sub,
                                createdByName: 'System',
                                isDelinquent: newDelinquent
                            });
                            
                            console.log(`Delinquent notification created: ${existingClient?.fullName} - ${newDelinquent ? 'marked' : 'unmarked'}`);
                        }
                    } catch (notifError) {
                        console.error('Failed to create delinquent notification:', notifError.message);
                    }
                }
            }

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