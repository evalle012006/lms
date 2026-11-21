const mockQuery = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { query(...a) { return mockQuery(...a); } } }));

import { findFaceDuplicates } from '@/lib/face-duplicate';

const tpl = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.2);
const near = tpl.map((v, i) => v + (i === 0 ? 0.3 : 0));

beforeEach(() => mockQuery.mockReset());

test('returns matches with distance and loan flags', async () => {
    mockQuery
        .mockResolvedValueOnce({ data: { matches: [{ _id: 'c1', firstName: 'A', lastName: 'B', branchName: 'X', status: 'active', faceTemplate: JSON.stringify(near) }] } })
        .mockResolvedValueOnce({ data: { loans: [{ clientId: 'c1', status: 'active' }] } });
    const r = await findFaceDuplicates(tpl, 'me');
    expect(r.available).toBe(true);
    expect(r.matches[0]).toMatchObject({ clientId: 'c1', name: 'B, A', hasActiveLoan: true, hasPendingLoan: false, distance: 0.3 });
});

test('no matches -> available, empty, and no loan lookup', async () => {
    mockQuery.mockResolvedValueOnce({ data: { matches: [] } });
    expect(await findFaceDuplicates(tpl, 'me')).toEqual({ available: true, matches: [] });
    expect(mockQuery).toHaveBeenCalledTimes(1);
});

test('fails soft when the DB function is missing (migration not run)', async () => {
    mockQuery.mockRejectedValueOnce(new Error("field 'fn_find_duplicate_faces' not found in type: 'query_root'"));
    expect(await findFaceDuplicates(tpl, 'me')).toEqual({ available: false, matches: [] });
});
