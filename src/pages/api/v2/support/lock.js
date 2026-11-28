// src/pages/api/v2/support/lock.js
// GET ?groupId= -> current lock | POST { groupId, action: 'acquire'|'release', reason? }
import { apiHandler } from '@/services/api-handler';
import { requireSupportUser, fail } from '@/lib/support-edit-service';
import { getGroupLock, acquireGroupLock, releaseGroupLock, LOCK_MINUTES } from '@/lib/support-lock';

export default apiHandler({ get: status, post: change });

async function status(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const lock = await getGroupLock(String(req.query.groupId ?? ''));
    return res.status(200).json({ success: true, lock, mine: !!lock && lock.locked_by === user._id, minutes: LOCK_MINUTES });
}

async function change(req, res) {
    const user = await requireSupportUser(req, res);
    if (!user) return;
    const { groupId, action, reason } = req.body ?? {};
    if (typeof groupId !== 'string' || !groupId) return fail(res, 'groupId is required.');
    const userName = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
    if (action === 'release') { await releaseGroupLock({ groupId, userId: user._id }); return res.status(200).json({ success: true, lock: null }); }
    if (action !== 'acquire') return fail(res, 'Unknown action.');
    const r = await acquireGroupLock({ groupId, user, userName, reason: typeof reason === 'string' ? reason.slice(0, 200) : null });
    if (!r.ok) return fail(res, `This group is already locked by ${r.lock.user_name || 'another support user'}.`, { lock: r.lock });
    return res.status(200).json({ success: true, lock: r.lock, mine: true, minutes: LOCK_MINUTES });
}
