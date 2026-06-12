// src/pages/api/v2/clients/merge.js
// POST { masterId, duplicateId, approvedBy, ciReferenceCode? }
// Merges duplicate client into master:
//   1. Re-links: loans, cashCollections, mcbu_withdrawals, transferClients, badDebtCollections
//   2. Marks duplicate client as status='merged', mergedIntoClientId=masterId
//   3. Updates temporaryLoanApplications.existingClientId if ciReferenceCode provided
//   4. Audit logs the merge

import { apiHandler }   from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import {
    createGraphType, queryQl, updateQl,
} from '@/lib/graph/graph.util';
import {
    CLIENT_FIELDS, LOAN_FIELDS, CASH_COLLECTIONS_FIELDS,
    MCBU_WITHDRAWAL_FIELDS, TEMP_LOAN_APP_FIELDS,
} from '@/lib/graph.fields';
import { filterGraphFields } from '@/lib/graph.functions';
import { logAudit }  from '@/lib/audit-logger';
import moment        from 'moment';

const graph = new GraphProvider();

const CLIENT_TYPE     = createGraphType('client',                   CLIENT_FIELDS)('clients');
const LOAN_TYPE       = createGraphType('loans',                    '_id clientId')('loans');
const CC_TYPE         = createGraphType('cashCollections',          '_id clientId')('cashCollections');
const MCBU_TYPE       = createGraphType('mcbu_withdrawals',         '_id client_id')('mcbu_withdrawals');
const TRANSFER_TYPE   = createGraphType('transferClients',          '_id selectedClientId')('transferClients');
const BAD_DEBT_TYPE   = createGraphType('badDebtCollections',       '_id clientId')('badDebtCollections');
const TEMP_TYPE       = createGraphType('temporaryLoanApplications', '_id existingClientId promotedClientId')('temporaryLoanApplications');

// Update loan type — minimal for re-link
const LOAN_UPDATE     = createGraphType('loans',            '_id')('loans');
const CC_UPDATE       = createGraphType('cashCollections',  '_id')('cashCollections');
const MCBU_UPDATE     = createGraphType('mcbu_withdrawals', '_id')('mcbu_withdrawals');
const TRANSFER_UPDATE = createGraphType('transferClients',  '_id')('transferClients');
const BAD_DEBT_UPDATE = createGraphType('badDebtCollections', '_id')('badDebtCollections');
const CLIENT_UPDATE   = createGraphType('client',           CLIENT_FIELDS)('clients');
const TEMP_UPDATE     = createGraphType('temporaryLoanApplications', TEMP_LOAN_APP_FIELDS)('temporaryLoanApplications');

export default apiHandler({ post: mergeClients });

async function mergeClients(req, res) {
    const currentUser = req.auth;
    const { masterId, duplicateId, ciReferenceCode } = req.body;

    if (!masterId || !duplicateId) {
        return res.status(200).json({ success: false, message: 'masterId and duplicateId are required.' });
    }
    if (masterId === duplicateId) {
        return res.status(200).json({ success: false, message: 'masterId and duplicateId must be different.' });
    }

    // Verify both clients exist
    const [master, duplicate] = await Promise.all([
        graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: masterId } } }))
            .then(r => r.data?.clients?.[0] ?? null),
        graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: duplicateId } } }))
            .then(r => r.data?.clients?.[0] ?? null),
    ]);

    if (!master)    return res.status(200).json({ success: false, message: 'Master client not found.' });
    if (!duplicate) return res.status(200).json({ success: false, message: 'Duplicate client not found.' });
    if (duplicate.status === 'merged') {
        return res.status(200).json({ success: false, message: 'Client is already marked as merged.' });
    }

    const mutationList = [];
    const addToMutationList = fn => mutationList.push(fn(`bulk_${mutationList.length}`));
    const now = moment().toISOString();

    // ── 1. Re-link loans ──────────────────────────────────────────────────
    const loans = await graph.query(
        queryQl(LOAN_TYPE, { where: { clientId: { _eq: duplicateId } } })
    ).then(r => r.data?.loans ?? []);

    for (const loan of loans) {
        addToMutationList(alias => updateQl(
            createGraphType('loans', '_id')(alias),
            { where: { _id: { _eq: loan._id } }, set: { clientId: masterId } }
        ));
    }

    // ── 2. Re-link cashCollections ────────────────────────────────────────
    const cashCollections = await graph.query(
        queryQl(CC_TYPE, { where: { clientId: { _eq: duplicateId } } })
    ).then(r => r.data?.cashCollections ?? []);

    for (const cc of cashCollections) {
        addToMutationList(alias => updateQl(
            createGraphType('cashCollections', '_id')(alias),
            { where: { _id: { _eq: cc._id } }, set: { clientId: masterId } }
        ));
    }

    // ── 3. Re-link mcbu_withdrawals ───────────────────────────────────────
    const mcbuWithdrawals = await graph.query(
        queryQl(MCBU_TYPE, { where: { client_id: { _eq: duplicateId } } })
    ).then(r => r.data?.mcbu_withdrawals ?? []);

    for (const w of mcbuWithdrawals) {
        addToMutationList(alias => updateQl(
            createGraphType('mcbu_withdrawals', '_id')(alias),
            { where: { _id: { _eq: w._id } }, set: { client_id: masterId } }
        ));
    }

    // ── 4. Re-link transferClients ────────────────────────────────────────
    const transfers = await graph.query(
        queryQl(TRANSFER_TYPE, { where: { selectedClientId: { _eq: duplicateId } } })
    ).then(r => r.data?.transferClients ?? []);

    for (const t of transfers) {
        addToMutationList(alias => updateQl(
            createGraphType('transferClients', '_id')(alias),
            { where: { _id: { _eq: t._id } }, set: { selectedClientId: masterId } }
        ));
    }

    // ── 5. Re-link badDebtCollections ─────────────────────────────────────
    const badDebts = await graph.query(
        queryQl(BAD_DEBT_TYPE, { where: { clientId: { _eq: duplicateId } } })
    ).then(r => r.data?.badDebtCollections ?? []);

    for (const b of badDebts) {
        addToMutationList(alias => updateQl(
            createGraphType('badDebtCollections', '_id')(alias),
            { where: { _id: { _eq: b._id } }, set: { clientId: masterId } }
        ));
    }

    // ── 6. Mark duplicate client as merged ────────────────────────────────
    addToMutationList(alias => updateQl(
        createGraphType('client', '_id')(alias),
        {
            where: { _id: { _eq: duplicateId } },
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

    // ── 7. Update temporaryLoanApplications if ciReferenceCode provided ───
    if (ciReferenceCode) {
        addToMutationList(alias => updateQl(
            createGraphType('temporaryLoanApplications', '_id')(alias),
            {
                where: { ciReferenceCode: { _eq: ciReferenceCode } },
                set: {
                    existingClientId: masterId,
                    clientType:       'reloan',
                    status:           'ci_approved',
                    duplicateValidatedBy:   currentUser._id,
                    duplicateValidatedAt:   now,
                    duplicateValidationNote: `Merged duplicate ${duplicateId} into master ${masterId}`,
                },
            }
        ));
    }

    // ── Execute all mutations ─────────────────────────────────────────────
    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    // ── Audit log ─────────────────────────────────────────────────────────
    await logAudit(req, {
        action:      'CLIENT_MERGED',
        category:    'CLIENT',
        severity:    'WARNING',
        entityType:  'client',
        entityId:    masterId,
        description: `Client ${duplicate.firstName} ${duplicate.lastName} (${duplicateId}) merged into ${master.firstName} ${master.lastName} (${masterId}). Re-linked: ${loans.length} loans, ${cashCollections.length} collections, ${mcbuWithdrawals.length} MCBU withdrawals, ${transfers.length} transfers, ${badDebts.length} bad debts.`,
        branchId:    master.branchId,
        metadata:    { masterId, duplicateId, ciReferenceCode, relinked: { loans: loans.length, cashCollections: cashCollections.length, mcbuWithdrawals: mcbuWithdrawals.length, transfers: transfers.length, badDebts: badDebts.length } },
    });

    return res.status(200).json({
        success: true,
        masterId,
        duplicateId,
        relinked: {
            loans:          loans.length,
            cashCollections: cashCollections.length,
            mcbuWithdrawals: mcbuWithdrawals.length,
            transfers:       transfers.length,
            badDebts:        badDebts.length,
        },
        message: `Merge complete. ${loans.length} loan(s) and ${cashCollections.length} collection(s) re-linked to master client.`,
    });
}