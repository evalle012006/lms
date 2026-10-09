import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();
const CSF_GROUP_TYPE = createGraphType('groups', '_id name branchId branchName csfEnabled')('csfGroup');

// root / admin / area managers: any group. Branch managers: only groups in their own branch.
// (Area managers are not scoped to their area here, same as the existing group routes.)
const canToggleGroupCsf = (user, group) => {
    if (!user) return false;
    if (user.root || user.role?.rep <= 2) return true;
    if (user.role?.rep === 3) return !!user.designatedBranchId && group.branchId === user.designatedBranchId;
    return false;
};

export default apiHandler({ post: setGroupCsfEnabled });

async function setGroupCsfEnabled(req, res) {
    const { groupId, csfEnabled } = req.body;

    if (!groupId || typeof csfEnabled !== 'boolean') {
        return res.status(200).json({ success: false, error: true, message: 'groupId and csfEnabled (true/false) are required.' });
    }

    const user = await findUserById(req.auth.sub);

    const [group] = await graph.query(
        queryQl(CSF_GROUP_TYPE, { where: { _id: { _eq: groupId } }, limit: 1 })
    ).then(r => r.data?.csfGroup ?? []);

    if (!group) {
        return res.status(200).json({ success: false, error: true, message: 'Group not found.' });
    }

    if (!canToggleGroupCsf(user, group)) {
        return res.status(200).json({ success: false, error: true, message: 'You are not allowed to change the CSF setting for this group.' });
    }

    if (group.csfEnabled === csfEnabled) {
        return res.status(200).json({ success: true, csfEnabled });
    }

    await graph.mutation(
        updateQl(CSF_GROUP_TYPE, { set: { csfEnabled }, where: { _id: { _eq: groupId } } })
    );

    await logAudit(req, {
        action:      csfEnabled ? 'GROUP_CSF_ENABLED' : 'GROUP_CSF_DISABLED',
        category:    'SETTINGS',
        severity:    'INFO',
        entityType:  'group',
        entityId:    group._id,
        description: `CSF / CSF In ${csfEnabled ? 'enabled' : 'disabled'} for group "${group.name}" by ${user.firstName} ${user.lastName}`,
        beforeData:  { csfEnabled: group.csfEnabled },
        afterData:   { csfEnabled },
        branchId:    group.branchId,
        branchName:  group.branchName,
    });

    return res.status(200).json({ success: true, csfEnabled });
}