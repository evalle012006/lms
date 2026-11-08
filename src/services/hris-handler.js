/**
 * hris-handler.js  ->  lms/src/services/hris-handler.js
 * -----------------------------------------------------
 * Auth wrapper for the /api/v2/hris/* endpoints.
 *
 * WHY NOT apiHandler + WEBHOOK_API_KEY?
 *   apiHandler skips JWT for ANY route when x-webhook-api-key matches, so that key
 *   unlocks the whole LMS API. These endpoints reset accounts and passwords, so
 *   HRIS gets its own key (HRIS_API_KEY) that only works on /hris/* routes.
 *
 * Header : x-hris-api-key: <HRIS_API_KEY>
 * Fails CLOSED: if HRIS_API_KEY is not configured, every request is refused.
 */
import { timingSafeEqual } from 'crypto';
import { errorHandler } from './error-handler';

export { hrisHandler };

function keyMatches(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
}

const hrisHandler = (handler) => async (req, res) => {
    try {
        const method = req.method.toLowerCase();
        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }

        const expected = process.env.HRIS_API_KEY;
        if (!expected) {
            console.error('[hris-handler] HRIS_API_KEY is not set; refusing request');
            return res.status(503).json({ success: false, message: 'HRIS integration is not configured' });
        }
        if (!keyMatches(req.headers['x-hris-api-key'], expected)) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
};
