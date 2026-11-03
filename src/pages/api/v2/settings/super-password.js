// src/pages/api/v2/settings/super-password.js
// GET — the current super password, for the Settings → System page ONLY. Root only.
// The general settings API never returns it; login reads it straight from the database.
import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById }             from '@/lib/graph.functions';
import { logAudit }                 from '@/lib/audit';
import { canManageSuperPassword }   from '@/lib/super-password-access';

const graph = new GraphProvider();
const SECRET_TYPE = createGraphType('settings', '_id superPwd')('superPwdRow');

export default apiHandler({ get: getSuperPassword });

const refuse = (res, message) => res.send({ success: false, error: true, message });

async function getSuperPassword(req, res) {
    const user = req.auth?.sub ? await findUserById(req.auth.sub) : null;
    if (!user) return refuse(res, 'User not found.');
    if (!canManageSuperPassword(user)) return refuse(res, 'Not allowed.');

    const [row] = await graph.query(queryQl(SECRET_TYPE, { limit: 1 })).then((r) => r.data?.superPwdRow ?? []);

    // Viewing a master credential is itself worth a record (the value is never logged)
    const name = `${user.firstName} ${user.lastName}`;
    await logAudit(req, {
        action: 'SYSTEM_SECRET_VIEWED', category: 'SETTINGS', severity: 'WARNING',
        entityType: 'settings', entityId: row?._id ?? null,
        description: `Super password viewed by ${name}`,
        userId: user._id, userName: name, metadata: { key: 'superPwd' },
    });

    res.setHeader('Cache-Control', 'no-store');
    res.send({ success: true, superPwd: row?.superPwd ?? null });
}