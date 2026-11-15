import { findHardRuleViolations, CODES } from '@/lib/collection-rules';

const row = (o) => ({ status: 'active', loanBalance: 1000, activeLoan: 100, paymentCollection: 0, csfCollection: 0, transferStr: '-', ...o });

describe('Rule 2: leader CSF on drafts', () => {
    const codes = (rows) => findHardRuleViolations(rows, { csfEnabled: true }).map(v => v.code);

    test('leader at CSF 0 is flagged when another client in the group has a payment, even if the leader row is still empty', () => {
        expect(codes([row({ slotNo: 1, paymentCollection: 100 }), row({ slotNo: 2, groupLeader: true })]))
            .toContain(CODES.LEADER_CSF_REQUIRED);
    });
    test('leader with a CSF collection passes', () => {
        expect(codes([row({ slotNo: 1, paymentCollection: 100 }), row({ slotNo: 2, groupLeader: true, csfCollection: 20 })]))
            .not.toContain(CODES.LEADER_CSF_REQUIRED);
    });
    test('leader with an Excused or Delinquent remark is exempt', () => {
        expect(codes([row({ slotNo: 1, paymentCollection: 100 }), row({ slotNo: 2, groupLeader: true, remarks: { value: 'excused-hospital' } })]))
            .not.toContain(CODES.LEADER_CSF_REQUIRED);
    });
    test('nothing is flagged when nobody in the group has paid yet', () => {
        expect(codes([row({ slotNo: 1 }), row({ slotNo: 2, groupLeader: true })])).toEqual([]);
    });
    test('CSF-off groups are not checked', () => {
        expect(findHardRuleViolations([row({ paymentCollection: 100 }), row({ groupLeader: true })], { csfEnabled: false })
            .map(v => v.code)).not.toContain(CODES.LEADER_CSF_REQUIRED);
    });
});

describe('Rule 6: double / advance payment remark (pages only)', () => {
    const run = (rows, opts = {}) => findHardRuleViolations(rows, { csfEnabled: false, checkOverpaymentRemark: true, ...opts })
        .filter(v => v.code === CODES.OVERPAYMENT_REMARK_REQUIRED);

    test('double payment without a remark is flagged on Save Draft, with the same wording as Submit', () => {
        const v = run([row({ fullName: 'SALVADOR, ELLEN', paymentCollection: 200 })]);
        expect(v).toHaveLength(1);
        expect(v[0].message).toBe('SALVADOR, ELLEN: Error occured. Actual collection is a double payment please set remarks as Double Payment or Advance Payment.');
    });
    test('double payment passes with Double Payment or Advance Payment', () => {
        expect(run([row({ paymentCollection: 200, remarks: { value: 'double payment' } })])).toHaveLength(0);
        expect(run([row({ paymentCollection: 200, remarks: { value: 'advance payment' } })])).toHaveLength(0);
    });
    test('more than double needs Advance Payment specifically', () => {
        expect(run([row({ paymentCollection: 300, remarks: { value: 'double payment' } })])).toHaveLength(1);
        expect(run([row({ paymentCollection: 300, remarks: { value: 'advance payment' } })])).toHaveLength(0);
    });
    test('a single target payment, a payoff and mispay remarks are not flagged', () => {
        expect(run([row({ paymentCollection: 100 })])).toHaveLength(0);
        expect(run([row({ paymentCollection: 1000, loanBalance: 0 })])).toHaveLength(0);
        expect(run([row({ paymentCollection: 200, remarks: { value: 'past due collection' } })])).toHaveLength(0);
    });
    test('off by default so the server (saveV2) is unaffected', () => {
        expect(findHardRuleViolations([row({ paymentCollection: 200 })], { csfEnabled: false })
            .map(v => v.code)).not.toContain(CODES.OVERPAYMENT_REMARK_REQUIRED);
    });
});
