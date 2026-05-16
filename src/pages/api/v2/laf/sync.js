// src/pages/api/v2/laf/sync.js
// POST — authenticated (LO must be logged in)
// Syncs a single offline LAF entry: uploads photos, inserts to DB.
// Called in a loop from the client-side sync panel for each pending entry.

import { apiHandler }                         from '@/services/api-handler';
import { GraphProvider }                      from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }               from '@/lib/graph.fields';
import { generateUUID }                       from '@/lib/utils';
import { logAudit }                           from '@/lib/audit';
import { findUserById }                       from '@/lib/graph.functions';
import { S3Client, PutObjectCommand }          from '@aws-sdk/client-s3';

const s3 = new S3Client({
    endpoint:       'https://sgp1.digitaloceanspaces.com',
    region:         'sgp1',
    credentials:    {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function uploadBase64ToSpaces(base64String, key) {
    if (!base64String) return null;
    const buffer = Buffer.from(base64String, 'base64');
    await s3.send(new PutObjectCommand({
        Bucket:      process.env.SPACES_BUCKET,
        Key:         key,
        Body:        buffer,
        ContentType: 'image/jpeg',
        ACL:         'private',
    }));
    return key;
}
import moment                                 from 'moment';
import crypto                                 from 'crypto';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType(
    'temporaryLoanApplications', TEMP_LOAN_APP_FIELDS
)('temporaryLoanApplications');

const GROUP_TYPE = createGraphType('groups', `
    _id name branchId loanOfficerId qrToken qrExpiresAt
    branch { _id name code }
`)('groups');

export default apiHandler({ post: syncEntry });

async function syncEntry(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    const {
        qrToken, offlineId, groupId, loId, branchId,
        clientType, existingClientId, existingLoanId,
        firstName, lastName, middleName, birthdate, contactNumber,
        addressStreetNo, addressBarangayDistrict,
        addressMunicipalityCity, addressProvince, addressZipCode,
        landmark, distanceFromBranch,
        loanAmount, loanPurpose,
        guarantorFirstName, guarantorLastName,
        guarantorRelationship, guarantorContactNumber,
        governmentIdType, governmentIdNumber,
        lafPhotoBase64, idPhotoBase64, selfieBase64,
    } = req.body;

    if (!qrToken || !groupId || !firstName || !lastName) {
        return res.status(200).json({ success: false, message: 'Missing required fields.' });
    }

    // Validate QR token
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, { where: { qrToken: { _eq: qrToken } } })
    ).then(r => r.data?.groups ?? []);

    if (!group) return res.status(200).json({ success: false, message: 'QR token not found.' });
    if (group.qrExpiresAt && moment().isAfter(moment(group.qrExpiresAt))) {
        return res.status(200).json({ success: false, message: 'QR code expired. Ask LO to regenerate.' });
    }

    // Upload photos from base64
    const uuid = generateUUID();
    let lafPhotoKey = null, governmentIdPhotoKey = null, selfieWithIdPhotoKey = null;
    try {
        if (lafPhotoBase64) lafPhotoKey = await uploadBase64ToSpaces(lafPhotoBase64, `lms/laf-photos/${uuid}/${Date.now()}-laf.jpg`);
        if (idPhotoBase64)  governmentIdPhotoKey = await uploadBase64ToSpaces(idPhotoBase64, `lms/laf-id-photos/${uuid}/${Date.now()}-id.jpg`);
        if (selfieBase64)   selfieWithIdPhotoKey = await uploadBase64ToSpaces(selfieBase64, `lms/laf-selfie-with-id/${uuid}/${Date.now()}-selfie.jpg`);
    } catch (err) {
        return res.status(200).json({ success: false, message: `Photo upload failed: ${err.message}` });
    }

    // Generate CI reference code
    const branchCode      = group.branch?.code || branchId?.slice(-4).toUpperCase() || 'XXXX';
    const dateStr         = moment().format('MMDDYY');
    const suffix          = crypto.randomBytes(3).toString('hex').toUpperCase();
    const ciReferenceCode = `CI-${branchCode}-${dateStr}-${suffix}`;
    const insertId        = generateUUID();

    await graph.mutation(
        insertQl(TEMP_TYPE, {
            objects: [{
                _id: insertId, ciReferenceCode,
                branchId: group.branchId, groupId: group._id, loId: group.loanOfficerId,
                firstName:  firstName?.trim().toUpperCase(),
                lastName:   lastName?.trim().toUpperCase(),
                middleName: middleName?.trim().toUpperCase() || '',
                birthdate, contactNumber,
                addressStreetNo, addressBarangayDistrict,
                addressMunicipalityCity, addressProvince,
                addressZipCode:         addressZipCode        || '',
                landmark:               landmark              || null,
                distanceFromBranch:     distanceFromBranch    || null,
                loanAmount:             parseFloat(loanAmount) || 0,
                loanPurpose:            loanPurpose            || null,
                guarantorFirstName:     guarantorFirstName     || null,
                guarantorLastName:      guarantorLastName      || null,
                guarantorRelationship:  guarantorRelationship  || null,
                guarantorContactNumber: guarantorContactNumber || null,
                lafPhotoKey,
                governmentIdType:       governmentIdType       || null,
                governmentIdNumber:     governmentIdNumber     || null,
                governmentIdPhotoKey:   governmentIdPhotoKey   || null,
                selfieWithIdPhotoKey:   selfieWithIdPhotoKey   || null,
                clientType:             clientType             || 'prospect',
                existingClientId:       existingClientId       || null,
                existingLoanId:         existingLoanId         || null,
                isOffline:              true,
                syncedAt:               moment().toISOString(),
                status:                 'pending',
                submittedAt:            moment().toISOString(),
                dateAdded:              moment().format('YYYY-MM-DD'),
                expiresAt:              moment().add(30, 'days').toISOString(),
            }],
        })
    );

    await logAudit(req, {
        action: 'LAF_OFFLINE_SYNCED', category: 'LAF', severity: 'INFO',
        entityType: 'temporaryLoanApplication', entityId: insertId,
        description: `Offline LAF synced for ${firstName} ${lastName} by ${currentUser.firstName} ${currentUser.lastName}`,
        branchId: group.branchId, branchName: group.branch?.name,
        metadata: { offlineId, groupId: group._id, groupName: group.name, ciReferenceCode, clientType },
    });

    return res.status(200).json({
        success: true, ciReferenceCode, applicationId: insertId,
        message: 'Application synced successfully.',
    });
}