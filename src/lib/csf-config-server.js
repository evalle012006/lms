import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { isCsfEnabled } from '@/lib/csf-utils';
import logger from '@/logger';

const graph = new GraphProvider();
const CSF_GROUP_TYPE  = createGraphType('groups',   '_id branchId csfEnabled')('csfGroup');
const CSF_BRANCH_TYPE = createGraphType('branches', '_id csfEnabled')('csfBranch');

// Resolves from the DB (group -> its branch), never from client-supplied branch ids.
// Fails open (enabled = today's behavior) and logs, so a missing column/permission can't block saves.
export async function loadCsfEnabled(groupId) {
    if (!groupId) return true;
    try {
        const [group] = await graph.query(
            queryQl(CSF_GROUP_TYPE, { where: { _id: { _eq: groupId } }, limit: 1 })
        ).then(r => r.data?.csfGroup ?? []);
        if (!group) return true;

        const [branch] = await graph.query(
            queryQl(CSF_BRANCH_TYPE, { where: { _id: { _eq: group.branchId } }, limit: 1 })
        ).then(r => r.data?.csfBranch ?? []);

        return isCsfEnabled(branch, group);
    } catch (e) {
        logger.warn({ page: 'csf-config', message: 'Could not resolve csfEnabled, defaulting to enabled', groupId, error: e.message });
        return true;
    }
}