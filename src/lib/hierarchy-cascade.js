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

// ── Manager diff helpers ──────────────────────────────────────────────────────

/**
 * Collects manager link mutations into addToMutationList.
 * Reads still happen immediately — writes go to the batch.
 */
export async function syncManagerLinks(entityTable, removedIds, addedIds, hierarchySet, addToMutationList) {
    for (const userId of removedIds) {
        const records = await graph.query(
            queryQl(
                createGraphType(entityTable, `_id managerIds`)(alias('find')),
                { where: { managerIds: { _like: `%${userId}%` } } }
            )
        ).then(r => r.data[entityTable] ?? []);

        for (const entity of entityRecords) {
            const updated = parseIds(entity.managerIds).filter(id => id !== userId);
            mutations.push(
                updateQl(createGraphType(entityTable, '_id')(alias('rmMgr')), {
                    set: { managerIds: JSON.stringify(updated) },
                    where: { _id: { _eq: entity._id } }
                })
            );
        }

        addToMutationList(alias => updateQl(
            createGraphType('users', '_id')(alias), {
                set: { divisionId: null, regionId: null, areaId: null, designatedBranchId: null },
                where: { _id: { _eq: userId } }
            })
        );
    }

    for (const userId of addedIds) {
        const records = await graph.query(
            queryQl(
                createGraphType(entityTable, `_id managerIds`)(alias('findAdd')),
                { where: { managerIds: { _like: `%${userId}%` } } }
            )
        ).then(r => r.data[entityTable] ?? []);

        for (const entity of entityRecords) {
            const updated = parseIds(entity.managerIds).filter(id => id !== userId);
            mutations.push(
                updateQl(createGraphType(entityTable, '_id')(alias('addRm')), {
                    set: { managerIds: JSON.stringify(updated) },
                    where: { _id: { _eq: entity._id } }
                })
            );
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
            })
        );
    }

    if (mutations.length > 0) {
        await graph.mutation(...mutations);
    }
}

// ── Branch linking helpers ────────────────────────────────────────────────────

/**
 * When branches are linked to an area:
 *   - Update the branch's areaId, regionId, divisionId
 *   - Update all users under that branch (by designatedBranchId)
 *
 * When branches are unlinked from an area:
 *   - Null out areaId on the branch (regionId/divisionId left as-is —
 *     they'll be corrected when the branch is reassigned)
 *   - Leave user fields alone (they'll be corrected on reassignment)
 */
export async function syncBranchLinks(
    newBranchIds,
    oldBranchIds,
    areaId,
    regionId,
    divisionId
) {
    const removed = oldBranchIds.filter(id => !newBranchIds.includes(id));
    const added   = newBranchIds.filter(id => !oldBranchIds.includes(id));

    const mutations = [];
    let aliasCounter = 0;
    const alias = (prefix) => `${prefix}_${aliasCounter++}`;

    // Unlink removed branches — null areaId only
    if (removed.length > 0) {
        mutations.push(
            updateQl(branchType(alias('rmBranch')), {
                set: { areaId: null },
                where: { _id: { _in: removed } }
            })
        );
    }

    // Link added branches — stamp all three IDs
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
            })
        );
    }

    if (mutations.length > 0) {
        await graph.mutation(...mutations);
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

/**
 * When a region is linked to a new division, cascade that divisionId
 * down through the region's full subtree.
 */
export async function cascadeRegionToDivision(regionId, divisionId) {
    await cascadeRegionDivisionChange(regionId, divisionId);
}