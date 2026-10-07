// src/lib/loan-approval-client.js
// Pure helpers for the v2 approval actions. They rebuild, field for field, what
// the classic page's getListLoan / handleMultiApprove / updateClientStatus /
// handleLdfApprovalConfirm sent to the EXISTING write endpoints
// (transactions/loans/approve-by-batch and transactions/loans/reject), so those
// endpoints behave exactly as they do today. Do not "tidy" the deletes below
// without reading those endpoints: they strip UI-only keys the server also
// expects to be gone.
//
// What is different from classic: the rows come from approval-rows.js (fresh,
// read server-side for the caller's own branch) instead of whatever the browser
// had in memory, and the gate flags come from the server.
//
// Intentionally NOT carried over: "LDF Unapproved". The classic client sets
// ldfApproved=false, but approve-by-batch's `ldf` branch then forces
// ldfApproved=true, so the button re-approves. See the Phase 2 notes.

import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';

/** Raw SQL-function row + server gates -> the row shape the classic list held. */
export function mapApprovalRow(raw, gates = {}) {
    return {
        ...raw,
        loanOfficerName: `${raw.loanOfficer?.lastName}, ${raw.loanOfficer?.firstName}`,
        groupName: raw.group?.name,
        principalLoanStr: formatPricePhp(raw.principalLoan),
        mcbuStr: formatPricePhp(raw.mcbu),
        activeLoanStr: formatPricePhp(raw.activeLoan),
        loanBalanceStr: formatPricePhp(raw.loanBalance),
        loanRelease: raw.amountRelease,
        loanReleaseStr: formatPricePhp(raw.amountRelease),
        profile: raw?.client?.profile || '',
        fullName: UppercaseFirstLetter(
            `${raw?.client?.lastName}, ${raw?.client?.firstName} ${raw?.client?.middleName ? raw?.client?.middleName : ''}`
        ),
        allowApproved: !!gates.allowApproved,
        selected: false,
        hasActiveLoan: !!gates.hasActiveLoan,
        hasTdaLoan: !!gates.hasTdaLoan,
        ciName: UppercaseFirstLetter(raw?.ciName ? raw?.ciName : raw.client?.ciName),
        transactionClosed: !!gates.transactionClosed,
        guarantorDuplicate: raw.guarantorDuplicate || false,
        coMakerPending: raw.coMakerPending || false,
        coMakerPendingName: raw.coMakerPendingName || null,
    };
}

/**
 * Classic checked these inside the payload `.map` for the LDF path and the
 * non-disbursement approve path (not for the disbursement-modal path).
 * Returns human-readable problems; empty = fine.
 */
export function collectMissingInfo(rows) {
    const problems = [];
    rows.forEach((loan) => {
        const client = loan?.client;
        const groupName = loan.group?.name;
        if (!client?.firstName || !client?.lastName || client?.firstName === 'null' || client?.lastName === 'null') {
            problems.push(`First and/or Last Name of slot no ${loan.slotNo} from group ${groupName} is missing!`);
        }
        if (!client?.profile || !String(client.profile).trim()) {
            problems.push(`Slot no ${loan.slotNo} from group ${groupName} don't have photo uploaded!`);
        }
    });
    return problems;
}

function stripUiKeys(temp) {
    delete temp.group;
    delete temp.client;
    delete temp.branch;
    delete temp.principalLoanStr;
    delete temp.activeLoanStr;
    delete temp.loanBalanceStr;
    delete temp.mcbuStr;
    delete temp.selected;
    return temp;
}

/** origin 'ldf' — classic handleMultiApprove('ldf'). */
export function buildLdfPayload(rows, currentDate) {
    return rows.map((loan) => {
        const temp = stripUiKeys({ ...loan });
        temp.ldfApproved = true;
        temp.ldfApprovedDate = currentDate;
        temp.origin = 'ldf';
        return temp;
    });
}

/** origin 'application' WITHOUT the disbursement modal (branches not on clientFlowVersion v2). */
export function buildApplicationPayload(rows, currentDate) {
    return rows.map((loan) => {
        const temp = stripUiKeys({ ...loan });
        temp.groupLeader = loan.client?.groupLeader ? loan.client.groupLeader : false;
        temp.status = 'active';
        temp.preApproved = true;
        temp.preApprovedDate = currentDate;
        temp.mispayment = 0;
        temp.currentDate = currentDate;
        temp.origin = 'application';
        return temp;
    });
}

/** origin 'application' AFTER the DisbursementPhotoModal — classic handleLdfApprovalConfirm. */
export function buildDisbursementPayload(rows, { disbursementPhotoKey, approverId }) {
    return rows.map((loan) => ({
        ...loan,
        status: 'active',
        disbursementPhotoKey,
        disbursementPhotoAt: new Date().toISOString(),
        ldfApprovedBy: approverId,
    }));
}

/** transactions/loans/reject with status 'reject' — classic updateClientStatus(loan, 'reject', reason). */
export function buildRejectPayload(row, { userId, currentDate, reason }) {
    const loanData = { ...row };
    delete loanData.group;
    delete loanData.client;
    delete loanData.branch;
    delete loanData.principalLoanStr;
    delete loanData.activeLoanStr;
    delete loanData.loanBalanceStr;
    delete loanData.mcbuStr;

    loanData.insertedBy = userId;
    loanData.currentDate = currentDate;
    loanData.status = 'reject';
    loanData.rejectReason = reason;
    return loanData;
}