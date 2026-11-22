import {
    isCleanable, prefixLabel, referenceVariants, lookupVariants, minAgeMs, quarantineKeyOf, scanPrefixes,
} from '@/lib/spaces-cleanup-core';

const BUCKET = 'ambercashph';

beforeEach(() => {
    process.env.SPACES_ROOT = 'lms';
    process.env.SPACES_BUCKET = BUCKET;
    delete process.env.SPACES_CLEANUP_PREFIXES;
});

describe('isCleanable — what may EVER be flagged or moved', () => {
    test('LMS photo keys and temp uploads are cleanable', () => {
        expect(isCleanable('lms/laf-photos/abc/1-laf.jpg')).toBe(true);
        expect(isCleanable('lms/clients/uuid/photo.png')).toBe(true);
        expect(isCleanable('temp/1700000000-x.jpg')).toBe(true);
    });
    test('protected prefixes are never cleanable', () => {
        expect(isCleanable('lms/log-archive/audit_logs/2026-11-01/a.ndjson.gz')).toBe(false);
        expect(isCleanable('lms/dashboard-activities/slide1.jpg')).toBe(false);
        expect(isCleanable('to-delete/lms/clients/uuid/photo.png')).toBe(false);
    });
    test('anything outside LMS scope (other apps in the bucket) is never cleanable', () => {
        expect(isCleanable('hris/payslips/a.pdf')).toBe(false);
        expect(isCleanable('lmsx/other.jpg')).toBe(false);
    });
    test('folder placeholders and junk are not cleanable', () => {
        expect(isCleanable('lms/laf-photos/')).toBe(false);
        expect(isCleanable('')).toBe(false);
        expect(isCleanable(null)).toBe(false);
    });
    test('SPACES_CLEANUP_PREFIXES narrows the scope', () => {
        process.env.SPACES_CLEANUP_PREFIXES = 'lms/laf-photos/';
        expect(scanPrefixes()).toEqual(['lms/laf-photos/']);
        expect(isCleanable('lms/clients/uuid/photo.png')).toBe(false);
    });
});

describe('referenceVariants — a missing variant would flag a live file', () => {
    test('bare key', () => {
        expect(referenceVariants('lms/clients/u/a.png')).toContain('lms/clients/u/a.png');
    });
    test('legacy virtual-host URL becomes the key', () => {
        expect(referenceVariants(`https://${BUCKET}.sgp1.digitaloceanspaces.com/lms/clients/u/a.png`))
            .toContain('lms/clients/u/a.png');
    });
    test('legacy path-style URL (bucket in path) also yields the bare key', () => {
        expect(referenceVariants(`https://sgp1.digitaloceanspaces.com/${BUCKET}/lms/clients/u/a.png`))
            .toContain('lms/clients/u/a.png');
    });
    test('URL-encoded value yields both encoded and decoded forms', () => {
        const v = referenceVariants('lms/clients/u/file%20name.png');
        expect(v).toContain('lms/clients/u/file%20name.png');
        expect(v).toContain('lms/clients/u/file name.png');
    });
    test('malformed encoding does not throw', () => {
        expect(referenceVariants('lms/clients/u/100%.png')).toContain('lms/clients/u/100%.png');
    });
    test('empty, non-string, data URLs and giant blobs yield nothing', () => {
        expect(referenceVariants(null)).toEqual([]);
        expect(referenceVariants('')).toEqual([]);
        expect(referenceVariants(`data:image/png;base64,${'A'.repeat(50)}`)).toEqual([]);
        expect(referenceVariants('x'.repeat(2000))).toEqual([]);
    });
});

describe('lookupVariants / helpers', () => {
    test('covers bare, encoded and legacy URL forms', () => {
        const v = lookupVariants('lms/c/file name.png');
        expect(v).toContain('lms/c/file name.png');
        expect(v).toContain('lms/c/file%20name.png');
        expect(v).toContain(`https://${BUCKET}.sgp1.digitaloceanspaces.com/lms/c/file name.png`);
    });
    test('prefixLabel groups by the first two segments', () => {
        expect(prefixLabel('lms/laf-photos/u/x.jpg')).toBe('lms/laf-photos');
        expect(prefixLabel('temp/1-x.jpg')).toBe('temp');
    });
    test('temp files age out faster than everything else', () => {
        expect(minAgeMs('temp/1-x.jpg')).toBe(24 * 3600 * 1000);
        expect(minAgeMs('lms/laf-photos/u/x.jpg')).toBe(168 * 3600 * 1000);
    });
    test('quarantine key keeps the original path for restore', () => {
        expect(quarantineKeyOf('lms/c/a.png')).toBe('to-delete/lms/c/a.png');
    });
});
