import { findFaceMatches, findFaceMatchesAsync, parseFaceTemplate } from '@/lib/duplicate-faces';
import { detectDuplicates } from '@/lib/duplicate-clients';

const vec = (seed, jitter = 0) => Array.from({ length: 128 }, (_, i) => Math.sin(seed * (i + 1)) * 0.2 + (jitter ? jitter / Math.sqrt(128) : 0));

describe('face matching', () => {
    test('parses string / array templates, rejects bad ones', () => {
        expect(parseFaceTemplate(JSON.stringify(vec(1)))).toHaveLength(128);
        expect(parseFaceTemplate(vec(1))).toHaveLength(128);
        expect(parseFaceTemplate('nope')).toBeNull();
        expect(parseFaceTemplate([1, 2, 3])).toBeNull();
        expect(parseFaceTemplate([...vec(1).slice(1), NaN])).toBeNull();
    });
    test('close faces match, distinct faces do not; tier by distance', () => {
        const clients = [
            { _id: 'A', faceTemplate: JSON.stringify(vec(1)) },
            { _id: 'B', faceTemplate: JSON.stringify(vec(1, 0.3)) },   // distance 0.3 -> high
            { _id: 'C', faceTemplate: JSON.stringify(vec(1, 0.45)) },  // distance 0.45 -> possible
            { _id: 'D', faceTemplate: JSON.stringify(vec(7)) },        // different person
        ];
        const m = findFaceMatches(clients, new Set(['A']));
        const byPair = Object.fromEntries(m.map(x => [`${x.idA}${x.idB}`, x]));
        expect(byPair.AB.confidence).toBe('high');
        expect(byPair.AC.confidence).toBe('possible');
        expect(m.some(x => x.idB === 'D' || x.idA === 'D')).toBe(false);
    });
    test('pairs with no active-loan client are skipped; each pair reported once', () => {
        const clients = [{ _id: 'A', faceTemplate: vec(1) }, { _id: 'B', faceTemplate: vec(1) }];
        expect(findFaceMatches(clients, new Set())).toHaveLength(0);
        expect(findFaceMatches(clients, new Set(['A', 'B']))).toHaveLength(1);
    });
    test('a face match joins two differently-named records into one cluster', () => {
        const base = { birthdate: '', contactNumber: '', address: '', branchId: 'b1', groupId: 'g1', loId: 'l1', status: 'active', dateAdded: '2026-01-01' };
        const clients = [
            { ...base, _id: 'A', firstName: 'Maria', lastName: 'Santos' },
            { ...base, _id: 'B', firstName: 'Zenaida', lastName: 'Quimpo', groupId: 'g2', loId: 'l2' },
        ];
        const pairs = findFaceMatches(
            [{ _id: 'A', faceTemplate: vec(2) }, { _id: 'B', faceTemplate: vec(2, 0.2) }], new Set(['A', 'B']));
        expect(detectDuplicates(clients, new Set(['A', 'B'])).clusters).toHaveLength(0);
        const { clusters } = detectDuplicates(clients, new Set(['A', 'B']), pairs);
        expect(clusters).toHaveLength(1);
        expect(clusters[0].severity).toBe('both_active');
        expect(clusters[0].reasons.join(' ')).toMatch(/Face match/);
    });
});

describe('findFaceMatchesAsync (cooperative, time-boxed)', () => {
    const clients = [
        { _id: 'A', faceTemplate: JSON.stringify(vec(1)) },
        { _id: 'B', faceTemplate: JSON.stringify(vec(1, 0.3)) },
        { _id: 'D', faceTemplate: JSON.stringify(vec(7)) },
    ];
    test('gives the same pairs as the sync version', async () => {
        const sync = findFaceMatches(clients, new Set(['A']));
        const { pairs, timedOut } = await findFaceMatchesAsync(clients, new Set(['A']), { yieldEvery: 1 });
        expect(timedOut).toBe(false);
        expect(pairs).toEqual(sync);
    });
    test('yields to the event loop while working', async () => {
        let ticks = 0;
        const timer = setInterval(() => { ticks++; }, 0);
        const many = Array.from({ length: 300 }, (_, i) => ({ _id: 'C' + i, faceTemplate: JSON.stringify(vec(i + 20)) }));
        await findFaceMatchesAsync(many, new Set(many.map(c => c._id)), { yieldEvery: 5 });
        clearInterval(timer);
        expect(ticks).toBeGreaterThan(0);
    });
    test('gives up after the time budget and reports it', async () => {
        const many = Array.from({ length: 400 }, (_, i) => ({ _id: 'C' + i, faceTemplate: JSON.stringify(vec(i + 20)) }));
        const res = await findFaceMatchesAsync(many, new Set(many.map(c => c._id)), { yieldEvery: 1, maxMs: 1 });
        expect(res.timedOut).toBe(true);
        expect(res.compared).toBeLessThan(400);
    });
    test('identical templates cannot explode the pair count (per-client cap), group stays connected', async () => {
        const same = Array.from({ length: 60 }, (_, i) => ({ _id: 'S' + i, faceTemplate: JSON.stringify(vec(3)) }));
        const res = await findFaceMatchesAsync(same, new Set(same.map(c => c._id)), { yieldEvery: 1, maxPerRow: 3 });
        expect(res.pairs.length).toBeLessThanOrEqual(60 * 3);
        const linked = new Set(res.pairs.flatMap(p => [p.idA, p.idB]));
        expect(linked.size).toBeGreaterThan(50);
    });
    test('global pair cap stops the pass and reports it', async () => {
        const same = Array.from({ length: 60 }, (_, i) => ({ _id: 'S' + i, faceTemplate: JSON.stringify(vec(3)) }));
        const res = await findFaceMatchesAsync(same, new Set(same.map(c => c._id)), { yieldEvery: 1, maxPerRow: 3, maxPairs: 10 });
        expect(res.capped).toBe(true);
    });
    test('accepts pre-parsed vectors (no raw template string needed)', async () => {
        const pre = [
            { _id: 'A', v: parseFaceTemplate(vec(1)) },
            { _id: 'B', v: parseFaceTemplate(vec(1, 0.3)) },
        ];
        const { pairs } = await findFaceMatchesAsync(pre, new Set(['A']), { yieldEvery: 1 });
        expect(pairs).toHaveLength(1);
    });
});
