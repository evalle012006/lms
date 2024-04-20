import { errorHandler } from './error-handler';
import { jwtMiddleware } from './jwt-middleware';

const { expressjwt: jwt } = require('express-jwt');

export { apiHandler };

const apiHandler = (handler) => async (req, res) => {
    try {
        const method = req.method.toLowerCase();

        if (!handler[method]) {
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    
        await jwtMiddleware(req, res);

        return await handler[method](req, res);
    } catch (err) {
        errorHandler(err, res);
    }
}