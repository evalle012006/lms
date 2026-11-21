jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: jest.fn() }));
jest.mock('@/services/api-handler', () => ({ apiHandler: h => h }));
jest.mock('@/lib/graph.functions', () => ({ findUserById: jest.fn() }));
import { tallyNewerRecords } from '@/pages/api/v2/clients/duplicates/metrics';

const m = (id, dateAdded, lo, branch, isClosed = false) => ({ _id: id, dateAdded, effLoId: lo, loName: lo, branchId: branch, branchName: branch, isClosed });

test('credits the newer live record, ignores closed ones, ranks by both-active', () => {
    const { byLo, byBranch } = tallyNewerRecords([
        { severity: 'both_active', confidence: 'exact', members: [m('a', '2026-01-01', 'LO1', 'B1'), m('b', '2026-03-01', 'LO2', 'B2')] },
        { severity: 'one_active', confidence: 'possible', members: [m('c', '2026-01-01', 'LO1', 'B1'), m('d', '2026-02-01', 'LO1', 'B1')] },
        { severity: 'one_active', confidence: 'high', members: [m('e', '2026-01-01', 'LO3', 'B3'), m('f', '2026-09-01', 'LO9', 'B9', true)] }, // only 1 live -> skipped
    ]);
    expect(byLo[0]).toMatchObject({ loId: 'LO2', groups: 1, bothActive: 1, exactOrHigh: 1 });
    expect(byLo.find(r => r.loId === 'LO1')).toMatchObject({ groups: 1, bothActive: 0 });
    expect(byLo.some(r => r.loId === 'LO9' || r.loId === 'LO3')).toBe(false);
    expect(byBranch[0].branchId).toBe('B2');
});
