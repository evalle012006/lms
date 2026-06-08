import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import { nullify, syncManagerLinks, syncBranchLinks } from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, regionId, divisionId, managerIds = [], branchIds = [] } = req.body;

    const mutationList = [];
    const addToMutationList = (fn) => mutationList.push(fn(`bulk_${mutationList.length}`));

    const _id = generateUUID();

    // 1. Insert area — only real columns (no branchIds column)
    addToMutationList(alias => insertQl(createGraphType('areas', '_id')(alias), {
        objects: [{
            _id,
            name,
            regionId:   nullify(regionId),
            divisionId: nullify(divisionId),
            managerIds: JSON.stringify(managerIds),
            dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD'),
        }]
    }));

    // 2. Stamp areaId/regionId/divisionId on linked branches + their users
    if (branchIds.length > 0) {
        syncBranchLinks(branchIds, [], _id, nullify(regionId), nullify(divisionId), addToMutationList);
    }

    // 3. Assign managers
    if (managerIds.length > 0) {
        await syncManagerLinks('areas', [], managerIds, {
            divisionId: nullify(divisionId), regionId: nullify(regionId), areaId: _id
        }, addToMutationList);
    }

    if (mutationList.length > 0) {
        await graph.mutation(...mutationList);
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}