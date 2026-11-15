import { allowsMcbuInput, restoreRemarkFlags, withClientName } from '@/lib/remark-flags';

describe('remark flags after draft reload', () => {
    test.each([
        [{ remarks: { value: 'delinquent-mcbu' } }, true],
        [{ remarks: 'delinquent-mcbu' }, true],
        [{ dcmc: true }, true],
        [{ mpdc: true }, true],
        [{ remarks: { value: 'delinquent' } }, false],
        [{}, false],
    ])('%j -> %s', (row, expected) => {
        expect(allowsMcbuInput(row)).toBe(expected);
        expect(!!restoreRemarkFlags({}, row).allowMcbuCollection).toBe(expected);
    });

    test('withClientName prefixes only when a name exists', () => {
        expect(withClientName({ fullName: 'Doe, Jane' }, 'x')).toBe('Doe, Jane: x');
        expect(withClientName({ fullName: '-' }, 'x')).toBe('x');
        expect(withClientName(undefined, 'x')).toBe('x');
    });
});
