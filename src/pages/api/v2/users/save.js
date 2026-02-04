import { LO_10_DAILY_GROUPS, LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_1_DAILY_GROUPS, LO_20_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS, LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, WEEKLY_GROUPS } from '@/lib/constants';
import { USER_FIELDS, AREA_FIELDS, REGION_FIELDS, DIVISION_FIELDS } from '@/lib/graph.fields';
import { findAreas, findDivisions, findRegions, findUserById, findUsers } from '@/lib/graph.functions';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { apiHandler } from '@/services/api-handler';

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
            role: userRole,
            loNo: typeof data.loNo == 'string' ? parseInt(data.loNo) : data.loNo,
            transactionType: data.transactionType,
            designatedBranchId: data.designatedBranchId ?? null,
            areaId: data.areaId ?? null,
            regionId: data.regionId ?? null,
            divisionId: data.divisionId ?? null,
            root: false,
        };

        if (userRole.rep === 3 || userRole.rep === 4) {
            userData.designatedBranch = (data.designatedBranch && typeof data.designatedBranch !== "string") ? JSON.parse(data.designatedBranch) : data.designatedBranch;
            userData.designatedBranchId = (data.designatedBranchId && typeof data.designatedBranchId !== "string") ? JSON.parse(data.designatedBranch)._id : data.designatedBranchId;
        }

        if (userData.role.rep === 3) {
            userData.branchManagerName = data.branchManagerName;
        }

        if (userRole.shortCode === 'area_admin') {
            const [area] = await findAreas({ _id: { _eq: userData.areaId } }, `_id managerIds`);
            const managerIds = JSON.parse(area.managerIds ?? '[]');
            console.log(managerIds)
            managerIds.push(userData._id);
            addToMutationList((alias) => updateQl(createGraphType('areas', '_id')('area_' + alias), {
                set: {
                    managerIds: JSON.stringify([... new Set(managerIds)])
                },
                where: {
                    _id: { _eq: area._id ?? null }
                }
            }));

            userData.designatedBranch = (data.designatedBranch && typeof data.designatedBranch !== "string") ? JSON.parse(data.designatedBranch) : data.designatedBranch;
        }

        if (userRole.shortCode === 'regional_manager') {
            const [region] = await findRegions({ _id: { _eq: userData.regionId } }, `_id managerIds`);
            const managerIds = JSON.parse(region.managerIds ?? '[]');
            managerIds.push(userData._id);
            addToMutationList((alias) => updateQl(createGraphType('regions', '_id')('region_' + alias), {
                set: {
                    managerIds: JSON.stringify([... new Set(managerIds)])
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

        if(mutationList.length) {
            await graph.mutation(
                ... mutationList
            );
        }

        response = {
            success: true,
            user: userData,
            email: data.email
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function createGroups (user, addToMutationList) {

    const insertGroups =  (groups) => {
        addToMutationList(alias => insertQl(GROUP_TYPE(alias), {
            objects: groups.map(group => ({
                ... group,
                _id: generateUUID()
            }))
        }));
    }

    if (user.transactionType === 'daily') {
        const loNo = parseInt(user.loNo);
        if (loNo) {
            const groups = LOGROUPS[loNo - 1].map((g, i) => {
                const groups = createDailyGroupData(g, user, i + 1);
                return groups
            });

            insertGroups(groups);
        }
    } else if (user.transactionType === 'weekly') {
        const groups = WEEKLY_GROUPS.map((g, i) => {
            const groupNo = i + 1;
            if (groupNo <= 3) {
                const groups = createWeeklyGroupData(g, user, groupNo, "monday");
                return groups;
            } else if (groupNo >= 4 && groupNo <= 6) {
                const groups = createWeeklyGroupData(g, user, groupNo, "tuesday");
                return groups;
            } else if (groupNo >= 7 && groupNo <= 9) {
                const groups = createWeeklyGroupData(g, user, groupNo, "wednesday");
                return groups;
            } else if (groupNo >= 10 && groupNo <= 12) {
                const groups = createWeeklyGroupData(g, user, groupNo, "thursday");
                return groups;
            } else if (groupNo >= 13 && groupNo <= 15) {
                const groups = createWeeklyGroupData(g, user, groupNo, "friday");
                return groups
            }
        });

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
        capacity: 30,
        noOfClients: 0,
        status: "available",
        dateAdded: new Date()
    }
}