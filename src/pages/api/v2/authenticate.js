import getConfig from 'next/config';
import { timingSafeEqual } from 'crypto';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import moment from 'moment'

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, insertQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';

const jwt    = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { serverRuntimeConfig } = getConfig();

export default apiHandler({
    post: authenticate,
    get:  logout
});

// TODO: SHOULD BE ADDED IN SETTINGS
// ── Login lockout config ────────────────────────────────────────────────────
const MAX_ATTEMPTS  = 5;   // lock after 5 failures
const LOCK_MINUTES  = 15;  // locked for 15 minutes
// ───────────────────────────────────────────────────────────────────────────

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
weeklyScheduleType
areaId
regionId
divisionId
profile
loNo
biometricCredentialId
biometricPublicKey
biometricCounter
biometricRegisteredAt
biometricDeviceName
loginAttempts
lockedUntil
mustChangePassword
`)('users');

// Server-only. Read fresh on each non-root login and never cached, merged into
// another object, or included in any response.
const SECRET_TYPE = createGraphType('settings', 'superPwd')('superPwdRow');

const LOG_TYPE = createGraphType('user_activity_logs', `
id user_id action field old_value new_value created_at
`);

async function writeLog(payload) {
    try {
        await graph.mutation(
            insertQl(LOG_TYPE('log_login'), { objects: [payload] })
        );
    } catch (err) {
        logger.error({ page: 'login', message: 'Failed to write activity log', error: err });
    }
}

async function getSuperPassword() {
    try {
        const [row] = await graph.query(queryQl(SECRET_TYPE, { limit: 1 }))
            .then(r => r.data?.superPwdRow ?? []);
        return row?.superPwd || null;
    } catch (error) {
        logger.error({ page: 'login', message: 'Error fetching super password', error });
        return null; // fail closed: no super-password login if we can't read it
    }
}

function timingSafeEqualStr(a, b) {
    const ab = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    return ab.length === bb.length && timingSafeEqual(ab, bb);
}

async function authenticate(req, res) {
    let statusCode = 200;
    let response   = {};
    const { username, password } = req.body;

    try {
        const [user] = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    email:  { _eq: username },
                    status: { _eq: 'active' },
                }
            })
        ).then(r => r.data.users);

        if (!user) {
            response = { error: true, message: 'Email or Password is incorrect' };
            return sendResponse(res, response, statusCode);
        }

        // ── Lockout check ────────────────────────────────────────────────────
        if (user.lockedUntil && moment().isBefore(moment(user.lockedUntil))) {
            const remainingMins = moment(user.lockedUntil).diff(moment(), 'minutes') + 1;
            response = {
                error:  true,
                locked: true,
                message: `Account locked due to too many failed attempts. Try again in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.`,
            };
            return sendResponse(res, response, statusCode);
        }
        // ────────────────────────────────────────────────────────────────────

        if (!user.password) {
            response = { success: false, error: 'NO_PASS', user: user._id };
            return sendResponse(res, response, statusCode);
        }

        let success    = false;
        let authMethod = null;

        // Root accounts never accept the super password, so skip the DB read for them
        const superPwd = user.root ? null : await getSuperPassword();

        if (superPwd && typeof password === 'string' && timingSafeEqualStr(password, superPwd)) {
            success    = true;
            authMethod = 'super_password';
        } else if (user.password && bcrypt.compareSync(password, user.password)) {
            success    = true;
            authMethod = 'user_password';
        }

        if (success) {
            const token = jwt.sign({ sub: user._id }, serverRuntimeConfig.secret, { expiresIn: '4h' });
            delete user.password;

            // Reset lockout counters on successful login
            await graph.mutation(
                updateQl(USER_TYPE, {
                    set: {
                        logged:        true,
                        lastLogin:     moment(getCurrentDate()).format('YYYY-MM-DD'),
                        loginAttempts: 0,
                        lockedUntil:   null,
                    },
                    where: { _id: { _eq: user._id } }
                })
            );

            await writeLog({ user_id: user._id, action: 'login' });

            response = {
                success: true,
                user: { ...user, loginAttempts: 0, lockedUntil: null, __api_version: 'v2', token }
            };
            logger.info({ page: 'login', message: 'Login successful', userId: user._id, authMethod });
        } else {
            // ── Increment failure counter ────────────────────────────────────
            const attempts = (user.loginAttempts || 0) + 1;
            const locked   = attempts >= MAX_ATTEMPTS;
            const lockedUntil = locked
                ? moment().add(LOCK_MINUTES, 'minutes').toISOString()
                : null;

            await graph.mutation(
                updateQl(USER_TYPE, {
                    set: {
                        loginAttempts: attempts,
                        lockedUntil:   lockedUntil,
                    },
                    where: { _id: { _eq: user._id } }
                })
            );

            const remaining = MAX_ATTEMPTS - attempts;

            if (locked) {
                response = {
                    error:   true,
                    locked:  true,
                    message: `Account locked after ${MAX_ATTEMPTS} failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
                };
            } else {
                response = {
                    error:   true,
                    message: remaining === 1
                        ? `Email or Password is incorrect. 1 attempt remaining before lockout.`
                        : `Email or Password is incorrect. ${remaining} attempts remaining.`,
                };
            }
            // ─────────────────────────────────────────────────────────────────
        }

    } catch (error) {
        logger.error({ page: 'login', message: 'Authentication error', error });
        response  = { error: true, message: 'An error occurred during authentication' };
        statusCode = 500;
    }

    sendResponse(res, response, statusCode);
}

async function logout(req, res) {
    let statusCode = 200;
    let response   = {};
    const { user } = req.query;

    try {
        await graph.mutation(
            updateQl(USER_TYPE, {
                set:   { logged: false },
                where: { _id: { _eq: user } }
            })
        );
        await writeLog({ user_id: user, action: 'logout' });
        response = { success: true, query: { acknowledged: true }, user };
    } catch (error) {
        logger.error({ page: 'login', message: 'Logout error', error });
        response  = { success: false, error: 'Logout failed' };
        statusCode = 500;
    }

    sendResponse(res, response, statusCode);
}

function sendResponse(res, response, statusCode) {
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// Kept as a no-op so any existing `import { clearSettingsCache }` doesn't break.
// There is no settings cache anymore: the super password is read fresh on each login.
export function clearSettingsCache() {}