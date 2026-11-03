// src/pages/api/v2/clients/activity.js
// GET ?clientId=&before=<ISO>&limit=&category=&includeViews=true
// Sanitized, cursor-paginated activity timeline for one client: audit_logs + face verification attempts.
// Decision roles only, in-scope clients only. Never exposes beforeData/afterData/ipAddress/userAgent.
import { apiHandler }               from '@/services/api-handler';
import { GraphProvider }            from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById }             from '@/lib/graph.functions';
import { canDecideCI }              from '@/lib/ci-scope';
import { resolveClientInScope }     from '@/lib/client-scope';

const graph = new GraphProvider();

const AUDIT_TYPE = createGraphType('audit_logs', `
    _id timestamp userName userRole branchName action category severity
    entityType description metadata success failReason
`);
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', `
    _id loan_id ci_reference_code distance confidence matched photo_key captured_at inserted_by
`);
const APP_TYPE  = createGraphType('temporaryLoanApplications', '_id');
const LOAN_TYPE = createGraphType('loans', '_id');

export default apiHandler({ get: getActivity });

const NOISY_ACTIONS = ['LAF_DETAIL_VIEWED'];
const META_WHITELIST = [
    'reason', 'loanId', 'ciReferenceCode', 'version', 'mismatchCount',
    'distanceFromPrevious', 'duplicateCheck', 'pnNumber', 'changedFields',
];
const pick = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    const out = {};
    keys.forEach(k => { if (obj[k] !== undefined && obj[k] !== null) out[k] = obj[k]; });
    return Object.keys(out).length ? out : null;
};
const fail = (res, message) => res.status(200).json({ success: false, message });

async function getActivity(req, res) {
    const { clientId, before, includeViews } = req.query;
    // ?category=a&category=b arrives as an array — only a plain string counts
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 30, 1), 100);
    if (typeof clientId !== 'string' || !clientId) return fail(res, 'clientId required.');

    const user = await findUserById(req.auth?.sub);
    if (!user || !canDecideCI(user)) return fail(res, 'Not allowed.');
    if (!(await resolveClientInScope(user, clientId))) return fail(res, 'Client not found.');

    const beforeIso = before && !Number.isNaN(Date.parse(before)) ? new Date(before).toISOString() : null;

    // Everything that belongs to this client's record: the client, its loans, its LAF applications.
    // (Matching by entityId as well as clientId covers pre-promotion LAF events and any row the
    // backfill/trigger missed.)
    const { apps, loans } = await graph.query(
        queryQl(APP_TYPE('apps'), {
            where: { _or: [{ existingClientId: { _eq: clientId } }, { promotedClientId: { _eq: clientId } }] },
            limit: 100,
        }),
        queryQl(LOAN_TYPE('loans'), { where: { clientId: { _eq: clientId } }, limit: 100 })
    ).then(r => r.data);
    const entityIds = [clientId, ...(apps ?? []).map(a => a._id), ...(loans ?? []).map(l => l._id)];

    const and = [{ _or: [{ clientId: { _eq: clientId } }, { entityId: { _in: entityIds } }] }];
    if (beforeIso) and.push({ timestamp: { _lt: beforeIso } });
    if (includeViews !== 'true') and.push({ action: { _nin: NOISY_ACTIONS } });
    if (typeof category === 'string' && category) and.push({ category: { _eq: category } });

    const wantAttempts = !category || category === 'BIOMETRIC';
    const attemptWhere = { _and: [
        { client_id: { _eq: clientId } },
        ...(beforeIso ? [{ captured_at: { _lt: beforeIso } }] : []),
    ] };

    const [auditRows, attemptRows] = await Promise.all([
        graph.query(queryQl(AUDIT_TYPE('rows'), {
            where: { _and: and }, order_by: [{ timestamp: 'desc' }], limit: limit + 1,
        })).then(r => r.data?.rows ?? []),
        wantAttempts
            ? graph.query(queryQl(ATTEMPT_TYPE('attempts'), {
                where: attemptWhere, order_by: [{ captured_at: 'desc' }], limit: limit + 1,
            })).then(r => r.data?.attempts ?? [])
            : Promise.resolve([]),
    ]);

    const events = [
        ...auditRows.map(a => ({
            id: a._id, source: 'audit',
            timestamp: a.timestamp, category: a.category, action: a.action,
            severity: a.severity || 'INFO',
            description: a.description || null,
            actor: a.userName || null, actorRole: a.userRole || null, branchName: a.branchName || null,
            success: a.success !== false, failReason: a.failReason || null,
            meta: pick(a.metadata, META_WHITELIST),
            photoKey: null,
        })),
        ...attemptRows.map(a => {
            const pct = a.confidence != null ? `${Math.round(Number(a.confidence))}%` : null;
            const isEnrollCapture = a.matched === null || a.matched === undefined;
            return {
                id: `fva_${a._id}`, source: 'face_attempt',
                timestamp: a.captured_at, category: 'BIOMETRIC',
                action: isEnrollCapture ? 'FACE_CAPTURED' : (a.matched ? 'FACE_VERIFY_MATCH' : 'FACE_VERIFY_MISMATCH'),
                severity: a.matched === false ? 'WARNING' : 'INFO',
                description: isEnrollCapture
                    ? 'Face captured for enrollment'
                    : `Face verification ${a.matched ? 'matched' : 'did not match'}${pct ? ` (confidence ${pct})` : ''}`,
                actor: null, actorRole: null, branchName: null,
                success: true, failReason: null,
                meta: pick({ loanId: a.loan_id, ciReferenceCode: a.ci_reference_code }, ['loanId', 'ciReferenceCode']),
                photoKey: a.photo_key || null,
            };
        }),
    ].sort((x, y) => new Date(y.timestamp) - new Date(x.timestamp));

    const page = events.slice(0, limit);
    const hasMore = events.length > limit;

    return res.status(200).json({
        success: true,
        events: page,
        hasMore,
        nextBefore: hasMore ? page[page.length - 1].timestamp : null,
    });
}