// src/pages/api/public/laf/submit.js
import { publicApiHandler } from '@/services/public-api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl } from '@/lib/graph/graph.util';
import { TEMP_LOAN_APP_FIELDS } from '@/lib/graph.fields';
import { sendLAFSubmittedSMS }  from '@/lib/sms-service';
import { generateUUID } from '@/lib/utils';
import moment from 'moment';
import crypto from 'crypto';

const graph = new GraphProvider();

const GROUP_TYPE = createGraphType('groups', `
    _id name branchId loanOfficerId loanOfficerName qrToken qrExpiresAt
    branch { _id name code }
`)('groups');

const CLIENT_ID_TYPE = createGraphType('client', `
    _id firstName lastName status
`)('clients');

const TEMP_ID_TYPE = createGraphType('temporaryLoanApplications', `
    _id firstName lastName status ciReferenceCode
`)('temporaryLoanApplications');

const ACTIVE_LAF_STATUSES = ['pending', 'ci_approved', 'pending_validation'];

const TEMP_LAF_CHECK_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status
`)('temporaryLoanApplications');

const TEMP_TYPE = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default publicApiHandler({ post: submitLAF });

async function submitLAF(req, res) {
    const {
        groupId, branchId, qrToken,
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
        // FIX: clientChanges was missing from destructuring — now added
        clientChanges,
        // Duplicate flagging
        isDuplicateFlagged,
        duplicateCandidateIds,
        isBalikUnmatched,
        // Balik history
        oldGroupId,
        oldLoId,
        faceTemplate,
        faceEnrolledAt,
        livenessScore,
    } = req.body;

    // Basic presence check
    if (!groupId || !qrToken) {
        return res.status(200).json({
            success: false,
            message: 'Missing groupId or qrToken.',
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

    // ── Server-side Government ID uniqueness check ──────────────────────
    // Run for ALL client types that capture an ID — existingClientId excludes self
    // FIX: removed client name from error messages — public endpoint must not leak PII
    if (governmentIdType && governmentIdNumber?.trim()) {
        const cleanId   = governmentIdNumber.trim();
        const excludeId = existingClientId || '__none__';

        const [dupeClients, dupeLAFs] = await Promise.all([
            // Check promoted clients
            graph.query(
                queryQl(CLIENT_ID_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   governmentIdType },
                        governmentIdNumber: { _ilike: cleanId         },
                        status:             { _neq:  'archived'       },
                        _id:                { _neq:  excludeId        },
                    },
                    limit: 1,
                })
            ).then(r => r.data?.clients ?? []),

            // Check active LAF pipeline
            graph.query(
                queryQl(TEMP_ID_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   governmentIdType      },
                        governmentIdNumber: { _ilike: cleanId               },
                        status:             { _in:   ACTIVE_LAF_STATUSES   },
                        existingClientId:   { _neq:  excludeId             },
                    },
                    limit: 1,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []),
        ]);

        // FIX: generic messages — no names, no CI reference codes exposed
        if (dupeClients.length > 0) {
            return res.status(200).json({
                success: false,
                message: `This ${governmentIdType} ID is already registered to an existing client record. ` +
                    `If this is an existing member, please select Reloan, Pending Member, or Balik instead.`,
            });
        }

        if (dupeLAFs.length > 0) {
            return res.status(200).json({
                success: false,
                message: `This ${governmentIdType} ID is already associated with an active application. ` +
                    `The previous application must be completed or declined before submitting a new one.`,
            });
        }
    }

    // ── Check for existing pending CI application (reloan/pending only) ────────
    if ((clientType === 'reloan' || clientType === 'pending' || clientType === 'balik') && existingClientId) {
        const pendingApps = await graph.query(
            queryQl(TEMP_LAF_CHECK_TYPE, {
                where: {
                    existingClientId: { _eq: existingClientId },
                    status:           { _in: ['pending', 'pending_validation'] },
                },
                limit: 1,
            })
        ).then(r => r.data?.temporaryLoanApplications ?? []);

        if (pendingApps.length > 0) {
            const app = pendingApps[0];
            return res.status(200).json({
                success: false,
                message: `This member already has a loan application pending CI review (${app.ciReferenceCode}). The current application must be processed before submitting a new one.`,
            });
        }
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
                // ── Address extras ────────────────────────────────────────
                landmark:              landmark              || null,
                distanceFromBranch:    distanceFromBranch    || null,
                // ── Biometric — captured during LAFBiometricStep ──────────
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
                isOffline:             false,
                // Balik history — previous assignment preserved
                oldGroupId:            oldGroupId            || null,
                oldLoId:               oldLoId               || null,
                // Duplicate / Balik flagging
                isDuplicateFlagged:    isDuplicateFlagged    || false,
                duplicateCandidateIds: duplicateCandidateIds || [],
                isBalikUnmatched:      isBalikUnmatched      || false,
                // FIX: clientChanges was never saved — now persisted to DB
                // Contains only fields the member explicitly changed in the Confirm step
                clientChanges:         clientChanges && typeof clientChanges === 'object'
                    ? clientChanges
                    : {},
                // FIX: detailFlags was destructured but never inserted
                detailFlags:           Array.isArray(detailFlags) ? detailFlags : [],
                faceTemplate:   faceTemplate   || null,
                faceEnrolledAt: faceEnrolledAt || null,
                livenessScore:  livenessScore  != null ? livenessScore : null,
                // If prospect has duplicates → requires admin validation before promote
                ...(isDuplicateFlagged ? { status: 'pending_validation' } : {}),
            }]
        })
    ).then(r => r.data?.temporaryLoanApplications?.returning ?? []);

    if (!application) {
        return res.status(200).json({
            success: false,
            message: 'Failed to save application. Please try again.',
        });
    }

    // Send SMS to applicant — non-blocking, never fails the request
    sendLAFSubmittedSMS({
        contactNumber:   contactNumber,
        firstName:       firstName,
        ciReferenceCode: ciReferenceCode,
        branchName:      group?.branch?.name || branchName || 'our branch',
    }).catch(e => console.error('[LAF submit] SMS error:', e.message));

    res.status(200).json({
        success: true,
        ciReferenceCode,
        message: 'Application submitted successfully.',
    });
}