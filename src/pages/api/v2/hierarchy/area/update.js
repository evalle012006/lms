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

    // 1. Fetch current state
    const [current] = await graph.query(
        queryQl(areaType('get'), { where: { _id: { _eq: _id } } })
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

    // ── 4. Branch link diff ───────────────────────────────────────────────────
    await syncBranchLinks(
        newBranchIds,
        oldBranchIds,
        _id,
        nullify(regionId),
        nullify(divisionId)
    );

    // ── 5. Update area record ─────────────────────────────────────────────────
    await graph.mutation(
        updateQl(areaType('upd'), {
            set: {
                name,
                regionId:   nullify(regionId),
                divisionId: nullify(divisionId),
                managerIds: JSON.stringify(newManagerIds),
                branchIds:  JSON.stringify(newBranchIds)
            },
            where: { _id: { _eq: _id } }
        })
    );

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}