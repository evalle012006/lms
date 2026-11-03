jest.mock('@/lib/api/resolveLoanBranchScope', () => ({ resolveLoanBranchScope: jest.fn() }));
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { resolveBranchWhere, branchWhereAllows, isBranchInScope } from '@/lib/ci-scope';

describe('resolveBranchWhere', () => {
    test('admin (branchIds null) is unscoped', async () => {
        resolveLoanBranchScope.mockResolvedValue({ branchIds: null });
        expect(await resolveBranchWhere({ _id: 'u' })).toEqual({});
    });
    test('supervisor gets their branches', async () => {
        resolveLoanBranchScope.mockResolvedValue({ branchIds: ['b1', 'b2'] });
        expect(await resolveBranchWhere({ _id: 'u' })).toEqual({ branchId: { _in: ['b1', 'b2'] } });
    });
    test('empty branch list matches zero rows, never everything', async () => {
        resolveLoanBranchScope.mockResolvedValue({ branchIds: [] });
        expect(await resolveBranchWhere({ _id: 'u' })).toEqual({ branchId: { _in: [] } });
    });
    test('no user -> null', async () => {
        expect(await resolveBranchWhere(null)).toBeNull();
    });
});

describe('branchWhereAllows', () => {
    test('null/undefined where denies', () => {
        expect(branchWhereAllows(null, 'b1')).toBe(false);
        expect(branchWhereAllows(undefined, 'b1')).toBe(false);
    });
    test('{} (admin) allows anything', () => {
        expect(branchWhereAllows({}, 'whatever')).toBe(true);
    });
    test('_in allows members only; empty list allows nothing', () => {
        expect(branchWhereAllows({ branchId: { _in: ['b1'] } }, 'b1')).toBe(true);
        expect(branchWhereAllows({ branchId: { _in: ['b1'] } }, 'b2')).toBe(false);
        expect(branchWhereAllows({ branchId: { _in: [] } }, 'b1')).toBe(false);
    });
    test('_eq', () => {
        expect(branchWhereAllows({ branchId: { _eq: 'b1' } }, 'b1')).toBe(true);
        expect(branchWhereAllows({ branchId: { _eq: 'b1' } }, 'b2')).toBe(false);
    });
});

describe('isBranchInScope', () => {
    test('combines the resolver and the check', async () => {
        resolveLoanBranchScope.mockResolvedValue({ branchIds: ['b1'] });
        expect(await isBranchInScope({ _id: 'u' }, 'b1')).toBe(true);
        expect(await isBranchInScope({ _id: 'u' }, 'b9')).toBe(false);
    });
});