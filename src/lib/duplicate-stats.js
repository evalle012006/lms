// src/lib/duplicate-stats.js  (pure — no I/O, unit-tested)
// Duplicate-client statistics per Group / LO / Branch / Area / Region / Division.
//
// Definitions (shown on the page too):
//   - In every duplicate group the OLDEST record (earliest dateAdded, then smallest id) is the "original".
//   - Every other record is a "duplicate client". Each is counted under the unit it belongs to NOW (its own group,
//     LO, branch, ... ), so the numbers add up exactly: sum over rows = records - groups. Nothing is counted twice.
//   - "Involved records" = every record of the unit that sits in a duplicate group (original or not).
//   - "Groups" = distinct duplicate groups that touch the unit. A group spanning two branches counts once for each.
//   - "Active duplicates" = duplicate clients that currently have an active loan.

export const STAT_LEVELS = ['group', 'lo', 'branch', 'area', 'region', 'division'];

const time = (m) => { const t = Date.parse(m.dateAdded); return Number.isFinite(t) ? t : Infinity; };

/** The oldest record of a group; ties and missing dates fall back to the smaller _id so the result is stable. */
export function pickOriginal(members) {
    return members.reduce((a, b) => {
        const ta = time(a), tb = time(b);
        if (tb < ta) return b;
        if (tb > ta) return a;
        return String(b._id) < String(a._id) ? b : a;
    });
}

function unitOf(level, m, branchMap, names) {
    const branch = branchMap[m.branchId];
    switch (level) {
        case 'group':
            return { key: m.effGroupId ?? m.groupId ?? null, label: m.groupName ?? null, sub: m.branchName ?? branch?.name ?? null };
        case 'lo':
            return { key: m.effLoId ?? null, label: m.loName ?? null, sub: m.branchName ?? branch?.name ?? null };
        case 'branch':
            return { key: m.branchId ?? null, label: m.branchName ?? branch?.name ?? null, sub: null };
        case 'area':
            return { key: branch?.areaId ?? null, label: names.areas[branch?.areaId] ?? null, sub: null };
        case 'region':
            return { key: branch?.regionId ?? null, label: names.regions[branch?.regionId] ?? null, sub: null };
        case 'division':
            return { key: branch?.divisionId ?? null, label: names.divisions[branch?.divisionId] ?? null, sub: null };
        default:
            throw new Error(`Unknown level: ${level}`);
    }
}

/**
 * @param clusters   [{ _id, severity, confidence, members: [...] }]
 * @param level      one of STAT_LEVELS
 * @param ctx        { branches: [{_id,name,areaId,regionId,divisionId}], areas, regions, divisions: [{_id,name}],
 *                     branchIds?: string[] | null }   branchIds = optional scope; only records in these branches are counted
 */
export function tallyDuplicateStats(clusters, level, ctx) {
    if (!STAT_LEVELS.includes(level)) throw new Error(`Unknown level: ${level}`);
    const branchMap = Object.fromEntries((ctx.branches ?? []).map(b => [b._id, b]));
    const names = {
        areas: Object.fromEntries((ctx.areas ?? []).map(a => [a._id, a.name])),
        regions: Object.fromEntries((ctx.regions ?? []).map(a => [a._id, a.name])),
        divisions: Object.fromEntries((ctx.divisions ?? []).map(a => [a._id, a.name])),
    };
    const scope = ctx.branchIds ? new Set(ctx.branchIds) : null;
    const rows = new Map();
    const totals = { groups: 0, involvedRecords: 0, duplicateClients: 0, activeDuplicates: 0 };

    for (const c of clusters) {
        const members = c.members ?? [];
        if (members.length < 2) continue;
        const original = pickOriginal(members);
        const touched = new Set();
        let counted = false;

        for (const m of members) {
            if (scope && !scope.has(m.branchId)) continue;
            counted = true;
            const isDuplicate = m !== original;
            const u = unitOf(level, m, branchMap, names);
            const key = u.key ?? '__unassigned__';
            let row = rows.get(key);
            if (!row) {
                row = {
                    key: u.key, label: u.label ?? 'Unassigned', sub: u.sub,
                    groups: 0, involvedRecords: 0, duplicateClients: 0, activeDuplicates: 0,
                    exactGroups: 0, bothActiveGroups: 0,
                };
                rows.set(key, row);
            }
            row.involvedRecords++;
            totals.involvedRecords++;
            if (isDuplicate) {
                row.duplicateClients++;
                totals.duplicateClients++;
                if (m.activeLoan) { row.activeDuplicates++; totals.activeDuplicates++; }
            }
            if (!touched.has(key)) {
                touched.add(key);
                row.groups++;
                if (c.confidence === 'exact') row.exactGroups++;
                if (c.severity === 'both_active') row.bothActiveGroups++;
            }
        }
        if (counted) totals.groups++;
    }

    const sorted = [...rows.values()].sort((a, b) =>
        b.duplicateClients - a.duplicateClients || b.groups - a.groups || String(a.label).localeCompare(String(b.label)));
    return { rows: sorted, totals };
}
