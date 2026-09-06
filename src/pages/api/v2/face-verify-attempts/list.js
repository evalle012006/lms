// src/pages/api/v2/face-verify-attempts/list.js
// GET — paginated list of face verification attempts for debugging.
// Root only.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);
const CLIENT_TYPE  = createGraphType('client', `_id firstName lastName profile`)('clients');

export default apiHandler({ get: list });

async function list(req, res) {
    const currentUser = await findUserById(req.auth.sub);
    if (!currentUser?.root) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const offset = (page - 1) * limit;
    const matchedFilter = req.query.matched === 'true' ? true
        : req.query.matched === 'false' ? false : undefined;
    const search = req.query.search?.trim();

    const andConditions = [];
    if (matchedFilter !== undefined) andConditions.push({ matched: { _eq: matchedFilter } });

    if (search) {
        // Resolve any clients whose name matches, so we can filter attempts
        // by client_id too — there's no tracked relationship to join through.
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
                { ci_reference_code: { _ilike: `%${search}%` } },
                ...(matchingClientIds.length ? [{ client_id: { _in: matchingClientIds } }] : []),
            ],
        });
    }

    const where = andConditions.length ? { _and: andConditions } : {};

    const { attempts, countAgg } = await graph.query(
        queryQl(ATTEMPT_TYPE('attempts'), { where, order_by: [{ captured_at: 'desc' }], limit, offset }),
        aggregateQl(ATTEMPT_TYPE('countAgg'), `aggregate { count }`, where)
    ).then(r => r.data);

    // Attach client info in the same request — avoids a second round trip
    // and the by-ids 20-cap problem entirely, since we control the query here.
    const clientIds = [...new Set(attempts.map(a => a.client_id).filter(Boolean))];
    let clientMap = {};
    if (clientIds.length) {
        const clients = await graph.query(
            queryQl(CLIENT_TYPE, { where: { _id: { _in: clientIds } } })
        ).then(r => r.data?.clients ?? []);
        clientMap = Object.fromEntries(clients.map(c => [c._id, c]));
    }

    const enriched = attempts.map(a => ({
        ...a,
        clientName: clientMap[a.client_id]
            ? `${clientMap[a.client_id].firstName} ${clientMap[a.client_id].lastName}`
            : null,
        clientEnrollmentPhotoKey: clientMap[a.client_id]?.profile ?? null,
    }));

    return res.status(200).json({ success: true, attempts: enriched, total: countAgg.aggregate.count, page, limit });
}