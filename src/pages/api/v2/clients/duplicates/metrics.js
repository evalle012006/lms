// src/pages/api/v2/clients/duplicates/metrics.js
// GET — which LOs / branches the NEWER record of each open duplicate group belongs to (admin only).
// The newer record (latest dateAdded among live members) is the one that created the duplicate, so that is who
// is credited. Groups marked "not a duplicate" are excluded. Reads the stored scan; no live detection.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();
const MAX_CLUSTERS = 20000;
const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', '_id severity confidence members');

export default apiHandler({ get: metrics });

export function tallyNewerRecords(clusters) {
    const byLo = new Map();
    const byBranch = new Map();
    const bump = (map, key, base, c) => {
        const row = map.get(key) ?? { ...base, groups: 0, bothActive: 0, exactOrHigh: 0 };
        row.groups++;
        if (c.severity === 'both_active') row.bothActive++;
        if (c.confidence === 'exact' || c.confidence === 'high') row.exactOrHigh++;
        map.set(key, row);
    };
    for (const c of clusters) {
        const live = (c.members ?? []).filter(m => !m.isClosed);
        if (live.length < 2) continue;
        const newer = live.reduce((a, b) => String(b.dateAdded ?? '') > String(a.dateAdded ?? '') ? b : a);
        bump(byLo, newer.effLoId ?? 'unknown', { loId: newer.effLoId ?? null, loName: newer.loName ?? 'Unknown', branchName: newer.branchName ?? null }, c);
        bump(byBranch, newer.branchId ?? 'unknown', { branchId: newer.branchId ?? null, branchName: newer.branchName ?? 'Unknown' }, c);
    }
    const sort = rows => rows.sort((a, b) => b.bothActive - a.bothActive || b.groups - a.groups);
    return { byLo: sort([...byLo.values()]), byBranch: sort([...byBranch.values()]) };
}

async function metrics(req, res) {
    const user = await findUserById(req.auth.sub);
    if (!user || !(user.root || user.role?.rep === 1)) {
        return res.status(200).json({ success: false, message: 'Admin access required.' });
    }
    const rows = await graph.query(queryQl(CLUSTER_TYPE('clusters'), {
        where: {
            _and: [
                { status: { _eq: 'open' } },
                { view: { _eq: 'active' } },
                { _or: [{ review_status: { _is_null: true } }, { review_status: { _neq: 'not_duplicate' } }] },
            ],
        },
        limit: MAX_CLUSTERS,
    })).then(r => r.data?.clusters ?? []);
    const { byLo, byBranch } = tallyNewerRecords(rows);
    return res.status(200).json({ success: true, groups: rows.length, byLo: byLo.slice(0, 25), byBranch: byBranch.slice(0, 25) });
}
