// ─────────────────────────────────────────────────────────────────────────────
// src/pages/api/v2/hierarchy/region/save.js
// ─────────────────────────────────────────────────────────────────────────────
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import { nullify, syncManagerLinks, cascadeAreaChange } from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, divisionId, managerIds = [], areaIds = [] } = req.body;

    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    const _id = generateUUID();

    // 1. Insert region — only real columns (no areaIds column)
    addToMutationList(alias => insertQl(createGraphType('regions', '_id')(alias), {
        objects: [{
            _id,
            name,
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(managerIds),
            dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
    }));

    // 2. Stamp regionId + divisionId on linked areas and cascade down
    if (areaIds.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
            set: { regionId: _id, divisionId: nullify(divisionId) },
            where: { _id: { _in: areaIds } }
        }));
        for (const areaId of areaIds) {
            cascadeAreaChange(areaId, _id, nullify(divisionId), addToMutationList);
        }
    }

    // 3. Assign managers
    if (managerIds.length > 0) {
        await syncManagerLinks('regions', [], managerIds, {
            divisionId: nullify(divisionId), regionId: _id, areaId: null
        }, addToMutationList);
    }

    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}