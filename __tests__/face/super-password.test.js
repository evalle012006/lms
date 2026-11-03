jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h }));
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/graph.functions',      () => require('../../__mocks__/face-harness').graphFunctionsMock());
jest.mock('@/lib/audit', () => ({ logAudit: jest.fn() }));
jest.mock('@/logger', () => ({ __esModule: true, default: { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() } }));
jest.mock('next/config', () => () => ({ serverRuntimeConfig: { secret: 'test-secret' } }));
jest.mock('@/lib/date-utils', () => ({ getCurrentDate: jest.fn(() => '2026-11-02') }));

const bcrypt = require('bcryptjs');
const { graph, findUserById, user, call, run, answer, queried } = require('../../__mocks__/face-harness');
const { logAudit } = require('@/lib/audit');
const access = require('@/lib/super-password-access');
const settingsApi = require('@/pages/api/v2/settings/system').default;
const { ROOT_ONLY_SETTINGS } = require('@/pages/api/v2/settings/system');
const secretApi = require('@/pages/api/v2/settings/super-password').default;
const authApi = require('@/pages/api/v2/authenticate').default;

const ROOT = user('admin', { root: true });
const OLD = 'Old-Master-Pass1';
const NEW = 'N3w-Master-Pass!';

beforeEach(() => {
    jest.clearAllMocks();
    graph.query.mockReset(); graph.mutation.mockReset();
    graph.mutation.mockResolvedValue({ data: { settings: { returning: [{ _id: 's1', companyName: 'Acme' }] } } });
    findUserById.mockReset();
});

describe('access rule', () => {
    it('root only', () => {
        expect(access.canManageSuperPassword({ root: true })).toBe(true);
        expect(access.canManageSuperPassword(user('admin'))).toBe(false);          // admin shortCode, not root
        expect(access.canManageSuperPassword(user('branch_manager'))).toBe(false);
        expect(access.canManageSuperPassword(null)).toBe(false);
    });
    it('length limits', () => {
        expect([access.SUPER_PASSWORD_MIN_LENGTH, access.SUPER_PASSWORD_MAX_LENGTH]).toEqual([12, 128]);
    });
    it('is not in the root-only switch list, so its value can never reach the switch audit entries', () => {
        expect(ROOT_ONLY_SETTINGS).not.toContain('superPwd');
    });
});

describe('the general settings API never returns it', () => {
    it('GET strips it even when the row has it', async () => {
        answer({ settings: [{ _id: 's1', companyName: 'Acme', superPwd: OLD }] });
        const body = await run(settingsApi.get, { auth: { sub: 'sub' } });
        expect(body).toEqual({ success: true, system: { _id: 's1', companyName: 'Acme' } });
        expect(JSON.stringify(body)).not.toContain(OLD);
    });
    it('POST strips it from the echoed row', async () => {
        findUserById.mockResolvedValue(ROOT);
        answer({ currentFlags: [], currentSecret: [{ superPwd: OLD }] });
        graph.mutation.mockResolvedValue({ data: { settings: { returning: [{ _id: 's1', superPwd: NEW }] } } });
        const body = await run(settingsApi.post, { auth: { sub: 'sub' }, body: { _id: 's1', companyName: 'Acme', superPwd: NEW } });
        expect(body.success).toBe(true);
        expect(JSON.stringify(body)).not.toContain(NEW);
    });
});

describe('writing the super password', () => {
    const post = (b, u = ROOT, was = null) => {
        findUserById.mockResolvedValue(u);
        answer({ currentFlags: [], currentSecret: was === undefined ? [] : [{ superPwd: was }] });
        return run(settingsApi.post, { auth: { sub: 'sub' }, body: { _id: 's1', companyName: 'Acme', ...b } });
    };
    const written = () => graph.mutation.mock.calls[0][0].args;
    const secretAudit = () => logAudit.mock.calls.map((c) => c[1]).find((a) => a.action === 'SYSTEM_SECRET_CHANGED');

    it.each([
        ['set',     null, NEW],
        ['changed', OLD,  NEW],
        ['cleared', OLD,  ''],
    ])('root: %s', async (change, was, sent) => {
        expect((await post({ superPwd: sent }, ROOT, was)).success).toBe(true);
        expect(written().set.superPwd).toBe(sent === '' ? null : sent);
        expect(secretAudit()).toMatchObject({ severity: 'CRITICAL', metadata: { key: 'superPwd', change } });
    });

    it('never puts a value (old or new) in the audit log', async () => {
        await post({ superPwd: NEW }, ROOT, OLD);
        // inspect only what is written to the audit log (argument 2) — argument 1 is the request itself,
        // which of course carries the submitted value
        const dump = JSON.stringify(logAudit.mock.calls.map((c) => c[1]));
        expect(dump).not.toContain(NEW);
        expect(dump).not.toContain(OLD);
    });

    it('an unchanged value is not rewritten or audited', async () => {
        await post({ superPwd: OLD }, ROOT, OLD);
        expect(written().set).toEqual({ companyName: 'Acme' });
        expect(secretAudit()).toBeUndefined();
    });

    it('clearing something that is already empty is a no-op', async () => {
        await post({ superPwd: '' }, ROOT, null);
        expect(written().set).toEqual({ companyName: 'Acme' });
        expect(secretAudit()).toBeUndefined();
    });

    it('a legacy short value that is left unchanged never blocks saving the rest of the form', async () => {
        expect((await post({ superPwd: 'short' }, ROOT, 'short')).success).toBe(true);
    });

    it.each([
        ['too short (11)', 'a'.repeat(11)],
        ['too long (129)', 'a'.repeat(129)],
        ['a number', 12345678901234],
        ['an array', ['a'.repeat(20)]],
    ])('refuses a new value that is %s', async (_n, value) => {
        const res = await post({ superPwd: value }, ROOT, OLD);
        expect(res).toMatchObject({ success: false, message: 'The super password must be between 12 and 128 characters.' });
        expect(graph.mutation).not.toHaveBeenCalled();
    });

    it.each([['12 characters', 'a'.repeat(12)], ['128 characters', 'a'.repeat(128)]])('accepts %s', async (_n, value) => {
        expect((await post({ superPwd: value }, ROOT, OLD)).success).toBe(true);
    });

    it.each([['a non-root admin', user('admin')], ['a branch manager', user('branch_manager')]])(
        '%s: the value is dropped and the secret is never even read', async (_n, u) => {
            const res = await post({ superPwd: NEW }, u, OLD);
            expect(res.success).toBe(true);
            expect(written().set).toEqual({ companyName: 'Acme' });
            expect(queried().map((q) => q.alias)).not.toContain('currentSecret');
            expect(secretAudit()).toBeUndefined();
        });

    it('the secret is not read when none is sent', async () => {
        await post({});
        expect(queried().map((q) => q.alias)).not.toContain('currentSecret');
    });
});

describe('settings/super-password (the Settings → System page only)', () => {
    const get = (u, rows = [{ _id: 's1', superPwd: OLD }]) => {
        findUserById.mockResolvedValue(u);
        answer({ superPwdRow: rows });
        return call(secretApi.get, { auth: { sub: 'sub' } });
    };

    it('root gets the value, uncached, and the view is audited without the value', async () => {
        const res = await get(ROOT);
        expect(res.body).toEqual({ success: true, superPwd: OLD });
        expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
        const audit = logAudit.mock.calls[0][1];
        expect(audit).toMatchObject({ action: 'SYSTEM_SECRET_VIEWED', severity: 'WARNING', userId: 'u-admin' });
        expect(JSON.stringify(audit)).not.toContain(OLD);
    });
    it('no row means null', async () => {
        expect((await get(ROOT, [])).body).toEqual({ success: true, superPwd: null });
    });
    it.each([['a non-root admin', user('admin')], ['an area admin', user('area_admin')], ['a loan officer', user('loan_officer')]])(
        '%s is refused before anything is read or logged', async (_n, u) => {
            const res = await get(u);
            expect(res.body).toMatchObject({ success: false, message: 'Not allowed.' });
            expect(graph.query).not.toHaveBeenCalled();
            expect(logAudit).not.toHaveBeenCalled();
        });
    it('an unknown caller is refused', async () => {
        expect((await get(null)).body).toMatchObject({ success: false, message: 'User not found.' });
    });
});

describe('login still supports the super password (regression guard)', () => {
    const hash = (pw) => bcrypt.hashSync(pw, 4);
    const person = (over = {}) => ({
        _id: 'u1', email: 'a@b.c', status: 'active', password: hash('RealPass#1'), loginAttempts: 0,
        lockedUntil: null, root: false, role: { shortCode: 'branch_manager' }, firstName: 'A', lastName: 'B', ...over,
    });
    // authenticate caches the settings row for 5 minutes; it exports clearSettingsCache() for exactly this
    const { clearSettingsCache } = require('@/pages/api/v2/authenticate');
    const login = ({ password, users, settings }) => {
        clearSettingsCache();
        answer({ users, settings: settings ? [settings] : [] });
        return run(authApi.post, { body: { username: 'a@b.c', password }, headers: {} });
    };
    // toMatchObject prints the whole response when it fails, so a failure here says WHY

    it('wiring check: the handler is reached and reads the user query', async () => {
        const body = await login({ password: 'RealPass#1', users: [], settings: null });
        expect(body).toMatchObject({ error: true, message: 'Email or Password is incorrect' });
    });

    it("the user's own password works", async () => {
        const body = await login({ password: 'RealPass#1', users: [person()], settings: { superPwd: OLD } });
        expect(body).toMatchObject({ success: true });
        expect(body.user.token).toEqual(expect.any(String));
    });

    it('the configured super password logs in a non-root user', async () => {
        const body = await login({ password: OLD, users: [person()], settings: { superPwd: OLD } });
        expect(body).toMatchObject({ success: true });
    });

    it('…but never a root user', async () => {
        const body = await login({ password: OLD, users: [person({ root: true })], settings: { superPwd: OLD } });
        expect(body).not.toMatchObject({ success: true });
    });

    it('with no super password configured, the old value does not work', async () => {
        const body = await login({ password: OLD, users: [person()], settings: null });
        expect(body).not.toMatchObject({ success: true });
    });

    it('an empty super password never matches an empty login password', async () => {
        const body = await login({ password: '', users: [person()], settings: { superPwd: '' } });
        expect(body).not.toMatchObject({ success: true });
    });
});