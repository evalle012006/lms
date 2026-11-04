// settings/system: who may flip the root-only switches, id guard, audit of every flip.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));

const { graph, findUserById, user, run, answer, queried } = require('../../__mocks__/face-harness');
const { logAudit } = require('@/lib/audit');
const settingsApi = require('@/pages/api/v2/settings/system').default;
const { ROOT_ONLY_SETTINGS } = require('@/pages/api/v2/settings/system');

const ROOT = user('admin', { root: true });
const body = (o = {}) => ({
    _id: 's1', companyName: 'Acme', allowFaceRecapture: true, requireClientBiometric: false,
    requireStaffBiometric: true, requireLoanVerificationAtClosing: true, ...o,
});
const BEFORE = { allowFaceRecapture: false, requireClientBiometric: true, requireStaffBiometric: true, requireLoanVerificationAtClosing: true };
const post = (b, u = ROOT, before = [BEFORE]) => {
    findUserById.mockResolvedValue(u);
    answer({ currentFlags: before });
    return run(settingsApi.post, { auth: { sub: 'sub' }, body: b });
};
const written = () => graph.mutation.mock.calls[0][0].args;

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: { settings: { returning: [{ _id: 's1', companyName: 'Acme' }] } } });
    findUserById.mockReset();
});

describe('contract', () => {
    it('the root-only list includes the new switch and the existing biometric / verification ones', () => {
        // other features add their own root-only switches (e.g. allowOfflineUpload); only require that these stay protected
        expect(ROOT_ONLY_SETTINGS).toEqual(expect.arrayContaining([
            'allowFaceRecapture', 'requireClientBiometric', 'requireStaffBiometric', 'requireLoanVerificationAtClosing',
        ]));
        expect(ROOT_ONLY_SETTINGS).not.toContain('superPwd');
    });
});

describe('GET', () => {
    it('returns the first settings row', async () => {
        answer({ settings: [{ _id: 's1', allowFaceRecapture: true }, { _id: 's2' }] });
        expect(await run(settingsApi.get, { auth: { sub: 'sub' } })).toEqual({ success: true, system: { _id: 's1', allowFaceRecapture: true } });
    });
});

describe('POST: who and what', () => {
    it('refuses an unknown caller and writes nothing', async () => {
        const res = await post(body(), null);
        expect(res).toMatchObject({ success: false, message: 'User not found.' });
        expect(graph.mutation).not.toHaveBeenCalled();
        expect(logAudit).not.toHaveBeenCalled();
    });

    it.each([[{ _id: undefined }], [{ _id: '' }], [{ _id: 5 }], [{ _id: ['s1'] }]])('refuses a bad id %j (it would match every row)', async (o) => {
        const res = await post(body(o));
        expect(res).toMatchObject({ success: false, message: '_id is required.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('keeps _id in the where and out of the set', async () => {
        await post(body());
        expect(written().where).toEqual({ _id: { _eq: 's1' } });
        expect(written().set).not.toHaveProperty('_id');
    });

    it('root can write every field, including all four switches', async () => {
        await post(body());
        expect(written().set).toEqual({
            companyName: 'Acme', allowFaceRecapture: true, requireClientBiometric: false,
            requireStaffBiometric: true, requireLoanVerificationAtClosing: true,
        });
    });

    it.each([
        ['a branch manager', user('branch_manager')],
        ['an admin who is not root', user('admin')],
        ['a loan officer', user('loan_officer')],
    ])('%s: the switches are dropped, everything else still saves', async (_n, u) => {
        const res = await post(body(), u);
        expect(res.success).toBe(true);
        expect(written().set).toEqual({ companyName: 'Acme' });
    });

    it('returns the updated row', async () => {
        expect(await post(body())).toEqual({ success: true, system: { _id: 's1', companyName: 'Acme' } });
    });
});

describe('POST: allowFaceRecapture validation', () => {
    it.each([['yes'], ['true'], [1], [null], [{}]])('root sending %p is refused', async (value) => {
        const res = await post(body({ allowFaceRecapture: value }));
        expect(res).toMatchObject({ success: false, message: 'allowFaceRecapture must be true or false.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });
    it('a non-root caller sending junk is not refused — the key is simply ignored', async () => {
        const res = await post(body({ allowFaceRecapture: 'yes' }), user('branch_manager'));
        expect(res.success).toBe(true);
        expect(written().set).not.toHaveProperty('allowFaceRecapture');
    });
    it('both true and false are accepted from root', async () => {
        expect((await post(body({ allowFaceRecapture: true }))).success).toBe(true);
        graph.mutation.mockClear();
        expect((await post(body({ allowFaceRecapture: false }), ROOT, [{ ...BEFORE, allowFaceRecapture: true }])).success).toBe(true);
    });
});

describe('POST: audit of switch changes', () => {
    it('records each switch that actually changed — who, key, from, to', async () => {
        await post(body());   // allowFaceRecapture false→true, requireClientBiometric true→false, others unchanged
        const keys = logAudit.mock.calls.map((c) => c[1].metadata.key).sort();
        expect(keys).toEqual(['allowFaceRecapture', 'requireClientBiometric']);
        const call = logAudit.mock.calls.find((c) => c[1].metadata.key === 'allowFaceRecapture')[1];
        expect(call).toMatchObject({
            action: 'SYSTEM_SETTING_CHANGED', category: 'SETTINGS', severity: 'WARNING',
            entityId: 's1', userId: 'u-admin', metadata: { key: 'allowFaceRecapture', from: false, to: true },
        });
        expect(call.description).toContain('allowFaceRecapture changed from false to true');
    });

    it('does not audit a switch that kept its value', async () => {
        await post(body({ allowFaceRecapture: false, requireClientBiometric: true }));
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('reports "from: null" when the setting had no previous value', async () => {
        await post(body({ requireClientBiometric: undefined, requireStaffBiometric: undefined, requireLoanVerificationAtClosing: undefined }),
            ROOT, [{ allowFaceRecapture: null }]);
        expect(logAudit.mock.calls[0][1].metadata).toEqual({ key: 'allowFaceRecapture', from: null, to: true });
    });

    it('audits nothing for a non-root caller (their switch values were dropped)', async () => {
        await post(body(), user('branch_manager'));
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('does not read the current switch values when none is being written', async () => {
        await post({ _id: 's1', companyName: 'Only this' });
        expect(queried().map((q) => q.alias)).not.toContain('currentFlags');
        expect(logAudit).not.toHaveBeenCalled();
    });
});