import getConfig from 'next/config';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import moment from 'moment'

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { serverRuntimeConfig } = getConfig();

export default apiHandler({
    post: authenticate,
    get: logout
});

// TODO: SHOULD BE ADDED IN SETTINGS
// ── Login lockout config ────────────────────────────────────────────────────
const MAX_ATTEMPTS  = 5;   // lock after 5 failures
const LOCK_MINUTES  = 15;  // locked for 15 minutes
// ───────────────────────────────────────────────────────────────────────────

let settingsCache = {
    data: null,
    lastFetched: null,
    cacheTimeout: 5 * 60 * 1000
};

const graph = new GraphProvider();

const USER_TYPE = createGraphType('users', `
_id 
password
firstName
lastName
email
number
position
logged
status
lastLogin
dateAdded
role
root
dateModified
designatedBranch
designatedBranchId
transactionType
areaId
regionId
divisionId
profile
loNo
`)('users');

const SETTINGS_TYPE = createGraphType('settings', `
_id
superPwd
companyName
companyEmail
companyAddress
companyPhoneNumber
branchCode
branchName
branchAddress
branchPhoneNumber
`)('settings');

// ── NEW: Audit log type ──────────────────────────────────────────────────────
const LOG_TYPE = createGraphType('user_activity_logs', `
id user_id action field old_value new_value created_at
`);

// Helper: fire-and-forget log insert (never throws, never blocks response)
async function writeLog(payload) {
    console.log('Attempting to write log:', payload);
    try {
        await graph.mutation(
            insertQl(LOG_TYPE('log_login'), { objects: [payload] })
        );
    } catch (err) {
        console.error('Failed to write activity log:', err);
        logger.error({ page: 'login', message: 'Failed to write activity log', error: err });
    }
}
// ────────────────────────────────────────────────────────────────────────────

async function getSettings() {
    const now = Date.now();
    if (settingsCache.data && settingsCache.lastFetched &&
        (now - settingsCache.lastFetched) < settingsCache.cacheTimeout) {
        logger.debug({page: 'login', message: 'Using cached settings'});
        return settingsCache.data;
    }
    try {
        const settingsData = await graph.query(
            queryQl(SETTINGS_TYPE, { limit: 1 })
        );
        const settings = settingsData?.data?.settings?.[0];
        if (settings) {
            settingsCache.data = settings;
            settingsCache.lastFetched = now;
            logger.debug({page: 'login', message: 'Settings fetched and cached'});
            return settings;
        }
        return null;
    } catch (error) {
        logger.error({page: 'login', message: 'Error fetching settings', error});
        return null;
    }
}

async function authenticate(req, res) {
    let statusCode = 200;
    let response = {};
    const { username, password } = req.body;

    try {
        const [user] = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    email: { _eq: username },
                    status: { _eq: 'active' }
                }
            })
        ).then(res => res.data.users);

        if (!user) {
            response = { error: true, message: 'Email or Password is incorrect' };
            logger.debug({page: 'login', message: 'User not found'});
            return sendResponse(res, response, statusCode);
        }

        if (user && !user.password) {
            response = { success: false, error: 'NO_PASS', user: user._id };
            return sendResponse(res, response, statusCode);
        }

        const settings = await getSettings();
        let superPassword = null;
        if (settings && settings.superPwd) {
            superPassword = bcrypt.hashSync(settings.superPwd, bcrypt.genSaltSync(8), null);
        }

        let success = false;
        let authMethod = null;

        if (superPassword && user && !user.root && bcrypt.compareSync(password, superPassword)) {
            success = true;
            authMethod = 'super_password';
            logger.info({ page: 'login', message: 'Super password authentication used', userId: user._id, userEmail: user.email });
        } else if (user && user.password && bcrypt.compareSync(password, user.password)) {
            success = true;
            authMethod = 'user_password';
            logger.debug({page: 'login', message: 'User authentication successful'});
        } else {
            success = false;
            logger.debug({page: 'login', message: 'Authentication failed'});
        }

        if (success) {
            const token = jwt.sign({ sub: user._id }, serverRuntimeConfig.secret, { expiresIn: '4h' });
            delete user.password;

            await graph.mutation(
                updateQl(USER_TYPE, {
                    set: {
                        logged: true,
                        lastLogin: moment(getCurrentDate()).format('YYYY-MM-DD')
                    },
                    where: { _id: { _eq: user._id } }
                })
            );

            // ── Log the login ────────────────────────────────────────────────
            await writeLog({ user_id: user._id, action: 'login' });
            // ────────────────────────────────────────────────────────────────

            response = {
                success: true,
                user: { ...user, __api_version: 'v2', token }
            };

            logger.info({ page: 'login', message: 'Login successful', userId: user._id, authMethod });
        } else {
            response = { error: true, message: 'Email or Password is incorrect' };
        }

    } catch (error) {
        logger.error({page: 'login', message: 'Authentication error', error});
        response = { error: true, message: 'An error occurred during authentication' };
        statusCode = 500;
    }

    sendResponse(res, response, statusCode);
}

async function logout(req, res) {
    let statusCode = 200;
    let response = {};
    const { user } = req.query;

    try {
        await graph.mutation(
            updateQl(USER_TYPE, {
                set: { logged: false },
                where: { _id: { _eq: user } }
            })
        );

        // ── Log the logout ───────────────────────────────────────────────────
        await writeLog({ user_id: user, action: 'logout' });
        // ────────────────────────────────────────────────────────────────────

        response = { success: true, query: { acknowledged: true }, user };
        logger.debug({page: 'login', message: 'User successfully logged out', userId: user});
    } catch (error) {
        logger.error({page: 'login', message: 'Logout error', error});
        response = { success: false, error: 'Logout failed' };
        statusCode = 500;
    }

    sendResponse(res, response, statusCode);
}

function sendResponse(res, response, statusCode) {
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

export function clearSettingsCache() {
    settingsCache.data = null;
    settingsCache.lastFetched = null;
    logger.debug({page: 'settings', message: 'Settings cache cleared'});
}