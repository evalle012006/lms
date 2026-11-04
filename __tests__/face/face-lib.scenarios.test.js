// Extra pure-unit scenarios: UI gate, input sanitizers, redaction edges, audit plumbing, camera hygiene.
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/face-harness').graphProviderMock());
jest.mock('@/lib/graph/graph.util',     () => require('../../__mocks__/face-harness').graphUtilMock());
jest.mock('@/lib/utils',                () => require('../../__mocks__/face-harness').utilsMock());

const { graph } = require('../../__mocks__/face-harness');
const { logAudit, logAuditPublic } = require('@/lib/audit');
const { redactBiometrics, REDACTED } = require('@/lib/audit-redact');
const utils = require('@/lib/face-recapture-utils');
const { openCameraStream, stopStream } = require('@/lib/camera-stream');

describe('getRecaptureState (drives the Re-enroll button)', () => {
    const MIN = utils.MIN_MISMATCHES_FOR_RECAPTURE;
    it.each([
        [{ enabled: false, mismatchCount: 99, canRecapture: true }, null],
        [{ enabled: true, mismatchCount: 0,       canRecapture: true  }, 'locked'],
        [{ enabled: true, mismatchCount: MIN - 1, canRecapture: true  }, 'locked'],
        [{ enabled: true, mismatchCount: MIN - 1, canRecapture: false }, 'locked'],
        [{ enabled: true, mismatchCount: MIN,     canRecapture: false }, 'no_permission'],
        [{ enabled: true, mismatchCount: MIN + 4, canRecapture: false }, 'no_permission'],
        [{ enabled: true, mismatchCount: MIN,     canRecapture: true  }, 'available'],
        [{ enabled: true }, 'locked'],
    ])('%j → %s', (input, expected) => expect(utils.getRecaptureState(input)).toBe(expected));
});

describe('sanitizeLiveness', () => {
    it.each([[0.9, 0.9], [0, 0], [1, 1]])('keeps %p', (v, out) => expect(utils.sanitizeLiveness(v)).toBe(out));
    it.each([[1.5], [-0.1], ['0.9'], [NaN], [Infinity], [null], [undefined], [{}], [true]])(
        'drops %p', (v) => expect(utils.sanitizeLiveness(v)).toBeNull());
});

describe('sanitizeEnrolledAt', () => {
    const now = Date.parse('2026-11-02T10:00:00.000Z');
    const NOW_ISO = '2026-11-02T10:00:00.000Z';
    it('keeps a timestamp near the server clock (normalised to ISO)', () => {
        expect(utils.sanitizeEnrolledAt('2026-11-02T09:59:00.000Z', now)).toBe('2026-11-02T09:59:00.000Z');
    });
    it('keeps the edge of the ±1 day window', () => {
        expect(utils.sanitizeEnrolledAt('2026-11-03T10:00:00.000Z', now)).toBe('2026-11-03T10:00:00.000Z');
    });
    it.each([
        ['more than a day ahead', '2026-11-03T10:00:01.000Z'],
        ['more than a day behind', '2026-11-01T09:59:59.000Z'],
        ['not a date', 'garbage'],
        ['date only (no time)', '2026-11-02'],
        ['empty', ''],
    ])('falls back to server time for %s', (_n, value) => expect(utils.sanitizeEnrolledAt(value, now)).toBe(NOW_ISO));
    it.each([[undefined], [null], [12345], [{}]])('falls back for %p', (v) =>
        expect(utils.sanitizeEnrolledAt(v, now)).toBe(NOW_ISO));
});

describe('canApproveFaceRecapture reads shortCode from either place', () => {
    it('accepts a flat shortCode', () => expect(utils.canApproveFaceRecapture({ shortCode: 'branch_manager' })).toBe(true));
    it('prefers role.shortCode', () => expect(utils.canApproveFaceRecapture({ role: { shortCode: 'loan_officer' }, shortCode: 'admin' })).toBe(false));
});

describe('redactBiometrics edge cases', () => {
    it('keeps a string of exactly 5000 characters, truncates 5001', () => {
        expect(redactBiometrics({ a: 'x'.repeat(5000) }).a).toHaveLength(5000);
        expect(redactBiometrics({ a: 'x'.repeat(5001) }).a).toBe('[truncated 5001 chars]');
    });
    it('redacts non-null falsy templates but leaves null and undefined alone', () => {
        expect(redactBiometrics({ faceTemplate: '' }).faceTemplate).toBe(REDACTED);
        expect(redactBiometrics({ faceTemplate: 0 }).faceTemplate).toBe(REDACTED);
        expect(redactBiometrics({ faceTemplate: undefined }).faceTemplate).toBeUndefined();
        expect(redactBiometrics({ faceTemplate: null }).faceTemplate).toBeNull();
    });
    it('does not touch unrelated booleans, numbers or similarly-named keys', () => {
        const out = redactBiometrics({ faceVerified: true, faceMatchScore: 0.2, hasFaceTemplate: true });
        expect(out).toEqual({ faceVerified: true, faceMatchScore: 0.2, hasFaceTemplate: true });
    });
    it('walks arrays of arrays', () => {
        const out = redactBiometrics([[{ faceTemplate: 'x' }], [{ ok: 1 }]]);
        expect(out[0][0].faceTemplate).toBe(REDACTED);
        expect(out[1][0]).toEqual({ ok: 1 });
    });
    it('stops at a maximum depth instead of recursing forever', () => {
        let o = { faceTemplate: 'DEEP' };
        for (let i = 0; i < 12; i++) o = { n: o };
        const json = JSON.stringify(redactBiometrics(o));
        expect(json).toContain('[max depth]');
        expect(json).not.toContain('DEEP');
    });
});

describe('logAudit plumbing', () => {
    const entry = () => graph.mutation.mock.calls[0][0].args.objects[0];
    beforeEach(() => {
        graph.mutation.mockReset(); graph.mutation.mockResolvedValue({});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => console.error.mockRestore());

    it('defaults severity to INFO and success to true', async () => {
        await logAudit({ headers: {}, auth: { sub: 'u1' } }, { action: 'X', category: 'Y' });
        expect(entry()).toMatchObject({ severity: 'INFO', success: true, beforeData: null, afterData: null, metadata: null });
    });
    it('keeps success:false and the failure reason', async () => {
        await logAudit({ headers: {}, auth: { sub: 'u1' } }, { action: 'X', category: 'Y', success: false, failReason: 'nope' });
        expect(entry()).toMatchObject({ success: false, failReason: 'nope' });
    });
    it('takes the first address from x-forwarded-for, else the socket, else null', async () => {
        await logAudit({ headers: { 'x-forwarded-for': '1.1.1.1, 2.2.2.2' } }, { action: 'X', category: 'Y' });
        expect(entry().ipAddress).toBe('1.1.1.1');
        graph.mutation.mockClear();
        await logAudit({ headers: {}, socket: { remoteAddress: '3.3.3.3' } }, { action: 'X', category: 'Y' });
        expect(entry().ipAddress).toBe('3.3.3.3');
        graph.mutation.mockClear();
        await logAudit({ headers: {} }, { action: 'X', category: 'Y' });
        expect(entry().ipAddress).toBeNull();
    });
    it('prefers an explicit userId over the token subject, and allows none', async () => {
        await logAudit({ headers: {}, auth: { sub: 'from-token' } }, { action: 'X', category: 'Y', userId: 'explicit' });
        expect(entry().userId).toBe('explicit');
        graph.mutation.mockClear();
        await logAudit({ headers: {} }, { action: 'X', category: 'Y' });
        expect(entry().userId).toBeNull();
    });
    it('logAuditPublic never attributes the entry to a token user', async () => {
        await logAuditPublic({ headers: {}, auth: { sub: 'someone' } }, { action: 'X', category: 'Y' });
        expect(entry().userId).toBeNull();
    });
    it('never throws, even if the insert throws synchronously', async () => {
        graph.mutation.mockImplementation(() => { throw new Error('boom'); });
        await expect(logAudit({ headers: {} }, { action: 'X', category: 'Y' })).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });
    it('never throws, even if the insert rejects (it is logged)', async () => {
        graph.mutation.mockRejectedValue(new Error('db down'));
        await expect(logAudit({ headers: {} }, { action: 'X', category: 'Y' })).resolves.toBeUndefined();
        await new Promise((r) => setImmediate(r));
        expect(console.error).toHaveBeenCalled();
    });
});

describe('camera stream edge cases', () => {
    const fakeStream = () => { const tracks = [{ stop: jest.fn() }, { stop: jest.fn() }]; return { tracks, getTracks: () => tracks }; };
    const setGum = (impl) => Object.defineProperty(global, 'navigator', {
        value: { mediaDevices: { getUserMedia: impl } }, configurable: true, writable: true,
    });

    it('passes the constraints through to getUserMedia', async () => {
        const gum = jest.fn(async () => fakeStream());
        setGum(gum);
        const constraints = { video: { facingMode: 'user' }, audio: false };
        await openCameraStream({ streamRef: { current: null }, constraints });
        expect(gum).toHaveBeenCalledWith(constraints);
    });

    it('treats a caller that gave no isActive as still mounted', async () => {
        const s = fakeStream();
        setGum(async () => s);
        const ref = { current: null };
        await expect(openCameraStream({ streamRef: ref, constraints: {} })).resolves.toBe(s);
    });

    it('releases the previous stream immediately, not after the new one opens', async () => {
        const first = fakeStream();
        let resolveSecond;
        setGum(jest.fn()
            .mockImplementationOnce(async () => first)
            .mockImplementationOnce(() => new Promise((r) => { resolveSecond = r; })));
        const ref = { current: null };
        await openCameraStream({ streamRef: ref, constraints: {} });
        const pending = openCameraStream({ streamRef: ref, constraints: {} });
        first.tracks.forEach((t) => expect(t.stop).toHaveBeenCalled());
        expect(ref.current).toBeNull();
        resolveSecond(fakeStream());
        await pending;
    });

    it('stopStream keeps going when one track throws', () => {
        const a = { stop: jest.fn(() => { throw new Error('already stopped'); }) };
        const b = { stop: jest.fn() };
        expect(() => stopStream({ getTracks: () => [a, b] })).not.toThrow();
        expect(b.stop).toHaveBeenCalled();
    });
});

describe('recapture reason presets', () => {
    it('every preset is long enough to be accepted as-is', () => {
        utils.RECAPTURE_REASON_PRESETS.forEach((p) =>
            expect(p.trim().length).toBeGreaterThanOrEqual(utils.MIN_RECAPTURE_REASON_LENGTH));
    });
    it('has presets, all different', () => {
        expect(utils.RECAPTURE_REASON_PRESETS.length).toBeGreaterThan(0);
        expect(new Set(utils.RECAPTURE_REASON_PRESETS).size).toBe(utils.RECAPTURE_REASON_PRESETS.length);
    });
});