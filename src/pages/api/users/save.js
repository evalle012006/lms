import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import moment from 'moment'
import { LO_10_DAILY_GROUPS, LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS, LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_9_DAILY_GROUPS, WEEKLY_GROUPS } from '@/lib/constants';

export default apiHandler({
    post: save
});

async function save(req, res) {
    const { email, firstName, lastName, number, position, designatedBranch, role, loNo, transactionType, currentDate } = req.body;

    const { db } = await connectToDatabase();

    const users = await db
        .collection('users')
        .find({ email: email })
        .toArray();

    let response = {};
    let statusCode = 200;

    if (users.length > 0) {
        response = {
            error: true,
            fields: ['email'],
            message: `User with the email "${email}" already exists`
        };
    } else {
        // const role = await db.collection('platformRoles').find({ rep: 1 }).project({ _id: 0 }).toArray();
        let assignedBranch = designatedBranch;
        if (typeof assignedBranch !== "string") {
            assignedBranch = JSON.parse(designatedBranch);
        }
        const userData = {
            firstName: firstName,
            lastName: lastName,
            email: email,
            number: number,
            position: position,
            logged: false,
            lastLogin: null,
            dateAdded: currentDate,
            role: JSON.parse(role),
            loNo: loNo,
            designatedBranch: assignedBranch,
            transactionType: transactionType
        }
        const user = await db.collection('users').insertOne(userData);
        await createGroups(userData);

        response = {
            success: true,
            user: user,
            email: email
        }
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}

async function createGroups (user) {
    const { db } = await connectToDatabase();
    
    if (user.transactionType === 'daily') {
        switch (parseInt(user.loNo)) {
            case 1:
                LO_1_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 2:
                LO_2_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 3:
                LO_3_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 4:
                LO_4_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 5:
                LO_5_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 6:
                LO_6_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 7:
                LO_7_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 8:
                LO_1_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 9:
                LO_9_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            case 10:
                LO_10_DAILY_GROUPS.map(async (g, i) => {
                    const groups = createDailyGroupData(g, user, i + 1);
                    await db.collection('groups').inserOne(groups);
                });
                break;
            default:
                break;
        }
    } else if (user.transactionType === 'weekly') {
        WEEKLY_GROUPS.map(async (g, i) => {
            const groupNo = i + 1;
            if (groupNo <= 3) {
                const groups = createWeeklyGroupData(g, user, groupNo, "monday");
                await db.collection('groups').inserOne(groups);
            } else if (groupNo >= 4 && groupNo <= 6) {
                const groups = createWeeklyGroupData(g, user, groupNo, "tuesday");
                await db.collection('groups').inserOne(groups);
            } else if (groupNo >= 7 && groupNo <= 9) {
                const groups = createWeeklyGroupData(g, user, groupNo, "wednesday");
                await db.collection('groups').inserOne(groups);
            } else if (groupNo >= 10 && groupNo <= 12) {
                const groups = createWeeklyGroupData(g, user, groupNo, "thursday");
                await db.collection('groups').inserOne(groups);
            } else if (groupNo >= 13 && groupNo <= 15) {
                const groups = createWeeklyGroupData(g, user, groupNo, "friday");
                await db.collection('groups').inserOne(groups);
            }
        });
    }
}

const createDailyGroupData = (groupName, user, groupNo) => {
    return {
        name: groupName,
        branchId: user.branchId,
        day: "all",
        dayNo: 0,
        time: "7:30AM-7:45AM",
        groupNo: groupNo,
        occurence: "daily",
        loanOfficerId: user._id,
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
        branchId: user.branchId,
        day: day,
        dayNo: groupNo,
        time: "7:30AM-7:45AM",
        groupNo: groupNo,
        occurence: "daily",
        loanOfficerId: user._id,
        loanOfficerName: user.lastName + ', ' + user.firstName,
        availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
        capacity: 30,
        noOfClients: 0,
        status: "available",
        dateAdded: new Date()
    }
}