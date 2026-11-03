// Scenario coverage for clients/index (GET + POST): scope, biometrics, partial updates, audit, notifications.
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/client-scope', () => ({ resolveClientInScope: jest.fn() }));
jest.mock('@/lib/ci-scope', () => ({ ...jest.requireActual('@/lib/ci-scope'), resolveBranchWhere: jest.fn() }));
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/lib/utils', () => require('../../__mocks__/face-harness').utilsMock());
jest.mock('@/lib/notification-service', () => ({
    notifyGroupLeaderUpdated: jest.fn(), notifyClientDelinquent: jest.fn(), isNotificationEnabled: jest.fn(),
}));
jest.mock('@/lib/date-utils', () => ({ getCurrentDate: jest.fn() }));
jest.mock('formidable', () => ({
    IncomingForm: function IncomingForm() { return { parse: (req, cb) => cb(null, global.__formFields, {}) }; },
}));

const { graph, findUserById, findBranches, findGroups, ZERO, user, run, answer } = require('../../__mocks__/face-harness');
const { resolveClientInScope } = require('@/lib/client-scope');
const { resolveBranchWhere } = require('@/lib/ci-scope');
const { logAudit } = require('@/lib/audit');
const notif = require('@/lib/notification-service');
const clientsApi = require('@/pages/api/v2/clients/index').default;

const row = (over = {}) => ({
    _id: 'c1', firstName: 'Ana', lastName: 'Cruz', branchId: 'b1', groupId: 'g1', loId: 'lo1', status: 'active',
    groupLeader: false, delinquent: false, duplicate: false, archived: false,
    profile: 'p.jpg', faceTemplate: JSON.stringify(ZERO), qrToken: 'qr', loans: [{ _id: 'l1' }], ...over,
});
const post = (fields) => { global.__formFields = fields; return run(clientsApi.post, { auth: { sub: 'sub' }, headers: {} }); };
const get  = (query = { clientId: 'c1' }) => run(clientsApi.get, { auth: { sub: 'sub' }, query });
const written = () => graph.mutation.mock.calls[0][0].args;

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: {} });
    findUserById.mockReset(); findUserById.mockResolvedValue(user('branch_manager'));
    resolveClientInScope.mockImplementation(async (u, id) => (typeof id === 'string' && id ? { _id: id, branchId: 'b1' } : null));
    resolveBranchWhere.mockResolvedValue({});
    notif.isNotificationEnabled.mockResolvedValue(false);
    notif.notifyGroupLeaderUpdated.mockResolvedValue();
    notif.notifyClientDelinquent.mockResolvedValue();
    findBranches.mockResolvedValue([{ name: 'Br' }]);
    findGroups.mockResolvedValue([{ name: 'Grp' }]);
    answer({ clients: [row()] });
    jest.spyOn(console, 'error').mockImplementation(() => {});   // two tests fail on purpose; keep the output readable
});

afterEach(() => console.error.mockRestore());

describe('GET', () => {
    it('no clientId reads as not-found', async () => {
        expect(await get({})).toEqual({ success: true, client: null });
    });
    it('in scope but gone from the database reads as not-found', async () => {
        answer({ clients: [] });
        expect(await get()).toEqual({ success: true, client: null });
    });
    it('keeps everything except the face template', async () => {
        const { client } = await get();
        expect(client).not.toHaveProperty('faceTemplate');
        expect(client).toMatchObject({ _id: 'c1', profile: 'p.jpg', qrToken: 'qr', loans: [{ _id: 'l1' }] });
    });
    it('an unknown caller gets success:false', async () => {
        findUserById.mockResolvedValue(null);
        expect(await get()).toMatchObject({ success: false, message: 'User not found.' });
    });
});

describe('POST: who and what', () => {
    it('an unknown caller is refused and nothing is written', async () => {
        findUserById.mockResolvedValue(null);
        expect(await post({ _id: 'c1', groupLeader: 'true' })).toMatchObject({ success: false, message: 'User not found.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('out-of-scope and truly-missing clients are indistinguishable', async () => {
        resolveClientInScope.mockResolvedValue(null);
        const a = await post({ _id: 'c1', groupLeader: 'true' });
        resolveClientInScope.mockImplementation(async () => ({ _id: 'c1', branchId: 'b1' }));
        answer({ clients: [] });
        const b = await post({ _id: 'c1', groupLeader: 'true' });
        expect(b).toEqual(a);
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it('a partial update leaves every omitted field exactly as it was', async () => {
        await post({ _id: 'c1', groupLeader: 'true' });
        expect(written().where).toEqual({ _id: { _eq: 'c1' } });
        expect(written().set).toMatchObject({
            firstName: 'Ana', lastName: 'Cruz', branchId: 'b1', groupId: 'g1', loId: 'lo1',
            status: 'active', groupLeader: true, delinquent: false, archived: false, profile: 'p.jpg',
        });
        expect(written().set.dateModified).toBeDefined();
    });

    it('literal "null" / "undefined" strings fall back to the existing values', async () => {
        await post({ _id: 'c1', firstName: 'undefined', contactNumber: 'null' });
        expect(written().set.firstName).toBe('Ana');
        expect(written().set.contactNumber).toBe('');
    });

    it.each([
        [false, 'true', true], [false, '1', true], [true, 'false', false], [true, '0', false],
        [true, '', true], [true, 'garbage', true], [false, 'null', false], [true, 'undefined', true],
    ])('groupLeader %s + input %j → %s', async (initial, input, expected) => {
        answer({ clients: [row({ groupLeader: initial })] });
        await post({ _id: 'c1', groupLeader: input });
        expect(written().set.groupLeader).toBe(expected);
    });

    it('never echoes the face template back', async () => {
        expect((await post({ _id: 'c1', groupLeader: 'true' })).client).not.toHaveProperty('faceTemplate');
    });
});

describe('POST: moving a client between branches', () => {
    it('a save that keeps the same branch does no scope lookup', async () => {
        await post({ _id: 'c1', branchId: 'b1', groupLeader: 'true' });
        expect(resolveBranchWhere).not.toHaveBeenCalled();
    });
    it('a literal "null" branch means "unchanged"', async () => {
        await post({ _id: 'c1', branchId: 'null', groupLeader: 'true' });
        expect(resolveBranchWhere).not.toHaveBeenCalled();
        expect(written().set.branchId).toBe('b1');
    });
    it('an unscoped caller (admin) may move a client anywhere', async () => {
        resolveBranchWhere.mockResolvedValue({});
        expect((await post({ _id: 'c1', branchId: 'b9' })).success).toBe(true);
    });
    it('a caller with no scope at all is refused', async () => {
        resolveBranchWhere.mockResolvedValue(null);
        const body = await post({ _id: 'c1', branchId: 'b2' });
        expect(body.message).toMatch(/outside your scope/);
        expect(graph.mutation).not.toHaveBeenCalled();
    });
    it('a scoped caller may move within scope but not outside it', async () => {
        resolveBranchWhere.mockResolvedValue({ branchId: { _in: ['b1', 'b2'] } });
        expect((await post({ _id: 'c1', branchId: 'b2' })).success).toBe(true);
        graph.mutation.mockClear();
        expect((await post({ _id: 'c1', branchId: 'b3' })).success).toBe(false);
        expect(graph.mutation).not.toHaveBeenCalled();
    });
});

describe('POST: audit trail', () => {
    it('lists every changed field in one entry, in a stable order', async () => {
        await post({ _id: 'c1', contactNumber: '0917', groupLeader: 'true', delinquent: 'true' });
        expect(logAudit).toHaveBeenCalledTimes(1);
        const audit = logAudit.mock.calls[0][1];
        expect(audit.metadata.changedFields).toEqual(['contactNumber', 'delinquent', 'groupLeader']);
        expect(audit.afterData).toEqual({ contactNumber: '0917', delinquent: true, groupLeader: true });
        // the fixture row has no contactNumber at all, so "before" is absent → null in the audit entry
        expect(audit.beforeData).toEqual({ contactNumber: null, delinquent: false, groupLeader: false });
    });

    it('archiving is a WARNING', async () => {
        await post({ _id: 'c1', archived: 'true' });
        expect(logAudit.mock.calls[0][1]).toMatchObject({ severity: 'WARNING', action: 'CLIENT_UPDATED' });
    });

    it('a profile change and a field change produce two separate entries', async () => {
        await post({ _id: 'c1', profile: 'new.jpg', groupLeader: 'true' });
        expect(logAudit.mock.calls.map(c => c[1].action)).toEqual(['CLIENT_UPDATED', 'CLIENT_PROFILE_PHOTO_CHANGED']);
    });

    it('carries the branch and the acting user', async () => {
        await post({ _id: 'c1', groupLeader: 'true' });
        expect(logAudit.mock.calls[0][1]).toMatchObject({ branchId: 'b1', userId: 'u-branch_manager', userName: 'Test branch_manager' });
    });

    it('does not audit a save that changes nothing', async () => {
        await post({ _id: 'c1' });
        expect(logAudit).not.toHaveBeenCalled();
    });

    it('an audit failure never breaks the update', async () => {
        logAudit.mockImplementationOnce(() => { throw new Error('audit down'); });
        const body = await post({ _id: 'c1', groupLeader: 'true' });
        expect(body.success).toBe(true);
        expect(graph.mutation).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalledWith('[clients] audit failed:', 'audit down');
    });
});

describe('POST: notifications (existing behaviour must not regress)', () => {
    beforeEach(() => notif.isNotificationEnabled.mockResolvedValue(true));

    it('notifies when a client becomes group leader, and not when nothing flipped', async () => {
        await post({ _id: 'c1', groupLeader: 'true' });
        expect(notif.notifyGroupLeaderUpdated).toHaveBeenCalledTimes(1);
        expect(notif.notifyGroupLeaderUpdated.mock.calls[0][0]).toMatchObject({ isGroupLeader: true, branchName: 'Br', groupName: 'Grp' });
        notif.notifyGroupLeaderUpdated.mockClear();
        await post({ _id: 'c1', groupLeader: 'false' });
        expect(notif.notifyGroupLeaderUpdated).not.toHaveBeenCalled();
    });

    it('notifies when a client becomes delinquent, not when already delinquent or recovering', async () => {
        await post({ _id: 'c1', delinquent: 'true' });
        expect(notif.notifyClientDelinquent).toHaveBeenCalledTimes(1);

        notif.notifyClientDelinquent.mockClear();
        answer({ clients: [row({ delinquent: true })] });
        await post({ _id: 'c1', delinquent: 'true' });
        await post({ _id: 'c1', delinquent: 'false' });
        expect(notif.notifyClientDelinquent).not.toHaveBeenCalled();
    });

    it('sends nothing when notifications are disabled', async () => {
        notif.isNotificationEnabled.mockResolvedValue(false);
        await post({ _id: 'c1', groupLeader: 'true', delinquent: 'true' });
        expect(notif.notifyGroupLeaderUpdated).not.toHaveBeenCalled();
        expect(notif.notifyClientDelinquent).not.toHaveBeenCalled();
    });

    it('a failing notification never fails the update', async () => {
        notif.notifyClientDelinquent.mockRejectedValue(new Error('smtp down'));
        expect((await post({ _id: 'c1', delinquent: 'true' })).success).toBe(true);
        expect(console.error).toHaveBeenCalledWith('Failed to send delinquent notification:', expect.any(Error));
    });
});