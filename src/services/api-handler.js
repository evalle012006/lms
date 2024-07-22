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

        if (webhook_api_key !== process.env.WEBHOOK_API_KEY) {
            await jwtMiddleware(req, res);
        }

        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
}