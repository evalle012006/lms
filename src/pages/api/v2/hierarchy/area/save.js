import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { getCurrentDate } from '@/lib/date-utils';
import { apiHandler } from '@/services/api-handler';
import moment from 'moment';
import {
    areaType, nullify,
    syncManagerLinks, syncBranchLinks
} from '@/lib/hierarchy-cascade';

const graph = new GraphProvider();

export default apiHandler({ post: save });

async function save(req, res) {
    const { name, regionId, divisionId, managerIds = [], branchIds = [] } = req.body;

    const _id = generateUUID();

    // 1. Insert the area
    await graph.mutation(
        insertQl(areaType('ins'), {
            objects: [{
                _id,
                name,
                regionId:   nullify(regionId),
                divisionId: nullify(divisionId),
                managerIds: JSON.stringify(managerIds),
                branchIds:  JSON.stringify(branchIds),
                dateAdded:  moment(getCurrentDate()).format('YYYY-MM-DD')
            }]
        })
    );

    // 2. Link branches — stamp areaId/regionId/divisionId on branches + their users
    if (branchIds.length > 0) {
        await syncBranchLinks(branchIds, [], _id, nullify(regionId), nullify(divisionId));
    }

    // 3. Assign managers — auto-remove from any previous area
    if (managerIds.length > 0) {
        await syncManagerLinks('areas', [], managerIds, {
            divisionId: nullify(divisionId),
            regionId:   nullify(regionId),
            areaId:     _id
        });
        await graph.mutation(
            updateQl(areaType('setMgr'), {
                set: { managerIds: JSON.stringify(managerIds) },
                where: { _id: { _eq: _id } }
            })
        );
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify({ success: true, _id }));
}