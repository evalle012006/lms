// src/lib/audit.js
// Centralized audit logger — call from any API handler.
// Writes to public.audit_logs table via direct GraphQL insert.
// Non-blocking — failures are logged to console but don't break the request.

import { GraphProvider }              from '@/lib/graph/graph.provider';
import { createGraphType, insertQl }  from '@/lib/graph/graph.util';
import { generateUUID }               from '@/lib/utils';
import moment                         from 'moment';

const graph = new GraphProvider();

const AUDIT_TYPE = createGraphType('audit_logs', `
    _id timestamp userId userName userRole
    branchId branchName action category severity
    entityType entityId description
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

        const entry = {
            _id:         generateUUID(),
            timestamp:   moment().toISOString(),
            userId:      params.userId    || req?.auth?.sub     || null,
            userName:    params.userName  || null,
            userRole:    params.userRole  || null,
            branchId:    params.branchId  || null,
            branchName:  params.branchName|| null,
            action:      params.action,
            category:    params.category,
            severity:    params.severity  || 'INFO',
            entityType:  params.entityType|| null,
            entityId:    params.entityId  || null,
            description: params.description || null,
            beforeData:  params.beforeData  || null,
            afterData:   params.afterData   || null,
            metadata:    params.metadata    || null,
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