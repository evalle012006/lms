// src/lib/heap-guard.js (server only)
// A scan over hundreds of thousands of clients can use gigabytes. Hitting the V8 heap limit kills the WHOLE app
// container (every user on it). This turns that into an ordinary failed run: callers check it at their natural
// checkpoints and it throws a clear error well before the limit.
import v8 from 'v8';
import vm from 'vm';

// heap_size_used includes garbage V8 has not collected yet, so a raw reading can trip the guard on memory that
// is about to be freed. Before failing a scan, force one full GC (exposed at runtime — no --expose-gc needed).
let forceGc = null;
try {
    v8.setFlagsFromString('--expose-gc');
    forceGc = vm.runInNewContext('gc');
} catch { /* not available: fall back to the raw reading */ }

export const heapStats = () => {
    const s = v8.getHeapStatistics();
    return { usedMb: Math.round(s.used_heap_size / 1048576), limitMb: Math.round(s.heap_size_limit / 1048576) };
};

/** @param {number} fraction share of the heap limit that counts as "too much" (default 0.85) */
export function heapGuard(fraction = Number(process.env.SCAN_HEAP_GUARD) || 0.85) {
    return function check(label = '') {
        let { usedMb, limitMb } = heapStats();
        if (usedMb > limitMb * fraction && forceGc) {
            try { forceGc(); } catch { /* ignore */ }
            ({ usedMb, limitMb } = heapStats());
        }
        if (usedMb > limitMb * fraction) {
            throw new Error(`memory guard: heap ${usedMb} MB of ${limitMb} MB in ${label || 'scan'} — stopped before the app container ran out of memory`);
        }
    };
}
