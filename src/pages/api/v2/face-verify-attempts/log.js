import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();
const ATTEMPT_TYPE = createGraphType('face_verify_attempts', FACE_VERIFY_ATTEMPT_FIELDS)('face_verify_attempts');

export default apiHandler({ post: logAttempt });

async function logAttempt(req, res) {
    const userId = req.auth?.sub || null;
    const {
        client_id, loan_id, branch_id,
        distance, confidence, matched, match_threshold,
        photo_key, user_agent,
    } = req.body;

    if (!client_id || distance === undefined || matched === undefined) {
        return res.status(200).json({ success: false, message: 'client_id, distance, and matched are required.' });
    }

    const result = await graph.mutation(
        insertQl(ATTEMPT_TYPE, {
            objects: [{
                _id: generateUUID(),
                client_id,
                loan_id: loan_id ?? null,
                branch_id: branch_id ?? null,
                distance,
                confidence: confidence ?? null,
                matched,
                match_threshold: match_threshold ?? null,
                photo_key: photo_key ?? null,
                user_agent: user_agent ?? null,
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