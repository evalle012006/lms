import { heapGuard, heapStats } from '@/lib/heap-guard';

describe('heap guard', () => {
    test('reports used and limit', () => {
        const { usedMb, limitMb } = heapStats();
        expect(usedMb).toBeGreaterThan(0);
        expect(limitMb).toBeGreaterThan(usedMb);
    });
    test('does nothing while the heap is comfortable', () => {
        expect(() => heapGuard(0.99)('detect')).not.toThrow();
    });
    test('throws a clear error, naming the phase, when over the limit', () => {
        expect(() => heapGuard(0.0001)('detect')).toThrow(/memory guard: heap \d+ MB of \d+ MB in detect/);
    });
});
