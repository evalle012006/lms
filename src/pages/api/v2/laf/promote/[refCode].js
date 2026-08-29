// src/pages/api/v2/laf/promote/[refCode].js
// Promotes a ci_approved LAF into a client record (new) or updates existing (reloan/pending/balik).
//
// FIX (idempotency): converted GET -> POST; promotion is now claimed atomically via
//   UPDATE ... WHERE status = 'ci_approved'. A concurrent second call sees zero
//   affected rows and exits before ever inserting a client. If client creation/update
//   fails after the claim succeeds, status is reverted to 'ci_approved' so the
//   application isn't left stuck and a retry is possible.
//
// FIX (duplicate-check extraction): checkDuplicates/calculateSimilarity moved to
//   @/lib/duplicate-check so laf/detail.js's preview-time warning and this file's
//   enforcement can never drift out of sync with each other.
//
// FIX (assignment override): accepts optional groupId/loId in the POST body for the
//   New-Prospect branch only — lets AddUpdateClientPage.js's manual "Add Client"
//   screen reassign Group/LO at creation time. Falls back to the LAF's own
//   application.groupId/loId when not provided (e.g. CIReviewPanel's auto-promote,
//   which sends no body). Existing-client branch is unaffected — reassignment for
//   reloan/pending/balik clients is a separate transfer operation, not this endpoint.
//
// Previous fixes (unchanged):
// FIX 1: selfieWithIdPhotoKey added to existing client update payload (was missing)
// FIX 2: ci_approved no longer blocks a new LAF submission — handled in lookup-client.js
// FIX 3: ch.lastName and ch.middleName removed — name changes need dedicated transaction
// FIX 4: All new personal info fields (civilStatus, yearsOfStay, business, dailyIncome,
//         faceTemplate, faceEnrolledAt, livenessScore, birthdate) included for existing clients
// FIX 5: Balik status reset to 'pending' on promote

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS, CLIENT_FIELDS } from '@/lib/graph.fields';
import { checkDuplicates }          from '@/lib/duplicate-check';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateUUID } from '@/lib/utils';
import moment from 'moment';

const graph = new GraphProvider();
const TEMP_TYPE       = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE         = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const CLIENT_TYPE     = createGraphType('client', CLIENT_FIELDS)('clients');
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
    const command = new GetObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: key });
    return getSignedUrl(s3, command, { expiresIn: 900 });
}

export default apiHandler({ post: promoteApplication });

async function promoteApplication(req, res) {
    const { refCode } = req.query;
    const { groupId: overrideGroupId, loId: overrideLoId } = req.body || {};

    const [application] = await graph.query(
        queryQl(TEMP_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'CI code not found.' });
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
            message: application.status === 'promoted'
                ? 'This CI code has already been used. The client record already exists.'
                : `Cannot promote — application status is "${application.status}". CI must approve first.`,
        });
    }

    // ── Atomic claim ─────────────────────────────────────────────────────
    // Only the request that wins this row-locked update proceeds. A concurrent
    // call (retry, double-click, auto-promote firing twice) affects zero rows
    // here and exits before any client is ever inserted.
    const claimed = await graph.mutation(
        updateQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: refCode }, status: { _eq: 'ci_approved' } },
            set:   { status: 'promoted', promotedAt: moment().toISOString() },
        })
    ).then(r => r.data?.temporaryLoanApplications?.returning ?? []);

    if (claimed.length === 0) {
        return res.status(200).json({
            success: false,
            message: 'This CI code was just promoted by another request. The client record already exists.',
        });
    }

    const [investigation] = await graph.query(
        queryQl(CI_TYPE, { where: { ciReferenceCode: { _eq: refCode } } })
    ).then(r => r.data?.ciInvestigations ?? []);

    const existingClient = application.existingClientId
        ? await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: application.existingClientId } } })
          ).then(r => r.data?.clients?.[0] ?? null)
        : null;

    const [lafPhotoUrl, selfieUrl, duplicateCandidates] = await Promise.all([
        application.lafPhotoKey  ? getSignedUrlForKey(application.lafPhotoKey)  : Promise.resolve(null),
        investigation?.selfieKey ? getSignedUrlForKey(investigation.selfieKey)  : Promise.resolve(null),
        checkDuplicates(application.firstName, application.lastName),
    ]);

    try {
        // ── Existing client (reloan / pending / balik) ────────────────────
        if (application.existingClientId) {
            const updatePayload = {};

            const ch = application.clientChanges || {};
            if (ch.contactNumber)           updatePayload.contactNumber           = ch.contactNumber.trim();
            if (ch.addressStreetNo)         updatePayload.addressStreetNo         = ch.addressStreetNo.trim();
            if (ch.addressBarangayDistrict) updatePayload.addressBarangayDistrict = ch.addressBarangayDistrict.trim();
            if (ch.addressMunicipalityCity) updatePayload.addressMunicipalityCity = ch.addressMunicipalityCity.trim();
            if (ch.addressProvince)         updatePayload.addressProvince         = ch.addressProvince.trim();

            if (application.contactNumber && !ch.contactNumber)
                updatePayload.contactNumber = application.contactNumber;
            if (application.addressStreetNo && !ch.addressStreetNo)
                updatePayload.addressStreetNo = application.addressStreetNo;
            if (application.addressBarangayDistrict && !ch.addressBarangayDistrict)
                updatePayload.addressBarangayDistrict = application.addressBarangayDistrict;
            if (application.addressMunicipalityCity && !ch.addressMunicipalityCity)
                updatePayload.addressMunicipalityCity = application.addressMunicipalityCity;
            if (application.addressProvince && !ch.addressProvince)
                updatePayload.addressProvince = application.addressProvince;
            if (application.addressZipCode)     updatePayload.addressZipCode     = application.addressZipCode;
            if (application.landmark)           updatePayload.landmark           = application.landmark;
            if (application.distanceFromBranch) updatePayload.distanceFromBranch = application.distanceFromBranch;

            if (application.lafPhotoKey) updatePayload.profile = application.lafPhotoKey;

            if (application.governmentIdType)     updatePayload.governmentIdType     = application.governmentIdType;
            if (application.governmentIdNumber)   updatePayload.governmentIdNumber   = application.governmentIdNumber;
            if (application.governmentIdPhotoKey) updatePayload.governmentIdPhotoKey = application.governmentIdPhotoKey;
            if (application.selfieWithIdPhotoKey) updatePayload.selfieWithIdPhotoKey = application.selfieWithIdPhotoKey;

            if (application.biometricCredentialId) {
                updatePayload.biometricCredentialId = application.biometricCredentialId;
                updatePayload.biometricPublicKey    = application.biometricPublicKey;
                updatePayload.biometricCounter      = application.biometricCounter || 0;
                updatePayload.biometricRegisteredAt = application.biometricRegisteredAt;
                updatePayload.biometricDeviceName   = application.biometricDeviceName;
            }

            if (application.clientType === 'balik') {
                updatePayload.status = 'pending';
            }

            if (application.faceTemplate)   updatePayload.faceTemplate   = application.faceTemplate;
            if (application.faceEnrolledAt) updatePayload.faceEnrolledAt = application.faceEnrolledAt;
            if (application.livenessScore != null && !existingClient?.livenessScore) {
                updatePayload.livenessScore = application.livenessScore;
            }

            if (application.birthdate   && !existingClient?.birthdate)   updatePayload.birthdate   = application.birthdate;
            if (application.civilStatus && !existingClient?.civilStatus) updatePayload.civilStatus = application.civilStatus;
            if (application.yearsOfStay && !existingClient?.yearsOfStay) updatePayload.yearsOfStay = application.yearsOfStay;
            if (application.business    && !existingClient?.business)    updatePayload.business    = application.business;
            if (application.dailyIncome && !existingClient?.dailyIncome) updatePayload.dailyIncome = application.dailyIncome;

            if (investigation?.picUserName) updatePayload.ciName = investigation.picUserName;

            if (Object.keys(updatePayload).length > 0) {
                await graph.mutation(
                    updateQl(CLIENT_TYPE, {
                        where: { _id: { _eq: application.existingClientId } },
                        set:   updatePayload,
                    })
                );
            }

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

        // ── New prospect — Option A: directly insert client record ────────
        const clientId = generateUUID();

        // Assignment: caller-supplied override wins, else fall back to the
        // LAF's own groupId/loId. CIReviewPanel's auto-promote sends no
        // body, so overrideGroupId/overrideLoId are undefined there and
        // this resolves exactly as before.
        const resolvedGroupId = overrideGroupId || application.groupId || null;
        const resolvedLoId    = overrideLoId    || application.loId    || null;

        const [group] = await graph.query(
            queryQl(GROUP_NAME_TYPE, { where: { _id: { _eq: resolvedGroupId } } })
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
                    groupId:                 resolvedGroupId,
                    loId:                    resolvedLoId,
                    groupName:               group?.name                         || '',
                    profile:                 application.lafPhotoKey             || null,
                    governmentIdType:        application.governmentIdType        || null,
                    governmentIdNumber:      application.governmentIdNumber      || null,
                    governmentIdPhotoKey:    application.governmentIdPhotoKey    || null,
                    selfieWithIdPhotoKey:    application.selfieWithIdPhotoKey    || null,
                    biometricCredentialId:   application.biometricCredentialId   || null,
                    biometricPublicKey:      application.biometricPublicKey      || null,
                    biometricCounter:        application.biometricCounter        || 0,
                    biometricRegisteredAt:   application.biometricRegisteredAt   || null,
                    biometricDeviceName:     application.biometricDeviceName     || null,
                    faceTemplate:            application.faceTemplate            || null,
                    faceEnrolledAt:          application.faceEnrolledAt          || null,
                    civilStatus:             application.civilStatus             || null,
                    yearsOfStay:             application.yearsOfStay             || null,
                    business:                application.business                || null,
                    dailyIncome:             application.dailyIncome             || null,
                    ciName:                  investigation?.picUserName          || null,
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
            throw new Error('Failed to create client record.');
        }

        // Claim already set status + promotedAt — just attach the new client id.
        await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: { ciReferenceCode: { _eq: refCode } },
                set:   { promotedClientId: clientId },
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
                groupId:                resolvedGroupId,
                loId:                   resolvedLoId,
                clientType:             application.clientType,
            },
            photos: { lafPhotoUrl, selfieUrl },
            duplicateCandidates,
        });

    } catch (err) {
        // Something failed after we'd already claimed the promotion. Revert
        // so the application isn't stuck "promoted" with no client attached,
        // and so a retry from the LAF tab actually has something to do.
        await graph.mutation(
            updateQl(TEMP_TYPE, {
                where: { ciReferenceCode: { _eq: refCode } },
                set:   { status: 'ci_approved', promotedAt: null },
            })
        ).catch(() => { /* best-effort revert; original error still surfaces below */ });

        console.error('[promote] failed after claim:', err);
        return res.status(200).json({
            success: false,
            message: 'Failed to create client record. Please try again.',
        });
    }
}