// __tests__/face/face-lib.test.js
// Pure units: recapture roles, audit redaction + clientId derivation, camera stream hygiene.
jest.mock('@/lib/graph/graph.provider', () => {
    const shared = { query: jest.fn(), mutation: jest.fn() };
    return { GraphProvider: function GraphProvider() { return shared; }, __shared: shared };
});
jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (table) => (alias) => ({ table, alias: alias || table }),
    insertQl: (type, args) => ({ op: 'insert', ...type, args }),
}));
jest.mock('@/lib/utils', () => ({ generateUUID: () => 'uuid-1' }));

const { __shared: graph } = require('@/lib/graph/graph.provider');
const { logAudit } = require('@/lib/audit');
const { redactBiometrics, REDACTED } = require('@/lib/audit-redact');
const utils = require('@/lib/face-recapture-utils');
const { CI_DECISION_ROLES } = require('@/lib/ci-roles');
const { openCameraStream, stopStream } = require('@/lib/camera-stream');

const user = (shortCode, extra = {}) => ({ role: { shortCode }, ...extra });

describe('canApproveFaceRecapture', () => {
    it.each(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager'])(
        'allows %s', (code) => expect(utils.canApproveFaceRecapture(user(code))).toBe(true));

    it.each(['loan_officer', 'cashier', 'staff', undefined])(
        'refuses %s', (code) => expect(utils.canApproveFaceRecapture(user(code))).toBe(false));

    it('allows root, like every other CI decision', () => {
        expect(utils.canApproveFaceRecapture({ root: true, role: { shortCode: 'loan_officer' } })).toBe(true);
    });

    it('refuses a missing user', () => {
        expect(utils.canApproveFaceRecapture(null)).toBe(false);
        expect(utils.canApproveFaceRecapture(undefined)).toBe(false);
    });

    it('stays in lock-step with the CI decision roles (change both on purpose, not by accident)', () => {
        expect(CI_DECISION_ROLES).toEqual(['admin', 'deputy_director', 'regional_manager', 'area_admin', 'branch_manager']);
    });

    it('has sane limits', () => {
        expect(utils.MIN_MISMATCHES_FOR_RECAPTURE).toBeGreaterThanOrEqual(2);
        expect(utils.MAX_RECAPTURES_PER_LOAN).toBeGreaterThanOrEqual(1);
        expect(utils.MIN_RECAPTURE_REASON_LENGTH).toBeGreaterThanOrEqual(10);
        expect(utils.FACE_MATCH_THRESHOLD).toBe(0.5);
    });
});

describe('redactBiometrics', () => {
    it('redacts templates and public keys at any depth, keeps photo keys and normal fields', () => {
        const out = redactBiometrics({
            client: { firstName: 'Ana', faceTemplate: '[0.1,0.2]', faceEnrollPhotoKey: 'k.jpg' },
            application: { biometricPublicKey: 'pk', nested: { face_template: [1, 2, 3] } },
        });
        expect(out.client.faceTemplate).toBe(REDACTED);
        expect(out.client.firstName).toBe('Ana');
        expect(out.client.faceEnrollPhotoKey).toBe('k.jpg');
        expect(out.application.biometricPublicKey).toBe(REDACTED);
        expect(out.application.nested.face_template).toBe(REDACTED);
    });

    it('does not mutate its input', () => {
        const input = { a: { faceTemplate: 'x' } };
        redactBiometrics(input);
        expect(input.a.faceTemplate).toBe('x');
    });

    it('walks arrays', () => {
        const out = redactBiometrics([{ faceTemplate: 'x' }, { ok: 1 }]);
        expect(out[0].faceTemplate).toBe(REDACTED);
        expect(out[1]).toEqual({ ok: 1 });
    });

    it('truncates huge strings (base64 payloads)', () => {
        expect(redactBiometrics({ offlinePayload: 'A'.repeat(6000) }).offlinePayload).toBe('[truncated 6000 chars]');
    });

    it('passes through null, undefined, primitives and Dates', () => {
        const d = new Date();
        expect(redactBiometrics(null)).toBeNull();
        expect(redactBiometrics(undefined)).toBeUndefined();
        expect(redactBiometrics(5)).toBe(5);
        expect(redactBiometrics({ at: d }).at).toBe(d);
    });

    it('leaves a null template alone (nothing to hide)', () => {
        expect(redactBiometrics({ faceTemplate: null }).faceTemplate).toBeNull();
    });
});

describe('logAudit', () => {
    const req = { headers: {}, auth: { sub: 'u1' } };
    const entry = () => graph.mutation.mock.calls[0][0].args.objects[0];

    beforeEach(() => {
        graph.mutation.mockReset();
        graph.mutation.mockResolvedValue({});
    });

    it('uses the entity id as clientId for client entities', async () => {
        await logAudit(req, { action: 'X', category: 'CLIENT', entityType: 'client', entityId: 'c1' });
        expect(entry().clientId).toBe('c1');
    });

    it('prefers an explicit clientId', async () => {
        await logAudit(req, { action: 'X', category: 'CLIENT', entityType: 'client', entityId: 'c1', clientId: 'c2' });
        expect(entry().clientId).toBe('c2');
    });

    it('falls back to metadata.clientId', async () => {
        await logAudit(req, { action: 'X', category: 'CI', entityType: 'temporaryLoanApplication', entityId: 't1', metadata: { clientId: 'c9' } });
        expect(entry().clientId).toBe('c9');
    });

    it('leaves clientId null otherwise (the DB trigger resolves loan / LAF entities)', async () => {
        await logAudit(req, { action: 'X', category: 'LOAN', entityType: 'loan', entityId: 'l1' });
        expect(entry().clientId).toBeNull();
    });

    it('never stores face templates in beforeData / afterData / metadata', async () => {
        await logAudit(req, {
            action: 'LAF_PROMOTION_REVERTED_GHOST_CLIENT', category: 'CI',
            beforeData: { client: { firstName: 'Ana', faceTemplate: 'TEMPLATE' }, application: { faceTemplate: [1, 2], faceEnrollPhotoKey: 'k' } },
            afterData: { faceTemplate: 'TEMPLATE' },
            metadata: { biometricPublicKey: 'pk', reason: 'r' },
        });
        const e = entry();
        expect(JSON.stringify(e)).not.toContain('TEMPLATE');
        expect(e.beforeData.client.faceTemplate).toBe(REDACTED);
        expect(e.beforeData.client.firstName).toBe('Ana');
        expect(e.beforeData.application.faceEnrollPhotoKey).toBe('k');
        expect(e.metadata.biometricPublicKey).toBe(REDACTED);
        expect(e.metadata.reason).toBe('r');
    });
});

describe('openCameraStream', () => {
    const fakeStream = () => {
        const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }];
        return { tracks, getTracks: () => tracks };
    };
    const setGum = (impl) => Object.defineProperty(global, 'navigator', {
        value: { mediaDevices: { getUserMedia: impl } }, configurable: true, writable: true,
    });

    it('returns the stream and remembers it when the caller is still mounted', async () => {
        const s = fakeStream();
        setGum(async () => s);
        const streamRef = { current: null };
        await expect(openCameraStream({ streamRef, isActive: () => true, constraints: {} })).resolves.toBe(s);
        expect(streamRef.current).toBe(s);
        s.tracks.forEach(t => expect(t.stop).not.toHaveBeenCalled());
    });

    it('stops the stream if the component unmounted while the camera was opening (the Try Again leak)', async () => {
        const s = fakeStream();
        let resolveGum;
        setGum(() => new Promise((r) => { resolveGum = r; }));
        const streamRef = { current: null };
        let active = true;

        const pending = openCameraStream({ streamRef, isActive: () => active, constraints: {} });
        active = false;      // unmount happens first…
        resolveGum(s);       // …then getUserMedia resolves

        await expect(pending).resolves.toBeNull();
        s.tracks.forEach(t => expect(t.stop).toHaveBeenCalled());
        expect(streamRef.current).toBeNull();
    });

    it('does not orphan the first stream when opened twice (double click)', async () => {
        const s1 = fakeStream(); const s2 = fakeStream();
        const queue = [s1, s2];
        setGum(async () => queue.shift());
        const streamRef = { current: null };

        await openCameraStream({ streamRef, constraints: {} });
        await openCameraStream({ streamRef, constraints: {} });

        s1.tracks.forEach(t => expect(t.stop).toHaveBeenCalled());
        s2.tracks.forEach(t => expect(t.stop).not.toHaveBeenCalled());
        expect(streamRef.current).toBe(s2);
    });

    it('propagates permission errors and keeps nothing', async () => {
        const err = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
        setGum(async () => { throw err; });
        const streamRef = { current: null };
        await expect(openCameraStream({ streamRef, constraints: {} })).rejects.toMatchObject({ name: 'NotAllowedError' });
        expect(streamRef.current).toBeNull();
    });

    it('stopStream tolerates null and half-baked streams', () => {
        expect(() => stopStream(null)).not.toThrow();
        expect(() => stopStream({})).not.toThrow();
    });
});