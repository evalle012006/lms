import { apiHandler } from '@/services/api-handler';
import formidable from "formidable";

import { USER_FIELDS, LOAN_FIELDS } from '@/lib/graph.fields';
import {
    WEEKLY_GROUPS, WEEKLY_GROUPS_ACCELERATED,
    LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS,
    LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, LO_10_DAILY_GROUPS,
    LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS,
    LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_20_DAILY_GROUPS,
    ACCELERATED_WEEKLY_CATEGORIES
} from '@/lib/constants';
import { findAreas, findDivisions, findRegions } from '@/lib/graph.functions';
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl, updateQl, insertQl, deleteQl } from "@/lib/graph/graph.util";
import { generateUUID } from '@/lib/utils';

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`)('users');

const LOAN_TYPE = createGraphType('loans', `
  _id
  status
  loId
  groupId
  fullName
  slotNo
`)('loans');

const GROUP_TYPE = createGraphType('groups', `_id name groupNo day occurence loanOfficerId weeklyScheduleType acceleratedCategory`);

const LOG_TYPE = createGraphType('user_activity_logs', `
id user_id action field old_value new_value created_at
`);

const LOGROUPS = [
    LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS,
    LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, LO_10_DAILY_GROUPS,
    LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS,
    LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_20_DAILY_GROUPS
];

const WATCHED_FIELDS = [
    'firstName', 'lastName', 'areaId', 'regionId', 'divisionId',
    'designatedBranch', 'designatedBranchId', 'transactionType', 'weeklyScheduleType',
    'acceleratedCategory'
];

async function writeChangeLogs(userId, oldData, newData) {
    try {
        const logs = WATCHED_FIELDS
            .filter(f => String(oldData[f] ?? '') !== String(newData[f] ?? ''))
            .map(f => ({
                user_id: userId,
                action: 'update',
                field: f,
                old_value: String(oldData[f] ?? ''),
                new_value: String(newData[f] ?? '')
            }));

        if (logs.length === 0) return;

        await graph.mutation(
            insertQl(LOG_TYPE('log_update'), { objects: logs })
        );
    } catch (err) {
        console.error('Failed to write activity logs:', err);
    }
}

const nullify = (val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '' || str === 'null' || str === 'undefined') return null;
    return val;
};

const buildHierarchyFields = (userRole, payload) => {
    const shortCode = userRole.shortCode;
    const rep = userRole.rep;

    if (rep === 1) {
        return {
            areaId: null,
            regionId: null,
            divisionId: null,
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    if (shortCode === 'deputy_director') {
        return {
            areaId: null,
            regionId: null,
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    if (shortCode === 'regional_manager') {
        return {
            areaId: null,
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    if (shortCode === 'area_admin') {
        return {
            areaId: nullify(payload.areaId),
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: null,
            designatedBranch: (payload.designatedBranch && typeof payload.designatedBranch !== 'string')
                ? JSON.parse(payload.designatedBranch)
                : (nullify(payload.designatedBranch) ?? '[]'),
        };
    }

    if (rep === 3 || rep === 4) {
        return {
            areaId: nullify(payload.areaId),
            regionId: nullify(payload.regionId),
            divisionId: nullify(payload.divisionId),
            designatedBranchId: nullify(payload.designatedBranchId),
            designatedBranch: (payload.designatedBranch && typeof payload.designatedBranch !== 'string')
                ? JSON.parse(payload.designatedBranch)
                : (nullify(payload.designatedBranch) ?? null),
        };
    }

    return {
        areaId: null,
        regionId: null,
        divisionId: null,
        designatedBranchId: null,
        designatedBranch: null,
    };
};

const findBlockingLoans = async (loId) => {
    const loans = await graph.query(
        queryQl(LOAN_TYPE, {
            where: { loId: { _eq: loId }, status: { _neq: 'closed' } }
        })
    ).then(res => res.data.loans);
    return loans || [];
};

// CHANGED: cleanup/existence functions now take acceleratedCategory as a
// third scoping dimension, alongside occurence and weeklyScheduleType.
// Without this, two accelerated LOs on different categories were still
// safe from each other (loanOfficerId already scoped them), but a single
// LO switching FROM one category TO another within accelerated had no
// scoping key to distinguish "old category groups to clean up" from
// "new category groups to check for/create" — both would look identical
// under occurence+weeklyScheduleType alone.

const findGroupsByLoOccurenceAndTheme = async (loId, occurence, weeklyScheduleType, acceleratedCategory) => {
    const where = { loanOfficerId: { _eq: loId }, occurence: { _eq: occurence } };
    if (occurence === 'weekly') {
        where.weeklyScheduleType = { _eq: weeklyScheduleType };
        if (weeklyScheduleType === 'accelerated') {
            where.acceleratedCategory = { _eq: acceleratedCategory };
        }
    }

    console.log('[findGroupsByLoOccurenceAndTheme] where:', JSON.stringify(where));

    const rawRes = await graph.query(
        queryQl(GROUP_TYPE('groupsQuery'), { where })
    );

    console.log('[findGroupsByLoOccurenceAndTheme] full response:', JSON.stringify(rawRes));

    const groups = rawRes?.data?.groupsQuery;
    return groups || [];
};

const findGroupIdsWithLoanHistory = async (groupIds) => {
    if (!groupIds.length) return new Set();
    const loans = await graph.query(
        queryQl(LOAN_TYPE, { where: { groupId: { _in: groupIds } } })
    ).then(res => res.data.loans);
    return new Set((loans || []).map(l => l.groupId));
};

const cleanupUnusedGroups = async (loId, occurence, weeklyScheduleType, acceleratedCategory) => {
    const groups = await findGroupsByLoOccurenceAndTheme(loId, occurence, weeklyScheduleType, acceleratedCategory);

    console.log(`[cleanupUnusedGroups] found ${groups.length} candidate groups for occurence=${occurence} theme=${weeklyScheduleType} category=${acceleratedCategory}`);

    if (!groups.length) return;

    const usedIds = await findGroupIdsWithLoanHistory(groups.map(g => g._id));
    const unused = groups.filter(g => !usedIds.has(g._id));

    console.log(`[cleanupUnusedGroups] ${unused.length} unused, will attempt delete:`, JSON.stringify(unused.map(g => g._id)));

    if (unused.length > 0) {
        const rawRes = await graph.mutation(
            deleteQl(GROUP_TYPE('groupsDelete'), { _id: { _in: unused.map(g => g._id) } })
        );
        console.log('[cleanupUnusedGroups] delete mutation response:', JSON.stringify(rawRes));
    }
};

const createWeeklyGroupData = (groupName, user, groupNo, day) => ({
    name: groupName,
    branchId: user.designatedBranchId,
    day,
    dayNo: groupNo,
    time: "7:30AM-7:45AM",
    groupNo,
    occurence: "weekly",
    loanOfficerId: user._id + "",
    loanOfficerName: user.lastName + ', ' + user.firstName,
    availableSlots: Array.from({ length: 30 }, (_, i) => i + 1),
    capacity: user.weeklyScheduleType === 'accelerated' ? 15 : 30,
    noOfClients: 0,
    weeklyScheduleType: user.weeklyScheduleType,
    acceleratedCategory: user.weeklyScheduleType === 'accelerated' ? user.acceleratedCategory : null,
    status: "available",
    dateAdded: new Date()
});

const createDailyGroupData = (groupName, user, groupNo) => ({
    name: groupName,
    branchId: user.designatedBranchId,
    day: "all",
    dayNo: 0,
    time: "7:30AM-7:45AM",
    groupNo,
    occurence: "daily",
    loanOfficerId: user._id + "",
    loanOfficerName: user.lastName + ', ' + user.firstName,
    availableSlots: Array.from({ length: 40 }, (_, i) => i + 1),
    capacity: 26,
    noOfClients: 0,
    status: "available",
    dateAdded: new Date()
});

const buildWeeklyGroupSet = (user, weeklyScheduleType, acceleratedCategory) => {
    let namePool;
    if (weeklyScheduleType === 'accelerated') {
        const category = ACCELERATED_WEEKLY_CATEGORIES.find(c => c.key === acceleratedCategory);
        if (!category) {
            console.warn(`[buildWeeklyGroupSet] no valid acceleratedCategory ('${acceleratedCategory}') for user ${user._id} — defaulting to 'cars'`);
        }
        namePool = category ? category.names : ACCELERATED_WEEKLY_CATEGORIES[0].names;
    } else {
        namePool = WEEKLY_GROUPS;
    }
    const perDay = weeklyScheduleType === 'accelerated' ? 5 : 3;
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
    const userWithCategory = { ...user, acceleratedCategory };

    return namePool.map((g, i) => {
        const groupNo = i + 1;
        const dayIndex = Math.floor((groupNo - 1) / perDay);
        if (dayIndex > 4) return null;
        return createWeeklyGroupData(g, userWithCategory, groupNo, days[dayIndex]);
    }).filter(Boolean);
};

const buildDailyGroupSet = (user, loNo) => {
    const pool = LOGROUPS[loNo - 1];
    if (!pool) return [];
    return pool.map((g, i) => createDailyGroupData(g, user, i + 1));
};

// Direct existence check — queries groups by loId + occurence (+ theme for
// weekly) rather than inferring from names or from cleanup side-effects.
const targetSetAlreadyExists = async (loId, occurence, weeklyScheduleType, acceleratedCategory) => {
    const where = { loanOfficerId: { _eq: loId }, occurence: { _eq: occurence } };
    if (occurence === 'weekly') {
        where.weeklyScheduleType = { _eq: weeklyScheduleType };
        if (weeklyScheduleType === 'accelerated') {
            where.acceleratedCategory = { _eq: acceleratedCategory };
        }
    }

    const rawRes = await graph.query(
        queryQl(GROUP_TYPE('groupsExistCheck'), { where, limit: 1 })
    );

    const groups = rawRes?.data?.groupsExistCheck;
    return (groups || []).length > 0;
};

// Handles ANY transition that changes which group set an LO should be
// using: daily<->weekly, or standard<->accelerated within weekly.
//
// fromWeeklyScheduleType / toWeeklyScheduleType are both explicit and
// independent — this is what lets cleanup target only the theme being
// left, without ever touching the theme being switched to (see note on
// cleanupUnusedGroups above for why that distinction matters).
// CHANGED: transitionGroups now threads acceleratedCategory through both
// the "from" cleanup and "to" existence-check/insert.
const transitionGroups = async ({
    user, fromOccurence, toOccurence,
    fromWeeklyScheduleType, toWeeklyScheduleType,
    fromAcceleratedCategory, toAcceleratedCategory, loNo
}) => {
    await cleanupUnusedGroups(user._id, fromOccurence, fromWeeklyScheduleType, fromAcceleratedCategory);

    let groupsToInsert = [];
    if (toOccurence === 'weekly') {
        const alreadyExists = await targetSetAlreadyExists(user._id, 'weekly', toWeeklyScheduleType, toAcceleratedCategory);
        if (!alreadyExists) {
            groupsToInsert = buildWeeklyGroupSet(user, toWeeklyScheduleType, toAcceleratedCategory);
        }
    } else if (toOccurence === 'daily') {
        const pool = LOGROUPS[loNo - 1];
        const alreadyExists = pool ? await targetSetAlreadyExists(user._id, 'daily', null, null) : false;
        if (pool && !alreadyExists) {
            groupsToInsert = buildDailyGroupSet(user, loNo);
        }
    }

    if (groupsToInsert.length > 0) {
        const objects = groupsToInsert.map(g => ({ ...g, _id: generateUUID() }));
        await graph.mutation(insertQl(GROUP_TYPE('groupsInsert'), { objects }));
    }
};

export default apiHandler({
    get: getUser,
    post: updateUser
});

async function getUser(req, res) {
    const { _id } = req.query;
    let statusCode = 200;
    let response = {};
    const user = await findUserByID(_id);
    response = { success: true, user };
    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function updateUser(req, res) {
    let statusCode = 200;
    let response = { upload: true, success: false };

    const form = new formidable.IncomingForm({ keepExtensions: true });
    const promise = await new Promise((resolve, reject) => {
        form.parse(req, async function (err, payload, files) {
            try {
                const userData = await findUserByEmail(payload.email);

                let file = payload.profile;

                if (err) {
                    resolve({ formError: true });
                    return;
                }

                const profile = file || userData.profile;
                const userRole = JSON.parse(payload.role);

                const hierarchyFields = buildHierarchyFields(userRole, payload);

                const switchingToWeekly = userRole.rep === 4 &&
                    payload.transactionType === 'weekly' &&
                    userData.transactionType !== 'weekly';

                const switchingToDaily = userRole.rep === 4 &&
                    payload.transactionType === 'daily' &&
                    userData.transactionType !== 'daily';

                // CHANGED: switchingScheduleType now also fires on a category change
                // within accelerated — this was the gap I flagged above. Without this,
                // an admin switching an LO from "cars" to "birds" while staying
                // accelerated would silently keep the old cars groups and never create
                // birds groups, because weeklyScheduleType itself never changed.
                const switchingScheduleType = userRole.rep === 4 &&
                    payload.transactionType === 'weekly' &&
                    userData.transactionType === 'weekly' &&
                    (
                        (payload.weeklyScheduleType || 'standard') !== (userData.weeklyScheduleType || 'standard')
                        ||
                        (
                            (payload.weeklyScheduleType || 'standard') === 'accelerated' &&
                            (payload.acceleratedCategory || null) !== (userData.acceleratedCategory || null)
                        )
                    );

                if (switchingToWeekly || switchingToDaily || switchingScheduleType) {
                    const blockingLoans = await findBlockingLoans(userData._id);
                    if (blockingLoans.length > 0) {
                        const isCategoryOnlyChange = switchingScheduleType &&
                            (payload.weeklyScheduleType || 'standard') === (userData.weeklyScheduleType || 'standard');
                        const label = switchingToWeekly ? 'Weekly'
                            : switchingToDaily ? 'Daily'
                            : isCategoryOnlyChange ? 'a different group category'
                            : 'Accelerated Weekly';
                        resolve({
                            success: false,
                            error: true,
                            message: `Cannot switch to ${label}. ${blockingLoans.length} loan(s) under this loan officer are not closed.`,
                            blockingLoans: blockingLoans.map(l => ({
                                loanId: l._id,
                                clientName: l.fullName,
                                slotNo: l.slotNo,
                                status: l.status
                            }))
                        });
                        return;
                    }
                }

                let forUpdate = {
                    firstName: payload.firstName,
                    lastName: payload.lastName,
                    number: payload.number,
                    position: payload.position,
                    profile: profile === 'null' ? null : profile,
                    loNo: payload.loNo && payload.loNo !== 'null' ? +payload.loNo : null,
                    transactionType: payload.transactionType,
                    weeklyScheduleType: payload.transactionType === 'weekly'
                        ? (payload.weeklyScheduleType || 'standard')
                        : null,
                    acceleratedCategory: (payload.transactionType === 'weekly' && (payload.weeklyScheduleType || 'standard') === 'accelerated')
                        ? (payload.acceleratedCategory || null)
                        : null,
                    ...hierarchyFields,
                };

                if (userRole.rep === 3 || userRole.rep === 4) {
                    if (payload.branchManagerName) {
                        forUpdate.branchManagerName = payload.branchManagerName;
                    }
                    forUpdate.designatedBranchId = (payload.designatedBranchId && typeof payload.designatedBranchId !== 'string')
                        ? JSON.parse(payload.designatedBranchId)
                        : nullify(payload.designatedBranchId);

                } else if (userRole.rep === 2) {
                    if (userRole.shortCode === 'deputy_director' && forUpdate.divisionId !== userData.divisionId) {
                        const [prev] = await findDivisions({ _id: { _eq: userData.divisionId } }, '_id managerIds');
                        const [current] = await findDivisions({ _id: { _eq: forUpdate.divisionId } }, '_id managerIds');
                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];
                        currentManagerIds.push(userData._id);
                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('divisions', `_id`)(alias), {
                            set: { managerIds },
                            where: { _id: { _eq: _id } }
                        });
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.divisionId, 'prevDivision'),
                            createUpdateQl(currentManagerIds, forUpdate.divisionId, 'currentDivision'),
                        );
                    } else if (userRole.shortCode === 'regional_manager' && userData.regionId != payload.regionId) {
                        const [prev] = await findRegions({ _id: { _eq: userData.regionId } }, '_id managerIds');
                        const [current] = await findRegions({ _id: { _eq: forUpdate.regionId } }, '_id managerIds');
                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];
                        currentManagerIds.push(userData._id);
                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('regions', `_id`)(alias), {
                            set: { managerIds: JSON.stringify(managerIds) },
                            where: { _id: { _eq: _id } }
                        });
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.regionId, 'prevRegion'),
                            createUpdateQl(currentManagerIds, forUpdate.regionId, 'currentRegion'),
                        );
                    } else if (userRole.shortCode === 'area_admin' && forUpdate.areaId != userData.areaId) {
                        const [prev] = await findAreas({ _id: { _eq: userData.areaId } }, '_id managerIds');
                        const [current] = await findAreas({ _id: { _eq: forUpdate.areaId } }, '_id managerIds');
                        const prevManagerIds = JSON.parse(prev.managerIds ?? '[]')?.filter(id => id != userData._id) ?? [];
                        const currentManagerIds = JSON.parse(current.managerIds ?? '[]') ?? [];
                        currentManagerIds.push(userData._id);
                        const createUpdateQl = (managerIds, _id, alias) => updateQl(createGraphType('areas', `_id`)(alias), {
                            set: { managerIds: JSON.stringify(managerIds) },
                            where: { _id: { _eq: _id } }
                        });
                        await graph.mutation(
                            createUpdateQl(prevManagerIds, userData.areaId, 'prevarea'),
                            createUpdateQl(currentManagerIds, forUpdate.areaId, 'currarea'),
                        );
                    }
                }

                const resp = await graph.mutation(
                    updateQl(USER_TYPE, {
                        set: forUpdate,
                        where: { email: { _eq: payload.email } }
                    })
                );

                if (resp.errors) {
                    reject(resp.errors);
                    return;
                }

                // ── Group transition: fires AFTER the user record is committed.
                // Any failure here is a hard reject — leaving the LO's
                // transactionType/weeklyScheduleType pointing at a group set
                // that doesn't fully exist yet is worse than surfacing a retry.
                // Still two separate mutations, not one transaction.
                try {
                    const mergedUser = { ...userData, ...forUpdate };

                    // ── TEMP LOG ──────────────────────────────────────────
                    console.log('[updateUser] group transition starting:', {
                        switchingToWeekly, switchingToDaily, switchingScheduleType,
                        oldTheme: userData.weeklyScheduleType,
                        newTheme: forUpdate.weeklyScheduleType
                    });

                    if (switchingToWeekly) {
                        await transitionGroups({
                            user: mergedUser,
                            fromOccurence: 'daily',
                            toOccurence: 'weekly',
                            fromWeeklyScheduleType: null,
                            toWeeklyScheduleType: forUpdate.weeklyScheduleType || 'standard',
                            fromAcceleratedCategory: null,
                            toAcceleratedCategory: forUpdate.acceleratedCategory
                        });
                    } else if (switchingToDaily) {
                        await transitionGroups({
                            user: mergedUser,
                            fromOccurence: 'weekly',
                            toOccurence: 'daily',
                            fromWeeklyScheduleType: userData.weeklyScheduleType || 'standard',
                            fromAcceleratedCategory: userData.acceleratedCategory || null,
                            loNo: parseInt(forUpdate.loNo || userData.loNo)
                        });
                    } else if (switchingScheduleType) {
                        await transitionGroups({
                            user: mergedUser,
                            fromOccurence: 'weekly',
                            toOccurence: 'weekly',
                            fromWeeklyScheduleType: userData.weeklyScheduleType || 'standard',
                            toWeeklyScheduleType: forUpdate.weeklyScheduleType || 'standard',
                            fromAcceleratedCategory: userData.acceleratedCategory || null,
                            toAcceleratedCategory: forUpdate.acceleratedCategory || null
                        });
                    }
                } catch (groupError) {
                    // ── TEMP LOG ──────────────────────────────────────────
                    console.log('[updateUser] group transition THREW:', groupError.message, groupError.stack);

                    reject({
                        message: `User record updated, but group transition failed: ${groupError.message}. Please retry or contact support.`,
                    });
                    return;
                }

                if (!payload._skipLog) {
                    await writeChangeLogs(userData._id, userData, forUpdate);
                }

                delete userData._id;
                delete userData.password;
                resolve({ success: true, user: userData });
            } catch (error) {
                console.error('Error updating user:', error);
                reject(error);
            }
        });
    });

    response = { ...response, success: true, ...promise };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

const findUserByID = async (id) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, { where: { _id: { _eq: id } } })
    ).then(res => res.data.users);
    return user;
};

const findUserByEmail = async (email) => {
    const [user] = await graph.query(
        queryQl(USER_TYPE, { where: { email: { _eq: email } } })
    ).then(res => res.data.users);
    return user;
};

export const config = {
    api: { bodyParser: false }
};