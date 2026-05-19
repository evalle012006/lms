// ─────────────────────────────────────────────────────────────────────────────
// src/pages/api/v2/hierarchy/region/save.js
// ─────────────────────────────────────────────────────────────────────────────
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import {
    regionType, areaType, nullify, parseIds,
    syncManagerLinks, cascadeAreaChange
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, divisionId, managerIds = [], areaIds = [] } = req.body;

    const _id = generateUUID();

    // 1. Insert the region
    await graph.mutation(
        insertQl(regionType('ins'), {
            objects: [{
                _id,
                name,
                divisionId: nullify(divisionId),
                managerIds: JSON.stringify(managerIds),
                areaIds:    JSON.stringify(areaIds),
                dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD')
            }]
        })
    );

    // 2. Link areas — update each area's regionId + divisionId and cascade down
    if (areaIds.length > 0) {
        await graph.mutation(
            updateQl(areaType('linkAreas'), {
                set: {
                    regionId:   _id,
                    divisionId: nullify(divisionId)
                },
                where: { _id: { _in: areaIds } }
            })
        );
        for (const areaId of areaIds) {
            await cascadeAreaChange(areaId, _id, divisionId);
        }
    }

    // 3. Assign managers
    if (managerIds.length > 0) {
        await syncManagerLinks('regions', [], managerIds, {
            divisionId: nullify(divisionId),
            regionId:   _id,
            areaId:     null
        });
        await graph.mutation(
            updateQl(regionType('setMgr'), {
                set: { managerIds: JSON.stringify(managerIds) },
                where: { _id: { _eq: _id } }
            })
        );
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}