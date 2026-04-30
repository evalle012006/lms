import { errorHandler } from './error-handler';

export { publicApiHandler };

const publicApiHandler = (handler) => async (req, res) => {
    try {
        const method = req.method.toLowerCase();

        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }

        // No JWT check — public route
        // Rate limiting and branch token validation are done inside the handler
        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
};