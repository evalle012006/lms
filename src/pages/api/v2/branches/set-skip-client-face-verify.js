import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { logAudit } from '@/lib/audit';
import { OFFLINE_MODE_DEFAULT_DAYS, OFFLINE_MODE_MAX_DAYS } from '@/lib/offline-mode';

const graph = new GraphProvider();
const BRANCH_TYPE = createGraphType('branches', '_id name code skipClientFaceVerify skipClientFaceVerifyUntil')('faceSkipBranch');

// Same rule as the CSF toggle: root / admin (rep 1) only.
const canToggle = (user) => !!(user?.root || user?.role?.rep === 1);

export default apiHandler({ post: setSkipClientFaceVerify });

const fail = (res, message) => res.status(200).json({ success: false, error: true, message });

async function setSkipClientFaceVerify(req, res) {
    const { branchId, skipClientFaceVerify } = req.body;

    if (!branchId || typeof skipClientFaceVerify !== 'boolean') {
        return fail(res, 'branchId and skipClientFaceVerify (true/false) are required.');
    }

    let until = null;
    let days = null;
    if (skipClientFaceVerify) {
        days = req.body.days === undefined ? OFFLINE_MODE_DEFAULT_DAYS : Number(req.body.days);
        if (!Number.isInteger(days) || days < 1 || days > OFFLINE_MODE_MAX_DAYS) {
            return fail(res, `days must be a whole number from 1 to ${OFFLINE_MODE_MAX_DAYS}.`);
        }
        until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    const user = await findUserById(req.auth.sub);
    if (!canToggle(user)) return fail(res, 'You are not allowed to change offline mode for a branch.');

    const [branch] = await graph.query(
        queryQl(BRANCH_TYPE, { where: { _id: { _eq: branchId } }, limit: 1 })
    ).then(r => r.data?.faceSkipBranch ?? []);

    if (!branch) return fail(res, 'Branch not found.');

    // Enabling always writes (it extends an active or expired window); disabling is a no-op if already off.
    if (!skipClientFaceVerify && branch.skipClientFaceVerify === false && !branch.skipClientFaceVerifyUntil) {
        return res.status(200).json({ success: true, skipClientFaceVerify, skipClientFaceVerifyUntil: null });
    }

    await graph.mutation(
        updateQl(BRANCH_TYPE, {
            set: { skipClientFaceVerify, skipClientFaceVerifyUntil: until },
            where: { _id: { _eq: branchId } },
        })
    );

    await logAudit(req, {
        action:      skipClientFaceVerify ? 'BRANCH_FACE_VERIFY_SKIP_ENABLED' : 'BRANCH_FACE_VERIFY_SKIP_DISABLED',
        category:    'SETTINGS',
        severity:    skipClientFaceVerify ? 'WARNING' : 'INFO', // enabling weakens a control
        entityType:  'branch',
        entityId:    branch._id,
        description: skipClientFaceVerify
            ? `Offline mode (client face verification skipped, photo upload instead) enabled for branch "${branch.name}" for ${days} day(s), until ${until}, by ${user.firstName} ${user.lastName}`
            : `Offline mode disabled for branch "${branch.name}" by ${user.firstName} ${user.lastName}`,
        beforeData:  { skipClientFaceVerify: branch.skipClientFaceVerify, skipClientFaceVerifyUntil: branch.skipClientFaceVerifyUntil ?? null },
        afterData:   { skipClientFaceVerify, skipClientFaceVerifyUntil: until },
        branchId:    branch._id,
        branchName:  branch.name,
    });

    return res.status(200).json({ success: true, skipClientFaceVerify, skipClientFaceVerifyUntil: until });
}