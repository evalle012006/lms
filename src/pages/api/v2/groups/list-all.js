// src/pages/api/v2/groups/list-all.js
// FIX 1: Removed invalid 'lo' join (Hasura relationship not tracked)
// FIX 2: Fetch LO data (loNo, transactionType, branchName) via separate users query
// FIX 3: Added occurence filter param
// FIX 4: Enrich groups with loNo, loTransactionType, branchName before returning

import { GROUP_FIELDS }             from '@/lib/graph.fields';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler }               from '@/services/api-handler';

const graph = new GraphProvider();

// Group type — only uses 'branch' for code filter (already tracked in Hasura)
// No 'lo' join — not a tracked relationship
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');

const USER_TYPE = createGraphType('users', `
    _id loNo transactionType weeklyScheduleType firstName lastName designatedBranch designatedBranchId
`)('users');

const BRANCH_TYPE = createGraphType('branches', `_id name code`)('branches');

export default apiHandler({ get: list });

async function list(req, res) {
    const {
        branchId      = null,
        loId          = null,
        areaManagerId = null,
        occurence     = null,   // FIX: new param — filter groups by occurrence for LO self-view
    } = req.query;

    // ── Area manager branch code lookup (unchanged) ────────────────────────
    const USER_DESIGN_TYPE = createGraphType('users', `designatedBranch`)('users');
    const codes = await graph.query(
        queryQl(USER_DESIGN_TYPE, {
            where: { _id: areaManagerId ? { _eq: areaManagerId } : { _eq: 'null' } }
        })
    ).then(r => r.data.users
        .map(u => jsonTryParse(u.designatedBranch, [u.designatedBranch]))
        .reduce((all, c) => [...all, ...c], [])
    );

    // ── Build where clause ────────────────────────────────────────────────
    const where = {
        branchId:      branchId ? { _eq: branchId } : { _neq: 'null' },
        loanOfficerId: loId     ? { _eq: loId }     : { _neq: 'null' },
        branch: {
            code: codes.length ? { _in: codes } : { _neq: 'null' },
        },
        status: (!branchId && !loId && !codes.length) ? { _eq: 'available' } : { _neq: 'null' },
    };

    // FIX: filter by occurrence when param provided (LO self-view)
    if (occurence) {
        where.occurence = { _eq: occurence };
    }

    // ── Fetch groups ──────────────────────────────────────────────────────
    const groups = await graph.query(
        queryQl(GROUP_TYPE, {
            where,
            order_by: [{ groupNo: 'asc' }],
        })
    ).then(r => r.data.groups ?? []);

    if (!groups.length) {
        return res.status(200).json({ success: true, groups: [] });
    }

    // ── FIX: Fetch LO data for all unique loanOfficerIds in one query ──────
    // Hasura has no tracked relationship from groups→users via loanOfficerId,
    // so we do a separate lookup and merge manually.
    const loIds = [...new Set(groups.map(g => g.loanOfficerId).filter(Boolean))];
    const branchIds = [...new Set(groups.map(g => g.branchId).filter(Boolean))];

    const [loMap, branchMap] = await Promise.all([
        // Fetch all LOs in one query
        loIds.length
            ? graph.query(
                queryQl(USER_TYPE, {
                    where: { _id: { _in: loIds } },
                })
              ).then(r => {
                  const map = {};
                  (r.data.users ?? []).forEach(u => { map[u._id] = u; });
                  return map;
              })
            : Promise.resolve({}),

        // Fetch branch names in one query (branchName is often null in groups table)
        branchIds.length
            ? graph.query(
                queryQl(BRANCH_TYPE, {
                    where: { _id: { _in: branchIds } },
                })
              ).then(r => {
                  const map = {};
                  (r.data.branches ?? []).forEach(b => { map[b._id] = b; });
                  return map;
              })
            : Promise.resolve({}),
    ]);

    // ── Enrich groups with loNo, loTransactionType, branchName ───────────
    const enriched = groups.map(g => {
        const lo     = loMap[g.loanOfficerId]     || null;
        const branch = branchMap[g.branchId]      || null;
        return {
            ...g,
            branchName:        branch?.name || g.branchName || null,
            branchCode:        branch?.code || null,
            loNo:              lo?.loNo             ?? null,
            loTransactionType: lo?.transactionType  || null,
            // NEW: LO's current weekly schedule type — needed to filter out
            // stale-theme duplicate groups on the frontend. null for daily LOs.
            loWeeklyScheduleType: lo?.weeklyScheduleType || null,
            loanOfficerName:   g.loanOfficerName
                || (lo ? `${lo.firstName} ${lo.lastName}`.trim() : null),
        };
    });

    return res.status(200).json({ success: true, groups: enriched });
}

function jsonTryParse(val, fallback) {
    try { return JSON.parse(val); } catch { return fallback; }
}