const mockMutation = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { mutation(...a) { return mockMutation(...a); } } }));
jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (name) => (alias) => ({ name, alias }),
    insertQl: (type, d) => ({ kind: 'insert', ...d }),
    updateQl: (type, d) => ({ kind: 'update', ...d }),
}));
jest.mock('@/lib/utils', () => ({ generateUUID: () => 'run-1' }));

const { beginCronRun, handleCron } = require('@/lib/cron-guard');

const mkRes = () => ({ code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } });
const req = { headers: { 'x-webhook-api-key': 'k' } };

beforeEach(() => { mockMutation.mockReset(); mockMutation.mockResolvedValue({}); jest.spyOn(console, 'warn').mockImplementation(() => {}); jest.spyOn(console, 'error').mockImplementation(() => {}); });

test('takes the lock: expires stale rows, then inserts a running row', async () => {
    const out = await beginCronRun('job-a');
    expect(out).toEqual({ started: true, runId: 'run-1' });
    expect(mockMutation.mock.calls[0][0].kind).toBe('update');
    expect(mockMutation.mock.calls[1][0].objects[0]).toMatchObject({ job_name: 'job-a', status: 'running' });
});

test('unique violation means another run holds the lock', async () => {
    mockMutation.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('Uniqueness violation. duplicate key value violates unique constraint "cron_runs_one_running"'));
    expect(await beginCronRun('job-a')).toEqual({ started: false, reason: 'already_running' });
});

test('guard table unavailable -> fail open (job still runs)', async () => {
    mockMutation.mockRejectedValue(new Error('field "cron_runs" not found in type: mutation_root'));
    expect(await beginCronRun('job-a')).toEqual({ started: true, runId: null });
});

test('already running -> 200 skipped and work never runs', async () => {
    mockMutation.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));
    const work = jest.fn(); const res = mkRes();
    await handleCron(req, res, 'job-a', work);
    expect(work).not.toHaveBeenCalled();
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ success: true, skipped: true });
});

test('awaited job: records success with stats', async () => {
    const res = mkRes();
    await handleCron(req, res, 'job-a', async () => ({ n: 3 }), { message: 'ok' });
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'ok', stats: { n: 3 } });
    const fin = mockMutation.mock.calls.at(-1)[0];
    expect(fin.set).toMatchObject({ status: 'success', stats: { n: 3 } });
});

test('awaited job that throws -> 500 and run marked failed', async () => {
    const res = mkRes();
    await handleCron(req, res, 'job-a', async () => { throw new Error('boom'); });
    expect(res.code).toBe(500);
    expect(mockMutation.mock.calls.at(-1)[0].set).toMatchObject({ status: 'failed', error: 'boom' });
});

test('background job: answers immediately, failure is recorded (no unhandled rejection)', async () => {
    const res = mkRes();
    let release; const gate = new Promise(r => { release = r; });
    await handleCron(req, res, 'job-a', async () => { await gate; throw new Error('late boom'); }, { background: true });
    expect(res.code).toBe(200);
    expect(res.body.runId).toBe('run-1');
    release(); await new Promise(r => setTimeout(r, 20));
    expect(mockMutation.mock.calls.at(-1)[0].set).toMatchObject({ status: 'failed', error: 'late boom' });
});
