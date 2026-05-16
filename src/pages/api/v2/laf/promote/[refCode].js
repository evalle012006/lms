import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS, CI_INVESTIGATION_FIELDS } from '@/lib/graph.fields';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const graph = new GraphProvider();
const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');
const CI_TYPE = createGraphType('ciInvestigations', CI_INVESTIGATION_FIELDS)('ciInvestigations');
const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName branchName similarityScore
`)('clients');

const s3 = new S3Client({
    endpoint: 'https://sgp1.digitaloceanspaces.com',
    region: 'sgp1',
    credentials: {
        accessKeyId: process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    const command = new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key: key,
    });
    return getSignedUrl(s3, command, { expiresIn: 900 });
}

// ── Direct GraphQL duplicate check — no internal HTTP call ────────────────
async function checkDuplicates(firstName, lastName) {
    if (!firstName || !lastName) return [];

    const firstNameUpper = firstName.trim().toUpperCase();
    const lastNameUpper  = lastName.trim().toUpperCase();

    // Broad ilike search — same logic as clients/search?mode=duplicate
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

    // Score each result — mirror calculateClientSimilarity from clients/search.js
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
        application.lafPhotoKey ? getSignedUrlForKey(application.lafPhotoKey) : Promise.resolve(null),
        investigation?.selfieKey ? getSignedUrlForKey(investigation.selfieKey) : Promise.resolve(null),
        checkDuplicates(application.firstName, application.lastName),
    ]);

    res.status(200).json({
        success: true,
        ciData: {
            ciReferenceCode: application.ciReferenceCode,
            investigatedBy:  investigation.picUserName || '',
            investigatedAt:  investigation.investigatedAt,
            decision:        investigation.decision,
        },
        clientData: {
            firstName:               application.firstName,
            lastName:                application.lastName,
            middleName:              application.middleName,
            birthdate:               application.birthdate,
            contactNumber:           application.contactNumber,
            addressStreetNo:         application.addressStreetNo,
            addressBarangayDistrict: application.addressBarangayDistrict,
            addressMunicipalityCity: application.addressMunicipalityCity,
            addressProvince:         application.addressProvince,
            addressZipCode:          application.addressZipCode,
            loanAmount:              application.loanAmount,
            loanPurpose:             application.loanPurpose,
            guarantorFirstName:      application.guarantorFirstName,
            guarantorLastName:       application.guarantorLastName,
            guarantorRelationship:   application.guarantorRelationship,
            guarantorContactNumber:  application.guarantorContactNumber,
            lafPhotoKey:             application.lafPhotoKey         || null,
            // ── Biometric ─────────────────────────────────────────────────
            biometricCredentialId:   application.biometricCredentialId || null,
            biometricPublicKey:      application.biometricPublicKey    || null,
            biometricCounter:        application.biometricCounter      || 0,
            biometricRegisteredAt:   application.biometricRegisteredAt || null,
            biometricDeviceName:     application.biometricDeviceName   || null,
            // ── Phase 2 fields — Government ID ────────────────────────────
            governmentIdType:        application.governmentIdType      || null,
            governmentIdNumber:      application.governmentIdNumber    || null,
            governmentIdPhotoKey:    application.governmentIdPhotoKey  || null,
            selfieWithIdPhotoKey:    application.selfieWithIdPhotoKey  || null,
            // ── Phase 2 fields — Address extras ───────────────────────────
            landmark:                application.landmark              || null,
            distanceFromBranch:      application.distanceFromBranch   || null,
            // ── Phase 2 fields — Client type + origin ─────────────────────
            clientType:              application.clientType            || 'prospect',
            existingClientId:        application.existingClientId      || null,
            existingLoanId:          application.existingLoanId        || null,
            groupId:                 application.groupId               || null,
            loId:                    application.loId                  || null,
            isOffline:               application.isOffline             || false,
        },
        loanData: {
            loanAmount:  application.loanAmount,
            loanPurpose: application.loanPurpose,
        },
        photos: {
            lafPhotoUrl,
            selfieUrl,
        },
        duplicateCandidates,
    });
}