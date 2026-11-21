// src/lib/audit.js
// Centralized audit logger — call from any API handler.
// Writes to public.audit_logs table via direct GraphQL insert.
// Non-blocking — failures are logged to console but don't break the request.

import { GraphProvider }              from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl }  from '@/lib/graph/graph.util';
import { generateUUID }               from '@/lib/utils';
import { redactBiometrics }           from '@/lib/audit-redact';
import moment                         from 'moment';

// Resolve userName/userRole/branchName when the caller only has ids (most endpoints pass just req.auth.sub).
// Cached briefly so a burst of audit rows costs one lookup per user/branch.
const NAME_TTL_MS = 5 * 60 * 1000;
const nameCache = new Map();
async function cached(key, loader) {
    const hit = nameCache.get(key);
    if (hit && Date.now() - hit.at < NAME_TTL_MS) return hit.value;
    let value = null;
    try { value = await loader(); } catch (e) { /* names are best-effort */ }
    if (nameCache.size > 2000) nameCache.clear();
    nameCache.set(key, { at: Date.now(), value });
    return value;
}
const USER_NAME_TYPE = createGraphType('users', '_id firstName lastName role')('audit_user');
const BRANCH_NAME_TYPE = createGraphType('branches', '_id name')('audit_branch');
export const resolveUserName = (id) => cached(`u:${id}`, async () => {
    const [u] = await graph.query(queryQl(USER_NAME_TYPE, { where: { _id: { _eq: id } }, limit: 1 })).then(r => r.data?.audit_user ?? []);
    return u ? { name: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || null, role: u.role?.name ?? u.role?.shortCode ?? null } : null;
});
export const resolveBranchName = (id) => cached(`b:${id}`, async () => {
    const [b] = await graph.query(queryQl(BRANCH_NAME_TYPE, { where: { _id: { _eq: id } }, limit: 1 })).then(r => r.data?.audit_branch ?? []);
    return b?.name ?? null;
});

const graph = new GraphProvider();

const AUDIT_TYPE = createGraphType('audit_logs', `
    _id timestamp userId userName userRole
    branchId branchName action category severity
    entityType entityId clientId description
    beforeData afterData metadata
    success failReason ipAddress userAgent
`)('audit_logs');

/**
 * logAudit — fire-and-forget audit log insert.
 *
 * @param {object} req          — Next.js request (for IP + userAgent extraction)
 * @param {object} params
 * @param {string} params.action      — e.g. 'CI_APPROVED', 'LAF_SUBMITTED'
 * @param {string} params.category    — 'CI' | 'LAF' | 'BIOMETRIC' | 'LOAN' | 'QR' | 'AUTH'
 * @param {string} [params.severity]  — 'INFO' | 'WARNING' | 'CRITICAL'  (default: 'INFO')
 * @param {string} [params.entityType]
 * @param {string} [params.entityId]
 * @param {string} [params.description]
 * @param {object} [params.beforeData]
 * @param {object} [params.afterData]
 * @param {object} [params.metadata]  — extra context
 * @param {string} [params.branchId]
 * @param {string} [params.branchName]
 * @param {string} [params.userId]    — override (default: req.auth.sub)
 * @param {string} [params.userName]
 * @param {string} [params.userRole]
 * @param {boolean}[params.success]   — default true
 * @param {string} [params.failReason]
 */
export async function logAudit(req, params) {
    try {
        const ipAddress = (
            req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() ||
            req?.socket?.remoteAddress ||
            null
        );
        const userAgent = req?.headers?.['user-agent'] || null;

        const uid = params.userId || req?.auth?.sub || null;
        const bid = params.branchId || null;
        const [who, branchName] = await Promise.all([
            uid && !params.userName ? resolveUserName(uid) : null,
            bid && !params.branchName ? resolveBranchName(bid) : null,
        ]);

        const entry = {
            _id:         generateUUID(),
            timestamp:   moment().toISOString(),
            userId:      params.userId    || req?.auth?.sub     || null,
            userName:    params.userName  || who?.name || null,
            userRole:    params.userRole  || who?.role || null,
            branchId:    params.branchId  || null,
            branchName:  params.branchName|| branchName || null,
            action:      params.action,
            category:    params.category,
            severity:    params.severity  || 'INFO',
            entityType:  params.entityType|| null,
            entityId:    params.entityId  || null,
            // Explicit > client-entity > metadata. The DB trigger covers loan/LAF entities.
            clientId:    params.clientId
                || (params.entityType === 'client' ? params.entityId : null)
                || params.metadata?.clientId
                || null,
            description: params.description || null,
            beforeData:  redactBiometrics(params.beforeData) || null,
            afterData:   redactBiometrics(params.afterData)  || null,
            metadata:    redactBiometrics(params.metadata)   || null,
            success:     params.success  !== undefined ? params.success : true,
            failReason:  params.failReason  || null,
            ipAddress,
            userAgent,
        };

        // Fire-and-forget — don't await, don't block the response
        graph.mutation(insertQl(AUDIT_TYPE, { objects: [entry] }))
            .catch(err => console.error('[audit] insert failed:', err.message));

    } catch (err) {
        // Never let audit logging break the main request
        console.error('[audit] logAudit error:', err.message);
    }
}

/**
 * logAuditPublic — for public (unauthenticated) routes (e.g. LAF submit, biometric register).
 * No req.auth available — pass user context explicitly.
 */
export async function logAuditPublic(req, params) {
    return logAudit({ headers: req?.headers, socket: req?.socket, auth: {} }, params);
}