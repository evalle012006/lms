// src/pages/api/v2/face-verify-attempts/list.js
// GET — paginated list of face verification attempts for debugging.
// Root only.

import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS);

export default apiHandler({ get: list });

async function list(req, res) {
    const currentUser = req.auth;
    if (!currentUser?.root) {
        return res.status(200).json({ success: false, message: 'Insufficient permissions.' });
    }

    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 25);
    const offset = (page - 1) * limit;

    const matchedFilter = req.query.matched === 'true' ? true
        : req.query.matched === 'false' ? false
        : undefined;

    const where = matchedFilter !== undefined ? { matched: { _eq: matchedFilter } } : {};

    const { attempts, countAgg } = await graph.query(
        queryQl(ATTEMPT_TYPE('attempts'), {
            where,
            order_by: [{ captured_at: 'desc' }],
            limit,
            offset,
        }),
        aggregateQl(ATTEMPT_TYPE('countAgg'), `aggregate { count }`, where)
    ).then(r => r.data);

    return res.status(200).json({
        success: true,
        attempts,
        total: countAgg.aggregate.count,
        page,
        limit,
    });
}