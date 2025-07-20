import getConfig from 'next/config';
import { apiHandler } from '@/services/api-handler';
import logger from '@/logger';
import moment from 'moment'

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl } from '@/lib/graph/graph.util';
import { getCurrentDate } from '@/lib/date-utils';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { serverRuntimeConfig } = getConfig();

export default apiHandler({
    post: authenticate,
    get: logout
});

let response = {};
let statusCode = 200;

// Cache for settings to avoid frequent database calls
let settingsCache = {
    data: null,
    lastFetched: null,
    cacheTimeout: 5 * 60 * 1000 // 5 minutes in milliseconds
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

// Function to get settings with caching
async function getSettings() {
    const now = Date.now();
    
    // Check if cache is valid
    if (settingsCache.data && 
        settingsCache.lastFetched && 
        (now - settingsCache.lastFetched) < settingsCache.cacheTimeout) {
        logger.debug({page: 'login', message: 'Using cached settings'});
        return settingsCache.data;
    }
    
    try {
        // Fetch fresh settings from database
        const settingsData = await graph.query(
            queryQl(SETTINGS_TYPE, {
                limit: 1
            })
        );
        
        const settings = settingsData?.data?.settings?.[0];
        
        if (settings) {
            // Update cache
            settingsCache.data = settings;
            settingsCache.lastFetched = now;
            logger.debug({page: 'login', message: 'Settings fetched and cached'});
            return settings;
        }
        
        return null;
    } catch (error) {
        logger.error({page: 'login', message: 'Error fetching settings', error: error});
        return null;
    }
}

async function authenticate(req, res) {
    const { username, password } = req.body;
    
    try {
        // Fetch user data
        const [ user ] = await graph.query(
            queryQl(USER_TYPE, {
                where: {
                    email: { _eq: username },
                    status: { _eq: 'active' }
                }
            })
        ).then(res => res.data.users);

        if (!user) {
            response = {
                error: true,
                message: 'Email or Password is incorrect'
            };
            logger.debug({page: 'login', message: 'User not found'});
            return sendResponse(res);
        }

        if (user && !user.password) {
            response = { success: false, error: 'NO_PASS', user: user._id };
            return sendResponse(res);
        }

        // Get settings (cached or fresh)
        const settings = await getSettings();
        
        // Determine super password
        let superPassword;
        if (settings && settings.superPwd) {
            superPassword = bcrypt.hashSync(settings.superPwd, bcrypt.genSaltSync(8), null);
            logger.debug({page: 'login', message: 'Using super password from settings'});
        } else {
            // Fallback to hardcoded password
            superPassword = bcrypt.hashSync("supeR_Pas$AC_25", bcrypt.genSaltSync(8), null);
            logger.debug({page: 'login', message: 'Using fallback super password'});
        }

        // Authentication logic
        let success = false;

        if (user && !user.root && bcrypt.compareSync(password, superPassword)) {
            success = true;
            logger.debug({page: 'login', message: 'Super authentication successful'});
        } else if (user && user.password && bcrypt.compareSync(password, user.password)) {
            success = true;
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
                    where: {
                        _id: { _eq: user._id }
                    }
                })
            );

            response = {
                success: true,
                user: { 
                    ...user, 
                    __api_version: 'v2',
                    token,
                }
            }

            logger.debug({page: 'login', message: 'Login successful', userId: user._id});
        } else {
            response = {
                error: true,
                message: 'Email or Password is incorrect'
            };
        }

    } catch (error) {
        logger.error({page: 'login', message: 'Authentication error', error: error});
        response = {
            error: true,
            message: 'An error occurred during authentication'
        };
        statusCode = 500;
    }

    sendResponse(res);
}

async function logout(req, res) {
    const { user } = req.query;

    try {
        await graph.mutation(
            updateQl(USER_TYPE, {
                set: {
                    logged: false
                },
                where: {
                    _id: { _eq: user }
                }
            })
        );

        response = { success: true, query: { acknowledged: true }, user };
        logger.debug({page: 'login', message: 'User successfully logged out', userId: user});
    } catch (error) {
        logger.error({page: 'login', message: 'Logout error', error: error});
        response = { success: false, error: 'Logout failed' };
        statusCode = 500;
    }

    sendResponse(res);
}

function sendResponse(res) {
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

// Optional: Function to clear settings cache (call this when settings are updated)
export function clearSettingsCache() {
    settingsCache.data = null;
    settingsCache.lastFetched = null;
    logger.debug({page: 'settings', message: 'Settings cache cleared'});
}