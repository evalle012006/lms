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
        order_by: [{ loanCycle: desc }]
        limit: 1
    ) {
        _id slotNo status loanCycle groupId branchId
        amountRelease loanBalance
        guarantorFirstName guarantorLastName guarantorMiddleName
    }
`)('clients');

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
                    : `Loan status is "${status}" — cannot apply as Balik.`,
    },
};

const REQUIRED_STATUS = {
    reloan:  'active',
    pending: 'completed',
    // balik: validated via client.status not loan.status — see status check below
};

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ success: false });

    const { groupId, branchId, firstName = '', lastName, middleName = '', slotNo, mode = 'reloan' } = req.query;

    // Balik requires firstName + lastName; reloan/pending require lastName + slotNo
    if (mode === 'balik') {
        if (!firstName?.trim() || !lastName?.trim()) {
            return res.status(200).json({ success: false, message: 'firstName and lastName are required for Balik lookup.' });
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
        // Build loan filter based on mode
        const loanStatusFilter = {
            reloan:  { _in: ['active'] },
            pending: { _in: ['completed'] },
            // Balik: client.status='offset', their last loan is 'closed'
            // (loan goes active→completed→closed when offset remarks applied)
            // Fetch for pre-fill only — status gate uses client.status='offset'
            balik:   { _in: ['closed'] },
        }[mode] || { _in: ['active', 'completed'] };

        // For balik — search by branchId (they may be in a different group now)
        // For reloan/pending — search by groupId + slotNo
        const isBalik = mode === 'balik';

        const clientWhere = isBalik
            ? (() => {
                // Balik: firstName + lastName mandatory, middleName + branchId optional
                const w = {
                    firstName: { _ilike: firstName.trim() },
                    lastName:  { _ilike: lastName.trim() },
                    status:    { _eq: 'offset' },
                };
                // middleName — match if provided, otherwise skip
                if (middleName?.trim() && middleName.trim().toUpperCase() !== 'N/A') {
                    w.middleName = { _ilike: middleName.trim() };
                }
                // branchId — offset clients retain their branchId (not nulled on offset)
                if (branchId) {
                    w.branchId = { _eq: branchId };
                }
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
            // Try to find them anyway to give a better error message
            if (!isBalik) {
                const anyClients = await graph.query(
                    queryQl(CLIENT_TYPE, {
                        where: {
                            lastName: { _ilike: lastName.trim() },
                            groupId:  { _eq: groupId },
                            loans: { slotNo: { _eq: parseInt(slotNo) }, groupId: { _eq: groupId } },
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

        // For reloan/pending — match by exact slot
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

        // Final status validation
        if (mode === 'balik') {
            // Validate client record status directly — loan status is irrelevant for Balik
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
        // Return all matches so the form can show a selection list
        if (isBalik && clients.length > 1) {
            return res.status(200).json({
                success:      true,
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
                    lastLoan:   cl.loans?.[0] ? {
                        _id:          cl.loans[0]._id,
                        status:       cl.loans[0].status,
                        amountRelease:cl.loans[0].amountRelease,
                        loanBalance:  cl.loans[0].loanBalance,
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
                governmentIdNumber:      matchedClient.governmentIdNumber     || null,
                governmentIdPhotoKey:    matchedClient.governmentIdPhotoKey   || null,
                // Balik display fields — branchId sent so client resolves name from branchList cache
                branchId:                matchedClient.branchId               || null,
                delinquent:              matchedClient.delinquent             || false,
                // Balik history fields — branchId is kept on offset (not nulled)
                oldGroupId:              matchedClient.oldGroupId             || null,
                oldLoId:                 matchedClient.oldLoId                || null,
                guarantorFirstName:      matchedLoan?.guarantorFirstName      || null,
                guarantorLastName:       matchedLoan?.guarantorLastName       || null,
                guarantorMiddleName:     matchedLoan?.guarantorMiddleName     || null,
                guarantorRelationship:   null,
                guarantorContactNumber:  null,
                slotNo:                  matchedLoan?.slotNo,
                loanId:                  matchedLoan?._id,
                loanCycle:               matchedLoan?.loanCycle,
                loanStatus:              matchedLoan?.status,
                amountRelease:           matchedLoan?.amountRelease           || 0,
                loanBalance:             matchedLoan?.loanBalance             || 0,
            },
        });

    } catch (err) {
        console.error('[lookup-client]', err);
        return res.status(200).json({ success: false, message: err.message || 'Server error.' });
    }
}