// src/pages/api/v2/clients/merge.js
// POST { masterId, duplicateId, ciReferenceCode?, applyLafUpdates? }
//
// Rules enforced server-side:
//   1. Master must be the client with active/completed loan — auto-enforced
//      If neither has active/completed loan, the caller-supplied masterId is used
//      but a warning is returned.
//   2. LAF data (if ciReferenceCode provided) is used to update safe fields on master:
//      contactNumber, address parts, governmentId, landmark, distanceFromBranch
//      photo key (profile). Structural fields (groupId, loId, branchId, slotNo)
//      are never changed.
//   3. All loans, cashCollections, mcbu_withdrawals, transferClients,
//      badDebtCollections from duplicate → re-linked to master.
//   4. Duplicate client → status: 'merged', archived: true.

import { apiHandler }    from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import {
    createGraphType, queryQl, updateQl,
} from '@/lib/graph/graph.util';
import {
    CLIENT_FIELDS, TEMP_LOAN_APP_FIELDS,
} from '@/lib/graph.fields';

import moment        from 'moment';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();

const CLIENT_TYPE    = createGraphType('clients',    CLIENT_FIELDS)('clients');
const LOAN_AGG_TYPE  = createGraphType('loans', '_id clientId status')('loans');
const CC_TYPE        = createGraphType('cashCollections',  '_id clientId')('cashCollections');
const MCBU_TYPE      = createGraphType('mcbu_withdrawals', '_id client_id')('mcbu_withdrawals');
const TRANSFER_TYPE  = createGraphType('transferClients',  '_id selectedClientId')('transferClients');
const BAD_DEBT_TYPE  = createGraphType('badDebtCollections', '_id clientId')('badDebtCollections');
const TEMP_TYPE      = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: mergeClients });

async function mergeClients(req, res) {
    const currentUser = req.auth;
    let { masterId, duplicateId, ciReferenceCode } = req.body;

    if (!masterId || !duplicateId) {
        return res.status(200).json({
            success: false,
            message: 'masterId and duplicateId are required.',
        });
    }
    if (masterId === duplicateId) {
        return res.status(200).json({
            success: false,
            message: 'masterId and duplicateId must be different.',
        });
    }

    // ── Fetch both clients + their loans in parallel ───────────────────────
    const [clientA, clientB] = await Promise.all([
        graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: masterId } } }))
            .then(r => r.data?.clients?.[0] ?? null),
        graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: duplicateId } } }))
            .then(r => r.data?.clients?.[0] ?? null),
    ]);

    if (!clientA) return res.status(200).json({ success: false, message: 'Master client not found.' });
    if (!clientB) return res.status(200).json({ success: false, message: 'Duplicate client not found.' });

    if (['merged', 'archived'].includes(clientA.status)) {
        return res.status(200).json({
            success: false,
            message: `Cannot use a ${clientA.status} client as master. Select an active or pending client.`,
        });
    }
    if (clientB.status === 'merged') {
        return res.status(200).json({
            success: false,
            message: 'The duplicate client is already marked as merged.',
        });
    }

    // ── Rule 1: Auto-enforce master = client with active/completed loan ────
    // Check each candidate's loan status
    const [aLoans, bLoans] = await Promise.all([
        graph.query(queryQl(LOAN_AGG_TYPE, {
            where: {
                clientId: { _eq: masterId },
                status:   { _in: ['active', 'completed'] },
            },
            limit: 1,
        })).then(r => r.data?.loans ?? []),

        graph.query(queryQl(LOAN_AGG_TYPE, {
            where: {
                clientId: { _eq: duplicateId },
                status:   { _in: ['active', 'completed'] },
            },
            limit: 1,
        })).then(r => r.data?.loans ?? []),
    ]);

    const aHasActiveLoan = aLoans.length > 0;
    const bHasActiveLoan = bLoans.length > 0;
    let masterSwapped    = false;
    let loanWarning      = null;

    if (bHasActiveLoan && !aHasActiveLoan) {
        // Swap: caller picked wrong master — the duplicate has the active/completed loan
        // Auto-correct: swap master and duplicate
        [masterId, duplicateId] = [duplicateId, masterId];
        masterSwapped = true;
    } else if (!aHasActiveLoan && !bHasActiveLoan) {
        // Neither has active/completed loan — proceed with caller's choice
        // but flag it
        loanWarning = 'Neither client has an active or completed loan. Proceeding with the selected master.';
    }
    // If aHasActiveLoan (regardless of b) — caller's choice is correct, no swap needed

    // Re-assign for clarity after potential swap
    const finalMaster    = masterId === clientA._id ? clientA : clientB;
    const finalDuplicate = duplicateId === clientB._id ? clientB : clientA;

    // ── Rule 2: Fetch LAF data for field updates (if ciReferenceCode given) ─
    let lafData = null;
    if (ciReferenceCode) {
        lafData = await graph.query(
            queryQl(TEMP_TYPE, {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
            })
        ).then(r => r.data?.temporaryLoanApplications?.[0] ?? null);
    }

    // Fields to update on master from LAF (safe, non-structural only)
    // We only overwrite if the LAF has a non-empty value
    const lafUpdates = {};
    if (lafData) {
        const safe = [
            'contactNumber',
            'addressStreetNo',
            'addressBarangayDistrict',
            'addressMunicipalityCity',
            'addressProvince',
            'addressZipCode',
            'address',
            'landmark',
            'distanceFromBranch',
            'governmentIdType',
            'governmentIdNumber',
            'governmentIdPhotoKey',
        ];
        for (const field of safe) {
            if (lafData[field] && lafData[field] !== 'N/A') {
                lafUpdates[field] = lafData[field];
            }
        }
        // Update profile photo from LAF if master has none
        if (lafData.lafPhotoKey && !finalMaster.profile) {
            lafUpdates.profile = lafData.lafPhotoKey;
        }
        // Rebuild address string if any address part was updated
        if (Object.keys(lafUpdates).some(k => k.startsWith('address'))) {
            lafUpdates.address = [
                lafUpdates.addressStreetNo         || finalMaster.addressStreetNo,
                lafUpdates.addressBarangayDistrict || finalMaster.addressBarangayDistrict,
                lafUpdates.addressMunicipalityCity || finalMaster.addressMunicipalityCity,
                lafUpdates.addressProvince         || finalMaster.addressProvince,
                lafUpdates.addressZipCode          || finalMaster.addressZipCode,
            ].filter(Boolean).join(', ');
        }
    }

    const now = moment().toISOString();
    const mutationList = [];
    const push = fn => mutationList.push(fn(`bulk_${mutationList.length}`));

    // ── Re-link loans ──────────────────────────────────────────────────────
    const dupLoans = await graph.query(
        queryQl(LOAN_AGG_TYPE, {
            where: { clientId: { _eq: finalDuplicate._id } },
        })
    ).then(r => r.data?.loans ?? []);

    for (const loan of dupLoans) {
        push(alias => updateQl(
            createGraphType('loans', '_id')(alias),
            { where: { _id: { _eq: loan._id } }, set: { clientId: masterId } }
        ));
    }

    // ── Re-link cashCollections ────────────────────────────────────────────
    const dupCC = await graph.query(
        queryQl(CC_TYPE, { where: { clientId: { _eq: finalDuplicate._id } } })
    ).then(r => r.data?.cashCollections ?? []);

    for (const cc of dupCC) {
        push(alias => updateQl(
            createGraphType('cashCollections', '_id')(alias),
            { where: { _id: { _eq: cc._id } }, set: { clientId: masterId } }
        ));
    }

    // ── Re-link mcbu_withdrawals ───────────────────────────────────────────
    const dupMCBU = await graph.query(
        queryQl(MCBU_TYPE, { where: { client_id: { _eq: finalDuplicate._id } } })
    ).then(r => r.data?.mcbu_withdrawals ?? []);

    for (const w of dupMCBU) {
        push(alias => updateQl(
            createGraphType('mcbu_withdrawals', '_id')(alias),
            { where: { _id: { _eq: w._id } }, set: { client_id: masterId } }
        ));
    }

    // ── Re-link transferClients ────────────────────────────────────────────
    const dupTransfer = await graph.query(
        queryQl(TRANSFER_TYPE, { where: { selectedClientId: { _eq: finalDuplicate._id } } })
    ).then(r => r.data?.transferClients ?? []);

    for (const t of dupTransfer) {
        push(alias => updateQl(
            createGraphType('transferClients', '_id')(alias),
            { where: { _id: { _eq: t._id } }, set: { selectedClientId: masterId } }
        ));
    }

    // ── Re-link badDebtCollections ─────────────────────────────────────────
    const dupBadDebts = await graph.query(
        queryQl(BAD_DEBT_TYPE, { where: { clientId: { _eq: finalDuplicate._id } } })
    ).then(r => r.data?.badDebtCollections ?? []);

    for (const b of dupBadDebts) {
        push(alias => updateQl(
            createGraphType('badDebtCollections', '_id')(alias),
            { where: { _id: { _eq: b._id } }, set: { clientId: masterId } }
        ));
    }

    // ── Update master client with LAF data ─────────────────────────────────
    if (Object.keys(lafUpdates).length > 0) {
        push(alias => updateQl(
            createGraphType('client', CLIENT_FIELDS)(alias),
            {
                where: { _id: { _eq: masterId } },
                set:   { ...lafUpdates, dateModified: now },
            }
        ));
    }

    // ── Archive duplicate client ───────────────────────────────────────────
    push(alias => updateQl(
        createGraphType('client', '_id')(alias),
        {
            where: { _id: { _eq: finalDuplicate._id } },
            set: {
                status:             'merged',
                mergedIntoClientId: masterId,
                mergedAt:           now,
                mergedBy:           currentUser._id,
                archived:           true,
                archivedDate:       now,
                archivedBy:         currentUser._id,
            },
        }
    ));

    // ── Update LAF if provided ─────────────────────────────────────────────
    if (ciReferenceCode && lafData) {
        push(alias => updateQl(
            createGraphType('temporaryLoanApplications', '_id')(alias),
            {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
                set: {
                    existingClientId:        masterId,
                    clientType:              'reloan',
                    // Back to pending so BM can complete CI normally
                    status:                  'pending',
                    isDuplicateFlagged:      false,
                    duplicateCandidateIds:   [],
                    duplicateValidatedBy:    currentUser._id,
                    duplicateValidatedAt:    now,
                    duplicateValidationNote: [
                        `Merged ${finalDuplicate.firstName} ${finalDuplicate.lastName} (${finalDuplicate._id}) into master ${finalMaster.firstName} ${finalMaster.lastName} (${masterId}).`,
                        masterSwapped ? 'Note: master was auto-corrected to the client with active/completed loan.' : '',
                        Object.keys(lafUpdates).length > 0
                            ? `Updated on master: ${Object.keys(lafUpdates).join(', ')}.`
                            : '',
                    ].filter(Boolean).join(' '),
                },
            }
        ));
    }

    // ── Execute ────────────────────────────────────────────────────────────
    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    // ── Audit ──────────────────────────────────────────────────────────────
    await logAudit(req, {
        action:      'CLIENT_MERGED',
        category:    'CLIENT',
        severity:    'WARNING',
        entityType:  'client',
        entityId:    masterId,
        description: [
            `${finalDuplicate.firstName} ${finalDuplicate.lastName} (${finalDuplicate._id})`,
            `merged into master ${finalMaster.firstName} ${finalMaster.lastName} (${masterId}).`,
            masterSwapped ? 'Master auto-corrected (duplicate had active loan).' : '',
            `Re-linked: ${dupLoans.length} loans, ${dupCC.length} collections,`,
            `${dupMCBU.length} MCBU, ${dupTransfer.length} transfers, ${dupBadDebts.length} bad debts.`,
            Object.keys(lafUpdates).length > 0
                ? `Master updated from LAF: ${Object.keys(lafUpdates).join(', ')}.`
                : '',
        ].filter(Boolean).join(' '),
        branchId:    finalMaster.branchId,
        metadata: {
            masterId,
            duplicateId:   finalDuplicate._id,
            masterSwapped,
            loanWarning,
            lafUpdatesApplied: Object.keys(lafUpdates),
            relinked: {
                loans:          dupLoans.length,
                cashCollections: dupCC.length,
                mcbuWithdrawals: dupMCBU.length,
                transfers:       dupTransfer.length,
                badDebts:        dupBadDebts.length,
            },
        },
    });

    return res.status(200).json({
        success:      true,
        masterId,
        duplicateId:  finalDuplicate._id,
        masterSwapped,
        loanWarning,
        lafUpdatesApplied: Object.keys(lafUpdates),
        relinked: {
            loans:          dupLoans.length,
            cashCollections: dupCC.length,
            mcbuWithdrawals: dupMCBU.length,
            transfers:       dupTransfer.length,
            badDebts:        dupBadDebts.length,
        },
        message: [
            masterSwapped
                ? `Note: master was automatically set to ${finalMaster.firstName} ${finalMaster.lastName} because they have the active/completed loan.`
                : null,
            `${finalDuplicate.firstName} ${finalDuplicate.lastName} has been archived.`,
            `${dupLoans.length} loan(s) and ${dupCC.length} collection(s) moved to master.`,
            Object.keys(lafUpdates).length > 0
                ? `Master record updated with newer data from LAF: ${Object.keys(lafUpdates).join(', ')}.`
                : null,
        ].filter(Boolean).join(' '),
    });
}