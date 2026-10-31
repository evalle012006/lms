const mockQuery = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({
    GraphProvider: jest.fn(() => ({ query: (...a) => mockQuery(...a) })),
}));
jest.mock('@/lib/ci-scope', () => ({
    resolveBranchWhere: jest.fn(),
    branchWhereAllows: (where, id) => !!where && (!where.branchId || where.branchId._in.includes(id)),
}));
import { resolveBranchWhere } from '@/lib/ci-scope';
import { resolveClientInScope } from '@/lib/client-scope';

const clientRow = (branchId) => ({ data: { clients: [{ _id: 'c1', branchId }] } });
const loanRows  = (...branchIds) => ({
    data: { loans: branchIds.map((b, i) => ({ _id: `l${i}`, branchId: b, status: 'pending' })) },
});

beforeEach(() => { mockQuery.mockReset(); resolveBranchWhere.mockReset(); });

test('in scope through the client own branch', async () => {
    resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['b1'] } });
    mockQuery.mockResolvedValueOnce(clientRow('b1'));
    expect(await resolveClientInScope({ _id: 'u' }, 'c1')).toEqual({ _id: 'c1', branchId: 'b1' });
});

test('balik: client branch out of scope, live loan in scope -> effective branch is the loan branch', async () => {
    resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['new'] } });
    mockQuery.mockResolvedValueOnce(clientRow('old')).mockResolvedValueOnce(loanRows('new'));
    expect(await resolveClientInScope({ _id: 'u' }, 'c1')).toEqual({ _id: 'c1', branchId: 'new' });
});

test('out of scope everywhere -> null', async () => {
    resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['mine'] } });
    mockQuery.mockResolvedValueOnce(clientRow('old')).mockResolvedValueOnce(loanRows('elsewhere'));
    expect(await resolveClientInScope({ _id: 'u' }, 'c1')).toBeNull();
});

test('unknown client -> null', async () => {
    mockQuery.mockResolvedValueOnce({ data: { clients: [] } });
    expect(await resolveClientInScope({ _id: 'u' }, 'nope')).toBeNull();
});

test('bad input -> null without querying', async () => {
    expect(await resolveClientInScope(null, 'c1')).toBeNull();
    expect(await resolveClientInScope({ _id: 'u' }, '')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
});