import {
    getShortCode, isSystemAdmin, canDecideCI, isAboveBranchLevel, CI_DECISION_ROLES,
} from '@/lib/ci-roles';

const withRole = (shortCode, rep = 2) => ({ role: { shortCode, rep } });

describe('ci-roles', () => {
    test('getShortCode reads role.shortCode, then top-level, else null', () => {
        expect(getShortCode(withRole('area_admin'))).toBe('area_admin');
        expect(getShortCode({ shortCode: 'admin' })).toBe('admin');
        expect(getShortCode(null)).toBeNull();
    });

    test.each(CI_DECISION_ROLES)('%s can decide', (sc) => {
        expect(canDecideCI(withRole(sc))).toBe(true);
    });

    test.each(['loan_officer', 'cashier', '', undefined])('%p cannot decide', (sc) => {
        expect(canDecideCI(withRole(sc, 4))).toBe(false);
    });

    test('rep alone grants nothing (shortCode is the rule)', () => {
        expect(canDecideCI({ role: { rep: 1 } })).toBe(false);
    });

    test('root flag is an admin even without a role', () => {
        expect(isSystemAdmin({ root: true })).toBe(true);
        expect(canDecideCI({ root: true })).toBe(true);
    });

    test('isAboveBranchLevel: admin/supervisors yes, branch_manager and LO no', () => {
        expect(isAboveBranchLevel(withRole('area_admin'))).toBe(true);
        expect(isAboveBranchLevel(withRole('admin', 1))).toBe(true);
        expect(isAboveBranchLevel(withRole('branch_manager', 3))).toBe(false);
        expect(isAboveBranchLevel(withRole('loan_officer', 4))).toBe(false);
    });
});