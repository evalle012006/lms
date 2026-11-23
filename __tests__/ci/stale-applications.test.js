import moment from 'moment';

jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { query() {} mutation() {} } }));

process.env.SPACES_ROOT = 'lms';
const { cutoffs } = require('@/lib/stale-applications-job');
const { folderPrefixOf } = require('@/lib/stale-application-files');

describe('stale application cutoffs', () => {
    const now = moment('2026-11-23T10:00:00Z');
    test('7 days, 14 days and 1 month back', () => {
        const c = cutoffs(now);
        expect(c.pending).toBe('2026-11-16T10:00:00.000Z');
        expect(c.approved).toBe('2026-11-09T10:00:00.000Z');
        expect(c.excluded).toBe('2026-10-23T10:00:00.000Z');
    });
    test('does not mutate the clock passed in', () => {
        const n = moment(now); cutoffs(n);
        expect(n.toISOString()).toBe(now.toISOString());
    });
});

describe('folderPrefixOf', () => {
    test.each([
        ['laf-photos', 'lms/laf-photos/laf1700000000000/a.jpg', 'lms/laf-photos/laf1700000000000/'],
        ['laf-id-photos', 'lms/laf-id-photos/laf1/b.jpg', 'lms/laf-id-photos/laf1/'],
        ['laf-selfie-with-id', 'lms/laf-selfie-with-id/laf1/c.jpg', 'lms/laf-selfie-with-id/laf1/'],
        ['face-enroll-thumbnail', 'lms/face-enroll-thumbnail/u1/d.jpg', 'lms/face-enroll-thumbnail/u1/'],
        ['ci-selfies', 'lms/ci-selfies/app-1/e.jpg', 'lms/ci-selfies/app-1/'],
    ])('%s -> whole submission folder', (_o, key, prefix) => {
        expect(folderPrefixOf(key, 'lms')).toBe(prefix);
    });
    test.each([
        'lms/disbursement/client-1/a.jpg',   // other origin: single object only
        'other/laf-photos/laf1/a.jpg',       // wrong root
        'lms/laf-photos/a.jpg',              // no per-submission folder
        '', null, undefined,
    ])('%p -> no folder expansion', (key) => {
        expect(folderPrefixOf(key, 'lms')).toBeNull();
    });
});
