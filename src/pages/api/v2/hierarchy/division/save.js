import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import {
    divisionType, nullify,
    syncManagerLinks, cascadeRegionToDivision
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, managerIds = [], regionIds = [] } = req.body;

    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    const _id = generateUUID();

    // 1. Insert division
    addToMutationList(alias => insertQl(createGraphType('divisions', `_id`)(alias), {
        objects: [{
            _id,
            name,
            managerIds: JSON.stringify(managerIds),
            regionIds:  JSON.stringify(regionIds),
            dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
    }));

    // 2. Link regions — stamp divisionId
    if (regionIds.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
            set: { divisionId: _id },
            where: { _id: { _in: regionIds } }
        }));
        // Cascade divisionId down through each linked region's subtree
        for (const regionId of regionIds) {
            cascadeRegionToDivision(regionId, _id, addToMutationList);
        }
    }

    // 3. Assign managers (reads happen inside, writes go to mutationList)
    if (managerIds.length > 0) {
        await syncManagerLinks('divisions', [], managerIds, {
            divisionId: _id, regionId: null, areaId: null
        }, addToMutationList);

        // Stamp managerIds on the new division record
        addToMutationList(alias => updateQl(createGraphType('divisions', '_id')(alias), {
            set: { managerIds: JSON.stringify(managerIds) },
            where: { _id: { _eq: _id } }
        }));
    }

    // Single round-trip for all writes
    await graph.mutation(...mutationList);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}