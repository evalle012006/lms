import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import {
    regionType, areaType, nullify, parseIds,
    diffManagerIds, syncManagerLinks,
    cascadeRegionDivisionChange, cascadeAreaChange
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: update });

async function update(req, res) {
    const {
        _id,
        name,
        divisionId,
        managerIds: newManagerIds = [],
        areaIds:    newAreaIds    = []
    } = req.body;

    // ── Read phase ─────────────────────────────────────────────────────────────
    // regionType() fetches: _id name managerIds divisionId areas { _id }
    const [current] = await graph.query(
        queryQl(regionType('get'), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.regions ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Region not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    // FIX: areaIds derived from areas relationship, not a stored column
    const oldAreaIds    = (current.areas ?? []).map(a => a._id);
    const oldDivisionId = current.divisionId;

    // ── 2. Manager diff ───────────────────────────────────────────────────────
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    await syncManagerLinks('regions', removedManagers, addedManagers, {
        divisionId: nullify(divisionId),
        regionId:   _id,
        areaId:     null
    });

    // divisionId changed — cascade down
    if (nullify(divisionId) !== nullify(oldDivisionId)) {
        await cascadeRegionDivisionChange(_id, nullify(divisionId));
    }

    // ── 4. Area link diff ─────────────────────────────────────────────────────
    const removedAreas = oldAreaIds.filter(id => !newAreaIds.includes(id));
    const addedAreas   = newAreaIds.filter(id => !oldAreaIds.includes(id));

    // Unlink removed areas — null their regionId, keep divisionId as-is
    if (removedAreas.length > 0) {
        await graph.mutation(
            updateQl(areaType('unlinkAreas'), {
                set: { regionId: null },
                where: { _id: { _in: removedAreas } }
            })
        );
        // Cascade null regionId down to their branches/users
        for (const areaId of removedAreas) {
            await cascadeAreaChange(areaId, null, nullify(divisionId));
        }
    }

    // Link added areas — stamp regionId + divisionId and cascade down
    if (addedAreas.length > 0) {
        await graph.mutation(
            updateQl(areaType('linkAreas'), {
                set: {
                    regionId:   _id,
                    divisionId: nullify(divisionId)
                },
                where: { _id: { _in: addedAreas } }
            })
        );
        for (const areaId of addedAreas) {
            await cascadeAreaChange(areaId, _id, nullify(divisionId));
        }
    }

    // Region record — areaIds is not a real column
    addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
        set: {
            name,
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