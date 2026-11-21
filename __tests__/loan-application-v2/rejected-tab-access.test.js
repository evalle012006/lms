import { canViewRejectedLoans, canReinstateRejectedLoans, approvalMode } from '@/lib/loan-application-v2-gate';

const user = (shortCode, extra = {}) => ({ role: { shortCode, rep: extra.rep }, ...extra });

describe('canViewRejectedLoans (read-only list)', () => {
    test.each(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager', 'loan_officer'])(
        '%s can view', (code) => { expect(canViewRejectedLoans(user(code))).toBe(true); });

    test('root can view', () => {
        expect(canViewRejectedLoans({ root: true, role: { shortCode: 'admin' } })).toBe(true);
    });

    test.each(['cashier', 'finance'])('%s cannot view', (code) => {
        expect(canViewRejectedLoans(user(code))).toBe(false);
    });

    test('missing user or role cannot view', () => {
        expect(canViewRejectedLoans(null)).toBe(false);
        expect(canViewRejectedLoans({})).toBe(false);
    });
});

describe('canReinstateRejectedLoans (admin + supervisors only)', () => {
    test.each(['admin', 'deputy_director', 'regional_manager', 'area_admin'])('%s can reinstate', (code) => {
        expect(canReinstateRejectedLoans(user(code))).toBe(true);
    });

    test('root can reinstate', () => {
        expect(canReinstateRejectedLoans({ root: true, role: { shortCode: 'admin' } })).toBe(true);
    });

    test.each(['branch_manager', 'loan_officer', 'cashier', 'finance'])('%s cannot reinstate', (code) => {
        expect(canReinstateRejectedLoans(user(code))).toBe(false);
    });

    test('missing user or role cannot reinstate', () => {
        expect(canReinstateRejectedLoans(null)).toBe(false);
        expect(canReinstateRejectedLoans({})).toBe(false);
    });

    test('supervisors are the same set approvalMode calls supervisor', () => {
        ['admin', 'deputy_director', 'regional_manager', 'area_admin'].forEach((code) => {
            expect(approvalMode(user(code, { rep: 2 }))).toBe('supervisor');
        });
    });
});
