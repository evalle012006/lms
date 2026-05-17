import { errorHandler } from './error-handler';

export { publicApiHandler };

const publicApiHandler = (handler) => async (req, res) => {
    try {
        // ── API key check ────────────────────────────────────────────────
        // NEXT_PUBLIC_LAF_API_KEY is sent by the client as x-laf-api-key header.
        // This is not a secret (it's in NEXT_PUBLIC_*) but prevents casual scanning
        // of public endpoints. Real security comes from QR token validation inside
        // each handler.
        const expectedKey = process.env.NEXT_PUBLIC_LAF_API_KEY;
        if (expectedKey) {
            const providedKey = req.headers['x-laf-api-key'];
            if (providedKey !== expectedKey) {
                return res.status(403).json({
                    success: false,
                    message: 'Forbidden.',
                });
            }
        }

        const method = req.method.toLowerCase();
        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }

        return await handler[method](req, res);
    } catch (err) {
        err.requestUrl = req.url;
        errorHandler(err, res);
    }
};