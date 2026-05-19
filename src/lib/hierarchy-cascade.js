/**
 * src/lib/hierarchy-cascade.js
 *
 * Shared cascade helpers for the hierarchy management APIs.
 * All write operations accept addToMutationList so callers can
 * batch everything into a single graph.mutation(...mutationList) call.
 */

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// ── Type factories — alias always equals table name ───────────────────────────
// Response key in res.data matches the alias, so keep alias === table name.
export const divisionType = () =>
    createGraphType('divisions', `_id name managerIds regionIds`)('divisions');

export const regionType = () =>
    createGraphType('regions', `_id name managerIds areaIds divisionId`)('regions');

export const areaType = () =>
    createGraphType('areas', `_id name managerIds branchIds regionId divisionId`)('areas');

// ── Null-safe value helper ────────────────────────────────────────────────────
export const nullify = (val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '' || str === 'null' || str === 'undefined') return null;
    return val;
};

// ── Parse JSON array stored as varchar ───────────────────────────────────────
export const parseIds = (raw) => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    try { return JSON.parse(raw); } catch { return []; }
};

// ── Manager diff ──────────────────────────────────────────────────────────────
export const diffManagerIds = (oldIds, newIds) => ({
    removed: oldIds.filter(id => !newIds.includes(id)),
    added:   newIds.filter(id => !oldIds.includes(id)),
});

/**
 * Collects manager link mutations into addToMutationList.
 * Reads (queries) still happen immediately since we need current managerIds.
 * All writes are pushed to the batch.
 *
 * @param {'divisions'|'regions'|'areas'} entityTable
 * @param {string[]} removedIds
 * @param {string[]} addedIds
 * @param {{ divisionId, regionId, areaId }} hierarchySet
 * @param {Function} addToMutationList  — (fn) => mutationList.push(fn(alias))
 */
export async function syncManagerLinks(entityTable, removedIds, addedIds, hierarchySet, addToMutationList) {
    // ── Removed managers ──────────────────────────────────────────────────────
    for (const userId of removedIds) {
        // Query: find entities that still reference this user (reads are sequential, not batched)
        const records = await graph.query(
            queryQl(
                createGraphType(entityTable, `_id managerIds`)(entityTable),
                { where: { managerIds: { _like: `%${userId}%` } } }
            )
        ).then(r => r.data[entityTable] ?? []);

        for (const entity of records) {
            const updated = parseIds(entity.managerIds).filter(id => id !== userId);
            addToMutationList(alias => updateQl(
                createGraphType(entityTable, '_id')(alias), {
                    set: { managerIds: JSON.stringify(updated) },
                    where: { _id: { _eq: entity._id } }
                }
            ));
        }

        // Null out the removed manager's hierarchy fields
        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: { divisionId: null, regionId: null, areaId: null, designatedBranchId: null },
                where: { _id: { _eq: userId } }
            }
        ));
    }

    // ── Added managers ────────────────────────────────────────────────────────
    for (const userId of addedIds) {
        // Remove from any other entity of the same type that lists this user
        const records = await graph.query(
            queryQl(
                createGraphType(entityTable, `_id managerIds`)(entityTable),
                { where: { managerIds: { _like: `%${userId}%` } } }
            )
        ).then(r => r.data[entityTable] ?? []);

        for (const entity of records) {
            const updated = parseIds(entity.managerIds).filter(id => id !== userId);
            addToMutationList(alias => updateQl(
                createGraphType(entityTable, '_id')(alias), {
                    set: { managerIds: JSON.stringify(updated) },
                    where: { _id: { _eq: entity._id } }
                }
            ));
        }

        // Stamp the correct hierarchy fields on the user
        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: {
                    divisionId:         nullify(hierarchySet.divisionId) ?? null,
                    regionId:           nullify(hierarchySet.regionId)   ?? null,
                    areaId:             nullify(hierarchySet.areaId)     ?? null,
                    designatedBranchId: null,
                },
                where: { _id: { _eq: userId } }
            }
        ));
    }
}

/**
 * Collects branch link mutations into addToMutationList.
 */
export function syncBranchLinks(newBranchIds, oldBranchIds, areaId, regionId, divisionId, addToMutationList) {
    const removed = oldBranchIds.filter(id => !newBranchIds.includes(id));
    const added   = newBranchIds.filter(id => !oldBranchIds.includes(id));

    if (removed.length > 0) {
        addToMutationList(alias => updateQl(
            createGraphType('branches', '_id')(alias), {
                set: { areaId: null },
                where: { _id: { _in: removed } }
            }
        ));
    }

    if (added.length > 0) {
        addToMutationList(alias => updateQl(
            createGraphType('branches', '_id')(alias), {
                set: {
                    areaId:     nullify(areaId),
                    regionId:   nullify(regionId),
                    divisionId: nullify(divisionId),
                },
                where: { _id: { _in: added } }
            }
        ));
        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: {
                    areaId:     nullify(areaId),
                    regionId:   nullify(regionId),
                    divisionId: nullify(divisionId),
                },
                where: { designatedBranchId: { _in: added } }
            }
        ));
    }
}

/**
 * Queues cascade mutations for a region's divisionId change.
 */
export function cascadeRegionDivisionChange(regionId, divisionId, addToMutationList) {
    addToMutationList(alias => updateQl(createGraphType('areas',    '_id')(alias), {
        set: { divisionId: nullify(divisionId) },
        where: { regionId: { _eq: regionId } }
    }));
    addToMutationList(alias => updateQl(createGraphType('branches', '_id')(alias), {
        set: { divisionId: nullify(divisionId) },
        where: { regionId: { _eq: regionId } }
    }));
    addToMutationList(alias => updateQl(createGraphType('users',    '_id')(alias), {
        set: { divisionId: nullify(divisionId) },
        where: { regionId: { _eq: regionId } }
    }));
}

/**
 * Queues cascade mutations for an area's regionId/divisionId change.
 */
export function cascadeAreaChange(areaId, regionId, divisionId, addToMutationList) {
    addToMutationList(alias => updateQl(createGraphType('branches', '_id')(alias), {
        set: { regionId: nullify(regionId), divisionId: nullify(divisionId) },
        where: { areaId: { _eq: areaId } }
    }));
    addToMutationList(alias => updateQl(createGraphType('users',    '_id')(alias), {
        set: { regionId: nullify(regionId), divisionId: nullify(divisionId) },
        where: { areaId: { _eq: areaId } }
    }));
}

export const cascadeRegionToDivision = cascadeRegionDivisionChange;