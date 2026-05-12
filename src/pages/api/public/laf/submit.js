// src/pages/api/public/laf/submit.js
import { publicApiHandler } from '@/services/public-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';
import moment from 'moment';
import crypto from 'crypto';

const graph = new GraphProvider();

const GROUP_TYPE = createGraphType('groups', `
    _id name branchId loanOfficerId loanOfficerName qrToken qrExpiresAt
    branch { _id name code }
`)('groups');

const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default publicApiHandler({ post: submitLAF });

async function submitLAF(req, res) {
    const {
        groupId, qrToken,
        firstName, lastName, middleName, birthdate, contactNumber,
        addressStreetNo, addressBarangayDistrict, addressMunicipalityCity,
        addressProvince, addressZipCode,
        loanAmount, loanPurpose,
        guarantorFirstName, guarantorLastName,
        guarantorRelationship, guarantorContactNumber,
        lafPhotoKey,
        // ── Address extras ────────────────────────────────────────────────
        landmark,
        distanceFromBranch,
        // ── Biometric fields from LAFBiometricStep ────────────────────────
        biometricCredentialId,
        biometricPublicKey,
        biometricCounter,
        biometricRegisteredAt,
        biometricDeviceName,
        // Government ID
        governmentIdType,
        governmentIdNumber,
        governmentIdPhotoKey,
        selfieWithIdPhotoKey,
        // Client type
        clientType,
        existingClientId,
        existingLoanId,
        detailFlags,
    } = req.body;

    // Basic presence check
    if (!branchId || !qrToken) {
        return res.status(200).json({
            success: false,
            message: 'Missing branchId or qrToken.',
        });
    }

    // ── Step 1: Find group by qrToken directly ──────────────────────────
    const [group] = await graph.query(
        queryQl(GROUP_TYPE, {
            where: { qrToken: { _eq: qrToken } }
        })
    ).then(r => r.data?.groups ?? []);

    if (!group) {
        return res.status(200).json({
            success: false,
            message: 'QR code is invalid or has been regenerated. Please scan the latest QR code.',
        });
    }

    // ── Step 2: Validate QR not expired ──────────────────────────────────
    if (group.qrExpiresAt && moment().isAfter(moment(group.qrExpiresAt))) {
        return res.status(200).json({
            success: false,
            message: 'This QR code has expired. Please ask your Loan Officer for a new QR code.',
        });
    }

    // branchId comes from req.body — validate it matches group
    // loId resolved from group record
    const resolvedLoId = group.loanOfficerId;

    if (!lafPhotoKey) {
        return res.status(200).json({
            success: false,
            message: 'A client photo is required to submit the application.',
        });
    }

    // ── Generate CI reference code ────────────────────────────────────────
    const dateStr = moment().format('YYYYMMDD');
    const suffix  = crypto.randomBytes(3).toString('hex').toUpperCase();
    const branchCode = group.branch?.code || branchId.slice(-4).toUpperCase();
    const ciReferenceCode = `CI-${branchCode}-${dateStr}-${suffix}`;

    // ── Insert into temporaryLoanApplications ─────────────────────────────
    const [application] = await graph.mutation(
        insertQl(TEMP_TYPE, {
            objects: [{
                _id: generateUUID(),
                ciReferenceCode,
                branchId,
                groupId: group._id,
                loId: resolvedLoId,
                firstName:  firstName?.trim().toUpperCase(),
                lastName:   lastName?.trim().toUpperCase(),
                middleName: middleName?.trim().toUpperCase() || '',
                birthdate,
                contactNumber,
                addressStreetNo,
                addressBarangayDistrict,
                addressMunicipalityCity,
                addressProvince,
                addressZipCode,
                address: [
                    addressStreetNo, addressBarangayDistrict,
                    addressMunicipalityCity, addressProvince, addressZipCode,
                ].filter(Boolean).join(', '),
                loanAmount:             loanAmount ? parseFloat(loanAmount) : null,
                loanPurpose,
                guarantorFirstName:     guarantorFirstName?.trim().toUpperCase(),
                guarantorLastName:      guarantorLastName?.trim().toUpperCase(),
                guarantorRelationship,
                guarantorContactNumber,
                lafPhotoKey,
                status:      'pending',
                dateAdded:   moment().format('YYYY-MM-DD'),
                submittedAt: new Date().toISOString(),
                expiresAt:   moment().add(30, 'days').toISOString(),
                // ── Biometric — captured during LAFBiometricStep ──────────
                landmark:              landmark              || null,
                distanceFromBranch:    distanceFromBranch    || null,
                biometricCredentialId: biometricCredentialId || null,
                biometricPublicKey:    biometricPublicKey    || null,
                biometricCounter:      biometricCounter      || 0,
                biometricRegisteredAt: biometricRegisteredAt || null,
                biometricDeviceName:   biometricDeviceName   || null,
                // Government ID
                governmentIdType:      governmentIdType      || null,
                governmentIdNumber:    governmentIdNumber    || null,
                governmentIdPhotoKey:  governmentIdPhotoKey  || null,
                selfieWithIdPhotoKey:  selfieWithIdPhotoKey  || null,
                // Client type metadata
                clientType:            clientType            || 'prospect',
                existingClientId:      existingClientId      || null,
                existingLoanId:        existingLoanId        || null,
                detailFlags:           detailFlags           || [],
                isOffline:             false,
            }]
        })
    ).then(r => r.data?.temporaryLoanApplications?.returning ?? []);

    if (!application) {
        return res.status(200).json({
            success: false,
            message: 'Failed to save application. Please try again.',
        });
    }

    res.status(200).json({
        success: true,
        ciReferenceCode,
        message: 'Application submitted successfully.',
    });
}