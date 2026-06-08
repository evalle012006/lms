import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import { nullify, syncManagerLinks, cascadeRegionToDivision } from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, managerIds = [], regionIds = [] } = req.body;

    const _id = generateUUID();

    // 1. Insert division — only real columns
    addToMutationList(alias => insertQl(createGraphType('divisions', `_id`)(alias), {
        objects: [{
            _id,
            name,
            managerIds: JSON.stringify(managerIds),
            dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
    }));

    // 2. Stamp divisionId on linked regions and cascade down
    if (regionIds.length > 0) {
        addToMutationList(alias => updateQl(createGraphType('regions', '_id')(alias), {
            set: { divisionId: _id },
            where: { _id: { _in: regionIds } }
        }));
        for (const regionId of regionIds) {
            await cascadeRegionToDivision(regionId, _id);
        }
    }

    // 3. Assign managers
    if (managerIds.length > 0) {
        await syncManagerLinks('divisions', [], managerIds, {
            divisionId: _id, regionId: null, areaId: null
        }, addToMutationList);
    }

    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}