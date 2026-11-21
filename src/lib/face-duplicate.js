// src/lib/face-duplicate.js
// Real-time "does this face already belong to another client?" check (pgvector, migration 007).
// Fails soft: if the function is not installed / tracked yet, or the query errors, returns {available:false}
// and the caller proceeds exactly as before.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { FACE_MATCH_THRESHOLD } from '@/lib/face-recapture-utils';

const graph = new GraphProvider();
const FACE_MATCH_TYPE = createGraphType('client',
    '_id firstName lastName branchId branchName status faceTemplate', 'fn_find_duplicate_faces');
const LOAN_TYPE = createGraphType('loans', '_id clientId status')('loans');

const euclid = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return Math.sqrt(s); };
const parse = (raw) => { try { const t = typeof raw === 'string' ? JSON.parse(raw) : raw; return Array.isArray(t) && t.length === 128 ? t : null; } catch { return null; } };

/**
 * @returns {{available:boolean, matches:Array<{clientId,name,branchName,status,distance,hasActiveLoan,hasPendingLoan}>}}
 */
export async function findFaceDuplicates(template, excludeClientId, { maxRows = 5 } = {}) {
    try {
        const rows = await graph.query(queryQl(FACE_MATCH_TYPE('matches'), {
            args: { vec: JSON.stringify(template), exclude_id: excludeClientId, max_distance: FACE_MATCH_THRESHOLD, max_rows: maxRows },
        })).then(r => r.data?.matches ?? []);
        if (!rows.length) return { available: true, matches: [] };

        const loans = await graph.query(queryQl(LOAN_TYPE, {
            where: { clientId: { _in: rows.map(r => r._id) }, status: { _in: ['active', 'pending'] } },
        })).then(r => r.data?.loans ?? []);
        const state = {};
        for (const l of loans) (state[l.clientId] ??= {})[l.status] = true;

        return {
            available: true,
            matches: rows.map(r => {
                const t = parse(r.faceTemplate);
                return {
                    clientId: r._id,
                    name: [r.lastName, r.firstName].filter(Boolean).join(', '),
                    branchName: r.branchName ?? null,
                    status: r.status,
                    distance: t ? Number(euclid(template, t).toFixed(3)) : null,
                    hasActiveLoan: !!state[r._id]?.active,
                    hasPendingLoan: !!state[r._id]?.pending,
                };
            }),
        };
    } catch (e) {
        console.warn('[face-duplicate] check skipped:', String(e?.message ?? e).slice(0, 200));
        return { available: false, matches: [] };
    }
}
