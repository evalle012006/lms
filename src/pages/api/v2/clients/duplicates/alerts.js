// src/pages/api/v2/clients/duplicates/alerts.js
// GET — dashboard "Duplicate Alerts": open, not-yet-reviewed duplicate groups where more than one loan is active
// (two records of one person each with an active loan, or one client ID with several active loans).
// Same audience as Delinquent Alerts (rep <= 3) and scoped to the caller's branches. Records in branches the
// caller cannot see are reduced to a placeholder — no names, ids or contact details leave their scope.
// Data comes from the stored scan, so it is as fresh as the last scan.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { resolveBranchWhere } from '@/lib/ci-scope';

const graph = new GraphProvider();
const LIMIT = 50;

const CLUSTER_TYPE = createGraphType('duplicate_client_clusters', `
  _id view confidence reasons active_count member_count members first_detected_at
`);

export default apiHandler({ get: alerts });

async function alerts(req, res) {
    const user = await findUserById(req.auth.sub);
    // 200 + success:false, never 403 (403 triggers client-side logout).
    if (!user || !(user.root || user.role?.rep <= 3)) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const scope = await resolveBranchWhere(user);
    if (scope === null) return res.status(200).json({ success: true, total: 0, alerts: [] });
    const scopedIds = scope.branchId ? (scope.branchId._in ?? [scope.branchId._eq].filter(Boolean)) : null; // null = unscoped
    if (scopedIds && scopedIds.length === 0) return res.status(200).json({ success: true, total: 0, alerts: [] });

    const where = {
        _and: [
            { status: { _eq: 'open' } },
            { view: { _in: ['active', 'same_client'] } },
            { severity: { _eq: 'both_active' } },
            { review_status: { _is_null: true } },
            ...(scopedIds ? [{ _or: scopedIds.map(id => ({ branch_ids: { _contains: [id] } })) }] : []),
        ],
    };

    const data = await graph.query(
        queryQl(CLUSTER_TYPE('clusters'), {
            where,
            order_by: [{ active_count: 'desc' }, { first_detected_at: 'desc' }],
            limit: LIMIT,
        }),
        aggregateQl(CLUSTER_TYPE('totalAgg'), 'aggregate { count }', where),
    ).then(r => r.data);

    const inScope = (m) => !scopedIds || scopedIds.includes(m.branchId);

    return res.status(200).json({
        success: true,
        total: data.totalAgg.aggregate.count,
        alerts: data.clusters.map(c => ({
            clusterId: c._id,
            view: c.view,
            confidence: c.confidence,
            reasons: c.reasons,
            activeCount: c.active_count,
            memberCount: c.member_count,
            firstDetectedAt: c.first_detected_at,
            members: c.members.map(m => inScope(m)
                ? {
                    _id: m._id,
                    name: [m.lastName, m.firstName, m.middleName].filter(Boolean).join(', '),
                    branchName: m.branchName ?? null,
                    loName: m.loName ?? null,
                    groupName: m.groupName ?? null,
                    status: m.status,
                    hasActiveLoan: !!m.hasActiveLoan,
                    activeLoan: m.activeLoan ? { loanCycle: m.activeLoan.loanCycle, loanBalance: m.activeLoan.loanBalance } : null,
                    activeLoans: m.activeLoans?.map(l => ({ _id: l._id, loanCycle: l.loanCycle, loanBalance: l.loanBalance, slotNo: l.slotNo })) ?? null,
                    inScope: true,
                }
                : { inScope: false, branchName: m.branchName ?? null, hasActiveLoan: !!m.hasActiveLoan }),
        })),
    });
}
