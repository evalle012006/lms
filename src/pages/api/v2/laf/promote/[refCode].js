// src/pages/api/v2/laf/promote/[refCode].js
// FIX 1: New prospect path switched to Option A — directly inserts client record
//        instead of returning clientData for AddUpdateClientPage.
//        groupId and loId already tied from the LAF QR flow.
// FIX 2: faceTemplate and faceEnrolledAt now copied to client on promote
//        for both existing clients (update) and new prospects (insert).

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
// FIX: added insertQl for direct client insert in Option A
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS, CLIENT_FIELDS } from '@/lib/graph.fields';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
// FIX: added generateUUID for new client _id
import { generateUUID } from '@/lib/utils';
import moment from 'moment';

const graph = new GraphProvider();
const TEMP_TYPE   = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE     = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const CLIENT_TYPE = createGraphType('client', CLIENT_FIELDS)('clients');

// Minimal group type — only needed for groupName lookup on prospect insert
const GROUP_NAME_TYPE = createGraphType('groups', '_id name')('groups');

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key:    key,
    });
    return getSignedUrl(s3, command, { expiresIn: 900 });
}

// ── Direct GraphQL duplicate check — no internal HTTP call ────────────────
async function checkDuplicates(firstName, lastName) {
    if (!firstName || !lastName) return [];

    const firstNameUpper = firstName.trim().toUpperCase();
    const lastNameUpper  = lastName.trim().toUpperCase();

    const clients = await graph.query(
        queryQl(CLIENT_TYPE, {
            where: {
                _or: [
                    { firstName: { _ilike: `%${firstNameUpper}%` } },
                    { lastName:  { _ilike: `%${lastNameUpper}%`  } },
                ],
                status: { _neq: 'offset' },
            },
            limit: 20,
        })
    ).then(r => r.data?.clients ?? []);

    return clients
        .map(c => {
            const score = calculateSimilarity(
                { firstName: firstNameUpper, lastName: lastNameUpper },
                { firstName: c.firstName?.toUpperCase() || '', lastName: c.lastName?.toUpperCase() || '' }
            );
            return { ...c, similarityScore: score };
        })
        .filter(c => c.similarityScore > 0.8)
        .sort((a, b) => b.similarityScore - a.similarityScore);
}

function calculateSimilarity(search, client) {
    const firstNameMatch = search.firstName === client.firstName ? 1
        : client.firstName?.includes(search.firstName) ? 0.8 : 0;
    const lastNameMatch  = search.lastName  === client.lastName  ? 1
        : client.lastName?.includes(search.lastName)   ? 0.8 : 0;
    return (firstNameMatch + lastNameMatch) / 2;
}

export default apiHandler({ get: getForPromotion });

async function getForPromotion(req, res) {
    const { refCode } = req.query;

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'CI code not found.' });
    }

    if (application.status === 'promoted') {
        return res.status(200).json({
            success: false,
            message: 'This CI code has already been used. The client record already exists.'
        });
    }

    if (application.status === 'pending_validation') {
        return res.status(200).json({
            success: false,
            message: 'Cannot promote — this application is flagged as a potential duplicate and is awaiting admin validation (regional manager or deputy director must approve first).',
        });
    }

    if (application.status !== 'ci_approved') {
        return res.status(200).json({
            success: false,
            message: `Cannot promote — application status is "${application.status}". CI must approve first.`
        });
    }

    const [investigation] = await graph.query(
        queryQl(CI_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.ciInvestigations ?? []);

    // Parallel: signed URLs + duplicate check
    const [lafPhotoUrl, selfieUrl, duplicateCandidates] = await Promise.all([
        application.lafPhotoKey    ? getSignedUrlForKey(application.lafPhotoKey)    : Promise.resolve(null),
        investigation?.selfieKey   ? getSignedUrlForKey(investigation.selfieKey)    : Promise.resolve(null),
        checkDuplicates(application.firstName, application.lastName),
    ]);

    // ── Existing client (reloan / pending / balik) ────────────────────────
    // Update the client record in place — do NOT open AddClientPage form.
    if (application.existingClientId) {
        const updatePayload = {};

        // Apply inline edits from Confirm step (clientChanges)
        const ch = application.clientChanges || {};
        if (ch.lastName)                updatePayload.lastName                = ch.lastName.trim();
        if (ch.middleName)              updatePayload.middleName              = ch.middleName.trim();
        if (ch.contactNumber)           updatePayload.contactNumber           = ch.contactNumber.trim();
        if (ch.addressStreetNo)         updatePayload.addressStreetNo         = ch.addressStreetNo.trim();
        if (ch.addressBarangayDistrict) updatePayload.addressBarangayDistrict = ch.addressBarangayDistrict.trim();
        if (ch.addressMunicipalityCity) updatePayload.addressMunicipalityCity = ch.addressMunicipalityCity.trim();
        if (ch.addressProvince)         updatePayload.addressProvince         = ch.addressProvince.trim();

        // Fields from LAF that always override
        if (application.contactNumber && !ch.contactNumber)                         updatePayload.contactNumber           = application.contactNumber;
        if (application.addressStreetNo && !ch.addressStreetNo)                     updatePayload.addressStreetNo         = application.addressStreetNo;
        if (application.addressBarangayDistrict && !ch.addressBarangayDistrict)     updatePayload.addressBarangayDistrict = application.addressBarangayDistrict;
        if (application.addressMunicipalityCity && !ch.addressMunicipalityCity)     updatePayload.addressMunicipalityCity = application.addressMunicipalityCity;
        if (application.addressProvince && !ch.addressProvince)                     updatePayload.addressProvince         = application.addressProvince;
        if (application.addressZipCode)       updatePayload.addressZipCode       = application.addressZipCode;
        if (application.landmark)             updatePayload.landmark             = application.landmark;
        if (application.distanceFromBranch)   updatePayload.distanceFromBranch   = application.distanceFromBranch;
        if (application.lafPhotoKey)          updatePayload.profile              = application.lafPhotoKey;
        if (application.governmentIdType)     updatePayload.governmentIdType     = application.governmentIdType;
        if (application.governmentIdNumber)   updatePayload.governmentIdNumber   = application.governmentIdNumber;
        if (application.governmentIdPhotoKey) updatePayload.governmentIdPhotoKey = application.governmentIdPhotoKey;

        if (application.biometricCredentialId) {
            updatePayload.biometricCredentialId = application.biometricCredentialId;
            updatePayload.biometricPublicKey    = application.biometricPublicKey;
            updatePayload.biometricCounter      = application.biometricCounter || 0;
            updatePayload.biometricRegisteredAt = application.biometricRegisteredAt;
            updatePayload.biometricDeviceName   = application.biometricDeviceName;
        }

        // FIX: balik clients come from 'offset' status — reset to 'pending' on promote
        if (application.clientType === 'balik') {
            updatePayload.status = 'pending';
        }

        // FIX: copy face liveness fields from LAF to client record on promote
        if (application.faceTemplate)   updatePayload.faceTemplate   = application.faceTemplate;
        if (application.faceEnrolledAt) updatePayload.faceEnrolledAt = application.faceEnrolledAt;

        if (investigation?.picUserName) updatePayload.ciName = investigation.picUserName;

        if (Object.keys(updatePayload).length > 0) {
            await graph.mutation(
                updateQl(CLIENT_TYPE, {
                    where: { _id: { _eq: application.existingClientId } },
                    set:   updatePayload,
                })
            );
        }

        // Mark LAF as promoted
        await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: { ciReferenceCode: { _eq: refCode } },
                set: {
                    status:     'promoted',
                    promotedAt: moment().toISOString(),
                },
            })
        );

        return res.status(200).json({
            success:          true,
            isExistingClient: true,
            clientId:         application.existingClientId,
            ciData: {
                ciReferenceCode: application.ciReferenceCode,
                investigatedBy:  investigation?.picUserName || '',
                investigatedAt:  investigation?.investigatedAt,
                decision:        investigation?.decision,
            },
            loanData: {
                loanAmount:             application.loanAmount,
                loanPurpose:            application.loanPurpose,
                guarantorFirstName:     application.guarantorFirstName,
                guarantorLastName:      application.guarantorLastName,
                guarantorRelationship:  application.guarantorRelationship,
                guarantorContactNumber: application.guarantorContactNumber,
                groupId:                application.groupId,
                loId:                   application.loId,
                clientType:             application.clientType,
                existingLoanId:         application.existingLoanId,
            },
            photos: { lafPhotoUrl, selfieUrl },
        });
    }

    // ── New prospect — FIX: Option A — directly insert client record ──────
    // Previously returned clientData for AddUpdateClientPage to save manually.
    // Now inserts the client here in one shot — no Add Client page needed.
    // groupId and loId are already tied from the LAF QR flow.
    const clientId = generateUUID();

    // Fetch group name for the client record
    const [group] = await graph.query(
        queryQl(GROUP_NAME_TYPE, { where: { _id: { _eq: application.groupId } } })
    ).then(r => r.data?.groups ?? []);

    const [newClient] = await graph.mutation(
        insertQl(CLIENT_TYPE, {
            objects: [{
                _id:                     clientId,
                firstName:               application.firstName,
                lastName:                application.lastName,
                middleName:              application.middleName              || '',
                fullName:                `${application.firstName} ${application.middleName || ''} ${application.lastName}`.trim().toUpperCase(),
                birthdate:               application.birthdate               || null,
                contactNumber:           application.contactNumber           || '',
                addressStreetNo:         application.addressStreetNo         || '',
                addressBarangayDistrict: application.addressBarangayDistrict || '',
                addressMunicipalityCity: application.addressMunicipalityCity || '',
                addressProvince:         application.addressProvince         || '',
                addressZipCode:          application.addressZipCode          || '',
                address: [
                    application.addressStreetNo,
                    application.addressBarangayDistrict,
                    application.addressMunicipalityCity,
                    application.addressProvince,
                    application.addressZipCode,
                ].filter(Boolean).join(', '),
                landmark:                application.landmark                || null,
                distanceFromBranch:      application.distanceFromBranch      || null,
                branchId:                application.branchId,
                groupId:                 application.groupId                 || null,
                loId:                    application.loId                    || null,
                groupName:               group?.name                         || '',
                // Profile photo from LAF
                profile:                 application.lafPhotoKey             || null,
                // Government ID
                governmentIdType:        application.governmentIdType        || null,
                governmentIdNumber:      application.governmentIdNumber      || null,
                governmentIdPhotoKey:    application.governmentIdPhotoKey    || null,
                selfieWithIdPhotoKey:    application.selfieWithIdPhotoKey    || null,
                // WebAuthn biometric (may be null for new flow)
                biometricCredentialId:   application.biometricCredentialId   || null,
                biometricPublicKey:      application.biometricPublicKey      || null,
                biometricCounter:        application.biometricCounter        || 0,
                biometricRegisteredAt:   application.biometricRegisteredAt   || null,
                biometricDeviceName:     application.biometricDeviceName     || null,
                // FIX: face liveness template from LAF — used for LDF verification
                faceTemplate:            application.faceTemplate            || null,
                faceEnrolledAt:          application.faceEnrolledAt          || null,
                // CI investigator name
                ciName:                  investigation?.picUserName          || null,
                // Client metadata
                status:                  'pending',
                delinquent:              false,
                duplicate:               false,
                groupLeader:             false,
                archived:                false,
                insertedBy:              investigation?.picUserId            || null,
                dateAdded:               moment().format('YYYY-MM-DD'),
            }]
        })
    ).then(r => r.data?.clients?.returning ?? []);

    if (!newClient) {
        return res.status(200).json({
            success: false,
            message: 'Failed to create client record. Please try again.',
        });
    }

    // Mark LAF as promoted with the new clientId
    await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: refCode } },
            set: {
                status:           'promoted',
                promotedAt:       moment().toISOString(),
                promotedClientId: clientId,
            },
        })
    );

    return res.status(200).json({
        success:          true,
        isExistingClient: false,
        clientId,
        ciData: {
            ciReferenceCode: application.ciReferenceCode,
            investigatedBy:  investigation?.picUserName || '',
            investigatedAt:  investigation?.investigatedAt,
            decision:        investigation?.decision,
        },
        loanData: {
            loanAmount:             application.loanAmount,
            loanPurpose:            application.loanPurpose,
            guarantorFirstName:     application.guarantorFirstName,
            guarantorLastName:      application.guarantorLastName,
            guarantorRelationship:  application.guarantorRelationship,
            guarantorContactNumber: application.guarantorContactNumber,
            groupId:                application.groupId,
            loId:                   application.loId,
            clientType:             application.clientType,
        },
        photos: { lafPhotoUrl, selfieUrl },
        duplicateCandidates,
    });
}