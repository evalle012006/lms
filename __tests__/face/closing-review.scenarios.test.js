// Closing review (loan-verification/list): face status precedence, re-enrollment, pagination, error safety.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());

const { graph, findUserById, findBranches, resolveClientFlowStatus, run, answer, queried, queryFor } =
    require('../../__mocks__/face-harness');
const listApi = require('@/pages/api/v2/transactions/closing-documents/loan-verification/list').default;

const loan = (id, over = {}) => ({
    _id: id, clientId: `c-${id}`, fullName: `Client ${id}`, pnNumber: `PN-${id}`, principalLoan: 5000,
    amountRelease: 4500, groupName: 'G1', guarantorPhotoKey: 'g.jpg', guarantorIdPhotoKey: null,
    disbursementPhotoKey: 'd.jpg', disbursementPhotoAt: 't', ciReferenceCode: `CI-${id}`, ...over,
});
const attempt = (loanId, matched, over = {}) => ({
    _id: `a-${loanId}-${matched}`, loan_id: loanId, matched, confidence: matched ? 80 : 10,
    distance: 0.3, photo_key: `cap-${loanId}.jpg`, captured_at: 't', ...over,
});
const recapture = (loanId, over = {}) => ({
    _id: `r-${loanId}`, loan_id: loanId, version: 2, reason: 'blurry', created_at: 't2', approved_by: 'u7', ...over,
});
const clientRow = (id) => ({
    _id: `c-${id}`, firstName: 'Ana', lastName: 'Cruz', profile: 'p.jpg', faceEnrollPhotoKey: 'e.jpg',
    governmentIdType: 'umid', governmentIdPhotoKey: 'id.jpg', selfieWithIdPhotoKey: 's.jpg',
});
const base = (over = {}) => ({
    settings: [{ requireClientBiometric: true, requireLoanVerificationAtClosing: true }],
    pageLoans: [loan('l1')], countAgg: { aggregate: { count: 1 } },
    clients: [clientRow('l1')], ciInvestigations: [], attempts: [], reviews: [], recaptures: [], ...over,
});
const req = (q = {}, auth = { sub: 'me' }) => ({ ...(auth ? { auth } : {}), query: { branchId: 'b1', dateFor: '2026-11-02', ...q } });
const go = (fx, q, auth) => { answer(fx ?? base()); return run(listApi.get, req(q, auth)); };
const firstLoan = (body) => body.loans[0];

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset();
    findBranches.mockReset(); findBranches.mockResolvedValue([{ _id: 'b1', clientFlowVersion: 'v2' }]);
    resolveClientFlowStatus.mockReset(); resolveClientFlowStatus.mockResolvedValue({ 'c-l1': true });
    findUserById.mockReset();
    findUserById.mockImplementation(async (id) => (id === 'u7' ? { firstName: 'Bea', lastName: 'Lim' } : null));
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => console.error.mockRestore());

describe('required input and applicability', () => {
    it.each([[{ branchId: undefined }], [{ dateFor: undefined }], [{ branchId: '' }]])('rejects %j', async (q) => {
        const body = await go(base(), q);
        expect(body).toEqual({ success: false, message: 'branchId and dateFor are required.' });
        expect(graph.query).not.toHaveBeenCalled();
    });

    const NOT_APPLICABLE = { success: true, applicable: false, loans: [], page: 1, limit: 15, total: 0, totalPages: 0 };
    it('is not applicable on a v1 branch, and never queries loans', async () => {
        findBranches.mockResolvedValue([{ clientFlowVersion: 'v1' }]);
        expect(await go()).toEqual(NOT_APPLICABLE);
        expect(queryFor('pageLoans')).toBeUndefined();
    });
    it('is not applicable when the branch cannot be found', async () => {
        findBranches.mockResolvedValue([]);
        expect(await go()).toEqual(NOT_APPLICABLE);
    });
    it('is not applicable when the whole-feature kill switch is off', async () => {
        expect(await go(base({ settings: [{ requireClientBiometric: true, requireLoanVerificationAtClosing: false }] }))).toEqual(NOT_APPLICABLE);
    });
    it('defaults to applicable when there is no settings row', async () => {
        expect((await go(base({ settings: [] }))).applicable).toBe(true);
    });
    it('an empty page answers early without the batch lookups', async () => {
        const body = await go(base({ pageLoans: [], countAgg: { aggregate: { count: 0 } } }));
        expect(body).toEqual({ success: true, applicable: true, loans: [], page: 1, limit: 15, total: 0, totalPages: 0 });
        expect(queryFor('clients')).toBeUndefined();
        expect(queryFor('attempts')).toBeUndefined();
    });
});

describe('pagination and scoping', () => {
    it.each([[undefined, 15], ['0', 15], ['-5', 1], ['999', 50], ['7', 7], ['abc', 15]])(
        'limit %p → %i', async (limit, expected) => {
            expect((await go(base(), { limit })).limit).toBe(expected);
        });

    it.each([[undefined, 1, 0], ['abc', 1, 0], ['0', 1, 0], ['-2', 1, 0], ['3', 3, 20]])(
        'page %p (limit 10) → page %i, offset %i', async (page, expectedPage, offset) => {
            const body = await go(base(), { page, limit: '10' });
            expect(body.page).toBe(expectedPage);
            expect(queryFor('pageLoans').args.offset).toBe(offset);
        });

    it('computes totalPages from the count', async () => {
        const body = await go(base({ countAgg: { aggregate: { count: 45 } } }), { limit: '10' });
        expect(body).toMatchObject({ total: 45, totalPages: 5 });
    });

    it('filters to this branch, this date and active loans — for the page AND the count', async () => {
        await go();
        const where = { branchId: { _eq: 'b1' }, dateOfRelease: { _eq: '2026-11-02' }, status: { _eq: 'active' } };
        expect(queryFor('pageLoans').args.where).toEqual(where);
        expect(queryFor('countAgg').args.where).toEqual(where);
    });

    it('looks attempts and re-enrollments up for THESE loans only', async () => {
        await go(base({ pageLoans: [loan('l1'), loan('l2')], clients: [clientRow('l1'), clientRow('l2')] }));
        expect(queryFor('attempts').args.where).toEqual({ loan_id: { _in: ['l1', 'l2'] } });
        expect(queryFor('recaptures').args.where).toEqual({
            loan_id: { _in: ['l1', 'l2'] }, source: { _eq: 'disbursement_recapture' },
        });
    });

    it('skips the client and CI lookups when no loan has them', async () => {
        await go(base({ pageLoans: [loan('l1', { clientId: null, ciReferenceCode: null })] }));
        expect(queried().map(q => q.alias)).not.toContain('clients');
        expect(queried().map(q => q.alias)).not.toContain('ciInvestigations');
    });
});

describe('face verification status', () => {
    it.each([
        ['no attempts', {}, 'missing', null],
        ['only mismatches', { attempts: [attempt('l1', false)] }, 'unmatched', false],
        ['newest is a mismatch but an earlier one matched',
            { attempts: [attempt('l1', false, { _id: 'new' }), attempt('l1', true, { _id: 'old' })] }, 'matched', true],
        ['only a match', { attempts: [attempt('l1', true)] }, 'matched', true],
        ['attempts logged without a loan are ignored', { attempts: [attempt(null, true)] }, 'missing', null],
    ])('%s → %s', async (_name, over, status, attemptMatched) => {
        const f = firstLoan(await go(base(over))).faceVerify;
        expect(f.status).toBe(status);
        expect(f.recapture).toBeNull();
        if (attemptMatched === null) expect(f.attempt).toBeNull();
        else expect(f.attempt.matched).toBe(attemptMatched);
    });

    it('re-enrolled wins over unmatched, and shows the newest attempt + who approved it', async () => {
        const f = firstLoan(await go(base({ attempts: [attempt('l1', false)], recaptures: [recapture('l1')] }))).faceVerify;
        expect(f.status).toBe('re_enrolled');
        expect(f.attempt).toMatchObject({ matched: false, photoKey: 'cap-l1.jpg' });
        expect(f.recapture).toEqual({ version: 2, reason: 'blurry', createdAt: 't2', approvedByName: 'Bea Lim' });
    });

    it('re-enrolled also wins over matched, and works with no attempts at all', async () => {
        const matched = firstLoan(await go(base({ attempts: [attempt('l1', true)], recaptures: [recapture('l1')] }))).faceVerify;
        expect(matched.status).toBe('re_enrolled');
        const none = firstLoan(await go(base({ recaptures: [recapture('l1')] }))).faceVerify;
        expect(none).toMatchObject({ status: 're_enrolled', attempt: null });
    });

    it('uses the newest re-enrollment when there are several', async () => {
        const f = firstLoan(await go(base({ recaptures: [recapture('l1', { version: 3 }), recapture('l1', { version: 2 })] }))).faceVerify;
        expect(f.recapture.version).toBe(3);
    });

    it('not_required when client biometrics are off — but the re-enrollment is still shown', async () => {
        const body = await go(base({
            settings: [{ requireClientBiometric: false, requireLoanVerificationAtClosing: true }],
            recaptures: [recapture('l1')],
        }));
        expect(firstLoan(body).faceVerify).toMatchObject({ status: 'not_required', recapture: expect.objectContaining({ version: 2 }) });
    });

    it('not_required for a legacy client', async () => {
        resolveClientFlowStatus.mockResolvedValue({ 'c-l1': false });
        expect(firstLoan(await go(base({ attempts: [attempt('l1', false)] }))).faceVerify.status).toBe('not_required');
    });

    it('a client missing from the flow lookup is treated as required (fail-safe)', async () => {
        resolveClientFlowStatus.mockResolvedValue({});
        expect(firstLoan(await go()).faceVerify.status).toBe('missing');
    });

    it('statuses are computed per loan in one page', async () => {
        resolveClientFlowStatus.mockResolvedValue({ 'c-l1': true, 'c-l2': true, 'c-l3': true, 'c-l4': false });
        const body = await go(base({
            pageLoans: [loan('l1'), loan('l2'), loan('l3'), loan('l4')], countAgg: { aggregate: { count: 4 } },
            clients: ['l1', 'l2', 'l3', 'l4'].map(clientRow),
            attempts: [attempt('l1', true), attempt('l2', false)],
            recaptures: [recapture('l3')],
        }));
        expect(Object.fromEntries(body.loans.map(l => [l.loanId, l.faceVerify.status]))).toEqual({
            l1: 'matched', l2: 'unmatched', l3: 're_enrolled', l4: 'not_required',
        });
    });
});

describe('approver lookup', () => {
    it('looks each approver up once, however many loans share them', async () => {
        resolveClientFlowStatus.mockResolvedValue({ 'c-l1': true, 'c-l2': true });
        await go(base({
            pageLoans: [loan('l1'), loan('l2')], clients: [clientRow('l1'), clientRow('l2')],
            recaptures: [recapture('l1'), recapture('l2')],
        }));
        expect(findUserById).toHaveBeenCalledTimes(1);
        expect(findUserById).toHaveBeenCalledWith('u7');
    });
    it('a failing lookup shows no name but never fails the page', async () => {
        findUserById.mockRejectedValue(new Error('x'));
        const body = await go(base({ recaptures: [recapture('l1')] }));
        expect(body.success).toBe(true);
        expect(firstLoan(body).faceVerify.recapture.approvedByName).toBeNull();
    });
    it('an unknown approver shows no name; no approver means no lookup', async () => {
        const unknown = await go(base({ recaptures: [recapture('l1', { approved_by: 'gone' })] }));
        expect(firstLoan(unknown).faceVerify.recapture.approvedByName).toBeNull();
        findUserById.mockClear();
        await go(base({ recaptures: [recapture('l1', { approved_by: null })] }));
        expect(findUserById).not.toHaveBeenCalled();
    });
});

describe('the rest of the row', () => {
    it('maps the client and exposes no biometrics', async () => {
        const c = firstLoan(await go()).client;
        expect(Object.keys(c).sort()).toEqual([
            'faceEnrollPhotoKey', 'governmentIdPhotoKey', 'governmentIdType', 'id', 'name',
            'profilePhotoKey', 'selfieWithIdPhotoKey',
        ]);
        expect(c.name).toBe('Ana Cruz');
    });
    it('a loan whose client row is missing has client: null', async () => {
        expect(firstLoan(await go(base({ clients: [] }))).client).toBeNull();
    });
    it('maps the CI investigation, or reports it missing, or reports no reference', async () => {
        const found = await go(base({ ciInvestigations: [{ ciReferenceCode: 'CI-l1', selfieKey: 'sk.jpg', decision: 'approved', investigatedAt: 't', picUserName: 'BM' }] }));
        expect(firstLoan(found).ci).toEqual({ ciReferenceCode: 'CI-l1', found: true, selfieKey: 'sk.jpg', decision: 'approved', investigatedAt: 't', picUserName: 'BM' });
        expect(firstLoan(await go()).ci).toMatchObject({ ciReferenceCode: 'CI-l1', found: false });
        expect(firstLoan(await go(base({ pageLoans: [loan('l1', { ciReferenceCode: null })] }))).ci).toEqual({ ciReferenceCode: null, found: false });
    });
    it('review defaults to not acknowledged, and maps a real review', async () => {
        expect(firstLoan(await go()).review).toEqual({ acknowledged: false, acknowledgedAt: null, viewCount: 0 });
        const body = await go(base({ reviews: [{ loan_id: 'l1', acknowledged: true, acknowledged_at: 't3', view_count: 4 }] }));
        expect(firstLoan(body).review).toEqual({ acknowledged: true, acknowledgedAt: 't3', viewCount: 4 });
    });
    it("reads only the CALLER's reviews, and none when there is no caller", async () => {
        await go();
        expect(queryFor('reviews').args.where).toEqual({
            branch_id: { _eq: 'b1' }, date_for: { _eq: '2026-11-02' }, loan_id: { _in: ['l1'] }, reviewed_by: { _eq: 'me' },
        });
        graph.query.mockReset();
        await go(base(), {}, null);
        expect(queried().map(q => q.alias)).not.toContain('reviews');
    });
    it('document keys default to null', async () => {
        const body = await go(base({ pageLoans: [loan('l1', { guarantorPhotoKey: undefined, disbursementPhotoKey: undefined })] }));
        expect(firstLoan(body).documents).toMatchObject({ guarantorPhotoKey: null, disbursementPhotoKey: null });
    });
});

describe('failure safety', () => {
    it('any lookup failure answers success:false and is logged — never a 500', async () => {
        // call the handler directly: go() would install answer() and cancel the rejection
        graph.query.mockRejectedValue(new Error('boom'));
        const body = await run(listApi.get, req());
        expect(body).toEqual({ success: false, message: 'Error loading loan verification data.' });
        expect(console.error).toHaveBeenCalledWith('Error listing loan verification data:', 'boom');
    });
});