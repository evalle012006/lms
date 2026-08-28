export function getLatestNonPendingLoan(loanHistory) {
    if (!Array.isArray(loanHistory)) return null;
    return [...loanHistory]
        .filter(l => l.status !== 'pending')
        .sort((a, b) => new Date(b.insertedDateTime || b.dateAdded || 0) - new Date(a.insertedDateTime || a.dateAdded || 0))[0] || null;
}
export function getNextLoanCycle(loanHistory) {
    return (getLatestNonPendingLoan(loanHistory)?.loanCycle || 0) + 1;
}

// Single source of truth for "does this client's new loan continue their
// existing cycle, or restart at 1?" Do not re-derive this from clientType
// string matching anywhere else — clientType means different things
// depending on which UI flow set it (manual dropdown vs CI-promoted banner),
// but the client's own loan history never lies.
//
// Reset to 1 when:
//   - no loan history at all (true new Prospect), OR
//   - most recent non-pending loan was closed via offset (Balik — the whole
//     point of offsetting is that their history was intentionally reset)
//
// Continue (prevCycle + 1) when:
//   - most recent non-pending loan is active (Reloan) or completed
//     (Pending Member re-applying) — only the loan *status* differs
//     between these two, the cycle math is identical.
export function resolveLoanCycle(loanHistory) {
    const latest = getLatestNonPendingLoan(loanHistory);
    if (!latest) return 1;
    if (latest.status === 'offset') return 1;
    return (latest.loanCycle || 0) + 1;
}