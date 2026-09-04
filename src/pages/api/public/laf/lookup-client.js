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
        order_by: [{ insertedDateTime: desc, loanCycle: desc }]
        limit: 5
    ) {
        _id slotNo status loanCycle groupId branchId
        amountRelease loanBalance loanRelease dateAdded dateOfRelease
        guarantorFirstName guarantorLastName guarantorMiddleName
    }
`)('clients');

// Balik matches on client.status alone — no loan validation involved (see
// clientWhere below). Querying loans for balik was dead weight that leaked
// stale closed-loan data (loanId, loanRelease, amountRelease) into the LAF
// submit payload for no reason. Lean type, no loans join.
const CLIENT_TYPE_NO_LOANS = createGraphType('client', `
    _id firstName lastName middleName birthdate contactNumber
    addressStreetNo addressBarangayDistrict addressMunicipalityCity
    addressProvince addressZipCode ciName status branchId branchName
    delinquent profile
    governmentIdType governmentIdNumber governmentIdPhotoKey
    oldGroupId oldLoId
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
    existing: {
        noLoan: 'No active or completed loan found at that slot. Check your last name and slot number.',
        wrongStatus: (status) =>
            status === 'offset'
                ? "This member's loan was offset/closed. Please select Balik instead."
                : `Loan status is "${status}" — cannot proceed. Please contact your administrator.`,
    },
};

const REQUIRED_STATUS = { reloan: 'active', pending: 'completed' };

// Statuses that mean the LAF is still being processed — client cannot submit another
// FIX: added 'ci_approved' — this means BM is doing CI but hasn't promoted yet.
// Without this, a client with a ci_approved LAF could re-submit via QR.
const ACTIVE_CI_STATUSES = ['pending', 'pending_validation', 'ci_approved'];

// Collapse any run of whitespace into a SQL wildcard so matching survives
// the double-space / inconsistent-spacing artifacts common in migrated
// name fields (e.g. "DELA  LINA" vs "DELA LINA"). _ilike is an exact
// pattern match — without this, a single extra space silently produces
// zero rows with no error surfaced anywhere.
const namePattern = (v) => `%${v.trim().replace(/\s+/g, '%')}%`;

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
                loans: (cl.loans || []).map(l => ({
                    _id: l._id, slotNo: l.slotNo, groupId: l.groupId,
                    status: l.status, loanCycle: l.loanCycle,
                    amountRelease: l.amountRelease, loanBalance: l.loanBalance, loanRelease: l.loanRelease,
                })),
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
            existing: { _in: ['active', 'completed'] },
        }[mode] || { _in: ['active', 'completed'] };

        const buildBalikWhere = (withBranch) => {
            const w = {
                firstName: { _ilike: namePattern(firstName) },
                lastName:  { _ilike: namePattern(lastName) },
                status:    { _eq: 'offset' },
            };
            if (middleName?.trim() && middleName.trim().toUpperCase() !== 'N/A') {
                w.middleName = { _ilike: namePattern(middleName.trim()) };
            }
            if (withBranch && branchId) w.branchId = { _eq: branchId };
            return w;
        };

        let clients = [];
        let balikFallback = false; // true = branch-scoped search found nothing, we retried unscoped

        if (isBalik) {
            clients = await graph.query(
                queryQl(CLIENT_TYPE_NO_LOANS, { where: buildBalikWhere(true), limit: 5 })
            ).then(r => r.data?.clients ?? []);

            if (clients.length === 0 && branchId) {
                clients = await graph.query(
                    queryQl(CLIENT_TYPE_NO_LOANS, { where: buildBalikWhere(false), limit: 5 })
                ).then(r => r.data?.clients ?? []);
                balikFallback = clients.length > 0;
            }
        } else {
            const clientWhere = {
                lastName:  { _ilike: namePattern(lastName) },
                groupId:   { _eq: groupId },
                loans: {
                    slotNo:  { _eq: parseInt(slotNo) },
                    groupId: { _eq: groupId },
                    status:  loanStatusFilter,
                },
            };
            clients = await graph.query(
                queryQl(CLIENT_TYPE, { where: clientWhere, limit: 5 })
            ).then(r => r.data?.clients ?? []);
        }

        if (clients.length === 0) {
            if (!isBalik) {
                const anyClients = await graph.query(
                    queryQl(CLIENT_TYPE, {
                        where: {
                            lastName: { _ilike: namePattern(lastName) },
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
                    if (!latestLoan) {
                        return res.status(200).json({
                            success: false,
                            message: `We found a matching member record at slot ${slotNo}, but there's no loan `
                                + `history on file. Please contact your administrator to verify before proceeding.`,
                        });
                    }
                    const actualStatus = latestLoan.status;
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

        let matchedClient = isBalik
            ? clients[0]
            : clients.find(c =>
                c.loans?.some(l => l.slotNo === parseInt(slotNo) && l.groupId === groupId)
            ) || clients[0];

        let matchedLoan = isBalik
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

        let resolvedType = null; // 'reloan' | 'pending' — only set when mode === 'existing'

        if (mode === 'existing') {
            const client = clients[0];
            const loans  = client.loans || [];

            const activeLoan = loans.find(l => l.slotNo === parseInt(slotNo) && l.groupId === groupId && l.status === 'active')
                            || loans.find(l => l.status === 'active');
            const completedLoan = loans.find(l => l.slotNo === parseInt(slotNo) && l.groupId === groupId && l.status === 'completed')
                                || loans.find(l => l.status === 'completed');

            // Data integrity guard — not DB-enforced, per Donie: "can happen" is
            // treated as impossible by the business but not guaranteed by schema.
            if (activeLoan && completedLoan) {
                console.error('[lookup-client] Client has both active and completed loans simultaneously', {
                    clientId: client._id, activeLoanId: activeLoan._id, completedLoanId: completedLoan._id,
                });
                return res.status(200).json({
                    success: false,
                    message: `This member has conflicting loan records on file — an active loan `
                        + `(balance ₱${Number(activeLoan.loanBalance || 0).toLocaleString()}) and a completed loan `
                        + `both exist. This must be resolved by an administrator before you can proceed. `
                        + `Please contact your branch administrator.`,
                });
            }

            if (!activeLoan && !completedLoan) {
                // Shouldn't reach here given the outer query filter, but guard anyway.
                return res.status(200).json({ success: false, message: MODE_ERRORS.existing.noLoan });
            }

            matchedLoan   = activeLoan || completedLoan;
            matchedClient = client;
            resolvedType  = activeLoan ? 'reloan' : 'pending';
            // no wrongStatus check — mode=existing accepts either, that's the whole point
        } else if (mode !== 'balik') {
            // existing reloan/pending/balik validation — UNCHANGED from current code
            const requiredStatus = REQUIRED_STATUS[mode];
            if (requiredStatus && matchedLoan?.status !== requiredStatus) {
                const errMsg = MODE_ERRORS[mode]?.wrongStatus(matchedLoan?.status)
                    || `Loan status "${matchedLoan?.status}" is not valid for ${mode}.`;
                return res.status(200).json({ success: false, message: errMsg });
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

        // For Balik — multiple offset clients, OR a single/multi match only found
        // after dropping the branch filter — both need the suggestion-list UI so
        // the user visually confirms rather than being silently auto-matched.
        if (isBalik && (clients.length > 1 || balikFallback)) {
            return res.status(200).json({
                success:       true,
                multipleFound: true,
                balikFallback,
                clients: clients.map(cl => ({
                    _id:        cl._id,
                    firstName:  cl.firstName,
                    lastName:   cl.lastName,
                    middleName: cl.middleName,
                    birthdate:  cl.birthdate,
                    branchId:   cl.branchId,
                    branchName: cl.branchName,
                    delinquent: cl.delinquent || false,
                    status:     cl.status,
                    profile:    cl.profile || null,
                })),
            });
        }

        return res.status(200).json({
            success: true,
            resolvedType,   // 'reloan' | 'pending' | null (null for balik/other modes)
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