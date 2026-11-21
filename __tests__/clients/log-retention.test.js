const mockQuery = jest.fn();
const mockMutation = jest.fn();
const mockArchive = jest.fn();
let mockArchiveOn = true;
jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { query(...a) { return mockQuery(...a); } mutation(...a) { return mockMutation(...a); } } }));
jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (name) => (alias) => ({ name, alias: alias ?? name }),
    queryQl: (t, d) => ({ kind: 'query', table: t.name, alias: t.alias, ...d }),
    deleteQl: (t, where) => ({ kind: 'delete', table: t.name, where }),
}));
jest.mock('@/lib/graph.fields', () => ({ FACE_VERIFY_ATTEMPT_FIELDS: '_id loan_id captured_at' }));
jest.mock('@/lib/log-archive', () => ({ archiveEnabled: () => mockArchiveOn, archiveRows: (...a) => mockArchive(...a) }));

const { runLogRetention, cutoffFor } = require('@/lib/log-retention');

// Fake DB: rows per table; batch query returns them once, delete empties them.
const db = {};
beforeEach(() => {
    mockQuery.mockReset(); mockMutation.mockReset(); mockArchive.mockReset(); mockArchiveOn = true;
    mockArchive.mockResolvedValue('key');
    Object.keys(db).forEach(k => delete db[k]);
    db.audit_logs = [{ _id: 'a1', timestamp: '2025-01-01T00:00:00Z', action: 'LOAN_CREATED' }];
    db.user_activity_logs = [{ id: 'u1', created_at: '2026-01-01T00:00:00Z' }];
    db.face_verify_attempts = [{ _id: 'f1', loan_id: 'L-old', captured_at: '2026-09-01T00:00:00Z' }, { _id: 'f2', loan_id: 'L-wait', captured_at: '2026-09-01T00:00:00Z' }];
    db.waiting = ['L-wait'];
    mockQuery.mockImplementation(async (q) => {
        if (q.table === 'loans') return { data: { loans: (q.where._id._in || []).filter(id => db.waiting.includes(id)).map(_id => ({ _id })) } };
        const skip = q.where._id?._nin || q.where.id?._nin || [];
        const idCol = q.table === 'user_activity_logs' ? 'id' : '_id';
        const dateCol = Object.keys(q.where).find(k => q.where[k]?._lt);
        const old = r => !dateCol || new Date(r[dateCol]) < new Date(q.where[dateCol]._lt);
        const a = q.where.action;
        const ok = r => !a || (a._in ? a._in.includes(r.action) : a._nin ? !a._nin.includes(r.action) : true);
        return { data: { batch: (db[q.table] || []).filter(r => !skip.includes(r[idCol]) && ok(r) && old(r)) } };
    });
    mockMutation.mockImplementation(async (m) => {
        if (m.kind === 'delete') {
            const idCol = m.table === 'user_activity_logs' ? 'id' : '_id';
            const ids = m.where[idCol]?._in;
            if (ids) db[m.table] = (db[m.table] || []).filter(r => !ids.includes(r[idCol]));
        }
        return {};
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
});

test('configured windows', () => {
    const { RETENTION } = require('@/lib/log-retention');
    const days = Object.fromEntries(RETENTION.map(c => [c.name ?? c.table, c.days]));
    expect(days).toEqual({ lms_logs: 7, audit_logs_noise: 30, audit_logs: 365, user_activity_logs: 90, face_verify_attempts: 30 });
    const t = '2026-11-22T00:00:00Z';
    expect(cutoffFor(30, t) < cutoffFor(7, t)).toBe(true);
    expect(cutoffFor(365, t) < cutoffFor(90, t)).toBe(true);
});

test('archives before deleting, and keeps rows of loans still waiting for approval', async () => {
    const stats = await runLogRetention({ scheduledTime: '2026-11-22T00:00:00Z' });
    expect(mockArchive).toHaveBeenCalled();
    expect(db.audit_logs).toEqual([]);
    expect(db.user_activity_logs).toEqual([]);
    expect(db.face_verify_attempts.map(r => r._id)).toEqual(['f2']); // proof for a pending loan survives
    expect(stats.face_verify_attempts).toMatchObject({ deleted: 1, protected: 1 });
    expect(stats.archive).toBe('spaces');
});

test('noise actions expire at 30 days, business events are kept for a year', async () => {
    db.audit_logs = [
        { _id: 'n1', timestamp: '2026-09-01T00:00:00Z', action: 'GROUP_QR_ACCESSED_EXPIRED' },
        { _id: 'b1', timestamp: '2026-09-01T00:00:00Z', action: 'LOAN_CREATED' },
        { _id: 'b2', timestamp: '2025-09-01T00:00:00Z', action: 'LOAN_CREATED' },
    ];
    await runLogRetention({ scheduledTime: '2026-11-22T00:00:00Z' });
    expect(db.audit_logs.map(r => r._id)).toEqual(['b1']);
});

test('archive failure → nothing deleted for that table, other tables still run', async () => {
    mockArchive.mockRejectedValueOnce(new Error('spaces down'));
    const stats = await runLogRetention({ scheduledTime: '2026-11-22T00:00:00Z' });
    expect(stats.audit_logs.error).toMatch(/spaces down/);
    expect(db.audit_logs).toHaveLength(1);
    expect(db.user_activity_logs).toEqual([]);
});

test('face override audit rows for a waiting loan are protected', async () => {
    db.audit_logs = [
        { _id: 'o1', timestamp: '2025-01-01T00:00:00Z', action: 'CLIENT_FACE_VERIFICATION_OVERRIDDEN', metadata: { loanId: 'L-wait' } },
        { _id: 'o2', timestamp: '2025-01-01T00:00:00Z', action: 'CLIENT_FACE_VERIFICATION_OVERRIDDEN', metadata: { loanId: 'L-old' } },
    ];
    await runLogRetention({ scheduledTime: '2026-11-22T00:00:00Z' });
    expect(db.audit_logs.map(r => r._id)).toEqual(['o1']);
});
