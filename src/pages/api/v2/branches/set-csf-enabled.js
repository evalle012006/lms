import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { logAudit } from '@/lib/audit';

const graph = new GraphProvider();
const CSF_BRANCH_TYPE = createGraphType('branches', '_id name code csfEnabled')('csfBranch');

// Only root / admin (rep 1) may change the branch-level CSF switch.
const canToggleBranchCsf = (user) => !!(user?.root || user?.role?.rep === 1);

export default apiHandler({ post: setBranchCsfEnabled });

async function setBranchCsfEnabled(req, res) {
    const { branchId, csfEnabled } = req.body;

    if (!branchId || typeof csfEnabled !== 'boolean') {
        return res.status(200).json({ success: false, error: true, message: 'branchId and csfEnabled (true/false) are required.' });
    }

    const user = await findUserById(req.auth.sub);
    if (!canToggleBranchCsf(user)) {
        return res.status(200).json({ success: false, error: true, message: 'You are not allowed to change the CSF setting for a branch.' });
    }

    const [branch] = await graph.query(
        queryQl(CSF_BRANCH_TYPE, { where: { _id: { _eq: branchId } }, limit: 1 })
    ).then(r => r.data?.csfBranch ?? []);

    if (!branch) {
        return res.status(200).json({ success: false, error: true, message: 'Branch not found.' });
    }

    if (branch.csfEnabled === csfEnabled) {
        return res.status(200).json({ success: true, csfEnabled });
    }

    await graph.mutation(
        updateQl(CSF_BRANCH_TYPE, { set: { csfEnabled }, where: { _id: { _eq: branchId } } })
    );

    await logAudit(req, {
        action:      csfEnabled ? 'BRANCH_CSF_ENABLED' : 'BRANCH_CSF_DISABLED',
        category:    'SETTINGS',   // use whichever category your audit log uses for config changes
        severity:    'INFO',
        entityType:  'branch',
        entityId:    branch._id,
        description: `CSF / CSF In ${csfEnabled ? 'enabled' : 'disabled'} for branch "${branch.name}" by ${user.firstName} ${user.lastName}`,
        beforeData:  { csfEnabled: branch.csfEnabled },
        afterData:   { csfEnabled },
        branchId:    branch._id,
        branchName:  branch.name,
    });

    return res.status(200).json({ success: true, csfEnabled });
}