import getConfig from 'next/config';

const { expressjwt: jwt } = require('express-jwt');
const util = require('util');

const { serverRuntimeConfig } = getConfig();

export { jwtMiddleware };

function jwtMiddleware(req, res) {
    const middleware = jwt({
        secret: serverRuntimeConfig.secret,
        algorithms: ['HS256']
    }).unless({
        // for open access pages, add the path here. 
        path: [
            '/api/authenticate',
            '/api/register',
            '/api/users',
            '/api/activate',
            '/api/reset-request',
            '/api/reset-password'
        ]
    });

    return util.promisify(middleware)(req, res);
}