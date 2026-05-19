import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import {
    divisionType, regionType, nullify, parseIds,
    syncManagerLinks, cascadeRegionToDivision
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, managerIds = [], regionIds = [] } = req.body;

    const _id = generateUUID();

    // 1. Insert the division
    await graph.mutation(
        insertQl(divisionType('ins'), {
            objects: [{
                _id,
                name,
                managerIds: JSON.stringify(managerIds),
                regionIds:  JSON.stringify(regionIds),
                dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD')
            }]
        })
    );

    // 2. Link regions — update each region's divisionId and cascade down
    if (regionIds.length > 0) {
        await graph.mutation(
            updateQl(regionType('linkRegions'), {
                set: { divisionId: _id },
                where: { _id: { _in: regionIds } }
            })
        );
        // Cascade divisionId down through each region's subtree
        for (const regionId of regionIds) {
            await cascadeRegionToDivision(regionId, _id);
        }
    }

    // 3. Assign managers — add them, auto-remove from any previous division
    if (managerIds.length > 0) {
        await syncManagerLinks('divisions', [], managerIds, {
            divisionId: _id,
            regionId:   null,
            areaId:     null
        });
        // Stamp the new division's managerIds
        await graph.mutation(
            updateQl(divisionType('setMgr'), {
                set: { managerIds: JSON.stringify(managerIds) },
                where: { _id: { _eq: _id } }
            })
        );
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}