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
    for (let i = 0; i < parsed.length; i++) {
        const a = parsed[i];
        if (!a.active) continue;
        for (let j = 0; j < parsed.length; j++) {
            if (i === j) continue;
            const b = parsed[j];
            if (b.active && j < i) continue;
            const dsq = distSqWithin(a.v, b.v, limitSq);
            if (dsq === Infinity) continue;
            const distance = Math.sqrt(dsq);
            out.push({
                idA: a.id, idB: b.id, distance,
                confidence: distance < FACE_HIGH_THRESHOLD ? 'high' : 'possible',
                reasons: [`Face match (distance ${distance.toFixed(2)})`],
            });
        }
    }
    return out;
}
