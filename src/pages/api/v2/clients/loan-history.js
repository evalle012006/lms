// src/pages/api/v2/clients/loan-history.js
// GET ?clientId=xxx
// Returns a client's full loan history, latest first.
// - missedPayments: cashCollections with status = 'no_payment' per loan
// - noOfPayments:   cashCollections with status != 'no_payment' per loan (paid days)
// - totalPayments:  loanTerms (total installment days for that loan)
// - delinquent:     from client record, applied only to latest active loan

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

const CLIENT_TYPE = createGraphType('client', `
    _id delinquent
    loans (order_by: [{ loanCycle: desc }]) {
        _id loanCycle status
        amountRelease loanBalance loanTerms
        dateAdded dateOfRelease
    }
`)('clients');

const CASH_COL_TYPE = createGraphType('client', `
    _id
    cashCollections (where: { draft: { _neq: true } }) {
        loanId status
    }
`)('clients');

export default apiHandler({ get: getLoanHistory });

async function getLoanHistory(req, res) {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const [clientData, cashData] = await Promise.all([
        graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients?.[0] ?? null),

        graph.query(
            queryQl(CASH_COL_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients?.[0]?.cashCollections ?? []),
    ]);

    if (!clientData) {
        return res.status(200).json({ success: true, loans: [] });
    }

    // Build per-loan collection maps
    const missedMap = {};  // loanId → count of no_payment
    const paidMap   = {};  // loanId → count of paid collections

    for (const col of cashData) {
        if (!col.loanId) continue;
        if (col.status === 'no_payment') {
            missedMap[col.loanId] = (missedMap[col.loanId] || 0) + 1;
        } else {
            paidMap[col.loanId] = (paidMap[col.loanId] || 0) + 1;
        }
    }

    const loans = (clientData.loans || []).map((l, i) => ({
        _id:            l._id,
        loanCycle:      l.loanCycle,
        status:         l.status,
        amountRelease:  l.amountRelease,
        loanBalance:    l.loanBalance,
        dateAdded:      l.dateAdded,
        dateOfRelease:  l.dateOfRelease,
        missedPayments: missedMap[l._id] || 0,
        noOfPayments:   paidMap[l._id]   || 0,
        totalPayments:  l.loanTerms       || null,
        // delinquent is client-level — only show on the latest active loan
        delinquent: i === 0 && l.status === 'active'
            ? (clientData.delinquent || false)
            : false,
    }));

    return res.status(200).json({ success: true, loans });
}