// src/pages/api/v2/qr-cash-collection/check-updates.js
// GET ?groupId=...&date=YYYY-MM-DD
// Cheap polling endpoint for the LOR page: returns the latest modified
// timestamp and row count for cashCollections, and the latest pending
// QR entry timestamp and count, for this exact group+date. No row data —
// just enough for the frontend to detect "something changed since I loaded."

import { createGraphType, aggregateQl } from '@/lib/graph/graph.util';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { apiHandler } from '@/services/api-handler';

const graph = new GraphProvider();

const CASH_COLLECTION_AGG_TYPE = createGraphType('cashCollections', '_id')('cashCollectionsAgg');
const QR_ENTRY_AGG_TYPE = createGraphType('qr_cash_collection_entries', '_id')('qrEntriesAgg');

export default apiHandler({ get: checkUpdates });

async function checkUpdates(req, res) {
    const { groupId, date } = req.query;
    if (!groupId || !date) {
        return res.status(200).json({ success: false, message: 'groupId and date required.' });
    }

    const cashCollectionsWhere = { groupId: { _eq: groupId }, dateAdded: { _eq: date } };
    const qrEntriesWhere = { groupId: { _eq: groupId }, collectionDate: { _eq: date }, status: { _eq: 'pending' } };

    const { cashCollectionsAgg, qrEntriesAgg } = await graph.query(
        aggregateQl(CASH_COLLECTION_AGG_TYPE, `aggregate { max { modifiedDateTime insertedDateTime } count }`, cashCollectionsWhere),
        aggregateQl(QR_ENTRY_AGG_TYPE, `aggregate { max { updatedDateTime insertedDateTime } count }`, qrEntriesWhere)
    ).then(r => r.data);

    return res.status(200).json({
        success: true,
        latestCashCollectionModified:
            cashCollectionsAgg?.aggregate?.max?.modifiedDateTime ||
            cashCollectionsAgg?.aggregate?.max?.insertedDateTime ||
            null,
        cashCollectionCount: cashCollectionsAgg?.aggregate?.count ?? 0,
        latestPendingQrEntry:
            qrEntriesAgg?.aggregate?.max?.updatedDateTime ||
            qrEntriesAgg?.aggregate?.max?.insertedDateTime ||
            null,
        pendingQrCount: qrEntriesAgg?.aggregate?.count ?? 0,
    });
}