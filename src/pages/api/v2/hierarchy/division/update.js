import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import {
    divisionType, nullify, parseIds,
    diffManagerIds, syncManagerLinks, cascadeRegionToDivision
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: update });

async function update(req, res) {
    const { _id, name, managerIds: newManagerIds = [], regionIds: newRegionIds = [] } = req.body;

    // ── Read phase ─────────────────────────────────────────────────────────────
    // divisionType() fetches: _id name managerIds regions { _id }
    const [current] = await graph.query(
        queryQl(divisionType(), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.divisions ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Division not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    // FIX: regionIds is derived from the regions relationship, not a stored column
    const oldRegionIds  = (current.regions ?? []).map(r => r._id);

    // ── Build mutation batch ──────────────────────────────────────────────────
    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    // Manager diff
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    if (removedManagers.length || addedManagers.length) {
        await syncManagerLinks('divisions', removedManagers, addedManagers, {
            divisionId: _id, regionId: null, areaId: null
        }, addToMutationList);
    }

    // Region link diff
    const removedRegions = oldRegionIds.filter(id => !newRegionIds.includes(id));
    const addedRegions   = newRegionIds.filter(id => !oldRegionIds.includes(id));

    if (removedRegions.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
            set: { divisionId: null },
            where: { _id: { _in: removedRegions } }
        }));
        for (const regionId of removedRegions) {
            cascadeRegionToDivision(regionId, null, addToMutationList);
        }
    }

    if (addedRegions.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
            set: { divisionId: _id },
            where: { _id: { _in: addedRegions } }
        }));
        for (const regionId of addedRegions) {
            cascadeRegionToDivision(regionId, _id, addToMutationList);
        }
    }

    // Division record — note: regionIds is not a real column, only managerIds is
    addToMutationList(alias => updateQl(createGraphType('divisions', '_id')(alias), {
        set: { name, managerIds: JSON.stringify(newManagerIds) },
        where: { _id: { _eq: _id } }
    }));

    // ── Single round-trip ─────────────────────────────────────────────────────
    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}