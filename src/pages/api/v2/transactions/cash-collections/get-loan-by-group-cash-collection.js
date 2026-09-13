// src/pages/api/v2/transactions/cash-collections/get-loan-by-group-cash-collection.js
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';
import { gql } from 'node_modules/apollo-boost/lib/index';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { QR_CASH_COLLECTION_ENTRY_FIELDS } from '@/lib/graph.fields';

export default apiHandler({
    get: getLoanWithCashCollection
});

const graph = new GraphProvider();
const QR_ENTRY_TYPE = createGraphType('qr_cash_collection_entries', QR_CASH_COLLECTION_ENTRY_FIELDS)('qrEntries');

async function getLoanWithCashCollection(req, res) {

    const { date, type, groupId } = req.query;

    let statusCode = 200;
    let response = {};
    let cashCollection;

    let cashCollectionDay = [];
    let tomorrowPending = [];

    cashCollectionDay = await graph.apollo.query({
        query: gql`
        query groups ($args: get_loans_per_group_cashcollection_collection_day_by_type_arguments!) {
            collections: get_loans_per_group_cashcollection_collection_day_by_type(args: $args) {
              data
              _id
            }
        }
        `,
        variables: {
           args: {
                curr_date: date,
                curr_type: type,
                group_id: groupId
           }
        }
    }).then(res => res.data.collections.map(c => c.data));

    if(type == 'current') {
        tomorrowPending = await graph.apollo.query({
            query: gql`
            query groups ($args: get_loans_per_group_cashcollection_tomorrow_pending_arguments!) {
                collections: get_loans_per_group_cashcollection_tomorrow_pending(args: $args) {
                  _id,
                  data
                }
              }
            `,
            variables: {
               args: {
                    curr_date: date,
                    group_id: groupId
               }
            }
        }).then(res => res.data.collections.map(c => c.data));
    }

    // ── QR merge-on-read overlay ──────────────────────────────────────────
    // Fetches BOTH 'pending' (not yet office-finalized) and 'merged'
    // (already saved) QR entries for this group+date in one query, matched
    // by clientId. 'pending' entries get their raw values overlaid so the
    // office sees them pre-filled; 'merged' entries only contribute the
    // provenance badge fields (qrSourced/qrReferenceCode) — their actual
    // values already live in the real saved cashCollections record.
    let qrByClientId = new Map();
    if (groupId && date) {
        const qrEntries = await graph.query(
            queryQl(QR_ENTRY_TYPE, {
                where: {
                    groupId: { _eq: groupId },
                    collectionDate: { _eq: date },
                    status: { _in: ['pending', 'merged'] },
                },
            })
        ).then(r => r.data?.qrEntries ?? []);
        qrByClientId = new Map(qrEntries.map(e => [e.clientId, e]));
    }

    cashCollection = {
        collection: cashCollectionDay.map(c => {
            const row = {
                ... c.details,
                type: c.curr_type,
                client: c.client,
                group: c.group,
                current: c.current ?? [],
                currentRelease: c.currentRelease ?? [],
                fullPayment: c.fullPayment ?? [],
                mcbuWithdrawalList: c.mcbuWithdrawals ?? [],
            };

            const qrEntry = qrByClientId.get(row.clientId);
            if (qrEntry) {
                // "Nothing real saved yet" means either no row at all, OR
                // only a pre-save placeholder (origin still 'pre-save' —
                // saveV2.js nulls this out the moment a real save happens).
                // Without this check, weekly groups using pre-save-collections
                // would NEVER show a QR-sourced value, since a placeholder
                // row always exists before the office opens the page.
                const existingRow = row.current?.[0];
                const isJustPlaceholder = !existingRow || existingRow.origin === 'pre-save' || existingRow.draft === true;

                if (qrEntry.status === 'pending' && isJustPlaceholder) {
                    row.mcbuCol = qrEntry.payload.mcbuCol;
                    row.csfCollection = qrEntry.payload.csfCollection;
                    row.paymentCollection = qrEntry.payload.paymentCollection;
                }
                // Badge fields apply regardless of pending/merged — a saved,
                // QR-originated row should still show its provenance.
                row.qrSourced = true;
                row.qrEntryId = qrEntry._id;
                row.qrReferenceCode = qrEntry.referenceCode;
            }

            return row;
        }).sort((a, b) => a.slotNo - b.slotNo),
        tomorrowPending: tomorrowPending.map(c => ({
            ... c,
            branch: c.branch?.[0],
            client: c.client?.[0],
            current: c.current?.[0],
            current: c.current ?? [],
            currentRelease: c.currentRelease ?? [],
            fullPayment: c.fullPayment ?? [],
            prevLoans: c.prevLoans ?? [],
        }))
        .sort((a, b) => a.slotNo - b.slotNo),
    };

    response = { success: true, data: cashCollection };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}