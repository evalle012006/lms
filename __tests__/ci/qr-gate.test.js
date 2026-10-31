const mockQuery = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({
    GraphProvider: jest.fn(() => ({ query: (...a) => mockQuery(...a) })),
}));
import { resolveGroupFromQr } from '@/lib/laf/qr-gate';

const future = () => new Date(Date.now() + 86400000).toISOString();
const past   = () => new Date(Date.now() - 86400000).toISOString();
const found  = (g) => ({ data: { groups: g ? [g] : [] } });

beforeEach(() => mockQuery.mockReset());

test('valid, unexpired token returns the group', async () => {
    mockQuery.mockResolvedValue(found({ _id: 'g1', qrExpiresAt: future() }));
    expect((await resolveGroupFromQr('tok', 'g1'))._id).toBe('g1');
});

test('expired token -> null', async () => {
    mockQuery.mockResolvedValue(found({ _id: 'g1', qrExpiresAt: past() }));
    expect(await resolveGroupFromQr('tok', 'g1')).toBeNull();
});

test('unknown token -> null', async () => {
    mockQuery.mockResolvedValue(found(null));
    expect(await resolveGroupFromQr('tok', 'g1')).toBeNull();
});

test('token that belongs to a different group -> null', async () => {
    mockQuery.mockResolvedValue(found({ _id: 'g2', qrExpiresAt: future() }));
    expect(await resolveGroupFromQr('tok', 'g1')).toBeNull();
});

test('token alone is enough when no groupId is given', async () => {
    mockQuery.mockResolvedValue(found({ _id: 'g2', qrExpiresAt: future() }));
    expect((await resolveGroupFromQr('tok'))._id).toBe('g2');
});

test.each([undefined, null, '', '   ', 123])('bad token %p -> null and no query', async (t) => {
    expect(await resolveGroupFromQr(t, 'g1')).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
});