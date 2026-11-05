// Scenario coverage for clients/enroll-face and face-verify-attempts/override.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => require('../../__mocks__/face-harness').utilsMock());

const { graph, findUserById, ONE, ZERO, user, call, run, answer, ops } = require('../../__mocks__/face-harness');
const { resolveClientInScope } = require('@/lib/client-scope');
const { logAudit } = require('@/lib/audit');
const enrollFace   = require('@/pages/api/v2/clients/enroll-face').default;
const overrideFace = require('@/pages/api/v2/face-verify-attempts/override').default;

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: {} });
    findUserById.mockReset(); findUserById.mockResolvedValue(user('branch_manager'));
    resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
});

describe('clients/enroll-face', () => {
    const req = (o = {}) => ({ auth: { sub: 'sub' }, body: {
        clientId: 'c1', faceTemplate: ONE, photoKey: 'p.jpg', loanId: 'l1', livenessScore: 0.8, ...o } });
    const fx = (o = {}) => ({
        clients: [{ _id: 'c1', branchId: 'b1', firstName: 'Ana', lastName: 'Cruz', faceTemplate: null }],
        enrollments: [], ...o,
    });
    const go = (o, f) => { answer(f ?? fx()); return run(enrollFace.post, req(o)); };

    it.each(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager'])(
        '%s can enroll', async (code) => {
            findUserById.mockResolvedValue(user(code));
            expect((await go()).success).toBe(true);
        });

    it.each(['loan_officer', 'cashier', undefined])('%s is refused without touching data', async (code) => {
        findUserById.mockResolvedValue(user(code));
        const res = await go();
        expect(res).toMatchObject({ success: false, message: 'You are not allowed to enroll a face template.' });
        expect(graph.query).not.toHaveBeenCalled();
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('an unknown user is refused', async () => {
        findUserById.mockResolvedValue(null);
        expect(await go()).toMatchObject({ success: false, message: 'User not found.' });
    });

    it.each([
        ['clientId is a number',  { clientId: 5 },                    /clientId and faceTemplate required/],
        ['faceTemplate missing',  { faceTemplate: undefined },        /clientId and faceTemplate required/],
        ['template is 127 long',  { faceTemplate: Array(127).fill(0.1) }, /Invalid face template/],
        ['template has NaN',      { faceTemplate: [...Array(127).fill(0.1), NaN] }, /Invalid face template/],
        ['template is an object', { faceTemplate: { 0: 1 } },         /Invalid face template/],
    ])('rejects: %s', async (_n, over, pattern) => {
        const res = await go(over);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(pattern);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('out-of-scope and truly-missing clients are indistinguishable', async () => {
        resolveClientInScope.mockResolvedValue(null);
        const a = await go();
        resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
        const b = await go({}, fx({ clients: [] }));
        expect(b).toEqual(a);
        expect(b.message).toBe('Client not found.');
    });

    it('a photo key that is not a string is stored as null and does not wipe the client photo', async () => {
        await go({ photoKey: 42 });
        expect(ops()[0].args.objects[0].photo_key).toBeNull();
        expect(ops()[1].args.set).not.toHaveProperty('faceEnrollPhotoKey');
    });

    it('a missing photo key behaves the same', async () => {
        await go({ photoKey: undefined });
        expect(ops()[0].args.objects[0].photo_key).toBeNull();
        expect(ops()[1].args.set).not.toHaveProperty('faceEnrollPhotoKey');
    });

    it('keeps a liveness score of 0 and drops invalid ones', async () => {
        await go({ livenessScore: 0 });
        expect(ops()[0].args.objects[0].liveness_score).toBe(0);
        graph.mutation.mockClear();
        await go({ livenessScore: 'high' });
        expect(ops()[0].args.objects[0].liveness_score).toBeNull();
        expect(ops()[1].args.set.livenessScore).toBeNull();
    });

    it('keeps a sensible client timestamp, replaces a bad one with server time', async () => {
        const good = new Date().toISOString();
        await go({ faceEnrolledAt: good });
        expect(ops()[0].args.objects[0].enrolled_at).toBe(good);

        graph.mutation.mockClear();
        await go({ faceEnrolledAt: 'garbage' });
        expect(ops()[0].args.objects[0].enrolled_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        expect(ops()[0].args.objects[0].enrolled_at).not.toBe('garbage');

        graph.mutation.mockClear();
        await go({ faceEnrolledAt: '2001-01-01T00:00:00.000Z' });
        expect(ops()[0].args.objects[0].enrolled_at).not.toBe('2001-01-01T00:00:00.000Z');
    });

    it('takes the branch from the client record and stores a null loan when none given', async () => {
        await go({ loanId: undefined });
        expect(ops()[0].args.objects[0]).toMatchObject({ branch_id: 'b1', loan_id: null });
    });

    it('stores the template as the same JSON string on the row and the client', async () => {
        await go();
        expect(ops()[0].args.objects[0].face_template).toBe(JSON.stringify(ONE));
        expect(ops()[1].args.set.faceTemplate).toBe(JSON.stringify(ONE));
    });

    it('audits without the template, with the client name and version', async () => {
        await go();
        const audit = logAudit.mock.calls[0][1];
        expect(audit.description).toContain('Ana Cruz');
        expect(audit.afterData).toEqual({ version: 1, photoKey: 'p.jpg' });
        expect(JSON.stringify(audit)).not.toContain('1,1,1,1,1');
    });

    it('a failed write raises and writes NO audit entry', async () => {
        answer(fx());
        graph.mutation.mockRejectedValue(new Error('db down'));
        await expect(enrollFace.post(req(), require('../../__mocks__/face-harness').makeRes())).rejects.toThrow('db down');
        expect(logAudit).not.toHaveBeenCalled();
    });
});

describe('face-verify-attempts/override', () => {
    const req = (o = {}) => ({ auth: { sub: 'sub' }, body: {
        clientId: 'c1', loanId: 'l1', ciReferenceCode: 'CI1', reason: 'Camera broken at this branch', ...o } });
    const fx = (o = {}) => ({
        clients: [{ _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1', faceTemplate: JSON.stringify(ZERO) }],
        loans: [{ _id: 'l1', clientId: 'c1', status: 'pending', ldfApproved: false }],
        mismatchAgg: { aggregate: { count: 3 } }, ...o,
    });
    const go = (o, f) => { answer(f ?? fx()); return run(overrideFace.post, req(o)); };
    beforeEach(() => findUserById.mockResolvedValue(user('admin')));

    it.each(['deputy_director', 'regional_manager', 'area_admin', 'branch_manager', 'loan_officer'])(
        '%s is not an administrator and is refused before any lookup', async (code) => {
            findUserById.mockResolvedValue(user(code));
            const res = await go();
            expect(res.message).toMatch(/administrator/);
            expect(graph.query).not.toHaveBeenCalled();
            expect(logAudit).not.toHaveBeenCalled();
        });

    it('an unknown user is refused', async () => {
        findUserById.mockResolvedValue(null);
        expect(await go()).toMatchObject({ success: false, message: 'User not found.' });
    });

    it.each([
        ['clientId is a number', { clientId: 7 },          /clientId and loanId/],
        ['loanId is missing',    { loanId: undefined },    /clientId and loanId/],
        ['reason has 9 chars',   { reason: '123456789' },  /reason of at least/],
        ['reason is padding',    { reason: '    a      ' },/reason of at least/],
        ['reason is a number',   { reason: 1234567890 },   /reason of at least/],
    ])('rejects: %s', async (_n, over, pattern) => {
        const res = await go(over);
        expect(res.message).toMatch(pattern);
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('accepts a reason of exactly 10 characters', async () => {
        expect((await go({ reason: '1234567890' })).success).toBe(true);
    });

    it('out-of-scope and truly-missing clients are indistinguishable', async () => {
        resolveClientInScope.mockResolvedValue(null);
        const a = await go();
        resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
        const b = await go({}, fx({ clients: [] }));
        expect(b).toEqual(a);
    });

    it('refuses a missing loan, another client\'s loan, and non-pending loans', async () => {
        expect((await go({}, fx({ loans: [] }))).message).toMatch(/does not belong/);
        expect((await go({}, fx({ loans: [{ _id: 'l1', clientId: 'other', status: 'pending' }] }))).message).toMatch(/does not belong/);
        for (const status of ['active', 'reject', 'closed']) {
            const res = await go({}, fx({ loans: [{ _id: 'l1', clientId: 'c1', status }] }));
            expect(res.message).toMatch(/only allowed while the loan is pending/);
        }
        expect(logAudit).not.toHaveBeenCalled();
    });

    it.each([[0], [1], [9]])('records %i prior mismatches', async (count) => {
        await go({}, fx({ mismatchAgg: { aggregate: { count } } }));
        expect(logAudit.mock.calls[0][1].metadata.mismatchCount).toBe(count);
    });

    it('labels the override by whether the client had a face on record', async () => {
        expect((await go()).kind).toBe('mismatch_override');
        const c = fx().clients[0];
        expect((await go({}, fx({ clients: [{ ...c, faceTemplate: null }] }))).kind).toBe('no_template_override');
        expect((await go({}, fx({ clients: [{ ...c, faceTemplate: '' }] }))).kind).toBe('no_template_override');
    });

    it('records a null CI reference when none is sent, and trims the reason', async () => {
        await go({ ciReferenceCode: undefined, reason: '   Camera broken at this branch   ' });
        const audit = logAudit.mock.calls[0][1];
        expect(audit.metadata.ciReferenceCode).toBeNull();
        expect(audit.metadata.reason).toBe('Camera broken at this branch');
        expect(audit.description).toContain('Reason: Camera broken at this branch');
    });

    it('names the administrator and returns only success + kind', async () => {
        const res = await go();
        expect(res).toEqual({ success: true, kind: 'mismatch_override' });
        const audit = logAudit.mock.calls[0][1];
        expect(audit).toMatchObject({ userId: 'u-admin', userName: 'Test admin', severity: 'CRITICAL', clientId: 'c1' });
        expect(audit.metadata.approvedBy).toBe('u-admin');
    });

    it('writes nothing to the database (it is a record, not a decision)', async () => {
        await go();
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('every refusal answers HTTP 200', async () => {
        for (const b of [{ reason: 'x' }, { loanId: '' }]) {
            const res = await call(overrideFace.post, req(b));
            expect(res.status.mock.calls.every(c => c[0] === 200)).toBe(true);
        }
    });

    it('an LDF-approved loan that is still pending IS allowed (the state of every loan in the disbursement window)', async () => {
        const res = await go({}, fx({ loans: [{ _id: 'l1', clientId: 'c1', status: 'pending', ldfApproved: true }] }));
        expect(res.success).toBe(true);
    });
});