import { applyLoanAssignmentToClient as apply } from '@/lib/client-assignment';

const loan = { groupId: 'G2', loId: 'L2', groupName: 'SWALLOW', branchId: 'B1' };

describe('applyLoanAssignmentToClient', () => {
    test('balik client (pending with old ids) gets group/LO and old ids cleared', () => {
        const c = apply({ status: 'pending', groupId: null, loId: null, oldGroupId: 'G1', oldLoId: 'L1' }, loan);
        expect(c).toMatchObject({ groupId: 'G2', loId: 'L2', groupName: 'SWALLOW', branchId: 'B1', oldGroupId: null, oldLoId: null });
    });

    test('offset client is treated as returning', () => {
        const c = apply({ status: 'offset', groupId: null, loId: null, oldGroupId: 'G1', oldLoId: 'L1' }, loan);
        expect(c).toMatchObject({ groupId: 'G2', loId: 'L2', oldGroupId: null, oldLoId: null });
    });

    test('active client with null group is assigned, old ids untouched', () => {
        const c = apply({ status: 'active', groupId: null, loId: null, oldGroupId: 'G1', oldLoId: 'L1' }, loan);
        expect(c).toMatchObject({ groupId: 'G2', loId: 'L2', oldGroupId: 'G1', oldLoId: 'L1' });
    });

    test('client already in a group is left alone', () => {
        const c = apply({ status: 'active', groupId: 'G1', loId: 'L1' }, loan);
        expect(c).toMatchObject({ groupId: 'G1', loId: 'L1' });
    });

    test('explicit groupName wins over loan.groupName', () => {
        const c = apply({ status: 'active', groupId: null, loId: null }, loan, 'FROM_GROUP');
        expect(c.groupName).toBe('FROM_GROUP');
    });

    test('loan without group/LO changes nothing', () => {
        const c = apply({ status: 'active', groupId: null, loId: null }, { groupId: undefined });
        expect(c.groupId).toBeNull();
        expect(c.loId).toBeNull();
    });
});
