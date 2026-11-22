// src/lib/duplicate-hierarchy.js  (server only)
// Division > Region > Area > Branch lookup for the duplicate-clients filters and statistics.
// Each branch row carries areaId / regionId / divisionId, so the scan does not have to store them: the groups only
// keep branch ids (branch_ids) and everything above the branch is resolved here at read time.

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();
const BRANCHES = createGraphType('branches', `_id name areaId regionId divisionId`)('branches');
const AREAS = createGraphType('areas', `_id name regionId divisionId`)('areas');
const REGIONS = createGraphType('regions', `_id name divisionId`)('regions');
const DIVISIONS = createGraphType('divisions', `_id name`)('divisions');

const byName = (a, b) => String(a.name ?? '').localeCompare(String(b.name ?? ''));

export async function loadHierarchy() {
    const d = await graph.query(
        queryQl(BRANCHES, { order_by: [{ name: 'asc' }] }),
        queryQl(AREAS, { order_by: [{ name: 'asc' }] }),
        queryQl(REGIONS, { order_by: [{ name: 'asc' }] }),
        queryQl(DIVISIONS, { order_by: [{ name: 'asc' }] }),
    ).then(r => r.data ?? {});
    return {
        branches: (d.branches ?? []).sort(byName),
        areas: (d.areas ?? []).sort(byName),
        regions: (d.regions ?? []).sort(byName),
        divisions: (d.divisions ?? []).sort(byName),
    };
}

/**
 * Branch ids selected by the Division / Region / Area / Branch filters (all that are set must match).
 * Returns null when no hierarchy filter is set (= no restriction), otherwise an array that may be empty
 * (an empty array means the filters match no branch, so no group can match).
 */
export function branchIdsForFilters(hierarchy, { divisionId, regionId, areaId, branchId } = {}) {
    if (!divisionId && !regionId && !areaId && !branchId) return null;
    return hierarchy.branches
        .filter(b => (!divisionId || b.divisionId === divisionId)
            && (!regionId || b.regionId === regionId)
            && (!areaId || b.areaId === areaId)
            && (!branchId || b._id === branchId))
        .map(b => b._id);
}

/** Hasura condition: a group is kept when ANY of its members belongs to one of these branches. */
export function branchIdsCondition(ids) {
    if (ids === null) return null;
    if (ids.length === 0) return { _id: { _eq: '__no_match__' } };
    return { branch_ids: { _has_keys_any: ids } };
}

/** Intersection of two branch-id restrictions where null means "no restriction". */
export function intersectBranchIds(a, b) {
    if (a === null || a === undefined) return b ?? null;
    if (b === null || b === undefined) return a;
    const set = new Set(b);
    return a.filter(id => set.has(id));
}

/** The hierarchy a scoped caller may pick from: only their branches and the area/region/division above them. */
export function scopeHierarchy(hierarchy, branchIds) {
    if (branchIds === null || branchIds === undefined) return hierarchy;
    const ids = new Set(branchIds);
    const branches = hierarchy.branches.filter(b => ids.has(b._id));
    const areaIds = new Set(branches.map(b => b.areaId).filter(Boolean));
    const regionIds = new Set(branches.map(b => b.regionId).filter(Boolean));
    const divisionIds = new Set(branches.map(b => b.divisionId).filter(Boolean));
    return {
        branches,
        areas: hierarchy.areas.filter(a => areaIds.has(a._id)),
        regions: hierarchy.regions.filter(r => regionIds.has(r._id)),
        divisions: hierarchy.divisions.filter(d => divisionIds.has(d._id)),
    };
}
