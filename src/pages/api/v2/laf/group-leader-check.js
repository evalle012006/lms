import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { canDecideCI, isBranchInScope } from '@/lib/ci-scope';

const graph = new GraphProvider();
const CLIENT_TYPE = createGraphType('client', '_id firstName lastName status groupLeader groupId')('clients');
const GROUP_TYPE  = createGraphType('groups', '_id branchId')('groups');

export default apiHandler({ get: checkGroupLeader });

async function checkGroupLeader(req, res) {
    const { groupId, excludeClientId } = req.query;
    if (typeof groupId !== 'string' || !groupId) {
        return res.status(200).json({ success: false, message: 'groupId required.' });
    }

    const user = await findUserById(req.auth?.sub);
    if (!user || !canDecideCI(user)) {
        return res.status(200).json({ success: false, message: 'Not allowed.' });
    }

    const [group] = await graph.query(
        queryQl(GROUP_TYPE, { where: { _id: { _eq: groupId } }, limit: 1 })
    ).then(r => r.data?.groups ?? []);

    if (!group || !(await isBranchInScope(user, group.branchId))) {
        return res.status(200).json({ success: false, message: 'Group not found.' });
    }

    const where = {
        groupId:     { _eq: groupId },
        groupLeader: { _eq: true },
        status:      { _in: ['active', 'pending'] },
    };
    if (typeof excludeClientId === 'string' && excludeClientId) {
        where._id = { _neq: excludeClientId };
    }

    const existingLeaders = await graph.query(
        queryQl(CLIENT_TYPE, { where })
    ).then(r => r.data?.clients ?? []);

    return res.status(200).json({
        success: true,
        hasExistingLeader: existingLeaders.length > 0,
        existingLeaders: existingLeaders.map(c => ({
            _id: c._id, firstName: c.firstName, lastName: c.lastName, status: c.status,
        })),
    });
}