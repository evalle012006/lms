import { checkLorRowRules, checkLorLoanRules } from '@/lib/lor-row-rules';
const rv = (v) => ({ label: v, value: v });
const base = { status: 'active', loanBalance: 500, targetCollection: 100, activeLoan: 100, paymentCollection: 100, remarks: '' };
const run = (row, touched, extra = {}) => checkLorRowRules({ row: { ...base, ...row }, touched: new Set(touched), group: { occurence: 'weekly', csfEnabled: true }, ...extra });
describe('checkLorRowRules', () => {
  test('offset on active row warns about status and needs a reason', () => {
    const r = run({ remarks: rv('offset-good') }, ['remarks'], { loan: { status: 'active' } });
    expect(r.errors.map((e) => e.field)).toContain('closeRemarks');
    expect(r.warnings.map((w) => w.field)).toEqual(expect.arrayContaining(['status', 'remarks']));
  });
  test('csf above 5 must be multiple of 5', () => { expect(run({ csfCollection: 7 }, ['csfCollection']).errors).toHaveLength(1); expect(run({ csfCollection: 10 }, ['csfCollection']).errors).toHaveLength(0); });
  test('leader needs csf', () => { expect(run({ groupLeader: true, csfCollection: 0 }, ['csfCollection']).errors).toHaveLength(1); });
  test('double payment needs remark', () => { expect(run({ paymentCollection: 200 }, ['paymentCollection']).warnings.some((w) => w.field === 'remarks')).toBe(true); });
  test('weekly mcbu 75', () => { expect(run({ mcbuCol: 15 }, ['mcbuCol']).warnings.some((w) => /75/.test(w.message))).toBe(true); });
  test('clean row has none', () => { const r = run({ mcbuCol: 75 }, ['paymentCollection']); expect(r.errors).toHaveLength(0); expect(r.warnings).toHaveLength(0); });
});
test('loan offset remark with active status', () => { expect(checkLorLoanRules({ loan: { remarks: 'Offset', status: 'active' }, touched: new Set(['remarks']) }).warnings).toHaveLength(1); });
