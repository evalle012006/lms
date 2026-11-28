import { validateEdit } from '@/lib/support-edit-validate';
import { diffFields } from '@/lib/support-edit-config';

const loan = { _id: 'L1', occurence: 'weekly', weeklyScheduleType: 'standard', principalLoan: 10000, amountRelease: 12000, loanBalance: 6000, activeLoan: 500, targetCollection: 500, lrfCollection: 100, loanRelease: 12000, mcbu: 500, csf: 100, status: 'active', loanTerms: 24, noOfPayments: 12, ldfApproved: true };
const run = (entity, before, proposed, ctx = {}) => validateEdit({ entity, before, changes: diffFields(entity, before, proposed), ctx });

describe('loans', () => {
    it('rejects an amountRelease that is not principal x the loan\'s own rate', () => {
        const r = run('loans', loan, { principalLoan: 15000, amountRelease: 17000 });
        expect(r.errors.map(e => e.field)).toContain('amountRelease');
    });
    it('accepts principal + amountRelease that agree (rate 1.2)', () => {
        expect(run('loans', loan, { principalLoan: 15000, amountRelease: 18000, loanBalance: 6000 }).errors).toEqual([]);
    });
    it('warns when installment/target/LRF do not follow a new principal', () => {
        const w = run('loans', loan, { principalLoan: 15000, amountRelease: 18000 }).warnings.map(x => x.field);
        expect(w).toEqual(expect.arrayContaining(['activeLoan', 'lrfCollection']));
    });
    it('rejects a principal not divisible by 1000', () => {
        expect(run('loans', loan, { principalLoan: 10500, amountRelease: 12600 }).errors.map(e => e.field)).toContain('principalLoan');
    });
    it('rejects balance above amountRelease and negatives', () => {
        expect(run('loans', loan, { loanBalance: 13000 }).errors.length).toBe(1);
        expect(run('loans', loan, { mcbu: -5 }).errors.length).toBe(1);
    });
    it('errors on completed with balance', () => {
        expect(run('loans', loan, { status: 'completed' }).errors.length).toBeGreaterThan(0);
    });
    it('returns an error when nothing changed', () => {
        expect(run('loans', loan, { status: 'active' }).errors[0].message).toMatch(/No changes/);
    });
});

describe('completed rule', () => {
    it('hard-errors on completed with balance / activeLoan / no or future payoff date', () => {
        const f = run('loans', loan, { status: 'completed' }, { today: '2026-11-25' }).errors.map(e => e.field);
        expect(f).toEqual(expect.arrayContaining(['loanBalance', 'activeLoan', 'fullPaymentDate']));
        const g = run('loans', loan, { status: 'completed', loanBalance: 0, activeLoan: 0, targetCollection: 0, fullPaymentDate: '2026-12-01' }, { today: '2026-11-25' }).errors.map(e => e.field);
        expect(g).toEqual(['fullPaymentDate']);
    });
    it('accepts a proper completed loan', () => {
        expect(run('loans', loan, { status: 'completed', loanBalance: 0, activeLoan: 0, targetCollection: 0, fullPaymentDate: '2026-11-20' }, { today: '2026-11-25' }).errors).toEqual([]);
    });
    it('accepts amountRelease using the current settings rate with a warning', () => {
        const r = run('loans', loan, { principalLoan: 10000, amountRelease: 13000 }, { serviceChargeRate: 1.3 });
        expect(r.errors).toEqual([]);
        expect(r.warnings.map(w => w.field)).toContain('amountRelease');
    });
});

describe('cashCollections', () => {
    const cc = { _id: 'C1', targetCollection: 500, paymentCollection: 500, loanBalance: 5500, activeLoan: 5500, status: 'active', remarks: 'paid', amountRelease: 12000 };
    it('rejects a payment that is not a multiple of target and not a payoff', () => {
        expect(run('cashCollections', cc, { paymentCollection: 730 }).errors.length).toBe(1);
    });
    it('allows a payoff amount that is not a multiple', () => {
        const r = run('cashCollections', cc, { paymentCollection: 200 }, { loan: { loanBalance: 200 } });
        expect(r.errors).toEqual([]);
    });
});

describe('mcbu_withdrawals', () => {
    it('rejects a withdrawal above the loan MCBU', () => {
        const w = { _id: 'W1', mcbu_withdrawal_amount: 100, csf_withdrawal_amount: 0, status: 'pending' };
        expect(run('mcbu_withdrawals', w, { mcbu_withdrawal_amount: 900 }, { loan: { mcbu: 500, csf: 0 } }).errors.length).toBe(1);
    });
});

describe('loan reconciliation', () => {
    const { computeLoanReconciliation } = require('@/lib/support-loan-reconcile');
    const rows = [
        { _id: 'c2', dateAdded: '2026-11-20', status: 'active', draft: false, loanBalance: 5000, mcbu: 600, csf: 0, noOfPayments: 14, advanceDays: 0, pastDue: 0, mcbuCol: 75, csfCollection: 0 },
        { _id: 'c1', dateAdded: '2026-11-19', status: 'active', draft: false, loanBalance: 5500, mcbu: 525, csf: 0, noOfPayments: 13, advanceDays: 0, pastDue: 0, mcbuCol: 75, csfCollection: 0 },
        { _id: 'd', dateAdded: '2026-11-21', status: 'active', draft: true, loanBalance: 1, mcbu: 1, csf: 0, noOfPayments: 99 },
    ];
    it('suggests the latest saved (non-draft) row values and ignores drafts', () => {
        const r = computeLoanReconciliation({ loanBalance: 5500, mcbu: 525, csf: 0, noOfPayments: 13, advanceDays: 0, pastDue: 0, status: 'active', mcbuCollection: 150, csfCollection: 0 }, rows);
        expect(r.latest._id).toBe('c2');
        expect(r.items.map(i => i.field).sort()).toEqual(['loanBalance', 'mcbu', 'noOfPayments']);
    });
    it('is empty when in sync', () => {
        expect(computeLoanReconciliation({ loanBalance: 5000, mcbu: 600, csf: 0, noOfPayments: 14, advanceDays: 0, pastDue: 0, status: 'active', mcbuCollection: 150, csfCollection: 0 }, rows).items).toEqual([]);
    });
});

describe('cash collection row against the loan installment', () => {
    const row = { _id: 'C1', loanId: 'L1', status: 'active', paymentCollection: 240, loanBalance: 6000, activeLoan: 240, draft: false };
    const ctx = { loan: { ...loan, activeLoan: 240, loanBalance: 6000 } };
    it('rejects a payment that is not a multiple of the loan installment (240 -> 245)', () => {
        expect(run('cashCollections', row, { paymentCollection: 245 }, ctx).errors.map(e => e.field)).toContain('paymentCollection');
    });
    it('warns that a multiple of the installment is an advance payment', () => {
        const r = run('cashCollections', row, { paymentCollection: 480 }, ctx);
        expect(r.errors).toEqual([]);
        expect(r.warnings.map(w => w.field)).toContain('paymentCollection');
    });
    it('accepts a payment equal to the installment', () => {
        expect(run('cashCollections', row, { paymentCollection: 240 }, ctx).errors.length).toBe(1); // no change -> "No changes"
    });
});

describe('full payment date needs a completed status', () => {
    const row = { _id: 'C1', loanId: 'L1', status: 'active', paymentCollection: 240, loanBalance: 6000, activeLoan: 240 };
    it('errors when a full payment date is added to a non-completed row', () => {
        expect(run('cashCollections', row, { fullPaymentDate: '2026-11-24' }, { today: '2026-11-25' }).errors.map(e => e.field)).toContain('fullPaymentDate');
    });
    it('errors on a non-completed loan too, only warns when closed', () => {
        expect(run('loans', loan, { fullPaymentDate: '2026-11-24' }).errors.map(e => e.field)).toContain('fullPaymentDate');
        const closed = { ...loan, status: 'closed' };
        const r = run('loans', closed, { fullPaymentDate: '2026-11-24' });
        expect(r.errors.map(e => e.field)).not.toContain('fullPaymentDate');
        expect(r.warnings.map(w => w.field)).toContain('fullPaymentDate');
    });
});

describe('empty values on required fields', () => {
    it('refuses to clear a required text field and a required amount, allows a nullable one', () => {
        const client = { _id: 'K1', firstName: 'SUSAN', lastName: 'LIANG', middleName: 'L.', status: 'active' };
        expect(run('client', client, { firstName: '' }).errors.map(e => e.field)).toContain('firstName');
        expect(run('client', client, { middleName: '' }).errors).toEqual([]);
        expect(run('loans', loan, { loanBalance: null }).errors.map(e => e.field)).toContain('loanBalance');
    });
});
