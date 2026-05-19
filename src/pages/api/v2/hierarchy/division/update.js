import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import {
    divisionType, regionType, nullify, parseIds,
    diffManagerIds, syncManagerLinks, cascadeRegionToDivision
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: update });

async function update(req, res) {
    const { _id, name, managerIds: newManagerIds = [], regionIds: newRegionIds = [] } = req.body;

    // 1. Fetch current state of the division
    const [current] = await graph.query(
        queryQl(divisionType('get'), { where: { _id: { _eq: _id } } })
    ).then(r => r.data.divisions ?? []);

    if (!current) {
        return res.status(200)
            .setHeader('Content-Type', 'application/json')
            .end(JSON.stringify({ error: true, message: 'Division not found' }));
    }

    const oldManagerIds = parseIds(current.managerIds);
    const oldRegionIds  = parseIds(current.regionIds);

    // ── 2. Manager diff ───────────────────────────────────────────────────────
    const { removed: removedManagers, added: addedManagers } = diffManagerIds(oldManagerIds, newManagerIds);
    await syncManagerLinks('divisions', removedManagers, addedManagers, {
        divisionId: _id,
        regionId:   null,
        areaId:     null
    });

    // ── 3. Region link diff ───────────────────────────────────────────────────
    const removedRegions = oldRegionIds.filter(id => !newRegionIds.includes(id));
    const addedRegions   = newRegionIds.filter(id => !oldRegionIds.includes(id));

    // Unlink removed regions — null their divisionId and cascade down
    if (removedRegions.length > 0) {
        await graph.mutation(
            updateQl(regionType('unlinkRegions'), {
                set: { divisionId: null },
                where: { _id: { _in: removedRegions } }
            })
        );
        for (const regionId of removedRegions) {
            await cascadeRegionToDivision(regionId, null);
        }
    }

    // Link added regions — set their divisionId and cascade down
    if (addedRegions.length > 0) {
        await graph.mutation(
            updateQl(regionType('linkRegions'), {
                set: { divisionId: _id },
                where: { _id: { _in: addedRegions } }
            })
        );
        for (const regionId of addedRegions) {
            await cascadeRegionToDivision(regionId, _id);
        }
    }

    // ── 4. Update division record itself ──────────────────────────────────────
    await graph.mutation(
        updateQl(divisionType('upd'), {
            set: {
                name,
                managerIds: JSON.stringify(newManagerIds),
                regionIds:  JSON.stringify(newRegionIds)
            },
            where: { _id: { _eq: _id } }
        })
    );

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true }));
}