import { duplicateAccess, canManageDuplicates } from '@/lib/duplicate-access';
import { intersectBranchIds, scopeHierarchy, branchIdsCondition } from '@/lib/duplicate-hierarchy';
import { maskId } from '@/lib/mask-id';

const u = (shortCode, rep, extra = {}) => ({ role: { shortCode, rep }, ...extra });

describe('duplicateAccess', () => {
    test('only root gets full access (Re-scan and action buttons)', () => {
        expect(duplicateAccess({ root: true })).toBe('full');
        expect(canManageDuplicates({ root: true })).toBe(true);
    });
    test('every other admin is read-only (all branches)', () => {
        expect(duplicateAccess(u('admin', 1))).toBe('readonly');
        expect(duplicateAccess({ role: { rep: 1 } })).toBe('readonly');
        expect(canManageDuplicates(u('admin', 1))).toBe(false);
    });
    test('branch manager, area manager, regional manager and division head are read-only', () => {
        for (const [c, r] of [['branch_manager', 3], ['area_admin', 2], ['regional_manager', 2], ['deputy_director', 2]]) {
            expect(duplicateAccess(u(c, r))).toBe('readonly');
            expect(canManageDuplicates(u(c, r))).toBe(false);
        }
    });
    test('regional_admin is not a role here (the Nav menu and scoping use regional_manager)', () => {
        expect(duplicateAccess(u('regional_admin', 2))).toBeNull();
    });
    test('loan officers and unknown users get nothing', () => {
        expect(duplicateAccess(u('loan_officer', 4))).toBeNull();
        expect(duplicateAccess(null)).toBeNull();
        expect(duplicateAccess({})).toBeNull();
    });
});

describe('scoping helpers', () => {
    const h = {
        divisions: [{ _id: 'd1', name: 'D1' }, { _id: 'd2', name: 'D2' }],
        regions: [{ _id: 'r1', name: 'R1', divisionId: 'd1' }, { _id: 'r2', name: 'R2', divisionId: 'd2' }],
        areas: [{ _id: 'a1', name: 'A1' }, { _id: 'a2', name: 'A2' }],
        branches: [
            { _id: 'b1', name: 'B1', areaId: 'a1', regionId: 'r1', divisionId: 'd1' },
            { _id: 'b2', name: 'B2', areaId: 'a2', regionId: 'r2', divisionId: 'd2' },
        ],
    };
    test('intersectBranchIds: null = unrestricted, otherwise the overlap only', () => {
        expect(intersectBranchIds(null, null)).toBeNull();
        expect(intersectBranchIds(null, ['b1'])).toEqual(['b1']);
        expect(intersectBranchIds(['b1', 'b2'], null)).toEqual(['b1', 'b2']);
        expect(intersectBranchIds(['b1', 'b2'], ['b2'])).toEqual(['b2']);
        expect(intersectBranchIds(['b1'], ['b2'])).toEqual([]);   // a filter can never widen the caller's scope
    });
    test('scopeHierarchy keeps only the caller branches and what is above them', () => {
        const s = scopeHierarchy(h, ['b1']);
        expect(s.branches.map(b => b._id)).toEqual(['b1']);
        expect(s.areas.map(a => a._id)).toEqual(['a1']);
        expect(s.regions.map(a => a._id)).toEqual(['r1']);
        expect(s.divisions.map(a => a._id)).toEqual(['d1']);
        expect(scopeHierarchy(h, null)).toBe(h);
    });
    test('an empty scope matches nothing', () => {
        expect(branchIdsCondition([])).toEqual({ _id: { _eq: '__no_match__' } });
        expect(scopeHierarchy(h, []).branches).toEqual([]);
    });
});

describe('maskId', () => {
    test('keeps only the last 4 characters', () => {
        expect(maskId('1234567890')).toBe('••••••7890');
        expect(maskId('abc')).toBe('••••');
        expect(maskId(null)).toBeNull();
    });
});

import { statsLevelsFor } from '@/lib/duplicate-access';
describe('statsLevelsFor', () => {
    const u = (shortCode, extra = {}) => ({ role: { shortCode, rep: 3 }, ...extra });
    test('per role', () => {
        expect(statsLevelsFor({ root: true })).toHaveLength(6);
        expect(statsLevelsFor({ role: { shortCode: 'admin', rep: 1 } })).toHaveLength(6);
        expect(statsLevelsFor(u('deputy_director'))).toEqual(['division', 'region', 'area', 'branch', 'lo', 'group']);
        expect(statsLevelsFor(u('regional_manager'))).toEqual(['region', 'area', 'branch', 'lo', 'group']);
        expect(statsLevelsFor(u('area_admin'))).toEqual(['area', 'branch', 'lo', 'group']);
        expect(statsLevelsFor(u('branch_manager'))).toEqual(['branch', 'lo', 'group']);
        expect(statsLevelsFor(u('loan_officer'))).toEqual([]);
    });
});
