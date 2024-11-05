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
            '/api/v2/authenticate',
            '/api/v2/authenticate',
            '/api/v2/register',
            '/api/v2/users',
            '/api/v2/activate',
            '/api/v2/reset-request',
            '/api/v2/reset-password'
        ]
    });

    return util.promisify(middleware)(req, res);
}