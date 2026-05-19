/**
 * src/lib/hierarchy-cascade.js
 *
 * Shared cascade helpers for the hierarchy management APIs.
 * All save/update endpoints (division, region, area) import from here
 * to keep cascade logic in one place and consistent.
 */

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';

const graph = new GraphProvider();

// ── Type factories ────────────────────────────────────────────────────────────
export const divisionType = (alias) => createGraphType('divisions', `_id name managerIds regionIds`)(alias ?? 'divisions');
export const regionType   = (alias) => createGraphType('regions',   `_id name managerIds areaIds divisionId`)(alias ?? 'regions');
export const areaType     = (alias) => createGraphType('areas',     `_id name managerIds branchIds regionId divisionId`)(alias ?? 'areas');
export const branchType   = (alias) => createGraphType('branches',  `_id areaId regionId divisionId`)(alias ?? 'branches');
export const userType     = (alias) => createGraphType('users',     `_id areaId regionId divisionId designatedBranchId role`)(alias ?? 'users');

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
 * Given the old managerIds on an entity and the new managerIds from the form,
 * returns which IDs were removed and which were added.
 */
export const diffManagerIds = (oldIds, newIds) => {
    const removed = oldIds.filter(id => !newIds.includes(id));
    const added   = newIds.filter(id => !oldIds.includes(id));
    return { removed, added };
};

/**
 * For each removed manager:
 *   1. Find all entities of entityTable whose managerIds contains this userId
 *      (i.e. the entity they are currently linked to — could be multiple but
 *       per business rule it should be one).
 *   2. Remove the userId from that entity's managerIds.
 *   3. Null out the user's hierarchy fields per their role.
 *
 * For each added manager:
 *   1. Update the user's hierarchy fields.
 *
 * @param {'divisions'|'regions'|'areas'} entityTable
 * @param {string[]} removedIds   — user IDs being unlinked
 * @param {string[]} addedIds     — user IDs being linked
 * @param {object}  hierarchySet  — { divisionId, regionId, areaId } to stamp on added users
 */
export async function syncManagerLinks(entityTable, removedIds, addedIds, hierarchySet) {
    const mutations = [];
    let aliasCounter = 0;
    const alias = (prefix) => `${prefix}_${aliasCounter++}`;

    // ── REMOVED managers ─────────────────────────────────────────────────────
    for (const userId of removedIds) {
        // Find all entities that still list this user in their managerIds
        // (varchar JSON array — use LIKE)
        const entityRecords = await graph.query(
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

        // Null out the user's hierarchy fields
        mutations.push(
            updateQl(userType(alias('rmUser')), {
                set: { divisionId: null, regionId: null, areaId: null, designatedBranchId: null },
                where: { _id: { _eq: userId } }
            })
        );
    }

    // ── ADDED managers ────────────────────────────────────────────────────────
    for (const userId of addedIds) {
        // Also remove from any OTHER entity of the same type that currently lists them
        const entityRecords = await graph.query(
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

        // Stamp correct hierarchy on the user
        mutations.push(
            updateQl(userType(alias('addUser')), {
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
        mutations.push(
            updateQl(branchType(alias('addBranch')), {
                set: {
                    areaId:     nullify(areaId),
                    regionId:   nullify(regionId),
                    divisionId: nullify(divisionId)
                },
                where: { _id: { _in: added } }
            })
        );

        // Cascade to users under those branches
        mutations.push(
            updateQl(userType(alias('addBranchUsers')), {
                set: {
                    areaId:     nullify(areaId),
                    regionId:   nullify(regionId),
                    divisionId: nullify(divisionId)
                },
                where: { designatedBranchId: { _in: added } }
            })
        );
    }

    if (mutations.length > 0) {
        await graph.mutation(...mutations);
    }
}

/**
 * Full downward cascade when a region's divisionId changes.
 * Updates: areas → branches → users (all filtered by regionId).
 */
export async function cascadeRegionDivisionChange(regionId, divisionId) {
    await graph.mutation(
        updateQl(areaType('casc_area'), {
            set: { divisionId: nullify(divisionId) },
            where: { regionId: { _eq: regionId } }
        }),
        updateQl(branchType('casc_branch'), {
            set: { divisionId: nullify(divisionId) },
            where: { regionId: { _eq: regionId } }
        }),
        updateQl(userType('casc_user'), {
            set: { divisionId: nullify(divisionId) },
            where: { regionId: { _eq: regionId } }
        })
    );
}

/**
 * Full downward cascade when an area's regionId or divisionId changes.
 * Updates: branches → users (all filtered by areaId).
 */
export async function cascadeAreaChange(areaId, regionId, divisionId) {
    await graph.mutation(
        updateQl(branchType('casc_branch'), {
            set: {
                regionId:   nullify(regionId),
                divisionId: nullify(divisionId)
            },
            where: { areaId: { _eq: areaId } }
        }),
        updateQl(userType('casc_user'), {
            set: {
                regionId:   nullify(regionId),
                divisionId: nullify(divisionId)
            },
            where: { areaId: { _eq: areaId } }
        })
    );
}

/**
 * When a region is linked to a new division, cascade that divisionId
 * down through the region's full subtree.
 */
export async function cascadeRegionToDivision(regionId, divisionId) {
    await cascadeRegionDivisionChange(regionId, divisionId);
}