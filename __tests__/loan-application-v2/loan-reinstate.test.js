import { planReinstate } from '@/lib/loan-reinstate';

const NOW = '2026-11-20T15:00:00.000Z';
const rejected = { _id: 'L-rej', status: 'reject', clientId: 'C1', groupId: 'G1', slotNo: 1, loanCycle: 0, rejectReason: 'CANCEL' };
const group = { _id: 'G1', name: 'MOCKINGBIRD', availableSlots: [1, 5], noOfClients: 10, capacity: 30, status: 'available' };
const prev = (over = {}) => ({ _id: 'L-prev', status: 'completed', loanCycle: 2, groupName: 'MOCKINGBIRD', insertedDateTime: '2026-01-01', ...over });
const plan = (over = {}) => planReinstate({ loan: rejected, group, otherLoans: [prev()], now: NOW, ...over });

describe('planReinstate', () => {
    test('happy path: pending, next cycle, slot retaken, reason cleared', () => {
        const r = plan();
        expect(r.ok).toBe(true);
        expect(r.loanCycle).toBe(3);
        expect(r.loanPatch).toMatchObject({
            status: 'pending', loanCycle: 3, rejectReason: null, ldfApproved: false,
            ldfApprovedDate: null, closedDate: null, fullPaymentDate: null, modifiedDateTime: NOW,
        });
        expect(r.groupPatch).toEqual({ availableSlots: [5], noOfClients: 11, status: 'available' });
    });

    test('never targets active', () => {
        expect(plan().loanPatch.status).not.toBe('active');
    });

    test('first loan for the client starts at cycle 1', () => {
        expect(plan({ otherLoans: [] }).loanCycle).toBe(1);
    });

    test('offset previous loan resets to cycle 1', () => {
        expect(plan({ otherLoans: [prev({ status: 'offset', loanCycle: 0 })] }).loanCycle).toBe(1);
    });

    test('ignores earlier rejected / pending loans when counting the cycle', () => {
        const others = [prev(), { _id: 'x', status: 'reject', loanCycle: 0 }];
        expect(plan({ otherLoans: others }).loanCycle).toBe(3);
    });

    test('denies a loan that is not rejected', () => {
        expect(plan({ loan: { ...rejected, status: 'pending' } }).ok).toBe(false);
        expect(plan({ loan: { ...rejected, status: 'active' } }).ok).toBe(false);
    });

    test('denies when the client already has a pending or active loan', () => {
        ['pending', 'active'].forEach((status) => {
            const r = plan({ otherLoans: [prev(), { _id: 'n', status, loanCycle: 3, groupName: 'KIWI' }] });
            expect(r.ok).toBe(false);
            expect(r.message).toMatch(/already has a/);
        });
    });

    test('denies when the slot was taken again', () => {
        const r = plan({ group: { ...group, availableSlots: [5, 6] } });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/no longer available/);
    });

    test('denies when the group is gone', () => {
        expect(plan({ group: undefined }).ok).toBe(false);
    });

    test('denies when the previous loan is active/completed with cycle 0 (the original data bug)', () => {
        const r = plan({ otherLoans: [prev({ status: 'completed', loanCycle: 0 })] });
        expect(r.ok).toBe(false);
        expect(r.message).toMatch(/invalid loan cycle/);
    });

    test('marks the group full when the last slot is taken', () => {
        const r = plan({ group: { ...group, availableSlots: [1], noOfClients: 29, capacity: 30 } });
        expect(r.groupPatch).toEqual({ availableSlots: [], noOfClients: 30, status: 'full' });
    });

    test('does not mutate its inputs', () => {
        const g = JSON.parse(JSON.stringify(group));
        const l = JSON.parse(JSON.stringify(rejected));
        planReinstate({ loan: l, group: g, otherLoans: [prev()], now: NOW });
        expect(g).toEqual(group);
        expect(l).toEqual(rejected);
    });
});
