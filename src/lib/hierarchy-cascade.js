/**
 * src/lib/hierarchy-cascade.js
 *
 * branchIds, areaIds, regionIds are NOT real DB columns —
 * they are derived from the branches/areas/regions relationships.
 * We query those relationships to get the current linked IDs.
 * updated ----
 */

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// ── Type factories — only real columns, alias === table name ──────────────────
export const divisionType = () =>
    createGraphType('divisions', `
        _id
        name
        managerIds
        regions { _id }
    `)('divisions');

export const regionType = () =>
    createGraphType('regions', `
        _id
        name
        managerIds
        divisionId
        areas { _id }
    `)('regions');

export const areaType = () =>
    createGraphType('areas', `
        _id
        name
        managerIds
        regionId
        divisionId
        branches { _id }
    `)('areas');

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
 * Reads still happen immediately — writes go to the batch.
 */
export async function syncManagerLinks(entityTable, removedIds, addedIds, hierarchySet, addToMutationList) {
    for (const userId of removedIds) {
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

        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: { divisionId: null, regionId: null, areaId: null, designatedBranchId: null },
                where: { _id: { _eq: userId } }
            }
        ));
    }

    for (const userId of addedIds) {
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
                set: { areaId: nullify(areaId), regionId: nullify(regionId), divisionId: nullify(divisionId) },
                where: { _id: { _in: added } }
            }
        ));
        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: { areaId: nullify(areaId), regionId: nullify(regionId), divisionId: nullify(divisionId) },
                where: { designatedBranchId: { _in: added } }
            }
        ));
    }
}

export function cascadeRegionDivisionChange(regionId, divisionId, addToMutationList) {
    addToMutationList(alias => updateQl(createGraphType('areas',    '_id')(alias), {
        set: { divisionId: nullify(divisionId) }, where: { regionId: { _eq: regionId } }
    }));
    addToMutationList(alias => updateQl(createGraphType('branches', '_id')(alias), {
        set: { divisionId: nullify(divisionId) }, where: { regionId: { _eq: regionId } }
    }));
    addToMutationList(alias => updateQl(createGraphType('users',    '_id')(alias), {
        set: { divisionId: nullify(divisionId) }, where: { regionId: { _eq: regionId } }
    }));
}

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