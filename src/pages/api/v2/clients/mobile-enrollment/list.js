// src/pages/api/v2/clients/mobile-enrollment/list.js
// GET — paginated log of mobile registration/activation attempts, all
// methods and outcomes. Root only, same gate as face-verify-attempts.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();

const ATTEMPT_TYPE = createGraphType('client_enrollment_attempts', `
  _id method outcome contact_number client_id enrollment_request_id detail reviewed_by_user_id created_at
`);

const CLIENT_TYPE = createGraphType('client', `_id firstName lastName`)('clients');

const REQUEST_TYPE = createGraphType('client_enrollment_requests', `
  _id government_id_type government_id_number government_id_photo_key selfie_photo_key rejection_reason
`)('client_enrollment_requests');

const USER_TYPE = createGraphType('users', `_id firstName lastName`)('users');

export default apiHandler({ get: list });

async function list(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser?.root) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const offset = (page - 1) * limit;

    const method  = req.query.method || undefined;
    const outcome = req.query.outcome || undefined;
    const search  = req.query.search?.trim();

    const andConditions = [];
    if (method) andConditions.push({ method: { _eq: method } });
    if (outcome) andConditions.push({ outcome: { _eq: outcome } });

    if (search) {
        const matchingClients = await graph.query(
            queryQl(CLIENT_TYPE, {
                where: {
                    _or: [
                        { firstName: { _ilike: `%${search}%` } },
                        { lastName:  { _ilike: `%${search}%` } },
                    ],
                },
            })
        ).then(r => r.data?.clients ?? []);
        const matchingClientIds = matchingClients.map(c => c._id);

        andConditions.push({
            _or: [
                { contact_number: { _ilike: `%${search}%` } },
                ...(matchingClientIds.length ? [{ client_id: { _in: matchingClientIds } }] : []),
            ],
        });
    }

    const where = andConditions.length ? { _and: andConditions } : {};

    const { attempts, countAgg } = await graph.query(
        queryQl(ATTEMPT_TYPE('attempts'), { where, order_by: [{ created_at: 'desc' }], limit, offset }),
        aggregateQl(ATTEMPT_TYPE('countAgg'), `aggregate { count }`, where)
    ).then(r => r.data);

    const clientIds  = [...new Set(attempts.map(a => a.client_id).filter(Boolean))];
    const reviewerIds = [...new Set(attempts.map(a => a.reviewed_by_user_id).filter(Boolean))];
    const requestIds  = [...new Set(attempts.map(a => a.enrollment_request_id).filter(Boolean))];

    const [clients, reviewers, requests] = await Promise.all([
        clientIds.length
            ? graph.query(queryQl(CLIENT_TYPE, { where: { _id: { _in: clientIds } } })).then(r => r.data?.clients ?? [])
            : [],
        reviewerIds.length
            ? graph.query(queryQl(USER_TYPE, { where: { _id: { _in: reviewerIds } } })).then(r => r.data?.users ?? [])
            : [],
        requestIds.length
            ? graph.query(queryQl(REQUEST_TYPE, { where: { _id: { _in: requestIds } } })).then(r => r.data?.client_enrollment_requests ?? [])
            : [],
    ]);

    const clientMap   = Object.fromEntries(clients.map(c => [c._id, c]));
    const reviewerMap  = Object.fromEntries(reviewers.map(u => [u._id, u]));
    const requestMap    = Object.fromEntries(requests.map(r => [r._id, r]));

    const enriched = attempts.map(a => ({
        ...a,
        clientName: clientMap[a.client_id]
            ? `${clientMap[a.client_id].firstName} ${clientMap[a.client_id].lastName}`
            : null,
        reviewedByName: reviewerMap[a.reviewed_by_user_id]
            ? `${reviewerMap[a.reviewed_by_user_id].firstName} ${reviewerMap[a.reviewed_by_user_id].lastName}`
            : null,
        request: a.enrollment_request_id ? requestMap[a.enrollment_request_id] ?? null : null,
    }));

    return res.status(200).json({
        success: true,
        attempts: enriched,
        total: countAgg?.aggregate?.count ?? 0,
    });
}