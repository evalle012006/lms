// src/lib/audit-lor.js
// Builds audit events for a Loan Officer Register (LOR) save from the posted rows.
// Pure (no I/O) so it can be unit-tested; the caller passes each event to logAudit().
//
// Tracked on purpose (issues we have fixed before and must be able to trace):
//  - Reloaner / Offset transactions (loan moves to the next loan or closes)
//  - Offset without a close reason, reloaner while a balance remains
//  - MCBU / CSF collection, withdrawal and return amounts per group

const num = v => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const remarkOf = r => (r?.remarks?.value ?? (typeof r?.remarks === 'string' ? r.remarks : '')) || '';

export function buildLorAuditEvents(rows, ctx = {}) {
    const list = Array.isArray(rows) ? rows : [];
    const events = [];
    const totals = { mcbuCollection: 0, csfCollection: 0, mcbuWithdrawal: 0, mcbuReturn: 0, csfWithdrawal: 0, csfReturn: 0 };
    const counts = { rows: list.length, reloaner: 0, offset: 0, delinquent: 0, excused: 0, drafts: 0 };
    const warnings = [];

    for (const r of list) {
        const remark = remarkOf(r);
        const base = {
            category: 'COLLECTION',
            entityType: 'cashCollection',
            entityId: r._id,
            clientId: r.clientId,
            branchId: r.branchId,
            metadata: { transactionId: ctx.transactionId, currentDate: ctx.currentDate, loanId: r.loanId, groupId: r.groupId, remarks: remark },
        };

        totals.mcbuCollection += num(r.mcbuCol);
        totals.csfCollection += num(r.csfCollection);
        totals.mcbuWithdrawal += num(r.mcbuWithdrawal);
        totals.mcbuReturn += num(r.mcbuReturnAmt);
        totals.csfWithdrawal += num(r.csfWithdrawal);
        totals.csfReturn += num(r.csfReturnAmt);
        if (r.draft) counts.drafts++;
        if (remark.startsWith('delinquent')) counts.delinquent++;
        if (remark.startsWith('excused')) counts.excused++;

        if (remark.startsWith('reloaner')) {
            counts.reloaner++;
            const warn = num(r.loanBalance) > 0 && !r.draft && r.status !== 'pending';
            if (warn) warnings.push({ clientId: r.clientId, loanId: r.loanId, issue: 'reloaner_with_balance', loanBalance: num(r.loanBalance) });
            events.push({
                ...base,
                action: 'LOR_RELOANER',
                severity: warn ? 'WARNING' : 'INFO',
                description: `Reloaner remark (${remark}) on loan ${r.loanId}`,
                afterData: { remarks: remark, status: r.status, loanBalance: num(r.loanBalance), fullPayment: num(r.fullPayment), draft: !!r.draft },
            });
        } else if (remark.startsWith('offset')) {
            counts.offset++;
            const missingReason = !r.closeRemarks && !r.draft;
            if (missingReason) warnings.push({ clientId: r.clientId, loanId: r.loanId, issue: 'offset_without_close_reason' });
            events.push({
                ...base,
                action: 'LOR_OFFSET',
                severity: missingReason ? 'WARNING' : 'INFO',
                description: `Offset (${remark}) on loan ${r.loanId}`,
                afterData: { remarks: remark, status: r.status, loanBalance: num(r.loanBalance), mcbuReturnAmt: num(r.mcbuReturnAmt), csfReturnAmt: num(r.csfReturnAmt), closeRemarks: r.closeRemarks ?? null },
            });
        }

        if (num(r.mcbuReturnAmt) > 0 || num(r.csfReturnAmt) > 0 || num(r.mcbuWithdrawal) > 0 || num(r.csfWithdrawal) > 0) {
            events.push({
                ...base,
                category: 'SAVINGS',
                action: 'SAVINGS_RETURN_OR_WITHDRAWAL',
                description: `MCBU/CSF out on loan ${r.loanId}`,
                afterData: { mcbuReturnAmt: num(r.mcbuReturnAmt), csfReturnAmt: num(r.csfReturnAmt), mcbuWithdrawal: num(r.mcbuWithdrawal), csfWithdrawal: num(r.csfWithdrawal), mcbu: num(r.mcbu), csf: num(r.csf) },
            });
        }
    }

    const first = list[0] || {};
    events.unshift({
        action: ctx.draft ? 'COLLECTION_DRAFT_SAVED' : 'COLLECTION_SUBMITTED',
        category: 'COLLECTION',
        severity: warnings.length ? 'WARNING' : 'INFO',
        entityType: 'group',
        entityId: first.groupId ?? null,
        branchId: first.branchId ?? null,
        description: `LOR ${ctx.draft ? 'draft saved' : 'submitted'} for ${ctx.currentDate}: ${counts.rows} row(s), ${counts.reloaner} reloaner, ${counts.offset} offset`,
        afterData: { counts, totals },
        metadata: { transactionId: ctx.transactionId, currentDate: ctx.currentDate, attempts: ctx.attempts, warnings },
    });
    return events;
}

// Savings totals can include thousands of rows in one request: cap per-request events.
export const MAX_LOR_EVENTS = 200;

// Reverts: one event per reverted row, typed by what is being undone so a revert of a
// reloan / offset / rejected loan can be traced separately from a plain payment revert.
export function buildRevertAuditEvents(rows, ctx = {}) {
    const list = Array.isArray(rows) ? rows : [];
    return list.map(r => {
        const remark = remarkOf(r);
        let kind = 'PAYMENT';
        if (r.status === 'closed' || remark.startsWith('offset')) kind = 'OFFSET';
        else if ((r.status === 'pending' || r.status === 'tomorrow') && num(r.loanCycle) > 1) kind = 'RELOAN';
        else if (r.status === 'reject' || remark.startsWith('reject')) kind = 'REJECTED_LOAN';
        else if (remark.startsWith('reloaner')) kind = 'RELOANER';
        return {
            action: `LOR_REVERT_${kind}`,
            category: 'COLLECTION',
            severity: 'WARNING',
            entityType: 'cashCollection',
            entityId: r._id,
            clientId: r.clientId,
            branchId: r.branchId,
            description: `Reverted ${kind.toLowerCase().replace('_', ' ')} transaction on loan ${r.loanId} (${ctx.currentDate})`,
            beforeData: { status: r.status, remarks: remark, loanBalance: num(r.loanBalance), paymentCollection: num(r.paymentCollection), mcbuReturnAmt: num(r.mcbuReturnAmt), csfReturnAmt: num(r.csfReturnAmt) },
            metadata: { loanId: r.loanId, groupId: r.groupId, loanCycle: r.loanCycle, currentDate: ctx.currentDate },
        };
    });
}
