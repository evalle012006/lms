// src/pages/api/v2/clients/duplicates/stats.js
// GET — duplicate-client counts per Group / LO / Branch / Area / Region / Division.
// Admin: everything. Branch manager / area / regional / division head: only their own branches (records in other
// branches are not counted and do not appear). Same audience as the list page (lib/duplicate-access.js).
// Reads the stored scan (as fresh as the last scan); definitions live in lib/duplicate-stats.js.
//
// Query params:
//   level          group | lo | branch | area | region | division   (default branch)
//   includeClosed  'true' to include Closed/Offset-only groups (default: groups with an active loan only).
//                  The closed set is ~90% of all groups, so this is much slower — it pages through all of them.
//   divisionId / regionId / areaId / branchId   restrict to groups touching these branches; only records in
//                  those branches are counted
//   all            'true' to return every row (Excel export); default is the top 200

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { loadHierarchy, branchIdsForFilters, branchIdsCondition, intersectBranchIds, scopeHierarchy } from '@/lib/duplicate-hierarchy';
import { resolveDuplicateScope } from '@/lib/duplicate-scope';
import { tallyDuplicateStats, STAT_LEVELS } from '@/lib/duplicate-stats';
import { getLatestRun } from '@/lib/duplicate-clients-job';

const graph = new GraphProvider();
const PAGE = 2000;
const MAX_CLUSTERS = 150000;
const TOP = 200;
const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', '_id severity confidence members');

export default apiHandler({ get: stats });

async function stats(req, res) {
    const user = await findUserById(req.auth.sub);
    const access = await resolveDuplicateScope(user);
    if (!access.level) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const q = req.query;
    const level = STAT_LEVELS.includes(q.level) ? q.level : 'branch';
    const includeClosed = q.includeClosed === 'true';
    const fullHierarchy = await loadHierarchy();
    const hierarchy = scopeHierarchy(fullHierarchy, access.branchIds);
    // Filters narrow within the caller's scope, never beyond it.
    const branchIds = intersectBranchIds(branchIdsForFilters(fullHierarchy, q), access.branchIds);
    const branchCond = branchIdsCondition(branchIds);

    const where = {
        _and: [
            { status: { _eq: 'open' } },
            { view: { _in: includeClosed ? ['active', 'closed'] : ['active'] } },
            { _or: [{ review_status: { _is_null: true } }, { review_status: { _neq: 'not_duplicate' } }] },
            ...(branchCond ? [branchCond] : []),
        ],
    };

    // Page through the groups and keep only what the tally needs; members are the heavy part.
    const clusters = [];
    for (let offset = 0; offset < MAX_CLUSTERS; offset += PAGE) {
        const rows = await graph.query(queryQl(CLUSTER_TYPE('clusters'), {
            where, order_by: [{ _id: 'asc' }], limit: PAGE, offset,
        })).then(r => {
            if (r.errors?.length) throw new Error(`GraphQL error reading duplicate groups: ${r.errors[0].message}`);
            return r.data?.clusters ?? [];
        });
        clusters.push(...rows);
        if (rows.length < PAGE) break;
    }

    const lastRun = await getLatestRun();
    const { rows, totals } = tallyDuplicateStats(clusters, level, { ...fullHierarchy, branchIds });
    return res.status(200).json({
        success: true,
        level,
        includeClosed,
        access: { level: access.level },
        totals,
        rows: q.all === 'true' ? rows : rows.slice(0, TOP),
        rowCount: rows.length,
        scanFinishedAt: lastRun?.finished_at ?? null,
        truncated: q.all !== 'true' && rows.length > TOP,
        hierarchy: { divisions: hierarchy.divisions, regions: hierarchy.regions, areas: hierarchy.areas, branches: hierarchy.branches },
    });
}
