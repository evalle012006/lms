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
    const {
        _id,
        name,
        regionId,
        divisionId,
        managerIds: newManagerIds = [],
        branchIds:  newBranchIds  = []
    } = req.body;

    // ── Read phase ─────────────────────────────────────────────────────────────
    // areaType() fetches: _id name managerIds regionId divisionId branches { _id }
    const [current] = await graph.query(
        queryQl(areaType('get'), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.areas ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Area not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    // FIX: branchIds derived from branches relationship, not a stored column
    const oldBranchIds  = (current.branches ?? []).map(b => b._id);
    const oldRegionId   = current.regionId;
    const oldDivisionId = current.divisionId;

    // ── 2. Manager diff ───────────────────────────────────────────────────────
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    await syncManagerLinks('areas', removedManagers, addedManagers, {
        divisionId: nullify(divisionId),
        regionId:   nullify(regionId),
        areaId:     _id
    });

    // ── 3. regionId or divisionId changed — cascade down ─────────────────────
    const regionChanged   = nullify(regionId)   !== nullify(oldRegionId);
    const divisionChanged = nullify(divisionId) !== nullify(oldDivisionId);

    if (regionChanged || divisionChanged) {
        await cascadeAreaChange(_id, nullify(regionId), nullify(divisionId));
    }

    // regionId or divisionId changed — cascade down
    if (nullify(regionId) !== nullify(oldRegionId) || nullify(divisionId) !== nullify(oldDivisionId)) {
        cascadeAreaChange(_id, nullify(regionId), nullify(divisionId), addToMutationList);
    }

    // Branch link diff
    syncBranchLinks(newBranchIds, oldBranchIds, _id, nullify(regionId), nullify(divisionId), addToMutationList);

    // Area record — branchIds is not a real column
    addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
        set: {
            name,
            regionId:   nullify(regionId),
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(newManagerIds),
        },
        where: { _id: { _eq: _id } }
    }));

    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}