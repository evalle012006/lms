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
