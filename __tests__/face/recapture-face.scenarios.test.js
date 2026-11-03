// Scenario coverage for clients/recapture-face: roles, input boundaries, gates, evidence, failure safety.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => require('../../__mocks__/face-harness').utilsMock());

const { graph, findUserById, ONE, user, makeRes, call, run, answer, ops, queried } = require('../../__mocks__/face-harness');
const { resolveClientInScope } = require('@/lib/client-scope');
const { resolveBranchWhere } = require('@/lib/ci-scope');
const { logAudit } = require('@/lib/audit');
const { MIN_MISMATCHES_FOR_RECAPTURE: MIN, MAX_RECAPTURES_PER_LOAN: MAX } = require('@/lib/face-recapture-utils');
const recaptureFace = require('@/pages/api/v2/clients/recapture-face').default;

const tpl = (first = 0) => Array.from({ length: 128 }, (_, i) => (i === 0 ? first : 0));
const body = (o = {}) => ({
    clientId: 'c1', loanId: 'l1', ciReferenceCode: 'CI1', faceTemplate: ONE,
    livenessScore: 0.95, photoKey: 'new.jpg', reason: 'Old photo was blurry and dark', ...o,
});
const req = (o) => ({ auth: { sub: 'sub' }, body: body(o) });
const fx = (o = {}) => ({
    clients: [{ _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1',
        faceTemplate: JSON.stringify(tpl(0)), faceEnrolledAt: 't0', faceEnrollPhotoKey: 'old.jpg', livenessScore: 0.9 }],
    loans: [{ _id: 'l1', clientId: 'c1', status: 'pending', ldfApproved: false, ciReferenceCode: 'CI1', branchId: 'b1' }],
    faceRecaptureSetting: [{ allowFaceRecapture: true }],
    activeEnrollments: [],
    mismatchAgg: { aggregate: { count: MIN } },
    recaptureAgg: { aggregate: { count: 0 } },
    triggerAttempts: [{ _id: 'a9' }],
    ...o,
});
const go = (o, f) => { answer(f ?? fx()); return run(recaptureFace.post, req(o)); };

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: {} });
    findUserById.mockReset(); findUserById.mockResolvedValue(user('branch_manager'));
    resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
    resolveBranchWhere.mockResolvedValue({});
});

describe('who may re-enroll', () => {
    it.each(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager'])(
        '%s can', async (code) => {
            findUserById.mockResolvedValue(user(code));
            expect((await go()).success).toBe(true);
        });

    it.each(['loan_officer', 'cashier', 'staff', undefined])(
        '%s is refused before any data is read or written', async (code) => {
            findUserById.mockResolvedValue(user(code));
            const res = await go();
            expect(res.success).toBe(false);
            expect(res.message).toMatch(/Only an admin/);
            expect(graph.query).not.toHaveBeenCalled();
            expect(graph.mutation).not.toHaveBeenCalled();
            expect(logAudit).not.toHaveBeenCalled();
        });

    it('root can even with a non-decision role', async () => {
        findUserById.mockResolvedValue(user('loan_officer', { root: true }));
        expect((await go()).success).toBe(true);
    });

    it('an unknown user is refused', async () => {
        findUserById.mockResolvedValue(null);
        expect(await go()).toMatchObject({ success: false, message: 'User not found.' });
    });
});

describe('input validation', () => {
    it.each([
        ['clientId is a number',      { clientId: 123 },                                        /clientId and loanId/],
        ['clientId is empty',         { clientId: '' },                                         /clientId and loanId/],
        ['loanId is an array',        { loanId: ['l1'] },                                       /clientId and loanId/],
        ['template is 127 long',      { faceTemplate: Array(127).fill(0.1) },                   /valid face capture/],
        ['template is 129 long',      { faceTemplate: Array(129).fill(0.1) },                   /valid face capture/],
        ['template contains NaN',     { faceTemplate: [...Array(127).fill(0.1), NaN] },         /valid face capture/],
        ['template contains Infinity',{ faceTemplate: [...Array(127).fill(0.1), Infinity] },    /valid face capture/],
        ['template contains a string',{ faceTemplate: [...Array(127).fill(0.1), '0.1'] },       /valid face capture/],
        ['template is not an array',  { faceTemplate: 'abc' },                                  /valid face capture/],
        ['photoKey is a number',      { photoKey: 42 },                                         /photo did not upload/],
        ['photoKey is missing',       { photoKey: undefined },                                  /photo did not upload/],
        ['reason has 9 characters',   { reason: '123456789' },                                  /reason of at least/],
        ['reason is mostly padding',  { reason: '          x          ' },                       /reason of at least/],
        ['reason is not a string',    { reason: 12345678901 },                                  /reason of at least/],
    ])('rejects: %s', async (_name, over, pattern) => {
        const res = await go(over);
        expect(res.success).toBe(false);
        expect(res.message).toMatch(pattern);
        expect(graph.query).not.toHaveBeenCalled();
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('accepts a reason of exactly 10 characters', async () => {
        expect((await go({ reason: '1234567890' })).success).toBe(true);
    });

    it('stores the trimmed reason', async () => {
        await go({ reason: '   Old photo blurry   ' });
        const v2 = ops()[1].args.objects[0];
        expect(v2.reason).toBe('Old photo blurry');
    });

    it('turns a non-numeric or out-of-range liveness score into null', async () => {
        for (const bad of ['abc', 1.5, -0.1, NaN]) {
            graph.mutation.mockClear();
            await go({ livenessScore: bad });
            expect(ops()[1].args.objects[0].liveness_score).toBeNull();
            expect(ops()[2].args.set.livenessScore).toBeNull();
        }
    });

    it('keeps a valid liveness score, including 0', async () => {
        await go({ livenessScore: 0 });
        expect(ops()[1].args.objects[0].liveness_score).toBe(0);
    });
});

describe('what is looked up', () => {
    it('out-of-scope and truly-missing clients are indistinguishable', async () => {
        resolveClientInScope.mockResolvedValue(null);
        const outOfScope = await go();
        resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
        const missing = await go({}, fx({ clients: [] }));
        expect(missing).toEqual(outOfScope);
        expect(missing.message).toBe('Client not found.');
    });

    it('a missing loan reads as "does not belong"', async () => {
        expect((await go({}, fx({ loans: [] }))).message).toMatch(/does not belong/);
    });

    it.each([
        ['not JSON',                 'not json'],
        ['JSON of the wrong length', JSON.stringify(Array(127).fill(0))],
        ['JSON that is not an array', JSON.stringify({ a: 1 })],
        ['empty string',             ''],
    ])('a corrupt stored template (%s) counts as "no face on record"', async (_n, stored) => {
        const c = fx().clients[0];
        const res = await go({}, fx({ clients: [{ ...c, faceTemplate: stored }] }));
        expect(res.message).toMatch(/no face on record/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it.each(['active', 'reject', 'closed', 'completed'])('loan status %s is refused', async (status) => {
        const res = await go({}, fx({ loans: [{ _id: 'l1', clientId: 'c1', status, ldfApproved: false }] }));
        expect(res.message).toMatch(/only allowed while the loan is pending/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });
});

describe('gate boundaries', () => {
    it.each([[MIN - 1, false], [0, false], [MIN, true], [MIN + 5, true]])(
        'with %i logged mismatches → allowed=%s', async (count, allowed) => {
            const res = await go({}, fx({ mismatchAgg: { aggregate: { count } } }));
            expect(res.success).toBe(allowed);
            if (!allowed) expect(res.message).toMatch(new RegExp(`unlocks after ${MIN}`));
        });

    it.each([[0, true], [MAX - 1, true], [MAX, false], [MAX + 1, false]])(
        'with %i earlier re-enrollments on this loan → allowed=%s', async (count, allowed) => {
            const res = await go({}, fx({ recaptureAgg: { aggregate: { count } } }));
            expect(res.success).toBe(allowed);
            if (!allowed) expect(res.message).toMatch(/limit for this loan/);
        });

    it('a capture just under the match threshold is "already matches"', async () => {
        const res = await go({ faceTemplate: tpl(0.49) });
        expect(res).toMatchObject({ success: false, code: 'ALREADY_MATCHES' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('a capture exactly at the threshold is allowed', async () => {
        const res = await go({ faceTemplate: tpl(0.5) });
        expect(res).toMatchObject({ success: true, distanceFromPrevious: 0.5 });
    });

    it('a capture just over the threshold is allowed', async () => {
        expect((await go({ faceTemplate: tpl(0.51) })).success).toBe(true);
    });

    it('reports the distance rounded to 3 decimals', async () => {
        expect((await go()).distanceFromPrevious).toBe(11.314); // sqrt(128)
    });
});

describe('what gets written', () => {
    it('works when no trigger attempt row comes back', async () => {
        const res = await go({}, fx({ triggerAttempts: [] }));
        expect(res.success).toBe(true);
        expect(ops()[1].args.objects[0].trigger_attempt_id).toBeNull();
        expect(logAudit.mock.calls[0][1].metadata.triggerAttemptId).toBeNull();
    });

    it('takes the branch from the client record, never from the request', async () => {
        await go({ branchId: 'evil-branch' });
        const [v1, v2] = [ops()[0].args.objects[0], ops()[1].args.objects[0]];
        expect(v1.branch_id).toBe('b1');
        expect(v2.branch_id).toBe('b1');
        expect(logAudit.mock.calls[0][1].branchId).toBe('b1');
    });

    it('records the caller as both capturer and approver', async () => {
        await go();
        const v2 = ops()[1].args.objects[0];
        expect(v2.captured_by).toBe('u-branch_manager');
        expect(v2.approved_by).toBe('u-branch_manager');
    });

    it("falls back to the loan's CI reference in the audit entry", async () => {
        await go({ ciReferenceCode: undefined });
        expect(logAudit.mock.calls[0][1].metadata.ciReferenceCode).toBe('CI1');
    });

    it('continues the version number from the active row', async () => {
        const res = await go({}, fx({ activeEnrollments: [{ _id: 'e5', version: 5 }] }));
        expect(res.version).toBe(6);
        expect(ops()[0]).toMatchObject({ op: 'update', table: 'client_face_enrollments' });
        expect(ops()[0].args.set.status).toBe('superseded');
        expect(ops()[3].args.set).toEqual({ enrollment_id: 'e5' });
    });

    it("only relinks THIS client's unlinked attempts", async () => {
        await go();
        expect(ops()[3].args.where).toEqual({
            _and: [{ client_id: { _eq: 'c1' } }, { enrollment_id: { _is_null: true } }],
        });
    });

    it('stores the new template as JSON on both the version row and the client', async () => {
        await go();
        expect(ops()[1].args.objects[0].face_template).toBe(JSON.stringify(ONE));
        expect(ops()[2].args.set.faceTemplate).toBe(JSON.stringify(ONE));
    });
});

describe('failure safety', () => {
    it('a failed swap raises and writes NO audit entry', async () => {
        answer(fx());
        graph.mutation.mockRejectedValue(new Error('db down'));
        await expect(recaptureFace.post(req(), makeRes())).rejects.toThrow('db down');
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('every refusal still answers HTTP 200 (a 403 would log the user out)', async () => {
        const bodies = [{ reason: 'x' }, { photoKey: '' }, { loanId: '' }];
        for (const b of bodies) {
            const res = await call(recaptureFace.post, req(b));
            expect(res.status.mock.calls.every(c => c[0] === 200)).toBe(true);
        }
    });
});

describe('feature switch (System Settings → Allow Client Face Re-enrollment)', () => {
    const off = (value) => fx({ faceRecaptureSetting: [{ allowFaceRecapture: value }] });

    it.each([
        ['false', false], ['null', null], ['unset', undefined], ['the string "true"', 'true'], ['the number 1', 1],
    ])('%s means OFF', async (_n, value) => {
        const res = await go({}, off(value));
        expect(res).toMatchObject({ success: false, code: 'FEATURE_DISABLED' });
        expect(res.message).toMatch(/turned off in System Settings/);
    });

    it('no settings row at all means OFF', async () => {
        expect((await go({}, fx({ faceRecaptureSetting: [] }))).code).toBe('FEATURE_DISABLED');
    });

    it('refuses before reading the client or loan, and writes and audits nothing', async () => {
        await go({}, off(false));
        const aliases = queried().map((q) => q.alias);
        expect(aliases).not.toContain('clients');
        expect(aliases).not.toContain('loans');
        expect(graph.mutation).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('role and scope refusals still read the same when the feature is off', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        expect((await go({}, off(false))).message).toMatch(/Only an admin/);
        findUserById.mockResolvedValue(user('branch_manager'));
        resolveClientInScope.mockResolvedValue(null);
        expect((await go({}, off(false))).message).toBe('Client not found.');
    });

    it('ON proceeds as before', async () => {
        expect((await go({}, off(true))).success).toBe(true);
    });

    it('a failing settings read raises, so the feature stays off and nothing is written', async () => {
        graph.query.mockRejectedValue(new Error('hasura down'));
        await expect(recaptureFace.post(req(), makeRes())).rejects.toThrow('hasura down');
        expect(graph.mutation).not.toHaveBeenCalled();
    });
});