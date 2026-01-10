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

// ============================================
// SANITIZATION UTILITIES
// ============================================

/**
 * Sanitize a boolean field from FormData
 * Converts string "true"/"false"/"null"/undefined to proper boolean
 */
const sanitizeBoolean = (value, defaultValue = false) => {
    if (value === null || value === undefined || value === 'null' || value === '') {
        return defaultValue;
    }
    if (value === true || value === 'true' || value === '1') {
        return true;
    }
    if (value === false || value === 'false' || value === '0') {
        return false;
    }
    return defaultValue;
};

/**
 * Sanitize a string field from FormData
 * Converts "null"/"undefined" strings to actual null or default value
 */
const sanitizeString = (value, defaultValue = null) => {
    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        return defaultValue;
    }
    return String(value);
};

/**
 * Sanitize all client fields from FormData
 * This prevents GraphQL errors like "invalid input syntax for type boolean: 'null'"
 */
const sanitizeClientFields = (fields) => {
    return {
        // String fields
        firstName: sanitizeString(fields.firstName),
        middleName: sanitizeString(fields.middleName, ''),
        lastName: sanitizeString(fields.lastName),
        birthdate: sanitizeString(fields.birthdate),
        addressStreetNo: sanitizeString(fields.addressStreetNo, ''),
        addressBarangayDistrict: sanitizeString(fields.addressBarangayDistrict, ''),
        addressMunicipalityCity: sanitizeString(fields.addressMunicipalityCity, ''),
        addressProvince: sanitizeString(fields.addressProvince, ''),
        addressZipCode: sanitizeString(fields.addressZipCode, ''),
        contactNumber: sanitizeString(fields.contactNumber, ''),
        branchId: sanitizeString(fields.branchId),
        branchName: sanitizeString(fields.branchName, ''),
        status: sanitizeString(fields.status),
        loId: sanitizeString(fields.loId),
        groupId: sanitizeString(fields.groupId),
        groupName: sanitizeString(fields.groupName, ''),
        ciName: sanitizeString(fields.ciName, ''),
        
        // Boolean fields - IMPORTANT: These were causing the GraphQL error
        delinquent: sanitizeBoolean(fields.delinquent, false),
        duplicate: sanitizeBoolean(fields.duplicate, false),
        groupLeader: sanitizeBoolean(fields.groupLeader, false),
        archived: sanitizeBoolean(fields.archived, false),
        
        // Nullable string fields
        archivedBy: sanitizeString(fields.archivedBy),
    };
};

// ============================================
// API HANDLERS
// ============================================

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
            try {
                let [clientData] = await graph.query(
                    queryQl(CLIENT_TYPE, {
                        where: {
                            _id: { _eq: fields._id ?? null }
                        }
                    })
                ).then(res => res.data.clients);

                if (!clientData) {
                    resolve({ success: false, message: 'Client not found' });
                    return;
                }

                const isNotificationEnabledFlag = await isNotificationEnabled();
                
                // Save previous values for comparison (for notifications)
                const previousGroupLeader = clientData?.groupLeader || false;
                const previousDelinquent = clientData?.delinquent || false;
            
                if (err) {
                    console.error('Form parse error:', err);
                    resolve({ formError: true });
                    return;
                }

                // IMPORTANT: Sanitize fields to convert string values to proper types
                const sanitizedFields = sanitizeClientFields(fields);
                
                // Handle profile field
                const profile = sanitizeString(fields.profile) || clientData.profile;

                // Merge sanitized fields with existing client data
                clientData = { 
                    ...clientData, 
                    ...sanitizedFields,
                    profile: profile,
                };

                // Perform the GraphQL mutation with sanitized values
                await graph.mutation(
                    updateQl(CLIENT_TYPE, {
                        set: {
                            firstName: sanitizedFields.firstName,
                            middleName: sanitizedFields.middleName,
                            lastName: sanitizedFields.lastName,
                            birthdate: sanitizedFields.birthdate,
                            addressStreetNo: sanitizedFields.addressStreetNo,
                            addressBarangayDistrict: sanitizedFields.addressBarangayDistrict,
                            addressMunicipalityCity: sanitizedFields.addressMunicipalityCity,
                            addressProvince: sanitizedFields.addressProvince,
                            addressZipCode: sanitizedFields.addressZipCode,
                            contactNumber: sanitizedFields.contactNumber,
                            branchId: sanitizedFields.branchId,
                            status: sanitizedFields.status,
                            loId: sanitizedFields.loId,
                            groupName: sanitizedFields.groupName,
                            groupId: sanitizedFields.groupId,
                            profile: profile,
                            ciName: sanitizedFields.ciName,
                            // Boolean fields - now properly sanitized
                            delinquent: sanitizedFields.delinquent,
                            duplicate: sanitizedFields.duplicate,
                            groupLeader: sanitizedFields.groupLeader,
                            archived: sanitizedFields.archived,
                            archivedBy: sanitizedFields.archivedBy,
                            // Timestamp
                            dateModified: moment().toISOString(),
                        },
                        where: {
                            _id: { _eq: fields._id }
                        }
                    })
                );

                // Handle notifications for groupLeader change
                if (isNotificationEnabledFlag && sanitizedFields.groupLeader !== previousGroupLeader) {
                    try {
                        const branches = await findBranches({ _id: { _eq: clientData.branchId } });
                        const branch = branches?.[0];
                        const groups = await findGroups({ _id: { _eq: clientData.groupId } });
                        const group = groups?.[0];
                        
                        await notifyGroupLeaderUpdated({
                            clientName: `${clientData.firstName} ${clientData.lastName}`,
                            branchName: branch?.name || clientData.branchName,
                            groupName: group?.name || clientData.groupName,
                            isGroupLeader: sanitizedFields.groupLeader,
                            branchId: clientData.branchId
                        });
                    } catch (notifError) {
                        console.error('Failed to send group leader notification:', notifError);
                    }
                }

                // Handle notifications for delinquent change
                if (isNotificationEnabledFlag && sanitizedFields.delinquent && !previousDelinquent) {
                    try {
                        const branches = await findBranches({ _id: { _eq: clientData.branchId } });
                        const branch = branches?.[0];
                        
                        await notifyClientDelinquent({
                            clientName: `${clientData.firstName} ${clientData.lastName}`,
                            branchName: branch?.name || clientData.branchName,
                            branchId: clientData.branchId
                        });
                    } catch (notifError) {
                        console.error('Failed to send delinquent notification:', notifError);
                    }
                }

                resolve({ success: true, client: clientData });
            } catch (error) {
                console.error('Error updating client:', error);
                resolve({ success: false, message: error.message });
            }
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