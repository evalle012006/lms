// src/pages/api/v2/laf/detail.js
// GET ?ciCode=xxx
// Authenticated — returns full LAF application detail for a given CI reference code.
// Used by /laf/[ciCode] page when BM or LO scans client QR.

import { apiHandler }                from '@/services/api-handler';
import { GraphProvider }             from '@/lib/graph/graph.provider';
import { createGraphType, queryQl }  from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS }      from '@/lib/graph.fields';
import { S3Client, GetObjectCommand }  from '@aws-sdk/client-s3';
import { getSignedUrl }                from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
    endpoint:       'https://sgp1.digitaloceanspaces.com',
    region:         'sgp1',
    credentials:    {
        accessKeyId:     process.env.SPACES_ACCESS_KEY,
        secretAccessKey: process.env.SPACES_SECRET_KEY,
    },
    forcePathStyle: false,
});

async function getSignedUrlForKey(key) {
    if (!key) return null;
    return getSignedUrl(s3, new GetObjectCommand({
        Bucket: process.env.SPACES_BUCKET,
        Key:    key,
    }), { expiresIn: 900 });
}
import { logAudit }                  from '@/lib/audit';
import { findUserById }              from '@/lib/graph.functions';

const graph = new GraphProvider();

const TEMP_TYPE = createGraphType(
    'temporaryLoanApplications', TEMP_LOAN_APP_FIELDS
)('temporaryLoanApplications');

const CI_TYPE = createGraphType('ciInvestigations', `
    _id ciReferenceCode decision findings investigatedAt syncedAt
    picUserName selfieKey
`)('ciInvestigations');

export default apiHandler({ get: getDetail });

async function getDetail(req, res) {
    const { ciCode } = req.query;
    if (!ciCode) return res.status(200).json({ success: false, message: 'ciCode required.' });

    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser) return res.status(200).json({ success: false, message: 'User not found.' });

    // Fetch application
    const [application] = await graph.query(
        queryQl(TEMP_TYPE, {
            where: { ciReferenceCode: { _eq: ciCode } },
        })
    ).then(r => r.data?.temporaryLoanApplications ?? []);

    if (!application) {
        return res.status(200).json({ success: false, message: 'Application not found.' });
    }

    // Rep 3/4 can only see their own branch
    if (currentUser.role.rep >= 3 && application.branchId !== currentUser.designatedBranchId) {
        return res.status(200).json({
            success: false,
            message: 'You do not have access to this application.',
        });
    }

    // Fetch CI investigation if exists
    const [investigation] = await graph.query(
        queryQl(CI_TYPE, {
            where: { ciReferenceCode: { _eq: ciCode } },
        })
    ).then(r => r.data?.ciInvestigations ?? []);

    // Get signed URL for LAF photo
    const lafPhotoUrl = application.lafPhotoKey
        ? await getSignedUrlForKey(application.lafPhotoKey).catch(() => null)
        : null;

    // Audit — log each access
    await logAudit(req, {
        action:      'LAF_DETAIL_VIEWED',
        category:    'LAF',
        severity:    'INFO',
        entityType:  'temporaryLoanApplication',
        entityId:    application._id,
        description: `LAF detail viewed for ${application.firstName} ${application.lastName} (${ciCode}) by ${currentUser.firstName} ${currentUser.lastName}`,
        branchId:    application.branchId,
        userId:      currentUser._id,
        userName:    `${currentUser.firstName} ${currentUser.lastName}`,
    });

    return res.status(200).json({
        success: true,
        ciData: investigation ? {
            ciReferenceCode: investigation.ciReferenceCode,
            decision:        investigation.decision,
            findings:        investigation.findings,
            investigatedAt:  investigation.investigatedAt,
            investigatedBy:  investigation.picUserName,
        } : null,
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
            landmark:                application.landmark,
            distanceFromBranch:      application.distanceFromBranch,
            loanAmount:              application.loanAmount,
            loanPurpose:             application.loanPurpose,
            guarantorFirstName:      application.guarantorFirstName,
            guarantorLastName:       application.guarantorLastName,
            guarantorRelationship:   application.guarantorRelationship,
            guarantorContactNumber:  application.guarantorContactNumber,
            lafPhotoKey:             application.lafPhotoKey,
            governmentIdType:        application.governmentIdType,
            governmentIdNumber:      application.governmentIdNumber,
            governmentIdPhotoKey:    application.governmentIdPhotoKey,
            selfieWithIdPhotoKey:    application.selfieWithIdPhotoKey,
            biometricCredentialId:   application.biometricCredentialId,
            biometricDeviceName:     application.biometricDeviceName,
            biometricRegisteredAt:   application.biometricRegisteredAt,
            clientType:              application.clientType,
            status:                  application.status,
            isOffline:               application.isOffline,
            submittedAt:             application.submittedAt,
        },
        photos: {
            lafPhotoUrl,
        },
    });
}