import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import {
    areaType, nullify, parseIds,
    diffManagerIds, syncManagerLinks,
    syncBranchLinks, cascadeAreaChange
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: update });

async function update(req, res) {
    const { _id, name, regionId, divisionId, managerIds: newManagerIds = [], branchIds: newBranchIds = [] } = req.body;

    // ── Read phase ─────────────────────────────────────────────────────────────
    const [current] = await graph.query(
        queryQl(areaType(), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.areas ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Area not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    const oldBranchIds  = parseIds(current.branchIds);
    const oldRegionId   = current.regionId;
    const oldDivisionId = current.divisionId;

    // ── Build mutation batch ──────────────────────────────────────────────────
    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    // Manager diff
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    if (removedManagers.length || addedManagers.length) {
        await syncManagerLinks('areas', removedManagers, addedManagers, {
            divisionId: nullify(divisionId), regionId: nullify(regionId), areaId: _id
        }, addToMutationList);
    }

    // regionId or divisionId changed — cascade down through branches + users
    if (nullify(regionId) !== nullify(oldRegionId) || nullify(divisionId) !== nullify(oldDivisionId)) {
        cascadeAreaChange(_id, nullify(regionId), nullify(divisionId), addToMutationList);
    }

    // Branch link diff
    syncBranchLinks(newBranchIds, oldBranchIds, _id, nullify(regionId), nullify(divisionId), addToMutationList);

    // Area record itself
    addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
        set: {
            name,
            regionId:   nullify(regionId),
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(newManagerIds),
            branchIds:  JSON.stringify(newBranchIds),
        },
        where: { _id: { _eq: _id } }
    }));

    // ── Single round-trip ─────────────────────────────────────────────────────
    await graph.mutation(...mutationList);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}