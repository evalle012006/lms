// src/lib/duplicate-faces.js
// Face-based duplicate detection (Phase 4). Pure functions, no I/O.
//
// Works on the 128-value face templates already stored on `client.faceTemplate` (same Euclidean distance the
// live verification uses, FACE_MATCH_THRESHOLD = 0.5) — no pgvector needed. A full N×N comparison is avoided:
// only pairs where at least one client has an active loan are compared, and each distance is abandoned as soon
// as its partial sum passes the threshold (almost every pair is rejected within the first few values).

export const FACE_DIM = 128;
export const FACE_MATCH_THRESHOLD = 0.5;   // keep in sync with lib/face-recapture-utils.js
export const FACE_HIGH_THRESHOLD = 0.4;    // closer than this = 'high' confidence, otherwise 'possible'

export function parseFaceTemplate(raw) {
    let t = raw;
    if (typeof raw === 'string') { try { t = JSON.parse(raw); } catch { return null; } }
    if (!Array.isArray(t) || t.length !== FACE_DIM) return null;
    const v = new Float32Array(FACE_DIM);
    for (let i = 0; i < FACE_DIM; i++) {
        if (!Number.isFinite(t[i])) return null;
        v[i] = t[i];
    }
    return v;
}

// Squared distance, or Infinity once it exceeds limitSq.
function distSqWithin(a, b, limitSq) {
    let s = 0;
    for (let i = 0; i < FACE_DIM; i++) {
        const d = a[i] - b[i];
        s += d * d;
        if (s > limitSq) return Infinity;
    }
    return s;
}

/**
 * @param {Array<{_id:string, faceTemplate:any}>} faceClients clients that have a face template
 * @param {Set<string>} activeLoanClientIds
 * @returns {Array<{idA:string,idB:string,distance:number,confidence:'high'|'possible',reasons:string[]}>}
 */
export function findFaceMatches(faceClients, activeLoanClientIds = new Set(), threshold = FACE_MATCH_THRESHOLD) {
    const parsed = [];
    for (const c of faceClients) {
        const v = parseFaceTemplate(c.faceTemplate);
        if (v) parsed.push({ id: c._id, v, active: activeLoanClientIds.has(c._id) });
    }
    const limitSq = threshold * threshold;

    // No "seen" set (it would hold millions of keys): an active-vs-active pair is compared only from the
    // lower-indexed side; an active-vs-inactive pair can only be reached from the active side.
    const out = [];
    for (let i = 0; i < parsed.length; i++) compareRow(parsed, i, limitSq, out);
    return out;
}

function compareRow(parsed, i, limitSq, out, maxPerRow = Infinity) {
    const a = parsed[i];
    if (!a.active) return;
    let rowPairs = [];
    let raw = 0;
    for (let j = 0; j < parsed.length; j++) {
        if (i === j) continue;
        const b = parsed[j];
        if (b.active && j < i) continue;
        const dsq = distSqWithin(a.v, b.v, limitSq);
        if (dsq === Infinity) continue;
        rowPairs.push({ idA: a.id, idB: b.id, dsq });
        raw++;
        // Many identical templates (placeholder / copied faces) would otherwise produce millions of pairs and
        // exhaust the heap: keep only the closest few per client — they still link the whole group.
        if (rowPairs.length > maxPerRow * 4) { rowPairs.sort((x, y) => x.dsq - y.dsq); rowPairs.length = maxPerRow; }
    }
    if (rowPairs.length > maxPerRow) { rowPairs.sort((x, y) => x.dsq - y.dsq); rowPairs.length = maxPerRow; }
    for (const r of rowPairs) {
        const distance = Math.sqrt(r.dsq);
        out.push({
            idA: r.idA, idB: r.idB, distance,
            confidence: distance < FACE_HIGH_THRESHOLD ? 'high' : 'possible',
            reasons: [`Face match (distance ${distance.toFixed(2)})`],
        });
    }
    return raw;
}

const tick = () => new Promise(resolve => setImmediate(resolve));

/**
 * Same result as findFaceMatches, but hands control back to the event loop regularly so a big scan never freezes
 * the app process (a full pass over ~100k faces is CPU-bound for many minutes), and gives up after `maxMs`.
 * @returns {Promise<{pairs:Array, timedOut:boolean, capped:boolean, compared:number, total:number}>}
 */
export async function findFaceMatchesAsync(faceClients, activeLoanClientIds = new Set(),
    { threshold = FACE_MATCH_THRESHOLD, yieldEvery = 5, maxMs = 0, onProgress = null, maxPerRow = 10, maxPairs = 300000 } = {}) {
    const parsed = [];
    for (const c of faceClients) {
        const v = c.v ?? parseFaceTemplate(c.faceTemplate);   // c.v: already parsed by the caller (saves memory)
        if (v) parsed.push({ id: c._id, v, active: activeLoanClientIds.has(c._id) });
    }
    const limitSq = threshold * threshold;
    const started = Date.now();
    const out = [];
    let compared = 0;
    let rawMatches = 0;
    for (let i = 0; i < parsed.length; i++) {
        if (!parsed[i].active) continue;
        rawMatches += compareRow(parsed, i, limitSq, out, maxPerRow) ?? 0;
        compared++;
        if (out.length >= maxPairs) return { pairs: out, timedOut: false, capped: true, compared, rawMatches, total: parsed.length };
        if (compared % yieldEvery === 0) {
            await tick();
            if (maxMs && Date.now() - started > maxMs) return { pairs: out, timedOut: true, compared, rawMatches, total: parsed.length };
            if (onProgress && compared % (yieldEvery * 100) === 0) await onProgress(compared);
        }
    }
    return { pairs: out, timedOut: false, capped: false, compared, rawMatches, total: parsed.length };
}
