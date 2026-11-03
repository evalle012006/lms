// The server-side face check used by approve-by-batch: who needs proof, what counts as proof, fail-closed.
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());

const { graph, findBranches, resolveClientFlowStatus, answer, queried, queryFor } = require('../../__mocks__/face-harness');
const {
    collectFaceProofDenials, finalApprovalRows, FACE_OVERRIDE_ACTION, FACE_ENROLLMENT_SOURCES,
} = require('@/lib/api/faceApprovalProof');

const row = (id, over = {}) => ({ _id: id, clientId: `c-${id}`, branchId: 'b1', fullName: `Client ${id}`, ...over });
const fx = (over = {}) => ({ settings: [{ requireClientBiometric: true }], faceMatched: [], faceEnrolled: [], faceOverrides: [], ...over });

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset();
    findBranches.mockReset();
    findBranches.mockResolvedValue([{ _id: 'b1', clientFlowVersion: 'v2' }]);
    resolveClientFlowStatus.mockReset();
    resolveClientFlowStatus.mockImplementation(async (ids) => Object.fromEntries(ids.map((i) => [i, true])));
});

describe('contract with the rest of the face feature', () => {
    it('uses the same action name the override endpoint writes', () => {
        expect(FACE_OVERRIDE_ACTION).toBe('CLIENT_FACE_VERIFICATION_OVERRIDDEN');
    });
    it('accepts exactly the enrollment sources the endpoints write at disbursement', () => {
        expect(FACE_ENROLLMENT_SOURCES).toEqual(['disbursement_first', 'disbursement_recapture']);
    });
});

describe('who needs proof', () => {
    it('nothing to check → no queries at all', async () => {
        for (const rows of [[], null, undefined, [null]]) {
            expect(await collectFaceProofDenials(rows)).toEqual([]);
        }
        expect(graph.query).not.toHaveBeenCalled();
    });

    it('requireClientBiometric=false exempts everything and stops before further lookups', async () => {
        answer(fx({ settings: [{ requireClientBiometric: false }] }));
        expect(await collectFaceProofDenials([row('l1')])).toEqual([]);
        expect(findBranches).not.toHaveBeenCalled();
    });

    it('a missing settings row means required (fail-closed default)', async () => {
        answer(fx({ settings: [] }));
        expect(await collectFaceProofDenials([row('l1')])).toHaveLength(1);
    });

    it('only v2 branches are checked', async () => {
        findBranches.mockResolvedValue([{ _id: 'b1', clientFlowVersion: 'v2' }, { _id: 'b2', clientFlowVersion: 'v1' }]);
        answer(fx());
        const denied = await collectFaceProofDenials([row('l1'), row('l2', { branchId: 'b2' })]);
        expect(denied).toEqual(['Client l1: face verification has not been completed for this loan.']);
        expect(resolveClientFlowStatus).toHaveBeenCalledWith(['c-l1']);
    });

    it('a branch that cannot be found is not treated as v2', async () => {
        findBranches.mockResolvedValue([]);
        answer(fx());
        expect(await collectFaceProofDenials([row('l1')])).toEqual([]);
    });

    it('legacy clients (no promoted LAF application) are exempt — decided on the server', async () => {
        resolveClientFlowStatus.mockResolvedValue({ 'c-l1': false, 'c-l2': true });
        answer(fx());
        const denied = await collectFaceProofDenials([row('l1'), row('l2')]);
        expect(denied).toEqual(['Client l2: face verification has not been completed for this loan.']);
    });

    it('a client missing from the flow lookup is required (fail-closed)', async () => {
        resolveClientFlowStatus.mockResolvedValue({});
        answer(fx());
        expect(await collectFaceProofDenials([row('l1')])).toHaveLength(1);
    });

    it('a loan with no client id on a v2 branch is required', async () => {
        resolveClientFlowStatus.mockResolvedValue({});
        answer(fx());
        const denied = await collectFaceProofDenials([row('l1', { clientId: undefined })]);
        expect(denied).toHaveLength(1);
    });
});

describe('what counts as proof', () => {
    it('a matched attempt', async () => {
        answer(fx({ faceMatched: [{ loan_id: 'l1' }] }));
        expect(await collectFaceProofDenials([row('l1')])).toEqual([]);
    });
    it('a first enrollment or supervisor re-enrollment at this disbursement', async () => {
        answer(fx({ faceEnrolled: [{ loan_id: 'l1' }] }));
        expect(await collectFaceProofDenials([row('l1')])).toEqual([]);
    });
    it('an administrator override recorded for this loan', async () => {
        answer(fx({ faceOverrides: [{ clientId: 'c-l1', metadata: { loanId: 'l1' } }] }));
        expect(await collectFaceProofDenials([row('l1')])).toEqual([]);
    });
    it('an override recorded for a DIFFERENT loan does not count', async () => {
        answer(fx({ faceOverrides: [{ clientId: 'c-l1', metadata: { loanId: 'other-loan' } }] }));
        expect(await collectFaceProofDenials([row('l1')])).toHaveLength(1);
    });
    it('override rows without usable metadata are ignored', async () => {
        answer(fx({ faceOverrides: [{ clientId: 'c-l1', metadata: null }, { clientId: 'c-l1' }] }));
        expect(await collectFaceProofDenials([row('l1')])).toHaveLength(1);
    });
    it('no proof of any kind is denied, naming the client', async () => {
        answer(fx());
        expect(await collectFaceProofDenials([row('l1')])).toEqual([
            'Client l1: face verification has not been completed for this loan.',
        ]);
    });
    it('names fall back to clientName, then a generic label', async () => {
        answer(fx());
        const denied = await collectFaceProofDenials([
            row('l1', { fullName: undefined, clientName: 'Ana Cruz' }),
            row('l2', { fullName: undefined }),
        ]);
        expect(denied[0]).toMatch(/^Ana Cruz:/);
        expect(denied[1]).toMatch(/^A client:/);
    });
    it('a mixed batch lists only the unproven loans, in order', async () => {
        answer(fx({ faceMatched: [{ loan_id: 'l2' }], faceEnrolled: [{ loan_id: 'l4' }] }));
        const denied = await collectFaceProofDenials([row('l1'), row('l2'), row('l3'), row('l4')]);
        expect(denied).toEqual([
            'Client l1: face verification has not been completed for this loan.',
            'Client l3: face verification has not been completed for this loan.',
        ]);
    });
});

describe('how it queries', () => {
    it('scopes each lookup to the loans and clients that need proof', async () => {
        answer(fx());
        await collectFaceProofDenials([row('l1'), row('l2')]);
        expect(queryFor('faceMatched').args.where).toEqual({ loan_id: { _in: ['l1', 'l2'] }, matched: { _eq: true } });
        expect(queryFor('faceEnrolled').args.where).toEqual({
            loan_id: { _in: ['l1', 'l2'] }, source: { _in: ['disbursement_first', 'disbursement_recapture'] },
        });
        expect(queryFor('faceOverrides').args.where).toEqual({
            action: { _eq: 'CLIENT_FACE_VERIFICATION_OVERRIDDEN' }, clientId: { _in: ['c-l1', 'c-l2'] },
        });
    });
    it('does not look anything up for exempt loans', async () => {
        resolveClientFlowStatus.mockResolvedValue({ 'c-l1': false });
        answer(fx());
        await collectFaceProofDenials([row('l1')]);
        expect(queried().map((q) => q.alias)).not.toContain('faceMatched');
    });
});

describe('fail-closed', () => {
    it('propagates a lookup failure so the guard can deny (enforce) or log (log)', async () => {
        graph.query.mockRejectedValue(new Error('hasura down'));
        await expect(collectFaceProofDenials([row('l1')])).rejects.toThrow('hasura down');
    });
    it('propagates a flow-status failure too', async () => {
        answer(fx());
        resolveClientFlowStatus.mockRejectedValue(new Error('flow down'));
        await expect(collectFaceProofDenials([row('l1')])).rejects.toThrow('flow down');
    });
});

describe('finalApprovalRows (pre-approvals are not disbursements)', () => {
    const rows = [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }];
    it('keeps only loans the guard rebuilt as active', () => {
        const rebuilt = [{ _id: 'a', status: 'active' }, { _id: 'b', status: 'pending', preApproved: true }];
        expect(finalApprovalRows(rows, rebuilt)).toEqual([{ _id: 'a' }]);
    });
    it('is empty when nothing is a final approval', () => {
        expect(finalApprovalRows(rows, [{ _id: 'a', status: 'pending' }])).toEqual([]);
    });
    it('is safe with missing input', () => {
        expect(finalApprovalRows(null, null)).toEqual([]);
        expect(finalApprovalRows(rows, undefined)).toEqual([]);
        expect(finalApprovalRows(rows, [null, { _id: 'a', status: 'active' }])).toEqual([{ _id: 'a' }]);
    });
});