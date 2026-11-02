import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl } from "@/lib/graph/graph.util";
import { SETTINGS_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { logAudit } from "@/lib/audit";
import {
    canManageSuperPassword, SUPER_PASSWORD_MIN_LENGTH, SUPER_PASSWORD_MAX_LENGTH,
} from "@/lib/super-password-access";

const graph = new GraphProvider();
const settingsType = createGraphType('settings', SETTINGS_FIELDS)();

// Switches only the root user may change. The settings page already hides these controls from
// everyone else; this makes the API agree. (superPwd is NOT in this list on purpose: its value
// must never reach the audit log.)
export const ROOT_ONLY_SETTINGS = [
    'allowFaceRecapture',
    'requireClientBiometric',
    'requireStaffBiometric',
    'requireLoanVerificationAtClosing',
];
const flagsType  = createGraphType('settings', ROOT_ONLY_SETTINGS.join(' '))('currentFlags');
const secretType = createGraphType('settings', 'superPwd')('currentSecret');

export default apiHandler({
    post: updateSystemSettings,
    get: getSystemSettings
});

// The general settings API never returns the super password (login reads it from the database,
// the settings page loads it from settings/super-password).
const stripSecrets = (row) => {
    if (!row || typeof row !== 'object') return row;
    const { superPwd, ...safe } = row;
    return safe;
};

async function getSystemSettings(req, res) {
    const { data } = await graph.query(queryQl(settingsType));
    res.send({ success: true, system: stripSecrets(data?.settings?.[0]) });
}

const refuse = (res, message) => res.send({ success: false, error: true, message });

async function updateSystemSettings(req, res) {
    const user = req.auth?.sub ? await findUserById(req.auth.sub) : null;
    if (!user) return refuse(res, 'User not found.');

    const { _id, ...incoming } = req.body || {};
    // An empty/missing id would otherwise produce a where that matches every row
    if (typeof _id !== 'string' || !_id) return refuse(res, '_id is required.');

    const isRoot = user.root === true;
    const system = Object.fromEntries(Object.entries(incoming).filter(([k]) => {
        if (k === 'superPwd') return canManageSuperPassword(user);
        if (ROOT_ONLY_SETTINGS.includes(k)) return isRoot;
        return true;
    }));

    if ('allowFaceRecapture' in system && typeof system.allowFaceRecapture !== 'boolean') {
        return refuse(res, 'allowFaceRecapture must be true or false.');
    }

    // Super password: only when sent by someone allowed to manage it. Unchanged → nothing to write or
    // validate (so a legacy short value never blocks saving the rest of the form). Empty → cleared.
    let secretChange = null;
    if ('superPwd' in system) {
        const next = system.superPwd === '' ? null : system.superPwd;
        const [current] = await graph.query(queryQl(secretType, { where: { _id: { _eq: _id } }, limit: 1 }))
            .then((r) => r.data?.currentSecret ?? []);
        const was = current?.superPwd || null;
        if (next === was) {
            delete system.superPwd;
        } else if (next !== null && (typeof next !== 'string'
            || next.length < SUPER_PASSWORD_MIN_LENGTH || next.length > SUPER_PASSWORD_MAX_LENGTH)) {
            return refuse(res, `The super password must be between ${SUPER_PASSWORD_MIN_LENGTH} and ${SUPER_PASSWORD_MAX_LENGTH} characters.`);
        } else {
            system.superPwd = next;
            secretChange = next === null ? 'cleared' : (was ? 'changed' : 'set');
        }
    }

    if (Object.keys(system).length === 0) return refuse(res, 'No updatable settings were sent.');

    // Only read the current values when a root-only switch is actually being written
    const touched = ROOT_ONLY_SETTINGS.filter((k) => k in system);
    const [before] = touched.length
        ? await graph.query(queryQl(flagsType, { where: { _id: { _eq: _id } }, limit: 1 })).then((r) => r.data?.currentFlags ?? [])
        : [];

    const { data } = await graph.mutation(
      updateQl(settingsType, {
        set: system,
        where: { _id: { _eq: _id } },
      })
    );

    // Accountability: who flipped a root-only switch, and to what
    const actorName = `${user.firstName} ${user.lastName}`;
    for (const key of touched) {
        const from = before?.[key] ?? null;
        if (from === system[key]) continue;
        await logAudit(req, {
            action: 'SYSTEM_SETTING_CHANGED', category: 'SETTINGS', severity: 'WARNING',
            entityType: 'settings', entityId: _id,
            description: `${key} changed from ${from} to ${system[key]} by ${actorName}`,
            userId: user._id, userName: actorName,
            metadata: { key, from, to: system[key] },
        });
    }
    if (secretChange) {
        await logAudit(req, {
            action: 'SYSTEM_SECRET_CHANGED', category: 'SETTINGS', severity: 'CRITICAL',
            entityType: 'settings', entityId: _id,
            description: `Super password ${secretChange} by ${actorName}`,   // the value is never logged
            userId: user._id, userName: actorName,
            metadata: { key: 'superPwd', change: secretChange },
        });
    }

    res.send({ success: true, system: stripSecrets(data?.settings?.returning?.[0]) });
}