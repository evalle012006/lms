// src/lib/loan-reinstate.js
// Pure rules for reinstating a REJECTED loan. The API (loans/reinstate.js) loads the
// data and writes; everything that decides lives here so it can be tested.
//
// A rejected loan was never approved (reject only accepts pending loans), so it goes
// back to PENDING, not active. Normal approval then creates the collection rows and
// activates the client, exactly as for any new loan. Reinstating straight to active
// would skip all of that.
//
// What reject did, and what we undo:
//   status 'reject' + rejectReason + loanCycle 0   -> pending, cycle recomputed, reason cleared
//   the group slot was handed back                  -> the slot is taken again (must still be free)
//   ldfApproved is reset: the loan re-enters the approval flow at the LDF step.

import { getLatestNonPendingLoan, resolveLoanCycle } from '@/lib/loan-cycle';

export const REINSTATE_REASON_MAX = 500;

const BLOCKING_STATUSES = ['pending', 'active'];

/**
 * @param {object} p
 * @param {object} p.loan        the rejected loan (needs _id, status, clientId, groupId, slotNo)
 * @param {object} p.group       its group (availableSlots, noOfClients, capacity, status)
 * @param {object[]} p.otherLoans the client's OTHER loans (any status)
 * @param {string} p.now         ISO timestamp for modifiedDateTime
 * @returns {{ ok: false, message: string } | { ok: true, loanCycle: number, loanPatch: object, groupPatch: object }}
 */
export function planReinstate({ loan, group, otherLoans = [], now }) {
    if (!loan) return { ok: false, message: 'Loan not found.' };
    if (loan.status !== 'reject') return { ok: false, message: 'Only a rejected loan can be reinstated.' };
    if (!group) return { ok: false, message: 'The loan\'s group no longer exists.' };

    const others = (otherLoans ?? []).filter((l) => l && l._id !== loan._id);

    const blocking = others.find((l) => BLOCKING_STATUSES.includes(l.status));
    if (blocking) {
        const where = blocking.groupName ? ` in ${blocking.groupName}` : '';
        return {
            ok: false,
            message: `This client already has a ${blocking.status} loan${where} (cycle ${blocking.loanCycle ?? '?'}). Resolve it before reinstating this one.`,
        };
    }

    const slot = Number(loan.slotNo);
    const available = (group.availableSlots ?? []).map(Number);
    if (!Number.isFinite(slot) || !available.includes(slot)) {
        return { ok: false, message: `Slot ${loan.slotNo} in ${group.name || 'the group'} is no longer available.` };
    }

    // A completed/active previous loan with cycle 0 is the data problem that broke
    // transactions before; do not build a new cycle on top of it.
    const latest = getLatestNonPendingLoan(others);
    if (latest && ['active', 'completed'].includes(latest.status) && !(Number(latest.loanCycle) > 0)) {
        return {
            ok: false,
            message: 'The client\'s previous loan has an invalid loan cycle (0). Repair it first, then reinstate.',
        };
    }

    const loanCycle = resolveLoanCycle(others);

    const noOfClients = (Number(group.noOfClients) || 0) + 1;
    const capacity = Number(group.capacity);
    const groupPatch = {
        availableSlots: (group.availableSlots ?? []).filter((s) => Number(s) !== slot),
        noOfClients,
        status: Number.isFinite(capacity) && capacity > 0 && noOfClients >= capacity ? 'full' : group.status,
    };

    const loanPatch = {
        status: 'pending',
        loanCycle,
        rejectReason: null,
        ldfApproved: false,
        ldfApprovedDate: null,
        ldfApprovedBy: null,
        closedDate: null,
        fullPaymentDate: null,
        modifiedDateTime: now,
    };

    return { ok: true, loanCycle, loanPatch, groupPatch };
}
