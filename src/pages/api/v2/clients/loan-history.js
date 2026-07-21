// src/pages/api/v2/clients/loan-history.js
// GET ?clientId=xxx
// FIX: cashCollections fetched directly by clientId — not via nested relationship.
// Nested relationship loads ALL fields for ALL collections, causing 40s+ timeouts.
// Direct query with only loanId + status fields is orders of magnitude faster.

import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// Minimal client + loans — no cashCollections here
const CLIENT_TYPE = createGraphType('client', `
    _id delinquent
    loans (order_by: [{ loanCycle: desc }], limit: 20) {
        _id loanCycle status slotNo
        amountRelease loanBalance loanTerms
        principalLoan pnNumber occurence
        dateAdded dateOfRelease
    }
`)('clients');

// FIX: direct cashCollections query — only two fields needed
// Previously fetched via nested client relationship which loaded ALL fields
const CASH_COL_DIRECT = createGraphType('cashCollections', `
    loanId status
`)('cashCollections');

export default apiHandler({ get: getLoanHistory });

async function getLoanHistory(req, res) {
    const { clientId } = req.query;

    if (!clientId) {
        return res.status(200).json({ success: false, message: 'clientId required.' });
    }

    const [clientData, cashCollections] = await Promise.all([
        graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _eq: clientId } } })
        ).then(r => r.data?.clients?.[0] ?? null),

        // FIX: query cashCollections table directly with clientId filter
        // Only fetch loanId + status — the two fields needed for payment counting
        // draft:false excluded same as before
        graph.query(
            queryQl(CASH_COL_DIRECT, {
                where: {
                    clientId: { _eq: clientId },
                    draft:    { _neq: true    },
                },
            })
        ).then(r => r.data?.cashCollections ?? []),
    ]);

    if (!clientData) {
        return res.status(200).json({ success: true, loans: [] });
    }

    // Build per-loan collection maps — same logic, now faster source data
    const missedMap = {};
    const paidMap   = {};

    for (const col of cashCollections) {
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
        slotNo:         l.slotNo,
        amountRelease:  l.amountRelease,
        loanBalance:    l.loanBalance,
        principalLoan:  l.principalLoan,
        pnNumber:       l.pnNumber,
        occurence:      l.occurence,
        dateAdded:      l.dateAdded,
        dateOfRelease:  l.dateOfRelease,
        missedPayments: missedMap[l._id] || 0,
        noOfPayments:   paidMap[l._id]   || 0,
        totalPayments:  l.loanTerms      || null,
        delinquent: i === 0 && l.status === 'active'
            ? (clientData.delinquent || false)
            : false,
    }));

    return res.status(200).json({ success: true, loans });
}