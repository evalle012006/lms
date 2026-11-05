// __tests__/face/face-api.test.js
// Endpoint behaviour with the GraphQL layer mocked. Queries are answered by ALIAS;
// every graph.mutation(...ops) call is one Hasura transaction, so we assert the exact op list.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => {
    const shared = { query: jest.fn(), mutation: jest.fn() };
    return { GraphProvider: function GraphProvider() { return shared; }, __shared: shared };
});
jest.mock('@/lib/graph/graph.util', () => {
    const tag = (op) => (type, args) => ({ op, ...type, args });
    return {
        createGraphType: (table) => (alias) => ({ table, alias: alias || table }),
        queryQl: tag('query'), insertQl: tag('insert'), updateQl: tag('update'), deleteQl: tag('delete'),
        aggregateQl: (type, fields, where) => ({ op: 'aggregate', ...type, args: { where } }),
    };
});
jest.mock('@/lib/graph.functions', () => ({
    findUserById: jest.fn(), findBranches: jest.fn(), findGroups: jest.fn(),
}));
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => { let n = 0; return { generateUUID: () => `uuid-${++n}` }; });
jest.mock('@/lib/notification-service', () => ({
    notifyGroupLeaderUpdated: jest.fn(), notifyClientDelinquent: jest.fn(),
    isNotificationEnabled: jest.fn().mockResolvedValue(false),
}));
jest.mock('@/lib/date-utils', () => ({ getCurrentDate: jest.fn() }));
jest.mock('formidable', () => ({
    IncomingForm: function IncomingForm() { return { parse: (req, cb) => cb(null, global.__formFields, {}) }; },
}));

const { __shared: graph } = require('@/lib/graph/graph.provider');
const { findUserById } = require('@/lib/graph.functions');
const { resolveClientInScope } = require('@/lib/client-scope');
const { resolveBranchWhere } = require('@/lib/ci-scope');
const { logAudit } = require('@/lib/audit');

const enrollFace    = require('@/pages/api/v2/clients/enroll-face').default;
const recaptureFace = require('@/pages/api/v2/clients/recapture-face').default;
const overrideFace  = require('@/pages/api/v2/face-verify-attempts/override').default;
const forReview     = require('@/pages/api/v2/face-verify-attempts/for-review').default;
const activity      = require('@/pages/api/v2/clients/activity').default;
const clientsApi    = require('@/pages/api/v2/clients/index').default;

// ── helpers ──────────────────────────────────────────────────────────────
const ZERO = Array(128).fill(0);
const ONE  = Array(128).fill(1);
const user = (shortCode, extra = {}) => ({
    _id: `u-${shortCode}`, firstName: 'Test', lastName: shortCode, role: { shortCode }, ...extra,
});
const makeRes = () => {
    const res = { body: undefined };
    res.status = jest.fn(() => res);
    res.setHeader = jest.fn(() => res);
    res.json = jest.fn((b) => { res.body = b; return res; });
    res.end = jest.fn((s) => { res.body = typeof s === 'string' ? JSON.parse(s) : s; return res; });
    return res;
};
const run = async (handler, req) => { const res = makeRes(); await handler(req, res); return res.body; };
const answer = (fx) => graph.query.mockImplementation(async (...qs) => ({
    data: Object.fromEntries(qs.map(q => [
        q.alias,
        q.alias in fx ? fx[q.alias] : (q.op === 'aggregate' ? { aggregate: { count: 0 } } : []),
    ])),
}));
const queried = () => graph.query.mock.calls.flat();
const queryFor = (alias) => queried().find(q => q.alias === alias);
const ops = () => graph.mutation.mock.calls[0];

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset();
    graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: {} });
    resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
    findUserById.mockReset();
    findUserById.mockResolvedValue(user('branch_manager'));
    resolveBranchWhere.mockResolvedValue({});
    delete process.env.ENFORCE_CLIENT_SCOPE;
});

// ── clients/enroll-face ──────────────────────────────────────────────────
describe('clients/enroll-face', () => {
    const req = (over = {}) => ({
        auth: { sub: 'sub' },
        body: { clientId: 'c1', faceTemplate: ONE, photoKey: 'p.jpg', loanId: 'l1', ...over },
    });
    const fx = (over = {}) => ({
        clients: [{ _id: 'c1', branchId: 'b1', firstName: 'Ana', lastName: 'Cruz', faceTemplate: null }],
        enrollments: [],
        ...over,
    });

    it('refuses callers without a decision role', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        answer(fx());
        expect((await run(enrollFace.post, req())).success).toBe(false);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('treats an out-of-scope client as not found', async () => {
        resolveClientInScope.mockResolvedValue(null);
        const body = await run(enrollFace.post, req());
        expect(body).toMatchObject({ success: false, message: 'Client not found.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('rejects malformed templates', async () => {
        answer(fx());
        const body = await run(enrollFace.post, req({ faceTemplate: [1, 2, 3] }));
        expect(body).toMatchObject({ success: false, message: 'Invalid face template.' });
    });

    it('never replaces an existing template', async () => {
        answer(fx({ clients: [{ _id: 'c1', branchId: 'b1', faceTemplate: JSON.stringify(ZERO) }] }));
        const body = await run(enrollFace.post, req());
        expect(body.success).toBe(false);
        expect(body.message).toMatch(/already has a face template/i);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('refuses when a version row already exists even if the column is empty', async () => {
        answer(fx({ enrollments: [{ _id: 'e1', version: 1 }] }));
        expect((await run(enrollFace.post, req())).success).toBe(false);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('first enrollment: v1 row + client update + attempt relink in ONE mutation', async () => {
        answer(fx());
        const body = await run(enrollFace.post, req());
        expect(body.success).toBe(true);
        expect(graph.mutation).toHaveBeenCalledTimes(1);

        const [insertRow, updateClient, relink] = ops();
        const row = insertRow.args.objects[0];
        expect(insertRow).toMatchObject({ op: 'insert', table: 'client_face_enrollments' });
        expect(row).toMatchObject({ client_id: 'c1', version: 1, status: 'active', source: 'disbursement_first', photo_key: 'p.jpg', loan_id: 'l1' });
        expect(updateClient.args.set.faceEnrollPhotoKey).toBe('p.jpg');
        expect(relink.args.set).toEqual({ enrollment_id: row._id });

        const audit = logAudit.mock.calls[0][1];
        expect(audit).toMatchObject({ action: 'CLIENT_FACE_ENROLLED_AT_DISBURSEMENT', category: 'BIOMETRIC', clientId: 'c1' });
    });
});

// ── clients/recapture-face ───────────────────────────────────────────────
describe('clients/recapture-face', () => {
    const body = (over = {}) => ({
        clientId: 'c1', loanId: 'l1', ciReferenceCode: 'CI1', faceTemplate: ONE,
        livenessScore: 0.95, photoKey: 'new.jpg', reason: 'Old photo was blurry and dark', ...over,
    });
    const req = (over) => ({ auth: { sub: 'sub' }, body: body(over) });
    const fx = (over = {}) => ({
        clients: [{ _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1',
            faceTemplate: JSON.stringify(ZERO), faceEnrolledAt: 't0', faceEnrollPhotoKey: 'old.jpg', livenessScore: 0.9 }],
        loans: [{ _id: 'l1', clientId: 'c1', status: 'pending', ldfApproved: false, ciReferenceCode: 'CI1', branchId: 'b1' }],
        faceRecaptureSetting: [{ allowFaceRecapture: true }],
        activeEnrollments: [],
        mismatchAgg: { aggregate: { count: 2 } },
        recaptureAgg: { aggregate: { count: 0 } },
        triggerAttempts: [{ _id: 'a9' }],
        ...over,
    });

    it('refuses a loan officer', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        answer(fx());
        const res = await run(recaptureFace.post, req());
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/Only an admin/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('treats out-of-scope as not found', async () => {
        resolveClientInScope.mockResolvedValue(null);
        answer(fx());
        expect(await run(recaptureFace.post, req())).toMatchObject({ success: false, message: 'Client not found.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it.each([
        [{ loanId: undefined }, /clientId and loanId/],
        [{ faceTemplate: [1, 2] }, /valid face capture/],
        [{ photoKey: '' }, /photo did not upload/],
        [{ reason: 'too short' }, /reason of at least/],
    ])('validates input %#', async (over, pattern) => {
        answer(fx());
        const res = await run(recaptureFace.post, req(over));
        expect(res.success).toBe(false);
        expect(res.message).toMatch(pattern);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('only while the loan is pending', async () => {
        answer(fx({ loans: [{ _id: 'l1', clientId: 'c1', status: 'active', ldfApproved: false }] }));
        expect((await run(recaptureFace.post, req())).message).toMatch(/only allowed while the loan is pending/);
        expect((await run(recaptureFace.post, req())).message).toMatch(/only allowed while the loan is pending/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it("refuses a loan that belongs to another client", async () => {
        answer(fx({ loans: [{ _id: 'l1', clientId: 'someone-else', status: 'pending' }] }));
        expect((await run(recaptureFace.post, req())).message).toMatch(/does not belong/);
    });

    it('refuses a client with no face on record', async () => {
        const c = fx().clients[0];
        answer(fx({ clients: [{ ...c, faceTemplate: null }] }));
        expect((await run(recaptureFace.post, req())).message).toMatch(/no face on record/);
    });

    it('unlocks only after two logged mismatches', async () => {
        answer(fx({ mismatchAgg: { aggregate: { count: 1 } } }));
        const res = await run(recaptureFace.post, req());
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/unlocks after 2/);
        expect(graph.mutation).not.toHaveBeenCalled();

        answer(fx({ mismatchAgg: { aggregate: { count: 2 } } }));
        expect((await run(recaptureFace.post, req())).success).toBe(true);
    });

    it('caps re-enrollments per loan', async () => {
        answer(fx({ recaptureAgg: { aggregate: { count: 2 } } }));
        expect((await run(recaptureFace.post, req())).message).toMatch(/limit for this loan/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('refuses to replace a reference the new capture already matches', async () => {
        answer(fx());
        const res = await run(recaptureFace.post, req({ faceTemplate: ZERO }));
        expect(res).toMatchObject({ success: false, code: 'ALREADY_MATCHES' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('counts mismatches against the CURRENT reference only', async () => {
        answer(fx());
        await run(recaptureFace.post, req());
        expect(queryFor('mismatchAgg').args.where._and).toContainEqual({ enrollment_id: { _is_null: true } });

        graph.query.mockReset();
        answer(fx({ activeEnrollments: [{ _id: 'e1', version: 2 }] }));
        await run(recaptureFace.post, req());
        expect(queryFor('mismatchAgg').args.where._and).toContainEqual({ enrollment_id: { _eq: 'e1' } });
    });

    it('first recapture: snapshot v1 + insert v2 + update client + relink attempts, in ONE mutation', async () => {
        answer(fx());
        const res = await run(recaptureFace.post, req());
        expect(res).toMatchObject({ success: true, version: 2 });
        expect(graph.mutation).toHaveBeenCalledTimes(1);

        const [snapshot, insertNew, updateClient, relink] = ops();
        const v1 = snapshot.args.objects[0];
        const v2 = insertNew.args.objects[0];
        expect(ops()).toHaveLength(4);
        expect(v1).toMatchObject({ version: 1, status: 'superseded', source: 'original', photo_key: 'old.jpg' });
        expect(v2).toMatchObject({
            version: 2, status: 'active', source: 'disbursement_recapture',
            photo_key: 'new.jpg', reason: 'Old photo was blurry and dark', trigger_attempt_id: 'a9',
        });
        expect(updateClient).toMatchObject({ op: 'update', table: 'client' });
        expect(updateClient.args.set.faceEnrollPhotoKey).toBe('new.jpg');
        expect(relink.args.set).toEqual({ enrollment_id: v1._id });
        expect(relink.args.where._and).toContainEqual({ enrollment_id: { _is_null: true } });
    });

    it('later recapture supersedes the active version instead of snapshotting', async () => {
        answer(fx({ activeEnrollments: [{ _id: 'e2', version: 2 }] }));
        const res = await run(recaptureFace.post, req());
        expect(res).toMatchObject({ success: true, version: 3 });

        const [supersede, insertNew, , relink] = ops();
        expect(supersede).toMatchObject({ op: 'update', table: 'client_face_enrollments' });
        expect(supersede.args.set.status).toBe('superseded');
        expect(insertNew.args.objects[0].version).toBe(3);
        expect(relink.args.set).toEqual({ enrollment_id: 'e2' });
    });

    it('audits with keys and versions — never a template', async () => {
        answer(fx());
        await run(recaptureFace.post, req());
        const audit = logAudit.mock.calls[0][1];
        expect(audit).toMatchObject({ action: 'CLIENT_FACE_RECAPTURED', category: 'BIOMETRIC', severity: 'WARNING', clientId: 'c1' });
        expect(audit.metadata).toMatchObject({ duplicateCheck: 'skipped', mismatchCount: 2, version: 2, loanId: 'l1' });
        expect(JSON.stringify(audit)).not.toContain('1,1,1,1,1');
    });
});

// ── face-verify-attempts/override ────────────────────────────────────────
describe('face-verify-attempts/override', () => {
    const req = (over = {}) => ({
        auth: { sub: 'sub' },
        body: { clientId: 'c1', loanId: 'l1', ciReferenceCode: 'CI1', reason: 'Camera broken at this branch', ...over },
    });
    const fx = (over = {}) => ({
        clients: [{ _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1', faceTemplate: JSON.stringify(ZERO) }],
        loans: [{ _id: 'l1', clientId: 'c1', status: 'pending', ldfApproved: false }],
        mismatchAgg: { aggregate: { count: 3 } },
        ...over,
    });

    it('is administrators only', async () => {
        findUserById.mockResolvedValue(user('branch_manager'));
        answer(fx());
        const res = await run(overrideFace.post, req());
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/administrator/);
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('requires a reason', async () => {
        findUserById.mockResolvedValue(user('admin'));
        answer(fx());
        expect((await run(overrideFace.post, req({ reason: 'meh' }))).message).toMatch(/reason of at least/);
    });

    it('only while the loan is pending', async () => {
        findUserById.mockResolvedValue(user('admin'));
        answer(fx({ loans: [{ _id: 'l1', clientId: 'c1', status: 'active' }] }));
        expect((await run(overrideFace.post, req())).message).toMatch(/only allowed while the loan is pending/);
    });

    it('records a CRITICAL audit entry for a mismatch override, and writes nothing else', async () => {
        findUserById.mockResolvedValue(user('admin'));
        answer(fx());
        const res = await run(overrideFace.post, req());
        expect(res).toMatchObject({ success: true, kind: 'mismatch_override' });
        expect(graph.mutation).not.toHaveBeenCalled();
        const audit = logAudit.mock.calls[0][1];
        expect(audit).toMatchObject({
            action: 'CLIENT_FACE_VERIFICATION_OVERRIDDEN', category: 'BIOMETRIC', severity: 'CRITICAL', clientId: 'c1',
        });
        expect(audit.metadata).toMatchObject({ kind: 'mismatch_override', mismatchCount: 3, reason: 'Camera broken at this branch', loanId: 'l1' });
    });

    it('labels an override for a client with no template', async () => {
        findUserById.mockResolvedValue(user('admin'));
        const c = fx().clients[0];
        answer(fx({ clients: [{ ...c, faceTemplate: null }] }));
        expect((await run(overrideFace.post, req())).kind).toBe('no_template_override');
    });

    it('treats root as an administrator', async () => {
        findUserById.mockResolvedValue(user('loan_officer', { root: true }));
        answer(fx());
        expect((await run(overrideFace.post, req())).success).toBe(true);
    });
});

// ── face-verify-attempts/for-review ──────────────────────────────────────
describe('face-verify-attempts/for-review', () => {
    const req = () => ({ auth: { sub: 'sub' }, query: { clientId: 'c1', loanId: 'l1' } });
    const attempt = (over = {}) => ({
        _id: 'a1', client_id: 'c1', loan_id: 'l1', matched: false, photo_key: 'cap.jpg',
        captured_at: 't', enrollment_id: null, ...over,
    });
    const client = { _id: 'c1', profile: 'prof.jpg', faceEnrollPhotoKey: 'current.jpg' };

    it('refuses callers without a decision role', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        answer({});
        expect(await run(forReview.get, req())).toMatchObject({ success: false, message: 'Not allowed.' });
    });

    it('treats out-of-scope as not found and never touches attempts', async () => {
        resolveClientInScope.mockResolvedValue(null);
        answer({});
        expect(await run(forReview.get, req())).toMatchObject({ success: false, message: 'Client not found.' });
        expect(graph.query).not.toHaveBeenCalled();
    });

    it('returns attempt:null when nothing is logged', async () => {
        answer({ attempts: [] });
        expect(await run(forReview.get, req())).toEqual({ success: true, attempt: null });
    });

    it("uses the client's current reference when the attempt predates any re-enrollment", async () => {
        answer({ attempts: [attempt()], clients: [client] });
        expect((await run(forReview.get, req())).attempt.clientEnrollmentPhotoKey).toBe('current.jpg');
    });

    it('shows the reference version the attempt was ACTUALLY checked against', async () => {
        answer({ attempts: [attempt({ enrollment_id: 'e1' })], clients: [client], enrollments: [{ _id: 'e1', photo_key: 'v1.jpg' }] });
        expect((await run(forReview.get, req())).attempt.clientEnrollmentPhotoKey).toBe('v1.jpg');
    });

    it('falls back to the profile photo when that version has no photo', async () => {
        answer({ attempts: [attempt({ enrollment_id: 'e1' })], clients: [client], enrollments: [{ _id: 'e1', photo_key: null }] });
        expect((await run(forReview.get, req())).attempt.clientEnrollmentPhotoKey).toBe('prof.jpg');
    });

    it('returns the re-enrollment with the approver name', async () => {
        findUserById.mockImplementation(async (id) => (id === 'u7' ? { firstName: 'Bea', lastName: 'Lim' } : user('branch_manager')));
        answer({
            attempts: [attempt()], clients: [client],
            recaptures: [{ version: 2, reason: 'blurry original', created_at: 't2', approved_by: 'u7' }],
        });
        expect((await run(forReview.get, req())).attempt.recapture).toEqual({
            version: 2, reason: 'blurry original', createdAt: 't2', approvedByName: 'Bea Lim',
        });
    });
});

// ── clients/activity ─────────────────────────────────────────────────────
describe('clients/activity', () => {
    const audit = (id, ts, extra = {}) => ({
        _id: id, timestamp: ts, userName: 'BM', userRole: 'BM', branchName: 'Br',
        action: 'CLIENT_UPDATED', category: 'CLIENT', severity: 'INFO', description: 'd',
        metadata: null, success: true, failReason: null,
        beforeData: { secret: 1 }, afterData: { secret: 2 }, ipAddress: '1.2.3.4', userAgent: 'UA', ...extra,
    });
    const attempt = (id, ts, matched) => ({
        _id: id, loan_id: 'l1', ci_reference_code: 'CI1', distance: 0.7, confidence: 12.4,
        matched, photo_key: 'k.jpg', captured_at: ts, inserted_by: 'u1',
    });
    const req = (query = {}) => ({ auth: { sub: 'sub' }, query: { clientId: 'c1', ...query } });

    it('refuses callers without a decision role', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        answer({});
        expect(await run(activity.get, req())).toMatchObject({ success: false, message: 'Not allowed.' });
    });

    it('treats out-of-scope as not found', async () => {
        resolveClientInScope.mockResolvedValue(null);
        answer({});
        expect(await run(activity.get, req())).toMatchObject({ success: false, message: 'Client not found.' });
    });

    it('merges both sources newest-first, paginates, and never leaks raw audit fields', async () => {
        answer({
            apps: [], loans: [],
            rows: [audit('A1', '2026-10-03T00:00:00Z'), audit('A2', '2026-10-01T00:00:00Z')],
            attempts: [attempt('F1', '2026-10-02T00:00:00Z', false)],
        });
        const body = await run(activity.get, req({ limit: '2' }));
        expect(body.success).toBe(true);
        expect(body.events.map(e => e.id)).toEqual(['A1', 'fva_F1']);
        expect(body.hasMore).toBe(true);
        expect(body.nextBefore).toBe('2026-10-02T00:00:00Z');

        const face = body.events[1];
        expect(face).toMatchObject({ action: 'FACE_VERIFY_MISMATCH', category: 'BIOMETRIC', photoKey: 'k.jpg', severity: 'WARNING' });
        expect(face.description).toContain('12%');

        const json = JSON.stringify(body);
        ['secret', '1.2.3.4', 'UA', 'beforeData', 'afterData', 'ipAddress', 'userAgent'].forEach(s => expect(json).not.toContain(s));
    });

    it('hides page views unless asked', async () => {
        answer({ apps: [], loans: [], rows: [], attempts: [] });
        await run(activity.get, req());
        expect(queryFor('rows').args.where._and).toContainEqual({ action: { _nin: ['LAF_DETAIL_VIEWED'] } });

        graph.query.mockReset();
        answer({ apps: [], loans: [], rows: [], attempts: [] });
        await run(activity.get, req({ includeViews: 'true' }));
        expect(queryFor('rows').args.where._and).not.toContainEqual({ action: { _nin: ['LAF_DETAIL_VIEWED'] } });
    });

    it('skips face attempts when filtering by another category', async () => {
        answer({ apps: [], loans: [], rows: [], attempts: [] });
        await run(activity.get, req({ category: 'LOAN' }));
        expect(queried().map(q => q.alias)).not.toContain('attempts');
    });

    it("matches the client's loans and LAF applications by entity id", async () => {
        answer({ apps: [{ _id: 'app1' }], loans: [{ _id: 'loan1' }], rows: [], attempts: [] });
        await run(activity.get, req());
        expect(queryFor('rows').args.where._and[0]._or).toContainEqual({ entityId: { _in: ['c1', 'app1', 'loan1'] } });
    });

    it('whitelists metadata', async () => {
        answer({
            apps: [], loans: [], attempts: [],
            rows: [audit('A1', '2026-10-03T00:00:00Z', { metadata: { reason: 'r', approvedBy: 'u9', secret: 'x', version: 2 } })],
        });
        const body = await run(activity.get, req());
        expect(body.events[0].meta).toEqual({ reason: 'r', version: 2 });
    });
});

// ── clients/index (scope + biometrics + audit) ───────────────────────────
describe('clients/index', () => {
    const row = (over = {}) => ({
        _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1', groupId: 'g1', loId: 'lo1',
        status: 'active', groupLeader: false, delinquent: false, duplicate: false, archived: false,
        profile: 'p.jpg', faceTemplate: JSON.stringify(ZERO), loans: [], ...over,
    });
    const getReq = () => ({ auth: { sub: 'sub' }, query: { clientId: 'c1' } });
    const post = async (fields) => {
        global.__formFields = fields;
        return run(clientsApi.post, { auth: { sub: 'sub' }, headers: {} });
    };

    describe('GET', () => {
        it('rejects an unknown caller', async () => {
            findUserById.mockResolvedValue(null);
            expect((await run(clientsApi.get, getReq())).success).toBe(false);
        });

        it('out-of-scope looks exactly like not-found and never loads the client', async () => {
            resolveClientInScope.mockResolvedValue(null);
            answer({ clients: [row()] });
            expect(await run(clientsApi.get, getReq())).toEqual({ success: true, client: null });
            expect(graph.query).not.toHaveBeenCalled();
        });

        it('returns an in-scope client without its face template', async () => {
            answer({ clients: [row()] });
            const body = await run(clientsApi.get, getReq());
            expect(body.client._id).toBe('c1');
            expect(body.client).not.toHaveProperty('faceTemplate');
        });

        it('can be switched off with ENFORCE_CLIENT_SCOPE=false (rollback)', async () => {
            jest.resetModules();
            process.env.ENFORCE_CLIENT_SCOPE = 'false';
            // flag is read at import time; reload the handler with scope refusing everyone
            const { resolveClientInScope: scope } = require('@/lib/client-scope');
            scope.mockResolvedValue(null);
            const fresh = require('@/pages/api/v2/clients/index').default;
            const g = require('@/lib/graph/graph.provider').__shared;
            const fu = require('@/lib/graph.functions').findUserById;
            fu.mockResolvedValue(user('branch_manager'));
            g.query.mockImplementation(async (...qs) => ({ data: { [qs[0].alias]: [row()] } }));
            const body = await run(fresh.get, getReq());
            expect(body.client._id).toBe('c1');
        });
    });

    describe('POST', () => {
        it('out-of-scope looks exactly like not-found and writes nothing', async () => {
            resolveClientInScope.mockResolvedValue(null);
            answer({ clients: [row()] });
            expect(await post({ _id: 'c1', groupLeader: 'true' })).toMatchObject({ success: false, message: 'Client not found' });
            expect(graph.mutation).not.toHaveBeenCalled();
        });

        it('refuses moving a client into a branch outside the caller scope', async () => {
            resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['b1'] } });
            answer({ clients: [row()] });
            const body = await post({ _id: 'c1', branchId: 'b2' });
            expect(body.success).toBe(false);
            expect(body.message).toMatch(/outside your scope/);
            expect(graph.mutation).not.toHaveBeenCalled();
        });

        it('allows a move within scope', async () => {
            resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['b1', 'b2'] } });
            answer({ clients: [row()] });
            expect((await post({ _id: 'c1', branchId: 'b2' })).success).toBe(true);
            expect(graph.mutation).toHaveBeenCalled();
        });

        it('audits exactly what changed — and only that', async () => {
            answer({ clients: [row()] });
            const body = await post({ _id: 'c1', groupLeader: 'true' });
            expect(body.success).toBe(true);
            expect(body.client).not.toHaveProperty('faceTemplate');
            expect(logAudit).toHaveBeenCalledTimes(1);
            const audit = logAudit.mock.calls[0][1];
            expect(audit).toMatchObject({ action: 'CLIENT_UPDATED', category: 'CLIENT', clientId: 'c1', entityId: 'c1' });
            expect(audit.metadata.changedFields).toEqual(['groupLeader']);
            expect(audit.beforeData).toEqual({ groupLeader: false });
            expect(audit.afterData).toEqual({ groupLeader: true });
        });

        it('audits a profile photo change as its own entry', async () => {
            answer({ clients: [row()] });
            await post({ _id: 'c1', profile: 'new.jpg' });
            expect(logAudit).toHaveBeenCalledTimes(1);
            expect(logAudit.mock.calls[0][1]).toMatchObject({
                action: 'CLIENT_PROFILE_PHOTO_CHANGED', severity: 'WARNING',
                beforeData: { profile: 'p.jpg' }, afterData: { profile: 'new.jpg' },
            });
        });

        it('does not audit a save that changes nothing', async () => {
            answer({ clients: [row()] });
            await post({ _id: 'c1' });
            expect(logAudit).not.toHaveBeenCalled();
        });
    });
});