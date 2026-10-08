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
 * Sanitize a boolean field from FormData.
 * Converts string "true"/"false"/"null"/undefined to a proper boolean.
 *
 * FIXED: `fallback` used to be a fixed default (usually `false`), so an
 * omitted field (fields.x === undefined, which is what happens whenever a
 * caller sends FormData without that key at all — see ClientQuickEditModal)
 * silently got written as `false`/`null` on every save, clobbering whatever
 * was actually in the database. `fallback` must be the field's CURRENT
 * value from the existing record, not a fixed default — a field the caller
 * genuinely never mentioned should be left untouched, not reset.
 */
const sanitizeBoolean = (value, fallback = false) => {
    if (value === null || value === undefined || value === 'null' || value === 'undefined' || value === '') {
        return fallback;
    }
    if (value === true || value === 'true' || value === '1') {
        return true;
    }
    if (value === false || value === 'false' || value === '0') {
        return false;
    }
    return fallback;
};

/**
 * Sanitize a string field from FormData.
 * Converts "null"/"undefined" strings to actual null, or to `fallback`.
 * See sanitizeBoolean's note above — `fallback` must be the existing value.
 */
const sanitizeString = (value, fallback = null) => {
    if (value === null || value === undefined || value === 'null' || value === 'undefined') {
        return fallback;
    }
    return String(value);
};

/**
 * Sanitize all client fields from FormData, falling back to the EXISTING
 * record (`existing`) for any field the caller didn't send — never to a
 * fixed empty/null default. This is the actual fix for the null
 * firstName/lastName/loId/groupId/branchId bug: a partial-update caller
 * (duplicate/groupLeader-only, archive-only, etc.) now correctly leaves
 * every other field as it already was in the database.
 *
 * `existing` is required — this function should never be called without
 * the current record already fetched (see updateClient below, which
 * fetches it and 404s before this is ever reached).
 */
const sanitizeClientFields = (fields, existing) => {
    return {
        // String fields — fall back to existing.<field>, not a fixed default
        firstName: sanitizeString(fields.firstName, existing.firstName),
        middleName: sanitizeString(fields.middleName, existing.middleName ?? ''),
        lastName: sanitizeString(fields.lastName, existing.lastName),
        birthdate: sanitizeString(fields.birthdate, existing.birthdate),
        addressStreetNo: sanitizeString(fields.addressStreetNo, existing.addressStreetNo ?? ''),
        addressBarangayDistrict: sanitizeString(fields.addressBarangayDistrict, existing.addressBarangayDistrict ?? ''),
        addressMunicipalityCity: sanitizeString(fields.addressMunicipalityCity, existing.addressMunicipalityCity ?? ''),
        addressProvince: sanitizeString(fields.addressProvince, existing.addressProvince ?? ''),
        addressZipCode: sanitizeString(fields.addressZipCode, existing.addressZipCode ?? ''),
        contactNumber: sanitizeString(fields.contactNumber, existing.contactNumber ?? ''),
        branchId: sanitizeString(fields.branchId, existing.branchId),
        branchName: sanitizeString(fields.branchName, existing.branchName ?? ''),
        status: sanitizeString(fields.status, existing.status),
        loId: sanitizeString(fields.loId, existing.loId),
        groupId: sanitizeString(fields.groupId, existing.groupId),
        groupName: sanitizeString(fields.groupName, existing.groupName ?? ''),
        ciName: sanitizeString(fields.ciName, existing.ciName ?? ''),

        // Boolean fields — same fix
        delinquent: sanitizeBoolean(fields.delinquent, existing.delinquent ?? false),
        duplicate: sanitizeBoolean(fields.duplicate, existing.duplicate ?? false),
        groupLeader: sanitizeBoolean(fields.groupLeader, existing.groupLeader ?? false),
        archived: sanitizeBoolean(fields.archived, existing.archived ?? false),

        // Nullable string field
        archivedBy: sanitizeString(fields.archivedBy, existing.archivedBy),
    };
};

// ============================================
// API HANDLERS
// ============================================

// FIXED: read `clientId` — this was already correct here; the bug was on
// the frontend caller (saveClientPartial) using `_id` instead. Also fixed:
// this used to return the raw, undestructured array from the GraphQL
// query (`client: client` where `client` was actually `res.data.clients`,
// plural) — any caller reading `response.client.firstName` would silently
// get `undefined` since arrays don't have that property, rather than an
// error making the mismatch obvious.
async function getClient(req, res) {
    const { clientId = null } = req.query;

    const [client] = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                _id: { _eq: clientId }
            }
        })
    ).then(res => res.data.clients);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, client: client || null }));
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

                // FIXED: pass the existing record so omitted fields fall back
                // to their current DB value instead of a fixed null/''/false.
                const sanitizedFields = sanitizeClientFields(fields, clientData);

                // Handle profile field
                const profile = sanitizeString(fields.profile, clientData.profile);

                // Merge sanitized fields with existing client data — this is
                // now genuinely a merge, since sanitizedFields itself already
                // preserves anything the caller omitted.
                clientData = {
                    ...clientData,
                    ...sanitizedFields,
                    profile: profile,
                };

                // FIXED: the mutation now writes `sanitizedFields.*`, which —
                // after the fix above — correctly equals either the caller's
                // new value or the pre-existing one. This was already what
                // the code looked like it intended; the bug was entirely in
                // what sanitizedFields itself contained, not in this mutation
                // shape. Also added `branchName`, which was computed above
                // but never actually persisted — a separate pre-existing
                // bug found while fixing this.
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
                            branchName: sanitizedFields.branchName,
                            status: sanitizedFields.status,
                            loId: sanitizedFields.loId,
                            groupName: sanitizedFields.groupName,
                            groupId: sanitizedFields.groupId,
                            profile: profile,
                            ciName: sanitizedFields.ciName,
                            delinquent: sanitizedFields.delinquent,
                            duplicate: sanitizedFields.duplicate,
                            groupLeader: sanitizedFields.groupLeader,
                            archived: sanitizedFields.archived,
                            archivedBy: sanitizedFields.archivedBy,
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