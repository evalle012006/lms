// Scenario coverage for face-verify-attempts/for-review and clients/activity.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => require('../../__mocks__/face-harness').utilsMock());

const { graph, findUserById, user, run, answer, queried, queryFor } = require('../../__mocks__/face-harness');
const { resolveClientInScope } = require('@/lib/client-scope');
const forReview = require('@/pages/api/v2/face-verify-attempts/for-review').default;
const activity  = require('@/pages/api/v2/clients/activity').default;

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    findUserById.mockReset(); findUserById.mockResolvedValue(user('branch_manager'));
    resolveClientInScope.mockResolvedValue({ _id: 'c1', branchId: 'b1' });
});

describe('face-verify-attempts/for-review', () => {
    const req = (query = { clientId: 'c1', loanId: 'l1' }) => ({ auth: { sub: 'sub' }, query });
    const attempt = (o = {}) => ({ _id: 'a1', client_id: 'c1', loan_id: 'l1', matched: false,
        photo_key: 'cap.jpg', captured_at: 't', enrollment_id: null, ...o });
    const client = { _id: 'c1', profile: 'prof.jpg', faceEnrollPhotoKey: 'current.jpg' };

    it.each([[{}], [{ clientId: 5 }], [{ clientId: '' }]])('rejects a bad clientId %j', async (q) => {
        expect(await run(forReview.get, req(q))).toMatchObject({ success: false, message: 'clientId is required.' });
        expect(graph.query).not.toHaveBeenCalled();
    });

    it('an unknown caller is refused', async () => {
        findUserById.mockResolvedValue(null);
        expect(await run(forReview.get, req())).toMatchObject({ success: false, message: 'Not allowed.' });
    });

    it.each(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager'])(
        '%s is allowed', async (code) => {
            findUserById.mockResolvedValue(user(code));
            answer({ attempts: [] });
            expect(await run(forReview.get, req())).toEqual({ success: true, attempt: null });
        });

    it('filters by client only when no loan is given, by client + loan otherwise', async () => {
        answer({ attempts: [] });
        await run(forReview.get, req({ clientId: 'c1' }));
        expect(queryFor('attempts').args.where).toEqual({ client_id: { _eq: 'c1' } });

        graph.query.mockReset(); answer({ attempts: [] });
        await run(forReview.get, req({ clientId: 'c1', loanId: 'l1' }));
        expect(queryFor('attempts').args.where).toEqual({ _and: [{ client_id: { _eq: 'c1' } }, { loan_id: { _eq: 'l1' } }] });
    });

    it('treats a loanId array as "no loan"', async () => {
        answer({ attempts: [] });
        await run(forReview.get, req({ clientId: 'c1', loanId: ['l1', 'l2'] }));
        expect(queryFor('attempts').args.where).toEqual({ client_id: { _eq: 'c1' } });
    });

    it('asks for the newest attempt only', async () => {
        answer({ attempts: [] });
        await run(forReview.get, req());
        expect(queryFor('attempts').args).toMatchObject({ order_by: [{ captured_at: 'desc' }], limit: 1 });
    });

    it('looks for re-enrollments of THIS loan only when a loan is given', async () => {
        answer({ attempts: [attempt()], clients: [client] });
        await run(forReview.get, req({ clientId: 'c1', loanId: 'l1' }));
        expect(queryFor('recaptures').args.where._and).toContainEqual({ loan_id: { _eq: 'l1' } });
        expect(queryFor('recaptures').args.where._and).toContainEqual({ source: { _eq: 'disbursement_recapture' } });

        graph.query.mockReset(); answer({ attempts: [attempt()], clients: [client] });
        await run(forReview.get, req({ clientId: 'c1' }));
        expect(queryFor('recaptures').args.where._and).not.toContainEqual({ loan_id: { _eq: 'l1' } });
    });

    it('falls back to the profile photo when the attempt\'s reference version row is gone', async () => {
        answer({ attempts: [attempt({ enrollment_id: 'e-missing' })], clients: [client], enrollments: [] });
        expect((await run(forReview.get, req())).attempt.clientEnrollmentPhotoKey).toBe('prof.jpg');
    });

    it('returns a null photo when there is no client row and no version', async () => {
        answer({ attempts: [attempt()], clients: [] });
        expect((await run(forReview.get, req())).attempt.clientEnrollmentPhotoKey).toBeNull();
    });

    it('passes the attempt\'s own fields through', async () => {
        answer({ attempts: [attempt({ matched: true })], clients: [client] });
        expect((await run(forReview.get, req())).attempt).toMatchObject({ matched: true, photo_key: 'cap.jpg', recapture: null });
    });

    it('does not look up an approver when the re-enrollment has none', async () => {
        answer({ attempts: [attempt()], clients: [client], recaptures: [{ version: 2, reason: 'r', created_at: 't', approved_by: null }] });
        const body = await run(forReview.get, req());
        expect(body.attempt.recapture.approvedByName).toBeNull();
        expect(findUserById).toHaveBeenCalledTimes(1); // only the caller
    });

    it('shows no name when the approver no longer exists', async () => {
        findUserById.mockImplementation(async (id) => (id === 'sub' ? user('branch_manager') : null));
        answer({ attempts: [attempt()], clients: [client], recaptures: [{ version: 2, reason: 'r', created_at: 't', approved_by: 'gone' }] });
        expect((await run(forReview.get, req())).attempt.recapture.approvedByName).toBeNull();
    });
});

describe('clients/activity', () => {
    const audit = (id, ts, extra = {}) => ({
        _id: id, timestamp: ts, userName: 'BM', userRole: 'BM', branchName: 'Br',
        action: 'CLIENT_UPDATED', category: 'CLIENT', severity: 'INFO', description: 'd',
        metadata: null, success: true, failReason: null, ...extra,
    });
    const attempt = (id, ts, over = {}) => ({
        _id: id, loan_id: 'l1', ci_reference_code: 'CI1', distance: 0.7, confidence: 12.4,
        matched: false, photo_key: 'k.jpg', captured_at: ts, inserted_by: 'u1', ...over,
    });
    const req = (query = {}) => ({ auth: { sub: 'sub' }, query: { clientId: 'c1', ...query } });
    const empty = { apps: [], loans: [], rows: [], attempts: [] };

    it.each([[{ clientId: undefined }], [{ clientId: 9 }], [{ clientId: '' }]])('rejects a bad clientId %j', async (q) => {
        expect(await run(activity.get, req(q))).toMatchObject({ success: false, message: 'clientId required.' });
    });

    it('an unknown caller is refused', async () => {
        findUserById.mockResolvedValue(null);
        expect(await run(activity.get, req())).toMatchObject({ success: false, message: 'Not allowed.' });
    });

    it.each([
        [undefined, 31], ['abc', 31], ['0', 31], ['7', 8], ['500', 101], ['-5', 2],
    ])('limit %p fetches %i rows per source (limit + 1 to detect more)', async (limit, expected) => {
        answer(empty);
        await run(activity.get, req({ limit }));
        expect(queryFor('rows').args.limit).toBe(expected);
        expect(queryFor('attempts').args.limit).toBe(expected);
    });

    it('applies a valid cursor to both sources and ignores an invalid one', async () => {
        answer(empty);
        await run(activity.get, req({ before: '2026-10-02T00:00:00.000Z' }));
        expect(queryFor('rows').args.where._and).toContainEqual({ timestamp: { _lt: '2026-10-02T00:00:00.000Z' } });
        expect(queryFor('attempts').args.where._and).toContainEqual({ captured_at: { _lt: '2026-10-02T00:00:00.000Z' } });

        graph.query.mockReset(); answer(empty);
        await run(activity.get, req({ before: 'nonsense' }));
        expect(JSON.stringify(queryFor('rows').args.where)).not.toContain('_lt');
        expect(JSON.stringify(queryFor('attempts').args.where)).not.toContain('_lt');
    });

    it('BIOMETRIC includes face attempts and filters the audit rows', async () => {
        answer(empty);
        await run(activity.get, req({ category: 'BIOMETRIC' }));
        expect(queried().map(q => q.alias)).toContain('attempts');
        expect(queryFor('rows').args.where._and).toContainEqual({ category: { _eq: 'BIOMETRIC' } });
    });

    it('another category excludes face attempts', async () => {
        answer(empty);
        await run(activity.get, req({ category: 'LAF' }));
        expect(queried().map(q => q.alias)).not.toContain('attempts');
        expect(queryFor('rows').args.where._and).toContainEqual({ category: { _eq: 'LAF' } });
    });

    it('ignores a repeated ?category= (array) and an empty one — no filter, attempts included', async () => {
        for (const category of [['LAF', 'LOAN'], '']) {
            graph.query.mockReset(); answer(empty);
            await run(activity.get, req({ category }));
            expect(JSON.stringify(queryFor('rows').args.where)).not.toContain('"category"');
            expect(queried().map(q => q.alias)).toContain('attempts');
        }
    });

    it('hides page views for anything but includeViews=true', async () => {
        for (const includeViews of [undefined, 'false', 'TRUE', '1']) {
            graph.query.mockReset(); answer(empty);
            await run(activity.get, req({ includeViews }));
            expect(queryFor('rows').args.where._and).toContainEqual({ action: { _nin: ['LAF_DETAIL_VIEWED'] } });
        }
    });

    it('returns an empty, finished timeline when there is nothing', async () => {
        answer(empty);
        expect(await run(activity.get, req())).toEqual({ success: true, events: [], hasMore: false, nextBefore: null });
    });

    it('is finished (no cursor) when everything fits in one page', async () => {
        answer({ ...empty, rows: [audit('A1', '2026-10-03T00:00:00Z')], attempts: [attempt('F1', '2026-10-02T00:00:00Z')] });
        const body = await run(activity.get, req());
        expect(body.events).toHaveLength(2);
        expect(body.hasMore).toBe(false);
        expect(body.nextBefore).toBeNull();
    });

    it.each([
        ['match',      { matched: true,  confidence: 91.6 }, 'FACE_VERIFY_MATCH',    'INFO',    'matched (confidence 92%)'],
        ['mismatch',   { matched: false, confidence: 12.4 }, 'FACE_VERIFY_MISMATCH', 'WARNING', 'did not match (confidence 12%)'],
        ['no score',   { matched: false, confidence: null }, 'FACE_VERIFY_MISMATCH', 'WARNING', 'did not match'],
        ['zero score', { matched: true,  confidence: 0 },    'FACE_VERIFY_MATCH',    'INFO',    '(confidence 0%)'],
        ['string score',{ matched: false, confidence: '12.4' }, 'FACE_VERIFY_MISMATCH', 'WARNING', '(confidence 12%)'],
        ['enrollment', { matched: null,  confidence: null }, 'FACE_CAPTURED',        'INFO',    'Face captured for enrollment'],
        ['enrollment (undefined)', { matched: undefined, confidence: undefined }, 'FACE_CAPTURED', 'INFO', 'Face captured for enrollment'],
    ])('face attempt: %s', async (_n, over, action, severity, text) => {
        answer({ ...empty, attempts: [attempt('F1', '2026-10-02T00:00:00Z', over)] });
        const [event] = (await run(activity.get, req())).events;
        expect(event).toMatchObject({ action, severity, category: 'BIOMETRIC', photoKey: 'k.jpg' });
        expect(event.description).toContain(text);
    });

    it('carries only loan / CI reference as face-attempt meta, and null when neither exists', async () => {
        answer({ ...empty, attempts: [attempt('F1', '2026-10-02T00:00:00Z', { ci_reference_code: null })] });
        expect((await run(activity.get, req())).events[0].meta).toEqual({ loanId: 'l1' });
        graph.query.mockReset();
        answer({ ...empty, attempts: [attempt('F2', '2026-10-02T00:00:00Z', { ci_reference_code: null, loan_id: null })] });
        expect((await run(activity.get, req())).events[0].meta).toBeNull();
    });

    it('maps failed audit rows and defaults severity', async () => {
        answer({ ...empty, rows: [audit('A1', '2026-10-03T00:00:00Z', { success: false, failReason: 'nope', severity: null })] });
        const [event] = (await run(activity.get, req())).events;
        expect(event).toMatchObject({ success: false, failReason: 'nope', severity: 'INFO' });
    });

    it('treats a null success as success', async () => {
        answer({ ...empty, rows: [audit('A1', '2026-10-03T00:00:00Z', { success: null })] });
        expect((await run(activity.get, req())).events[0].success).toBe(true);
    });

    it('keeps whitelisted metadata (including arrays) and returns null when nothing qualifies', async () => {
        answer({ ...empty, rows: [
            audit('A1', '2026-10-03T00:00:00Z', { metadata: { changedFields: ['groupLeader'], approvedBy: 'u9' } }),
            audit('A2', '2026-10-02T00:00:00Z', { metadata: { approvedBy: 'u9', token: 'x' } }),
            audit('A3', '2026-10-01T00:00:00Z', { metadata: null }),
        ] });
        const events = (await run(activity.get, req())).events;
        expect(events[0].meta).toEqual({ changedFields: ['groupLeader'] });
        expect(events[1].meta).toBeNull();
        expect(events[2].meta).toBeNull();
    });
});