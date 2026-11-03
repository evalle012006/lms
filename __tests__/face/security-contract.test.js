// Cross-endpoint rules every face / client endpoint must keep:
//  - refusals answer HTTP 200 (a 401/403 logs the user out in this app)
//  - a refused caller never causes a data read, a write or an audit entry
//  - out-of-scope reads exactly like not-found
//  - the scope check is made for the requested client with the real user
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => require('../../__mocks__/face-harness').utilsMock());

const { graph, findUserById, ONE, user, call, answer } = require('../../__mocks__/face-harness');
const { resolveClientInScope } = require('@/lib/client-scope');
const { logAudit } = require('@/lib/audit');

const recaptureFace = require('@/pages/api/v2/clients/recapture-face').default;
const enrollFace    = require('@/pages/api/v2/clients/enroll-face').default;
const overrideFace  = require('@/pages/api/v2/face-verify-attempts/override').default;
const forReview     = require('@/pages/api/v2/face-verify-attempts/for-review').default;
const activity      = require('@/pages/api/v2/clients/activity').default;

const writeBody = { clientId: 'c1', loanId: 'l1', faceTemplate: ONE, photoKey: 'k', reason: 'a long enough reason' };
const ENDPOINTS = [
    { name: 'recapture-face', handler: recaptureFace.post, req: { auth: { sub: 'sub' }, body: writeBody },
      okRole: 'branch_manager',
      missing: { faceRecaptureSetting: [{ allowFaceRecapture: true }], clients: [], loans: [], activeEnrollments: [] } },
    { name: 'enroll-face', handler: enrollFace.post, req: { auth: { sub: 'sub' }, body: writeBody },
      okRole: 'branch_manager', missing: { clients: [], enrollments: [] } },
    { name: 'override', handler: overrideFace.post, req: { auth: { sub: 'sub' }, body: writeBody },
      okRole: 'admin', missing: { clients: [], loans: [], mismatchAgg: { aggregate: { count: 0 } } } },
    { name: 'for-review', handler: forReview.get, req: { auth: { sub: 'sub' }, query: { clientId: 'c1', loanId: 'l1' } },
      okRole: 'branch_manager' },
    { name: 'activity', handler: activity.get, req: { auth: { sub: 'sub' }, query: { clientId: 'c1' } },
      okRole: 'branch_manager' },
];

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: {} });
    findUserById.mockReset();
    resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
    answer({});
});

describe.each(ENDPOINTS)('$name', ({ handler, req, okRole, missing }) => {
    it('refuses a loan officer: HTTP 200, no read, no write, no audit', async () => {
        findUserById.mockResolvedValue(user('loan_officer'));
        const res = await call(handler, req);
        expect(res.body.success).toBe(false);
        expect(res.status.mock.calls.every(c => c[0] === 200)).toBe(true);
        expect(graph.query).not.toHaveBeenCalled();
        expect(graph.mutation).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('refuses an unknown caller the same way', async () => {
        findUserById.mockResolvedValue(null);
        const res = await call(handler, req);
        expect(res.body.success).toBe(false);
        expect(res.status.mock.calls.every(c => c[0] === 200)).toBe(true);
        expect(graph.query).not.toHaveBeenCalled();
        expect(graph.mutation).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('says "Client not found." when the client is out of scope, and writes nothing', async () => {
        findUserById.mockResolvedValue(user(okRole));
        resolveClientInScope.mockResolvedValue(null);
        const res = await call(handler, req);
        expect(res.body).toMatchObject({ success: false, message: 'Client not found.' });
        expect(graph.mutation).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('checks scope for the requested client id with the real user', async () => {
        const u = user(okRole);
        findUserById.mockResolvedValue(u);
        resolveClientInScope.mockResolvedValue(null);
        await call(handler, req);
        expect(resolveClientInScope).toHaveBeenCalledWith(u, 'c1');
    });

    if (missing) {
        it('gives the SAME answer for out-of-scope and truly-missing clients', async () => {
            findUserById.mockResolvedValue(user(okRole));
            resolveClientInScope.mockResolvedValue(null);
            const outOfScope = (await call(handler, req)).body;

            resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
            answer(missing);
            const gone = (await call(handler, req)).body;
            expect(gone).toEqual(outOfScope);
        });
    }
});