import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'
import { LO_10_DAILY_GROUPS, LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_1_DAILY_GROUPS, LO_20_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS, LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, WEEKLY_GROUPS } from '@/lib/constants';

const LOGROUPS = [
    LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS,
    LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, LO_10_DAILY_GROUPS, 
    LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, 
    LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_20_DAILY_GROUPS
];

export default apiHandler({
    post: save
});

async function save(req, res) {
    const data = req.body;

    const { db } = await connectToDatabase();

    const users = await db
        .collection('users')
        .find({ email: data.email })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (users.length > 0) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${data.email}" already exists`
        };
    } else {
        let assignedBranch = data.designatedBranch;
        let assignedBranchId = data.designatedBranchId;
        if (typeof assignedBranch !== "string") {
            assignedBranch = JSON.parse(data.designatedBranch);
            assignedBranchId = JSON.parse(data.designatedBranchId);
        }

        let userData = {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            number: data.number,
            position: data.position,
            logged: false,
            lastLogin: null,
            dateAdded: data.currentDate,
            role: JSON.parse(data.role),
            loNo: data.loNo,
            designatedBranch: assignedBranch,
            designatedBranchId: assignedBranchId,
            transactionType: data.transactionType
        }

        if (userData.role.rep === 3) {
            userData.branchManagerName = data.branchManagerName;
        }
        
        const user = await db.collection('users').insertOne(userData);
        if (userData.role.rep === 4) {
            await createGroups(userData);
        }

        response = {
            success: true,
            user: user,
            email: data.email
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function createGroups (user) {
    const { db } = await connectToDatabase();

    if (user.transactionType === 'daily') {
        const loNo = parseInt(user.loNo);
        if (loNo) {
            LOGROUPS[loNo - 1].map(async (g, i) => {
                const groups = createDailyGroupData(g, user, i + 1);
                await db.collection('groups').insertOne(groups);
            });
        }
        // switch (parseInt(user.loNo)) {
        //     case 1:
        //         LO_1_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 2:
        //         LO_2_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 3:
        //         LO_3_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 4:
        //         LO_4_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 5:
        //         LO_5_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 6:
        //         LO_6_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 7:
        //         LO_7_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 8:
        //         LO_8_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 9:
        //         LO_9_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 10:
        //         LO_10_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 10:
        //         LO_10_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 11:
        //         LO_11_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 12:
        //         LO_12_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 13:
        //         LO_13_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 14:
        //         LO_14_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 15:
        //         LO_15_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 16:
        //         LO_16_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 17:
        //         LO_17_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 18:
        //         LO_18_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 19:
        //         LO_19_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     case 20:
        //         LO_20_DAILY_GROUPS.map(async (g, i) => {
        //             const groups = createDailyGroupData(g, user, i + 1);
        //             await db.collection('groups').insertOne(groups);
        //         });
        //         break;
        //     default:
        //         break;
        // }
    } else if (user.transactionType === 'weekly') {
        WEEKLY_GROUPS.map(async (g, i) => {
            const groupNo = i + 1;
            if (groupNo <= 3) {
                const groups = createWeeklyGroupData(g, user, groupNo, "monday");
                await db.collection('groups').insertOne(groups);
            } else if (groupNo >= 4 && groupNo <= 6) {
                const groups = createWeeklyGroupData(g, user, groupNo, "tuesday");
                await db.collection('groups').insertOne(groups);
            } else if (groupNo >= 7 && groupNo <= 9) {
                const groups = createWeeklyGroupData(g, user, groupNo, "wednesday");
                await db.collection('groups').insertOne(groups);
            } else if (groupNo >= 10 && groupNo <= 12) {
                const groups = createWeeklyGroupData(g, user, groupNo, "thursday");
                await db.collection('groups').insertOne(groups);
            } else if (groupNo >= 13 && groupNo <= 15) {
                const groups = createWeeklyGroupData(g, user, groupNo, "friday");
                await db.collection('groups').insertOne(groups);
            }
        });
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