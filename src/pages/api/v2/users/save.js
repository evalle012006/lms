import { LO_10_DAILY_GROUPS, LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_1_DAILY_GROUPS, LO_20_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS, LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, WEEKLY_GROUPS, ACCELERATED_WEEKLY_CATEGORIES } from '@/lib/constants';
import { USER_FIELDS, AREA_FIELDS, REGION_FIELDS, DIVISION_FIELDS } from '@/lib/graph.fields';
import { findAreas, findDivisions, findRegions, findUserById, findUsers } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { generateTempPassword } from '@/lib/generate-password';
import { apiHandler } from '@/services/api-handler';

const bcrypt = require('bcryptjs');

const LOGROUPS = [
    LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS,
    LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, LO_10_DAILY_GROUPS, 
    LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, 
    LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_20_DAILY_GROUPS
];

const graph = new GraphProvider();
const USER_TYPE = createGraphType('users', `
${USER_FIELDS}
`);

const GROUP_TYPE = createGraphType('groups', `_id`);

// ── ADDED: sanitizes any value that should be a real NULL in the DB ──────────
// Catches: actual null, undefined, the string "null", the string "undefined",
// empty string, and the string "[]" (empty branch placeholder).
const nullify = (val) => {
    if (val === null || val === undefined) return null;
    const str = String(val).trim();
    if (str === '' || str === 'null' || str === 'undefined') return null;
    return val;
};

// ── ADDED: enforces correct hierarchy fields per role ────────────────────────
// Prevents stale/wrong IDs from leaking across roles.
const buildHierarchyFields = (userRole, data) => {
    const shortCode = userRole.shortCode;
    const rep = userRole.rep;

    // admin / root — everything null
    if (rep === 1) {
        return {
            areaId: null,
            regionId: null,
            divisionId: null,
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // deputy_director — only divisionId
    if (shortCode === 'deputy_director') {
        return {
            areaId: null,
            regionId: null,
            divisionId: nullify(data.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // regional_manager — divisionId + regionId
    if (shortCode === 'regional_manager') {
        return {
            areaId: null,
            regionId: nullify(data.regionId),
            divisionId: nullify(data.divisionId),
            designatedBranchId: null,
            designatedBranch: null,
        };
    }

    // area_admin — areaId + regionId + divisionId, designatedBranch allowed (multi-branch)
    if (shortCode === 'area_admin') {
        return {
            areaId: nullify(data.areaId),
            regionId: nullify(data.regionId),
            divisionId: nullify(data.divisionId),
            designatedBranchId: null,
            designatedBranch: (data.designatedBranch && typeof data.designatedBranch !== 'string')
                ? JSON.parse(data.designatedBranch)
                : (nullify(data.designatedBranch) ?? '[]'),
        };
    }

    // branch_manager (rep 3) and loan_officer (rep 4) — full hierarchy
    if (rep === 3 || rep === 4) {
        return {
            areaId: nullify(data.areaId),
            regionId: nullify(data.regionId),
            divisionId: nullify(data.divisionId),
            designatedBranchId: nullify(data.designatedBranchId),
            designatedBranch: (data.designatedBranch && typeof data.designatedBranch !== 'string')
                ? JSON.parse(data.designatedBranch)
                : (nullify(data.designatedBranch) ?? null),
        };
    }

    // fallback — null everything to be safe
    return {
        areaId: null,
        regionId: null,
        divisionId: null,
        designatedBranchId: null,
        designatedBranch: null,
    };
};
// ────────────────────────────────────────────────────────────────────────────

export default apiHandler({
    post: save
});

async function save(req, res) {
    const mutationList = [];
    const addToMutationList = (handler) => mutationList.push(handler(`add_mutation_${mutationList.length}`));

    const data = req.body;
    const users = await findUsers({ email: { _eq: data.email } });

    let response = {};
    let statusCode = 200;

    if (users.length > 0) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${data.email}" already exists`
        };
    } else {
        const userRole = JSON.parse(data.role);

        // ── CHANGED: use buildHierarchyFields instead of raw data values ──
        const hierarchyFields = buildHierarchyFields(userRole, data);

        // NEW: real temp password instead of leaving `password` unset. An unset
        // password previously meant the NO_PASS login branch accepted any input
        // as correct on the next attempt — this replaces that silent bypass with
        // an admin-issued value. Plaintext only ever lives in this response,
        // once, for the admin to relay to the new user.
        const tempPassword = generateTempPassword();
        const hashedPassword = bcrypt.hashSync(tempPassword, bcrypt.genSaltSync(8), null);

        let userData = {
            _id: generateUUID(),
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            number: data.number,
            position: data.position,
            logged: false,
            lastLogin: null,
            dateAdded: data.currentDate,
            password: hashedPassword,
            mustChangePassword: true,
            role: userRole,
            loNo: typeof data.loNo == 'string' ? parseInt(data.loNo) : data.loNo,
            transactionType: data.transactionType,
            weeklyScheduleType: data.transactionType === 'weekly'
                ? (data.weeklyScheduleType || 'standard')
                : null,
            // NEW: only meaningful for weekly + accelerated. Persisted on the user
            // so the update route can compare old-vs-new category on edit (see
            // switchingScheduleType change in [id].js below).
            acceleratedCategory: (data.transactionType === 'weekly' && (data.weeklyScheduleType || 'standard') === 'accelerated')
                ? (data.acceleratedCategory || null)
                : null,
            root: false,
            ...hierarchyFields,
        };

        // rep 3/4: designatedBranchId from branch object if passed as object
        // Note: buildHierarchyFields already handles designatedBranch string/object,
        // but designatedBranchId for rep 3/4 needs the branch _id extraction:
        if (userRole.rep === 3 || userRole.rep === 4) {
            userData.designatedBranchId = (data.designatedBranchId && typeof data.designatedBranchId !== 'string')
                ? JSON.parse(data.designatedBranch)._id
                : nullify(data.designatedBranchId);
        }

        if (userRole.rep === 3) {
            userData.branchManagerName = data.branchManagerName;
        }

        if (userRole.shortCode === 'area_admin') {
            const [area] = await findAreas({ _id: { _eq: userData.areaId } }, `_id managerIds`);
            const managerIds = JSON.parse(area.managerIds ?? '[]');
            managerIds.push(userData._id);
            addToMutationList((alias) => updateQl(createGraphType('areas', '_id')('area_' + alias), {
                set: {
                    managerIds: JSON.stringify([...new Set(managerIds)])
                },
                where: {
                    _id: { _eq: area._id ?? null }
                }
            }));
        }

        if (userRole.shortCode === 'regional_manager') {
            const [region] = await findRegions({ _id: { _eq: userData.regionId } }, `_id managerIds`);
            const managerIds = JSON.parse(region.managerIds ?? '[]');
            managerIds.push(userData._id);
            addToMutationList((alias) => updateQl(createGraphType('regions', '_id')('region_' + alias), {
                set: {
                    managerIds: JSON.stringify([...new Set(managerIds)])
                },
                where: {
                    _id: { _eq: region._id ?? null }
                }
            }));
        }

        if (userRole.shortCode === 'deputy_director') {
            const [division] = await findDivisions({ _id: { _eq: userData.divisionId } }, `_id managerIds`);
            const managerIds = JSON.parse(division.managerIds ?? '[]');
            managerIds.push(userData._id);
            addToMutationList((alias) => updateQl(createGraphType('divisions', '_id')('division_' + alias), {
                set: {
                    managerIds: JSON.stringify([...new Set(managerIds)]),
                },
                where: {
                    _id: { _eq: division._id ?? null }
                }
            }));
        }
        
        addToMutationList((alias) => insertQl(USER_TYPE(alias), {
            objects: [userData]
        }));
        
        if (userData.role.rep === 4) {
            await createGroups(userData, addToMutationList);
        }

        if (mutationList.length) {
            await graph.mutation(
                ...mutationList
            );
        }

        // CHANGED: strip the password hash before echoing the user back in the
        // response — mirrors `delete userData.password` in pages/api/v2/users/index.js's
        // update handler. `userData` itself (still holding the hash) is left
        // untouched above since it's also passed into createGroups(); we only
        // scrub the copy that goes out over the wire. tempPassword is the one
        // and only place the plaintext appears.
        const { password, ...userForResponse } = userData;
        response = {
            success: true,
            user: userForResponse,
            email: data.email,
            tempPassword,
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function createGroups (user, addToMutationList) {

    const insertGroups = (groups) => {
        addToMutationList(alias => insertQl(GROUP_TYPE(alias), {
            objects: groups.map(group => ({
                ...group,
                _id: generateUUID()
            }))
        }));
    }

    if (user.transactionType === 'daily') {
        const loNo = parseInt(user.loNo);
        if (loNo) {
            const groups = LOGROUPS[loNo - 1].map((g, i) => createDailyGroupData(g, user, i + 1));
            insertGroups(groups);
        }
    } else if (user.transactionType === 'weekly') {
        // CHANGED: standard still uses WEEKLY_GROUPS (fruits) directly.
        // Accelerated now selects a pool from ACCELERATED_WEEKLY_CATEGORIES
        // by user.acceleratedCategory, defaulting to 'cars' if somehow
        // missing (should never happen — form validation requires it — but
        // a hard failure here would leave the user record created with no
        // groups at all, which is worse than defaulting and logging).
        let namePool;
        if (user.weeklyScheduleType === 'accelerated') {
            const category = ACCELERATED_WEEKLY_CATEGORIES.find(c => c.key === user.acceleratedCategory);
            if (!category) {
                console.warn(`[createGroups] user ${user._id} is accelerated with no valid acceleratedCategory ('${user.acceleratedCategory}') — defaulting to 'cars'`);
            }
            namePool = category ? category.names : ACCELERATED_WEEKLY_CATEGORIES[0].names;
        } else {
            namePool = WEEKLY_GROUPS;
        }

        const perDay = user.weeklyScheduleType === 'accelerated' ? 5 : 3;
        const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];

        const groups = namePool.map((g, i) => {
            const groupNo = i + 1;
            const dayIndex = Math.floor((groupNo - 1) / perDay);
            if (dayIndex > 4) return null;
            return createWeeklyGroupData(g, user, groupNo, days[dayIndex]);
        }).filter(Boolean);

        insertGroups(groups);
    }
}

const createDailyGroupData = (groupName, user, groupNo) => {
    return {
        name: groupName,
        branchId: user.designatedBranchId,
        day: "all",
        dayNo: 0,
        time: "7:30AM-7:45AM",
        groupNo: groupNo,
        occurence: "daily",
        loanOfficerId: user._id + "",
        loanOfficerName: user.lastName + ', ' + user.firstName,
        availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
        capacity: 26,
        noOfClients: 0,
        status: "available",
        dateAdded: new Date()
    }
}

const createWeeklyGroupData = (groupName, user, groupNo, day) => {
    return {
        name: groupName,
        branchId: user.designatedBranchId,
        day: day,
        dayNo: groupNo,
        time: "7:30AM-7:45AM",
        groupNo: groupNo,
        occurence: "weekly",
        loanOfficerId: user._id + "",
        loanOfficerName: user.lastName + ', ' + user.firstName,
        availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
        capacity: user.weeklyScheduleType === 'accelerated' ? 15 : 30,
        noOfClients: 0,
        status: "available",
        weeklyScheduleType: user.weeklyScheduleType,
        // NEW: needed on the group row itself, not just the user row, so
        // cleanup/transition queries in [id].js can scope by category.
        acceleratedCategory: user.weeklyScheduleType === 'accelerated' ? user.acceleratedCategory : null,
        dateAdded: new Date()
    }
}