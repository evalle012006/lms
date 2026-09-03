/**
 * src/lib/transfer-recalculation.js
 *
 * Recalculates a loan's installment amount and payment progress when a
 * client transfers between groups with a DIFFERENT occurence (daily <-> weekly).
 *
 * Formula (confirmed with Donie 2026-09-01):
 *   newActiveLoan   = amountRelease / newLoanTerms
 *     -> re-amortizes the FULL original loan over the new term count,
 *        aligning with the amount the client originally agreed to.
 *
 *   newNoOfPayments = floor((amountRelease - loanBalance) / newActiveLoan)
 *     -> expresses "how much has already been collected" in units of the
 *        NEW installment size. Floored deliberately: this must never let
 *        the system think more has been paid than actually has. Rounding
 *        up would under-bill the client on their next collection.
 *
 * These two are mathematically coupled by design:
 *   newLoanTerms - newNoOfPayments === loanBalance / newActiveLoan
 * i.e. however many installments are "left" always exactly covers what's
 * still owed. Do not change one formula without re-deriving the other.
 *
 * ONLY call recalculateLoanForTransfer when:
 *   - sourceGroup.occurence !== targetGroup.occurence, AND
 *   - loanBalance > 0 (a balance of 0 means the loan is already fully paid —
 *     there is nothing left to re-amortize, leave it alone)
 */

/**
 * Determines the loan term count (in installments) for the target occurence.
 *
 * - weekly: derived from the target group's weeklyScheduleType (standard/accelerated),
 *   same pattern as AddLoanPage.js.
 * - daily: NOT derivable from the group (daily groups carry no term field).
 *   Must come from an explicit user selection (targetLoanTerms), defaulting to 60.
 */
export function getNewLoanTermsForOccurence({ targetOccurence, targetWeeklyScheduleType, targetLoanTerms }) {
    if (targetOccurence === 'weekly') {
        return targetWeeklyScheduleType === 'accelerated' ? 12 : 24;
    }
    // daily — explicit selection required; default to 60 days per business rule
    return targetLoanTerms === 100 ? 100 : 60;
}

/**
 * @param {number} amountRelease  - loan.amountRelease (the full original loan amount, unchanged by transfer)
 * @param {number} loanBalance    - loan.loanBalance (remaining balance owed, unchanged by transfer)
 * @param {string} targetOccurence - 'daily' | 'weekly' (targetGroup.occurence)
 * @param {string} [targetWeeklyScheduleType] - targetGroup.weeklyScheduleType, required when targetOccurence === 'weekly'
 * @param {number} [targetLoanTerms] - 60 | 100, required (or defaulted) when targetOccurence === 'daily'
 * @returns {{ loanTerms: number, activeLoan: number, noOfPayments: number, weeklyScheduleType: string|null }}
 */
export function recalculateLoanForTransfer({
    amountRelease,
    loanBalance,
    targetOccurence,
    targetWeeklyScheduleType,
    targetLoanTerms,
}) {
    const newLoanTerms = getNewLoanTermsForOccurence({ targetOccurence, targetWeeklyScheduleType, targetLoanTerms });

    const safeAmountRelease = Number(amountRelease) || 0;
    const safeLoanBalance = Number(loanBalance) || 0;

    const newActiveLoan = newLoanTerms > 0 ? Math.round(safeAmountRelease / newLoanTerms) : 0;
    const alreadyCollected = Math.max(0, safeAmountRelease - safeLoanBalance);
    const newNoOfPayments = newActiveLoan > 0 ? Math.floor(alreadyCollected / newActiveLoan) : 0;

    return {
        loanTerms: newLoanTerms,
        activeLoan: newActiveLoan,
        noOfPayments: newNoOfPayments,
        weeklyScheduleType: targetOccurence === 'weekly' ? (targetWeeklyScheduleType || 'standard') : null,
    };
}

/**
 * Convenience helper for the confirmation modal / transfer drawer: decides
 * whether a recalculation applies at all, and returns either the recalculated
 * figures or the original (unchanged) figures so callers don't need an
 * if/else at every call site.
 */
export function getTransferPreview({
    sourceOccurence,
    targetOccurence,
    targetWeeklyScheduleType,
    targetLoanTerms,
    amountRelease,
    loanBalance,
    currentActiveLoan,
    currentLoanTerms,
    currentNoOfPayments,
}) {
    const occurenceChanged = sourceOccurence !== targetOccurence;
    const hasBalance = Number(loanBalance) > 0;

    if (!occurenceChanged || !hasBalance) {
        return {
            recalculated: false,
            loanTerms: currentLoanTerms,
            activeLoan: currentActiveLoan,
            noOfPayments: currentNoOfPayments,
        };
    }

    const result = recalculateLoanForTransfer({
        amountRelease,
        loanBalance,
        targetOccurence,
        targetWeeklyScheduleType,
        targetLoanTerms,
    });

    return { recalculated: true, ...result };
}