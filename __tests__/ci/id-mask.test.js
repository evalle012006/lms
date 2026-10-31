import { maskGovernmentId, isMaskedId, ID_MASK_CHAR } from '@/lib/laf/id-mask';
import { isValidGovernmentId, escapeLike } from '@/lib/validation-utils';

describe('maskGovernmentId', () => {
    test('keeps length and shows the last 4 only when longer than 8', () => {
        const m = maskGovernmentId('1234567890');
        expect(m).toHaveLength(10);
        expect(m.endsWith('7890')).toBe(true);
        expect(m.startsWith(ID_MASK_CHAR.repeat(6))).toBe(true);
    });
    test('short ids reveal nothing', () => {
        expect(maskGovernmentId('12345678')).toBe(ID_MASK_CHAR.repeat(8));
    });
    test('blank/null -> empty string', () => {
        expect(maskGovernmentId('')).toBe('');
        expect(maskGovernmentId(null)).toBe('');
    });
    test('a masked id still passes the form validity check (no forced ID re-entry)', () => {
        expect(isValidGovernmentId(maskGovernmentId('1234567890'))).toBe(true);
        expect(isValidGovernmentId(maskGovernmentId('12345678'))).toBe(true);
    });
    test('isMaskedId', () => {
        expect(isMaskedId(maskGovernmentId('1234567890'))).toBe(true);
        expect(isMaskedId('1234567890')).toBe(false);
    });
});

describe('escapeLike', () => {
    test('escapes %, _ and backslash so input only matches literally', () => {
        expect(escapeLike('a_b%c\\d')).toBe('a\\_b\\%c\\\\d');
    });
    test('leaves normal text alone', () => {
        expect(escapeLike('ABC-123')).toBe('ABC-123');
    });
});