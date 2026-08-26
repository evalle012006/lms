export function getLatestNonPendingLoan(loanHistory) {
    if (!Array.isArray(loanHistory)) return null;
    return [...loanHistory]
        .filter(l => l.status !== 'pending')
        .sort((a, b) => new Date(b.insertedDateTime || b.dateAdded || 0) - new Date(a.insertedDateTime || a.dateAdded || 0))[0] || null;
}
export function getNextLoanCycle(loanHistory) {
    return (getLatestNonPendingLoan(loanHistory)?.loanCycle || 0) + 1;
}