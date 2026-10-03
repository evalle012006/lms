import { errorHandler } from './error-handler';
import { clientJwtMiddleware } from './client-jwt-middleware';

export { clientApiHandler };

// Routes a client must be able to hit before they have a token.
const UNAUTHENTICATED_PATHS = [
    '/api/mobile/auth/request-otp',
    '/api/mobile/auth/verify-otp',
    '/api/mobile/auth/self-register',
    '/api/mobile/auth/refresh',   // by design — this is called precisely when the access token has expired
    '/api/mobile/auth/logout',    // takes the refresh token itself, not the (possibly expired) access token
    '/api/mobile/auth/config',    // checked from the login screen, before any token exists
    '/api/mobile/auth/login-password', // this IS a login endpoint — no token yet
];

const clientApiHandler = (handler) => async (req, res) => {
    try {
        const method = req.method.toLowerCase();

        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }

        if (!UNAUTHENTICATED_PATHS.includes(req.url.split('?')[0])) {
            const ok = await clientJwtMiddleware(req, res);
            if (!ok) return; // response already sent by the middleware
        }

        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
};