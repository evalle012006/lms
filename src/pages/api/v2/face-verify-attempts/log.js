// src/pages/api/v2/face-verify-attempts/log.js
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { canDecideCI } from '@/lib/ci-scope';
import { resolveClientInScope } from '@/lib/client-scope';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS)('face_verify_attempts');

export default apiHandler({ post: logAttempt });

const numOrNull = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function logAttempt(req, res) {
    const userId = req.auth?.sub || null;
    const {
        client_id, loan_id, ci_reference_code,
        distance, confidence, matched, match_threshold,
        photo_key, user_agent,
    } = req.body;

    if (typeof client_id !== 'string' || !client_id || distance === undefined || matched === undefined) {
        return res.status(200).json({ success: false, message: 'client_id, distance, and matched are required.' });
    }

    const user = await findUserById(userId);
    if (!user || !canDecideCI(user)) {
        return res.status(200).json({ success: false, message: 'Not allowed.' });
    }

    // The branch comes from the server, never from the request. Balik/transferred clients keep
    // their previous branch, so scope also passes through a live (pending/active) loan.
    const client = await resolveClientInScope(user, client_id);
    if (!client) {
        return res.status(200).json({ success: false, message: 'Client not found.' });
    }

    const result = await graph.mutation(
        insertQl(ATTEMPT_TYPE, {
            objects: [{
                _id: generateUUID(),
                client_id,
                loan_id: loan_id ?? null,
                branch_id: client.branchId,
                ci_reference_code: ci_reference_code ?? null,
                distance: numOrNull(distance),
                confidence: numOrNull(confidence),
                matched: typeof matched === 'boolean' ? matched : null,
                match_threshold: numOrNull(match_threshold),
                photo_key: photo_key ?? null,
                user_agent: typeof user_agent === 'string' ? user_agent.slice(0, 500) : null,
                inserted_by: userId,
                captured_at: new Date().toISOString(),
            }],
        })
    );

    if (result.errors?.length) {
        console.error('[face-verify-attempts/log]', result.errors[0].message);
        return res.status(200).json({ success: false });
    }

    return res.status(200).json({ success: true });
}