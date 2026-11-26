// Groups of a loan officer, in the order support looks for them:
//   1 = same type as the loan officer's transactionType (daily / weekly) and has clients
//   2 = same type, no clients        3 = everything else
// Inside a section: group number, then (weekly) the collection day.
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const dayRank = (g) => {
    const i = WEEKDAYS.indexOf(String(g.day ?? '').trim().toLowerCase());
    return i >= 0 ? i : (Number.isFinite(Number(g.dayNo)) ? Number(g.dayNo) : 99);
};
const numOrText = (a, b) => {
    const x = Number(a), y = Number(b);
    return Number.isFinite(x) && Number.isFinite(y) && x !== y ? x - y : String(a ?? '').localeCompare(String(b ?? ''), undefined, { numeric: true });
};
export function orderGroups(groups, loType) {
    const t = String(loType ?? '').trim().toLowerCase();
    const section = (g) => (t && String(g.occurence ?? '').trim().toLowerCase() === t ? ((Number(g.noOfClients) || 0) > 0 ? 1 : 2) : 3);
    return groups.map((g) => ({ ...g, section: section(g) }))
        .sort((a, b) => a.section - b.section || numOrText(a.groupNo, b.groupNo) || dayRank(a) - dayRank(b));
}
