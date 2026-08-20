// src/pages/api/public/laf/lookup-client.js
// GET ?groupId=xxx&lastName=xxx&slotNo=xxx&mode=reloan|pending|balik
// Public — no auth. Looks up existing member by last name + slot.
// mode=reloan   → requires active loan
// mode=pending  → requires completed loan (no active loan)
// mode=balik    → requires offset client (old closed loan), any slot in branch

import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id firstName lastName middleName birthdate contactNumber
    addressStreetNo addressBarangayDistrict addressMunicipalityCity
    addressProvince addressZipCode ciName status branchId branchName
    delinquent profile
    governmentIdType governmentIdNumber governmentIdPhotoKey
    oldGroupId oldLoId
    loans (
        where: { status: { _neq: "reject" } }
        order_by: [{ loanCycle: desc }, { insertedDateTime: desc }]
        limit: 5
    ) {
        _id slotNo status loanCycle groupId branchId
        amountRelease loanBalance loanRelease dateAdded dateOfRelease
        guarantorFirstName guarantorLastName guarantorMiddleName
    }
`)('clients');

// For checking existing active CI applications
const TEMP_LAF_TYPE = createGraphType('temporaryLoanApplications', `
    _id ciReferenceCode status submittedAt
`)('temporaryLoanApplications');

// ── Error messages per mode ───────────────────────────────────────────────
const MODE_ERRORS = {
    reloan: {
        noLoan:   'No active loan found at that slot. If your loan is completed, please select Pending Member.',
        wrongStatus: (status) =>
            status === 'completed'
                ? 'Your latest loan is already completed. Please select Pending Member instead of Reloan.'
                : status === 'offset'
                    ? "This member's loan was offset/closed. Please select Balik instead."
                    : `Loan status is "${status}" — cannot apply as Reloan.`,
    },
    pending: {
        noLoan:   'No completed loan found at that slot. If your loan is still active, please select Reloan.',
        wrongStatus: (status) =>
            status === 'active'
                ? 'Your loan is still active. Please select Reloan instead of Pending Member.'
                : status === 'offset'
                    ? "This member's loan was offset/closed. Please select Balik instead."
                    : `Loan status is "${status}" — cannot apply as Pending Member.`,
    },
    balik: {
        noLoan:   'No offset/closed loan found for this member in this branch.',
        wrongStatus: (status) =>
            status === 'active'
                ? 'This member has an active loan. Please select Reloan instead.'
                : status === 'completed'
                    ? 'This member has a completed loan. Please select Pending Member instead.'
                    : `Client status is "${status}" — cannot apply as Balik.`,
    },
};

const REQUIRED_STATUS = { reloan: 'active', pending: 'completed' };

// Statuses that mean the LAF is still being processed — client cannot submit another
// FIX: added 'ci_approved' — this means BM is doing CI but hasn't promoted yet.
// Without this, a client with a ci_approved LAF could re-submit via QR.
const ACTIVE_CI_STATUSES = ['pending', 'pending_validation', 'ci_approved'];

export async function handler(req, res) {
    const {
        groupId, branchId, lastName, firstName, middleName, slotNo, mode,
    } = req.query;

    if (!mode) {
        return res.status(200).json({ success: false, message: 'mode is required.' });
    }

    // mode=all — used for offline cache pre-load
    if (mode === 'all') {
        if (!groupId) {
            return res.status(200).json({ success: false, message: 'groupId required for mode=all.' });
        }
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    groupId: { _eq: groupId },
                    status:  { _in: ['active', 'pending'] },
                },
                limit: 200,
            })
        ).then(r => r.data?.clients ?? []);

        return res.status(200).json({
            success: true,
            clients: clients.map(cl => ({
                _id:        cl._id,
                firstName:  cl.firstName,
                lastName:   cl.lastName,
                middleName: cl.middleName,
                birthdate:  cl.birthdate,
                branchId:   cl.branchId,
                delinquent: cl.delinquent || false,
                status:     cl.status,
                profile:    cl.profile    || null,
                contactNumber: cl.contactNumber || '',
                governmentIdType:   cl.governmentIdType   || null,
                governmentIdNumber: cl.governmentIdNumber || null,
                lastLoan: cl.loans?.[0] ? {
                    _id:          cl.loans[0]._id,
                    status:       cl.loans[0].status,
                    amountRelease:cl.loans[0].amountRelease,
                    loanBalance:  cl.loans[0].loanBalance,
                    loanRelease:  cl.loans[0].loanRelease,
                    loanCycle:    cl.loans[0].loanCycle,
                    slotNo:       cl.loans[0].slotNo,
                } : null,
            })),
        });
    }

    const isBalik = mode === 'balik';

    if (isBalik) {
        if (!lastName || !firstName) {
            return res.status(200).json({ success: false, message: 'firstName and lastName are required.' });
        }
    } else {
        if (!lastName || !slotNo) {
            return res.status(200).json({ success: false, message: 'lastName and slotNo are required.' });
        }
    }
    if (!groupId && !branchId) {
        return res.status(200).json({ success: false, message: 'groupId or branchId is required.' });
    }

    try {
        const loanStatusFilter = {
            reloan:  { _in: ['active'] },
            pending: { _in: ['completed'] },
            balik:   { _in: ['closed'] },
        }[mode] || { _in: ['active', 'completed'] };

        const clientWhere = isBalik
            ? (() => {
                const w = {
                    firstName: { _ilike: firstName.trim() },
                    lastName:  { _ilike: lastName.trim() },
                    status:    { _eq: 'offset' },
                };
                if (middleName?.trim() && middleName.trim().toUpperCase() !== 'N/A') {
                    w.middleName = { _ilike: middleName.trim() };
                }
                if (branchId) w.branchId = { _eq: branchId };
                return w;
              })()
            : {
                lastName:  { _ilike: lastName.trim() },
                groupId:   { _eq: groupId },
                loans: {
                    slotNo:  { _eq: parseInt(slotNo) },
                    groupId: { _eq: groupId },
                    status:  loanStatusFilter,
                },
              };

        const clients = await graph.query(
            queryQl(CLIENT_TYPE, { where: clientWhere, limit: 5 })
        ).then(r => r.data?.clients ?? []);

        if (clients.length === 0) {
            if (!isBalik) {
                const anyClients = await graph.query(
                    queryQl(CLIENT_TYPE, {
                        where: {
                            lastName: { _ilike: lastName.trim() },
                            groupId:  { _eq: groupId },
                            loans: {
                                slotNo:  { _eq: parseInt(slotNo) },
                                groupId: { _eq: groupId },
                                status:  { _neq: 'reject' },
                            },
                        },
                        limit: 1,
                    })
                ).then(r => r.data?.clients ?? []);

                if (anyClients.length > 0) {
                    const latestLoan = anyClients[0].loans?.[0];
                    const actualStatus = latestLoan?.status;
                    const errMsg = MODE_ERRORS[mode]?.wrongStatus(actualStatus)
                        || `Member found but loan status is "${actualStatus}".`;
                    return res.status(200).json({ success: false, message: errMsg });
                }
            }

            return res.status(200).json({
                success: false,
                message: MODE_ERRORS[mode]?.noLoan || 'Member not found. Check your last name and slot number.',
            });
        }

        const matchedClient = isBalik
            ? clients[0]
            : clients.find(c =>
                c.loans?.some(l => l.slotNo === parseInt(slotNo) && l.groupId === groupId)
              ) || clients[0];

        const matchedLoan = isBalik
            ? matchedClient.loans?.[0]
            : matchedClient.loans?.find(
                l => l.slotNo === parseInt(slotNo) && l.groupId === groupId
              ) || matchedClient.loans?.[0];

        // ── FIX: Check for existing active CI application ─────────────────
        // Block if client already has a LAF in the active pipeline.
        // 'ci_approved' added — means BM is doing CI investigation, not yet promoted.
        // Without this, a client with ci_approved status could re-submit via QR.
        if (matchedClient) {
            const activeApps = await graph.query(
                queryQl(TEMP_LAF_TYPE, {
                    where: {
                        existingClientId: { _eq: matchedClient._id },
                        status:           { _in: ACTIVE_CI_STATUSES },
                    },
                    limit: 1,
                })
            ).then(r => r.data?.temporaryLoanApplications ?? []);

            if (activeApps.length > 0) {
                return res.status(200).json({
                    success: false,
                    message: 'This member already has a loan application currently being processed. Please wait for it to be completed before submitting a new one.',
                });
            }
        }

        // Final status validation
        if (mode === 'balik') {
            if (matchedClient.status !== 'offset') {
                const errMsg = MODE_ERRORS.balik.wrongStatus(matchedClient.status);
                return res.status(200).json({ success: false, message: errMsg });
            }
        } else {
            const requiredStatus = REQUIRED_STATUS[mode];
            if (requiredStatus && matchedLoan?.status !== requiredStatus) {
                const errMsg = MODE_ERRORS[mode]?.wrongStatus(matchedLoan?.status)
                    || `Loan status "${matchedLoan?.status}" is not valid for ${mode}.`;
                return res.status(200).json({ success: false, message: errMsg });
            }
        }

        // For Balik — multiple offset clients may match same name
        if (isBalik && clients.length > 1) {
            return res.status(200).json({
                success:       true,
                multipleFound: true,
                clients: clients.map(cl => ({
                    _id:        cl._id,
                    firstName:  cl.firstName,
                    lastName:   cl.lastName,
                    middleName: cl.middleName,
                    birthdate:  cl.birthdate,
                    branchId:   cl.branchId,
                    delinquent: cl.delinquent || false,
                    status:     cl.status,
                    profile:    cl.profile    || null,
                    lastLoan: cl.loans?.[0] ? {
                        _id:          cl.loans[0]._id,
                        status:       cl.loans[0].status,
                        amountRelease:cl.loans[0].amountRelease,
                        loanBalance:  cl.loans[0].loanBalance,
                        loanRelease:  cl.loans[0].loanRelease,
                        loanCycle:    cl.loans[0].loanCycle,
                    } : null,
                })),
            });
        }

        return res.status(200).json({
            success: true,
            client: {
                _id:                     matchedClient._id,
                firstName:               matchedClient.firstName,
                lastName:                matchedClient.lastName,
                middleName:              matchedClient.middleName,
                birthdate:               matchedClient.birthdate,
                contactNumber:           matchedClient.contactNumber,
                addressStreetNo:         matchedClient.addressStreetNo,
                addressBarangayDistrict: matchedClient.addressBarangayDistrict,
                addressMunicipalityCity: matchedClient.addressMunicipalityCity,
                addressProvince:         matchedClient.addressProvince,
                addressZipCode:          matchedClient.addressZipCode,
                ciName:                  matchedClient.ciName,
                profile:                 matchedClient.profile              || null,
                governmentIdType:        matchedClient.governmentIdType      || null,
                governmentIdNumber:      matchedClient.governmentIdNumber    || null,
                governmentIdPhotoKey:    matchedClient.governmentIdPhotoKey  || null,
                branchId:                matchedClient.branchId              || null,
                branchName:              matchedClient.branchName            || null,
                delinquent:              matchedClient.delinquent            || false,
                oldGroupId:              matchedClient.oldGroupId            || null,
                oldLoId:                 matchedClient.oldLoId               || null,
                loans:                   matchedClient.loans                 || [],
                slotNo:                  matchedLoan?.slotNo,
                loanId:                  matchedLoan?._id,
                loanCycle:               matchedLoan?.loanCycle,
                loanStatus:              matchedLoan?.status,
                amountRelease:           matchedLoan?.amountRelease          || 0,
                loanBalance:             matchedLoan?.loanBalance            || 0,
                // FIX: added loanRelease — used for "Previous Loan" cell in LAF print
                // for pending client type (shows full payment amount required)
                loanRelease:             matchedLoan?.loanRelease            || 0,
            },
        });

    } catch (err) {
        console.error('[lookup-client]', err);
        return res.status(200).json({ success: false, message: err.message || 'Server error.' });
    }
}

// Export as public API handler
import { publicApiHandler } from '@/services/public-api-handler';
export default publicApiHandler({ get: (req, res) => handler(req, res) });