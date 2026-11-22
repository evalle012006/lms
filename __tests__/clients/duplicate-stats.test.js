import { tallyDuplicateStats, pickOriginal, STAT_LEVELS } from '@/lib/duplicate-stats';
import { branchIdsForFilters, branchIdsCondition } from '@/lib/duplicate-hierarchy';
import { canSeeDuplicateAlerts } from '@/lib/duplicate-alerts-access';

const hierarchy = {
    divisions: [{ _id: 'd1', name: 'Div 1' }, { _id: 'd2', name: 'Div 2' }],
    regions: [{ _id: 'r1', name: 'Reg 1', divisionId: 'd1' }, { _id: 'r2', name: 'Reg 2', divisionId: 'd2' }],
    areas: [{ _id: 'a1', name: 'Area 1', regionId: 'r1', divisionId: 'd1' }, { _id: 'a2', name: 'Area 2', regionId: 'r2', divisionId: 'd2' }],
    branches: [
        { _id: 'b1', name: 'Branch 1', areaId: 'a1', regionId: 'r1', divisionId: 'd1' },
        { _id: 'b2', name: 'Branch 2', areaId: 'a1', regionId: 'r1', divisionId: 'd1' },
        { _id: 'b3', name: 'Branch 3', areaId: 'a2', regionId: 'r2', divisionId: 'd2' },
    ],
};

const m = (id, branchId, dateAdded, extra = {}) => ({ _id: id, branchId, dateAdded, effLoId: 'lo-' + branchId, loName: 'LO ' + branchId, effGroupId: 'g-' + branchId, groupName: 'G ' + branchId, ...extra });

// c1: 3 records (b1, b1, b2) — oldest is x1; c2: 2 records (b2, b3)
const clusters = [
    { _id: 'c1', confidence: 'exact', severity: 'both_active', members: [
        m('x2', 'b1', '2025-02-01', { activeLoan: { _id: 'l' } }),
        m('x1', 'b1', '2024-01-01'),
        m('x3', 'b2', '2025-06-01', { activeLoan: { _id: 'l' } }),
    ] },
    { _id: 'c2', confidence: 'high', severity: 'one_active', members: [
        m('y1', 'b2', '2024-05-01'),
        m('y2', 'b3', '2025-01-01'),
    ] },
];

describe('pickOriginal', () => {
    test('oldest dateAdded wins; ties fall back to smaller id; missing dates lose', () => {
        expect(pickOriginal([m('b', 'b1', '2024-01-01'), m('a', 'b1', '2024-01-01')])._id).toBe('a');
        expect(pickOriginal([m('n', 'b1', undefined), m('d', 'b1', '2030-01-01')])._id).toBe('d');
    });
});

describe('tallyDuplicateStats', () => {
    test('duplicates add up exactly: records - groups, at every level', () => {
        for (const level of STAT_LEVELS) {
            const { totals, rows } = tallyDuplicateStats(clusters, level, hierarchy);
            expect(totals.groups).toBe(2);
            expect(totals.involvedRecords).toBe(5);
            expect(totals.duplicateClients).toBe(3);
            expect(rows.reduce((s, r) => s + r.duplicateClients, 0)).toBe(3);
        }
    });

    test('branch level: each duplicate is counted under its own branch, a group counts once per branch', () => {
        const { rows } = tallyDuplicateStats(clusters, 'branch', hierarchy);
        const by = Object.fromEntries(rows.map(r => [r.key, r]));
        expect(by.b1).toMatchObject({ duplicateClients: 1, involvedRecords: 2, groups: 1, activeDuplicates: 1 });
        expect(by.b2).toMatchObject({ duplicateClients: 1, involvedRecords: 2, groups: 2, activeDuplicates: 1 });
        expect(by.b3).toMatchObject({ duplicateClients: 1, involvedRecords: 1, groups: 1, activeDuplicates: 0 });
        expect(by.b1.exactGroups).toBe(1);
        expect(by.b2.bothActiveGroups).toBe(1);
    });

    test('area / region / division roll branches up through the branch table', () => {
        const area = tallyDuplicateStats(clusters, 'area', hierarchy).rows;
        expect(area.find(r => r.key === 'a1')).toMatchObject({ label: 'Area 1', duplicateClients: 2, groups: 2 });
        expect(area.find(r => r.key === 'a2')).toMatchObject({ label: 'Area 2', duplicateClients: 1, groups: 1 });
        const div = tallyDuplicateStats(clusters, 'division', hierarchy).rows;
        expect(div.map(r => r.label)).toEqual(['Div 1', 'Div 2']);
    });

    test('records without LO / group / branch land in Unassigned instead of disappearing', () => {
        const c = [{ _id: 'c', confidence: 'exact', severity: 'one_active', members: [
            { _id: 'a', dateAdded: '2024-01-01', branchId: 'b1' },
            { _id: 'b', dateAdded: '2025-01-01', branchId: 'b1' },
        ] }];
        const lo = tallyDuplicateStats(c, 'lo', hierarchy);
        expect(lo.rows).toHaveLength(1);
        expect(lo.rows[0]).toMatchObject({ key: null, label: 'Unassigned', duplicateClients: 1 });
    });

    test('branch scope counts only records in those branches (the original is still chosen from the whole group)', () => {
        const { rows, totals } = tallyDuplicateStats(clusters, 'branch', { ...hierarchy, branchIds: ['b2'] });
        expect(rows.map(r => r.key)).toEqual(['b2']);
        expect(totals.groups).toBe(2);
        expect(totals.duplicateClients).toBe(1); // x3 is a duplicate; y1 is c2's original (oldest) so not a duplicate
    });

    test('groups with fewer than 2 records and unknown levels are handled', () => {
        expect(tallyDuplicateStats([{ _id: 'c', members: [m('a', 'b1', '2024-01-01')] }], 'branch', hierarchy).totals.groups).toBe(0);
        expect(() => tallyDuplicateStats(clusters, 'galaxy', hierarchy)).toThrow();
    });
});

describe('hierarchy filters', () => {
    const h = hierarchy;
    test('no filter = unrestricted (null)', () => {
        expect(branchIdsForFilters(h, {})).toBeNull();
        expect(branchIdsCondition(null)).toBeNull();
    });
    test('division / region / area narrow to their branches and combine with AND', () => {
        expect(branchIdsForFilters(h, { divisionId: 'd1' })).toEqual(['b1', 'b2']);
        expect(branchIdsForFilters(h, { regionId: 'r2' })).toEqual(['b3']);
        expect(branchIdsForFilters(h, { divisionId: 'd1', areaId: 'a2' })).toEqual([]);
        expect(branchIdsForFilters(h, { areaId: 'a1', branchId: 'b2' })).toEqual(['b2']);
    });
    test('condition uses a single indexed jsonb check; empty selection matches nothing', () => {
        expect(branchIdsCondition(['b1', 'b2'])).toEqual({ branch_ids: { _has_keys_any: ['b1', 'b2'] } });
        expect(branchIdsCondition([])).toEqual({ _id: { _eq: '__no_match__' } });
    });
});

describe('Duplicate Alerts widget audience', () => {
    const u = (role, extra = {}) => ({ role, ...extra });
    test('admin, root and division head see it', () => {
        expect(canSeeDuplicateAlerts(u({ rep: 1, shortCode: 'admin' }))).toBe(true);
        expect(canSeeDuplicateAlerts({ root: true })).toBe(true);
        expect(canSeeDuplicateAlerts(u({ rep: 2, shortCode: 'deputy_director' }))).toBe(true);
    });
    test('everyone else does not (for now)', () => {
        for (const role of [
            { rep: 2, shortCode: 'regional_manager' }, { rep: 2, shortCode: 'regional_admin' },
            { rep: 2, shortCode: 'area_admin' }, { rep: 3, shortCode: 'branch_manager' }, { rep: 4, shortCode: 'loan_officer' },
        ]) expect(canSeeDuplicateAlerts(u(role))).toBe(false);
        expect(canSeeDuplicateAlerts(null)).toBe(false);
        expect(canSeeDuplicateAlerts(u(undefined))).toBe(false);
    });
});
