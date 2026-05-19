import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import {
    nullify, syncManagerLinks, syncBranchLinks
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, regionId, divisionId, managerIds = [], branchIds = [] } = req.body;

    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    const _id = generateUUID();

    // 1. Insert area
    addToMutationList(alias => insertQl(createGraphType('areas', '_id')(alias), {
        objects: [{
            _id,
            name,
            regionId:   nullify(regionId),
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(managerIds),
            branchIds:  JSON.stringify(branchIds),
            dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
    }));

    // 2. Link branches — stamp areaId/regionId/divisionId on branches + their users
    if (branchIds.length > 0) {
        syncBranchLinks(branchIds, [], _id, nullify(regionId), nullify(divisionId), addToMutationList);
    }

    // 3. Assign managers
    if (managerIds.length > 0) {
        await syncManagerLinks('areas', [], managerIds, {
            divisionId: nullify(divisionId), regionId: nullify(regionId), areaId: _id
        }, addToMutationList);

        addToMutationList(alias => updateQl(createGraphType('areas', '_id')(alias), {
            set: { managerIds: JSON.stringify(managerIds) },
            where: { _id: { _eq: _id } }
        }));
    }

    await graph.mutation(...mutationList);

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}