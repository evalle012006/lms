import { analyzeTransaction } from '../../src/lib/support-analyze';

const group = { _id: 'g1', branchId: 'b1', loanOfficerId: 'lo1' };
const loan = { _id: 'l1', clientId: 'c1', groupId: 'g1', branchId: 'b1', loId: 'lo1', status: 'active', amountRelease: 6000, activeLoan: 100, loanTerms: '60', loanBalance: 5000, principalLoan: 5000, slotNo: 1, loanCycle: 2, fullName: 'Ana Cruz', mcbu: 0, csf: 0, noOfPayments: 1, advanceDays: 0, pastDue: 0, mcbuCollection: 0, csfCollection: 0 };
const client = { _id: 'c1', fullName: 'Ana  Cruz', groupId: 'g1', branchId: 'b1', loId: 'lo1', status: 'active' };
const row = { _id: 'r1', loanId: 'l1', clientId: 'c1', groupId: 'g1', branchId: 'b1', loId: 'lo1', slotNo: 1, loanCycle: 2, status: 'active', draft: false, paymentCollection: 100, activeLoan: 100, loanBalance: 5000, mcbu: 0, csf: 0, noOfPayments: 1, advanceDays: 0, pastDue: 0, mcbuCol: 0, csfCollection: 0, dateAdded: '2026-11-25' };
const base = { row, loan, group, client, rows: [row], today: '2026-11-25' };
const fields = (r) => r.issues.map((i) => `${i.entity}.${i.field}`);

test('clean data has no issues', () => { expect(analyzeTransaction(base).issues).toEqual([]); });
test('wrong ids on row, loan and client are repairable from the group', () => {
    const r = analyzeTransaction({ ...base, row: { ...row, loId: 'x', groupId: 'g9' }, loan: { ...loan, branchId: 'b9' }, client: { ...client, loId: 'x2' } });
    expect(fields(r)).toEqual(expect.arrayContaining(['cashCollections.loId', 'cashCollections.groupId', 'loans.branchId', 'client.loId']));
    expect(r.issues.find((i) => i.entity === 'cashCollections' && i.field === 'loId')).toMatchObject({ expected: 'lo1', repairable: true });
});
test('payment that is not a multiple of the installment is an error', () => {
    const r = analyzeTransaction({ ...base, row: { ...row, paymentCollection: 105 } });
    expect(r.issues.find((i) => i.field === 'paymentCollection')?.severity).toBe('error');
});
test('balance not following the previous row is flagged for review', () => {
    const r = analyzeTransaction({ ...base, prevRow: { loanBalance: 5300, dateAdded: '2026-11-24' } });
    expect(r.issues.find((i) => i.field === 'loanBalance')).toMatchObject({ expected: 5200, repairable: true, review: true });
});
test('stale draft and completed-with-balance', () => {
    expect(analyzeTransaction({ ...base, row: { ...row, draft: true, dateAdded: '2026-11-20' } }).issues.some((i) => i.field === 'draft')).toBe(true);
    expect(analyzeTransaction({ ...base, loan: { ...loan, status: 'completed', loanBalance: 50 } }).counts.error).toBeGreaterThan(0);
});

import { remarkOptions, canonicalRemark, sameValue, normalizeValue, ENTITIES } from '../../src/lib/support-edit-config';
import { validateEdit } from '../../src/lib/support-edit-validate';

describe('remarks follow the group occurence like the register', () => {
    const def = ENTITIES.cashCollections.fields.remarks;
    test('daily vs weekly lists', () => {
        expect(remarkOptions('daily').map((o) => o.value)).toContain('reloaner-cont');
        expect(remarkOptions('weekly').map((o) => o.value)).toContain('reloaner');
        expect(remarkOptions('weekly').map((o) => o.value)).not.toContain('reloaner-cont');
        expect(remarkOptions('daily').some((o) => o.value === '')).toBe(false);
    });
    test('stored as { label, value }; compare by value; blank is ""', () => {
        expect(normalizeValue(def, 'excused-death')).toEqual({ label: 'Excused - Death of Clients/Family Member', value: 'excused-death' });
        expect(normalizeValue(def, null)).toBe('');
        expect(sameValue(def, { label: 'x', value: 'past due' }, 'past due')).toBe(true);
        expect(sameValue(def, '', null)).toBe(true);
        expect(canonicalRemark({ value: 'delinquent' }).label).toBe('Delinquent');
    });
    test('a remark from the other register is rejected', () => {
        const before = { _id: 'r', occurence: 'weekly', paymentCollection: 0, status: 'active' };
        const r = validateEdit({ entity: 'cashCollections', before, changes: [{ field: 'remarks', before: '', after: { label: 'Reloaner', value: 'reloaner-cont' } }], ctx: {} });
        expect(r.errors.some((e) => e.field === 'remarks')).toBe(true);
        const ok = validateEdit({ entity: 'cashCollections', before, changes: [{ field: 'remarks', before: '', after: { label: 'Reloaner', value: 'reloaner' } }], ctx: {} });
        expect(ok.errors.some((e) => e.field === 'remarks')).toBe(false);
    });
});

test('register-only remarks sit with their related remarks', () => {
    const v = remarkOptions('daily').map((o) => o.value);
    expect(v.indexOf('offset-delinquent')).toBe(v.indexOf('offset-good') + 1);
    expect(v.indexOf('reloaner-wd')).toBe(v.indexOf('reloaner-cont') + 1);
});
