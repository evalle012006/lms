const mockQuery = jest.fn();
const mockMutation = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { query(...a) { return mockQuery(...a); } mutation(...a) { return mockMutation(...a); } } }));
jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (name) => (alias) => ({ name, alias }),
    queryQl: (t, d) => ({ kind: 'query', ...d }),
    insertQl: (t, d) => ({ kind: 'insert', table: t.name, ...d }),
    updateQl: (t, d) => ({ kind: 'update', table: t.name, ...d }),
}));
jest.mock('@/lib/utils', () => { let n = 0; return { generateUUID: () => `id-${++n}` }; });
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/duplicate-faces', () => ({ findFaceMatches: () => [] }));
jest.mock('@/lib/duplicate-clients', () => ({ detectDuplicates: () => ({ clusters: [], stats: {} }), detectMultiActiveLoans: () => [], clusterKey: () => '', normalizeText: x => x, normalizePhone: x => x }));

const { startDuplicateScan } = require('@/lib/duplicate-clients-job');

beforeEach(() => {
    mockQuery.mockReset(); mockMutation.mockReset();
    mockQuery.mockResolvedValue({ data: { runs: [] } });
    mockMutation.mockResolvedValue({});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('a second trigger that loses the cron_runs lock does not start a scan', async () => {
    mockMutation.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('duplicate key value violates unique constraint "cron_runs_one_running"'));
    expect(await startDuplicateScan({ trigger: 'cron' })).toEqual({ started: false, reason: 'already_running' });
    expect(mockMutation.mock.calls.some(c => c[0].table === 'duplicate_scan_runs')).toBe(false);
});

test('winning the lock creates the scan run row', async () => {
    const out = await startDuplicateScan({ trigger: 'manual', triggeredBy: 'u1' });
    expect(out.started).toBe(true);
    expect(mockMutation.mock.calls.some(c => c[0].kind === 'insert' && c[0].table === 'duplicate_scan_runs')).toBe(true);
});
