import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import {
    regionType, nullify, parseIds,
    diffManagerIds, syncManagerLinks,
    cascadeRegionDivisionChange, cascadeAreaChange
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: update });

async function update(req, res) {
    const { _id, name, divisionId, managerIds: newManagerIds = [], areaIds: newAreaIds = [] } = req.body;

    // ── Read phase ─────────────────────────────────────────────────────────────
    const [current] = await graph.query(
        queryQl(regionType(), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.regions ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Region not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    const oldAreaIds    = parseIds(current.areaIds);
    const oldDivisionId = current.divisionId;

    // ── Build mutation batch ──────────────────────────────────────────────────
    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    // Manager diff
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    if (removedManagers.length || addedManagers.length) {
        await syncManagerLinks('regions', removedManagers, addedManagers, {
            divisionId: nullify(divisionId), regionId: _id, areaId: null
        }, addToMutationList);
    }

    // divisionId change — cascade down through all areas/branches/users of this region
    if (nullify(divisionId) !== nullify(oldDivisionId)) {
        cascadeRegionDivisionChange(_id, nullify(divisionId), addToMutationList);
    }

    // Area link diff
    const removedAreas = oldAreaIds.filter(id => !newAreaIds.includes(id));
    const addedAreas   = newAreaIds.filter(id => !oldAreaIds.includes(id));

    if (removedAreas.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
            set: { regionId: null },
            where: { _id: { _in: removedAreas } }
        }));
        for (const areaId of removedAreas) {
            cascadeAreaChange(areaId, null, nullify(divisionId), addToMutationList);
        }
    }

    if (addedAreas.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
            set: { regionId: _id, divisionId: nullify(divisionId) },
            where: { _id: { _in: addedAreas } }
        }));
        for (const areaId of addedAreas) {
            cascadeAreaChange(areaId, _id, nullify(divisionId), addToMutationList);
        }
    }

    // Region record itself
    addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
        set: {
            name,
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(newManagerIds),
            areaIds:    JSON.stringify(newAreaIds),
        },
        where: { _id: { _eq: _id } }
    }));

    // ── Single round-trip ─────────────────────────────────────────────────────
    await graph.mutation(...mutationList);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}