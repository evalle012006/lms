// src/pages/api/v2/clients/duplicates/list.js
// GET — stored duplicate-client groups (written by lib/duplicate-clients-job.js), paginated in the database.
// Admin only (rep=1, root or not). Read-only.
//
// Query params:
//   view        'active' | 'closed' | 'same_client'      (default 'active')
//   confidence  'exact' | 'high' | 'possible'            (comma-separated allowed)
//   scenario    cross_branch | same_branch_diff_lo | same_lo_diff_group | same_group  (comma-separated allowed)
//   severity    both_active | one_active | no_active
//   branchId / loId / groupId                            group kept if ANY member matches
//   search      name, client id, or contact number
//   all         'true' to return every filtered group (Excel export, capped at EXPORT_MAX)
//   page / limit

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { normalizeText } from '@/lib/duplicate-clients';
import { getLatestRun, isRunActive } from '@/lib/duplicate-clients-job';

const graph = new GraphProvider();

const EXPORT_MAX = 20000;
const VIEWS = ['active', 'closed', 'same_client'];

const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `
  _id view confidence severity scenarios reasons active_count member_count
  exact_closed_vs_active members first_detected_at last_seen_at
`);
const BRANCH_TYPE = createGraphType('branches', `_id name`)('branches');

export default apiHandler({ get: list });

async function list(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    // 200 + success:false, never 403 (403 triggers client-side logout).
    if (!currentUser?.root && currentUser?.role?.rep !== 1) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const q = req.query;
    const view = VIEWS.includes(q.view) ? q.view : 'active';
    const page = Math.max(1, parseInt(q.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(q.limit) || 25));
    const all = q.all === 'true';
    const csv = (v) => (v ? String(v).split(',').filter(Boolean) : null);

    const and = [{ status: { _eq: 'open' } }, { view: { _eq: view } }];
    const confidences = csv(q.confidence);
    const scenarios = csv(q.scenario);
    if (confidences) and.push({ confidence: { _in: confidences } });
    if (scenarios) and.push({ _or: scenarios.map(s => ({ scenarios: { _contains: [s] } })) });
    if (q.severity) and.push({ severity: { _eq: q.severity } });
    if (q.branchId) and.push({ branch_ids: { _contains: [q.branchId] } });
    if (q.loId) and.push({ lo_ids: { _contains: [q.loId] } });
    if (q.groupId) and.push({ group_ids: { _contains: [q.groupId] } });
    const search = q.search?.trim();
    if (search) {
        // search_text holds each member's id + normalized name + normalized phone.
        const norm = normalizeText(search);
        const digits = search.replace(/\D/g, '').slice(-10);
        and.push({
            _or: [
                { search_text: { _ilike: `%${search}%` } },
                ...(norm ? [{ search_text: { _ilike: `%${norm}%` } }] : []),
                ...(digits.length >= 7 ? [{ search_text: { _ilike: `%${digits}%` } }] : []),
            ],
        });
    }
    const where = { _and: and };
    const base = [{ status: { _eq: 'open' } }, { view: { _eq: view } }];

    const T = (alias) => CLUSTER_TYPE(alias);
    const agg = (alias, extra = []) => aggregateQl(
        T(alias), 'aggregate { count sum { member_count } }', { _and: [...base, ...extra] });

    const data = await graph.query(
        queryQl(T('clusters'), {
            where,
            order_by: [{ active_count: 'desc' }, { confidence_rank: 'desc' }, { member_count: 'desc' }, { _id: 'asc' }],
            limit: all ? EXPORT_MAX : limit,
            offset: all ? 0 : (page - 1) * limit,
        }),
        aggregateQl(T('filteredAgg'), 'aggregate { count }', where),
        agg('totalAgg'),
        agg('exactAgg', [{ confidence: { _eq: 'exact' } }]),
        agg('highAgg', [{ confidence: { _eq: 'high' } }]),
        agg('possibleAgg', [{ confidence: { _eq: 'possible' } }]),
        agg('bothActiveAgg', [{ severity: { _eq: 'both_active' } }]),
        queryQl(BRANCH_TYPE, { order_by: [{ name: 'asc' }] }),
    ).then(r => r.data);

    const total = data.filteredAgg.aggregate.count;
    const run = await getLatestRun();

    return res.status(200).json({
        success: true,
        clusters: data.clusters.map(toApiCluster),
        pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        summary: {
            clusters: data.totalAgg.aggregate.count,
            clients: data.totalAgg.aggregate.sum?.member_count ?? 0,
            exact: data.exactAgg.aggregate.count,
            high: data.highAgg.aggregate.count,
            possible: data.possibleAgg.aggregate.count,
            bothActive: data.bothActiveAgg.aggregate.count,
        },
        branches: data.branches ?? [],
        lastRun: run && {
            status: run.status, trigger: run.trigger, startedAt: run.started_at,
            finishedAt: run.finished_at, error: run.error, running: isRunActive(run),
        },
    });
}

// Keep the camelCase shape the page + Excel export already use.
function toApiCluster(c) {
    return {
        clusterId: c._id,
        view: c.view,
        confidence: c.confidence,
        severity: c.severity,
        scenarios: c.scenarios,
        reasons: c.reasons,
        activeCount: c.active_count,
        memberCount: c.member_count,
        exactClosedVsActive: c.exact_closed_vs_active,
        members: c.members,
        firstDetectedAt: c.first_detected_at,
    };
}
