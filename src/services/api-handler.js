import { errorHandler } from './error-handler';
import { jwtMiddleware } from './jwt-middleware';

export { apiHandler };

const apiHandler = (handler) => async (req, res) => {
    try {

        const method = req.method.toLowerCase();
        const webhook_api_key = req.headers['x-webhook-api-key'];
        
        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }

        // CHANGED: only skip JWT when WEBHOOK_API_KEY is configured AND the header matches it.
        // Before, with the env var unset and no header, `undefined !== undefined` was false,
        // so JWT was skipped and the route ran unauthenticated.
        const expectedWebhookKey = process.env.WEBHOOK_API_KEY;
        const isWebhookCall = !!expectedWebhookKey && webhook_api_key === expectedWebhookKey;
        if (!isWebhookCall) {
            await jwtMiddleware(req, res);
        }

        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
}