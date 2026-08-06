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

// Used for server-side prospect name duplicate check against both tables
const CLIENT_NAME_TYPE = createGraphType('client', `
    _id firstName lastName middleName status
`)('clients');

const TEMP_NAME_TYPE = createGraphType('temporaryLoanApplications', `
    _id firstName lastName middleName status ciReferenceCode
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
        guarantorAddress,
        // Guarantor extended fields — captured in PublicLAFForm Loan step
        guarantorBirthDate,
        guarantorCivilStatus,
        guarantorBusiness,
        guarantorDailyIncome,
        lafPhotoKey,
        // Address extras
        landmark,
        distanceFromBranch,
        // Biometric fields from LAFBiometricStep
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
        clientChanges,
        // Balik history
        oldGroupId,
        oldLoId,
        // Face liveness
        faceTemplate,
        faceEnrolledAt,
        livenessScore,
        // Borrower personal info
        civilStatus,
        yearsOfStay,
        business,
        dailyIncome,
        // Balik
        isBalikUnmatched,
    } = req.body;

    // isDuplicateFlagged and duplicateCandidateIds extracted as `let`
    // so server can override client-sent values after running its own name check.
    // Client-sent values are NEVER trusted for prospects — server always re-derives.
    let isDuplicateFlagged    = false; // always reset — server derives below
    let duplicateCandidateIds = [];

    // Basic presence check
    if (!groupId || !qrToken) {
        return res.status(200).json({
            success: false,
            message: 'Missing groupId or qrToken.',
        });
    }

    // ── Step 1: Find group by qrToken directly ────────────────────────────
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

    // ── Time restriction check ────────────────────────────────────────────
    const [sysSettings] = await graph.query(
        queryQl(
            createGraphType('settings', 'qrAllowedStartTime qrAllowedEndTime')('settings'),
            { limit: 1 }
        )
    ).then(r => r.data?.settings ?? []);

    const manilaTime = moment().utcOffset('+08:00');
    const startTime  = sysSettings?.qrAllowedStartTime || '06:00';
    const endTime    = sysSettings?.qrAllowedEndTime   || '22:00';
    const [sH, sM]   = startTime.split(':').map(Number);
    const [eH, eM]   = endTime.split(':').map(Number);
    const nowMins    = manilaTime.hours() * 60 + manilaTime.minutes();
    if (nowMins < (sH * 60 + sM) || nowMins >= (eH * 60 + eM)) {
        return res.status(200).json({
            success: false,
            message: `Applications are only accepted between ${startTime} and ${endTime} (Manila time).`,
        });
    }

    const resolvedLoId = group.loanOfficerId;

    if (!lafPhotoKey) {
        return res.status(200).json({
            success: false,
            message: 'A client photo is required to submit the application.',
        });
    }

    // ── Server-side Government ID uniqueness check ────────────────────────
    // Runs for ALL client types that capture an ID.
    // existingClientId excludes self so reloan/pending/balik don't block on their own ID.
    if (governmentIdType && governmentIdNumber?.trim()) {
        const cleanId   = governmentIdNumber.trim();
        const excludeId = existingClientId || '__none__';

        const [dupeClients, dupeLAFs] = await Promise.all([
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

            graph.query(
                queryQl(TEMP_ID_TYPE, {
                    where: {
                        governmentIdType:   { _eq:   governmentIdType    },
                        governmentIdNumber: { _ilike: cleanId             },
                        status:             { _in:   ACTIVE_LAF_STATUSES },
                        existingClientId:   { _neq:  excludeId           },
                    },
                    limit: 1,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []),
        ]);

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

    // ── Anti-spam: check for existing pending CI application (reloan/pending/balik) ─
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

    // ── Server-side name duplicate check for prospects ────────────────────
    // Two distinct cases:
    //
    // CASE 1 — Same name found in `clients` (promoted client):
    //   → isDuplicateFlagged = true, status = pending_validation
    //   → Admin must review before the app can proceed
    //   → duplicateCandidateIds contains the matching client IDs
    //
    // CASE 2 — Same name found in `temporaryLoanApplications` (pending LAF):
    //   → Hard block — return success: false immediately
    //   → Prevents spamming of applications for the same name
    //   → CI reference code NOT exposed — public endpoint must not leak PII
    if (clientType === 'prospect') {
        const firstUpper   = firstName?.trim().toUpperCase();
        const lastUpper    = lastName?.trim().toUpperCase();

        if (firstUpper && lastUpper) {
            const [nameMatchClients, nameMatchLAFs] = await Promise.all([
                // CASE 1: check promoted clients — firstName + lastName match
                graph.query(
                    queryQl(CLIENT_NAME_TYPE, {
                        where: {
                            firstName: { _eq: firstUpper },
                            lastName:  { _eq: lastUpper  },
                            status:    { _nin: ['archived', 'merged'] },
                        },
                        limit: 5,
                    })
                ).then(r => r.data?.clients ?? []),

                // CASE 2: check pending LAFs — hard block re-submission of same name
                graph.query(
                    queryQl(TEMP_NAME_TYPE, {
                        where: {
                            firstName: { _eq: firstUpper },
                            lastName:  { _eq: lastUpper  },
                            status:    { _in: ['pending', 'pending_validation', 'ci_approved'] },
                        },
                        limit: 1,
                    })
                ).then(r => r.data?.temporaryLoanApplications ?? []),
            ]);

            // CASE 2: pending LAF with same name → hard block
            // FIX: do NOT expose CI reference code — public endpoint must not leak PII
            if (nameMatchLAFs.length > 0) {
                return res.status(200).json({
                    success: false,
                    message: 'A loan application for this name is already pending processing. ' +
                        'The previous application must be completed or declined before submitting a new one. ' +
                        'If this is a different person, please inform your Loan Officer.',
                });
            }

            // CASE 1: promoted client with same name → flag for admin validation
            if (nameMatchClients.length > 0) {
                isDuplicateFlagged    = true;
                duplicateCandidateIds = nameMatchClients.map(c => c._id);
            }
        }
    }

    // ── Generate CI reference code ────────────────────────────────────────
    const dateStr         = moment().format('YYYYMMDD');
    const suffix          = crypto.randomBytes(3).toString('hex').toUpperCase();
    const branchCode      = group.branch?.code || branchId.slice(-4).toUpperCase();
    const ciReferenceCode = `CI-${branchCode}-${dateStr}-${suffix}`;

    // ── Insert into temporaryLoanApplications ─────────────────────────────
    const [application] = await graph.mutation(
        insertQl(TEMP_TYPE, {
            objects: [{
                _id: generateUUID(),
                ciReferenceCode,
                branchId,
                groupId: group._id,
                loId:    resolvedLoId,
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
                guarantorAddress:         guarantorAddress?.trim() || null,
                // Guarantor extended fields
                guarantorBirthDate:    guarantorBirthDate    || null,
                guarantorCivilStatus:  guarantorCivilStatus  || null,
                guarantorBusiness:     guarantorBusiness     || null,
                guarantorDailyIncome:  guarantorDailyIncome  || null,
                lafPhotoKey,
                // FIX: status starts as 'pending' by default.
                // Overridden to 'pending_validation' below if server detected a name match.
                status:      'pending',
                dateAdded:   moment().format('YYYY-MM-DD'),
                submittedAt: new Date().toISOString(),
                expiresAt:   moment().add(30, 'days').toISOString(),
                // Address extras
                landmark:              landmark           || null,
                distanceFromBranch:    distanceFromBranch || null,
                // Biometric
                biometricCredentialId: biometricCredentialId || null,
                biometricPublicKey:    biometricPublicKey    || null,
                biometricCounter:      biometricCounter      || 0,
                biometricRegisteredAt: biometricRegisteredAt || null,
                biometricDeviceName:   biometricDeviceName   || null,
                // Government ID
                governmentIdType:      governmentIdType     || null,
                governmentIdNumber:    governmentIdNumber   || null,
                governmentIdPhotoKey:  governmentIdPhotoKey || null,
                selfieWithIdPhotoKey:  selfieWithIdPhotoKey || null,
                // Client type metadata
                clientType:       clientType       || 'prospect',
                existingClientId: existingClientId || null,
                existingLoanId:   existingLoanId   || null,
                isOffline:        false,
                // Balik history
                oldGroupId: oldGroupId || null,
                oldLoId:    oldLoId    || null,
                // FIX: always use server-derived values — client-sent values ignored
                isDuplicateFlagged:    isDuplicateFlagged,
                duplicateCandidateIds: duplicateCandidateIds,
                isBalikUnmatched:      isBalikUnmatched || false,
                // Client changes from Confirm step (reloan/pending/balik)
                clientChanges: clientChanges && typeof clientChanges === 'object'
                    ? clientChanges
                    : {},
                detailFlags: Array.isArray(detailFlags) ? detailFlags : [],
                // Face liveness
                faceTemplate:   faceTemplate   || null,
                faceEnrolledAt: faceEnrolledAt || null,
                livenessScore:  livenessScore  != null ? livenessScore : null,
                // Borrower personal info
                civilStatus:  civilStatus  || null,
                yearsOfStay:  yearsOfStay  || null,
                business:     business     || null,
                dailyIncome:  dailyIncome  || null,
                // FIX: server-derived flag → override status to pending_validation
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

    // Send SMS — non-blocking, never fails the request
    sendLAFSubmittedSMS({
        contactNumber:   contactNumber,
        firstName:       firstName,
        ciReferenceCode: ciReferenceCode,
        branchName:      group?.branch?.name || 'our branch',
    }).catch(e => console.error('[LAF submit] SMS error:', e.message));

    res.status(200).json({
        success: true,
        ciReferenceCode,
        message: 'Application submitted successfully.',
    });
}