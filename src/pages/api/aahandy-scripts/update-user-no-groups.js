import { apiHandler } from '@/services/api-handler';
import { connectToDatabase } from '@/lib/mongodb';
import { LO_10_DAILY_GROUPS, LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_1_DAILY_GROUPS, LO_20_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS, LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, WEEKLY_GROUPS } from '@/lib/constants';

const LOGROUPS = [
  LO_1_DAILY_GROUPS, LO_2_DAILY_GROUPS, LO_3_DAILY_GROUPS, LO_4_DAILY_GROUPS, LO_5_DAILY_GROUPS,
  LO_6_DAILY_GROUPS, LO_7_DAILY_GROUPS, LO_8_DAILY_GROUPS, LO_9_DAILY_GROUPS, LO_10_DAILY_GROUPS, 
  LO_11_DAILY_GROUPS, LO_12_DAILY_GROUPS, LO_13_DAILY_GROUPS, LO_14_DAILY_GROUPS, LO_15_DAILY_GROUPS, 
  LO_16_DAILY_GROUPS, LO_17_DAILY_GROUPS, LO_18_DAILY_GROUPS, LO_19_DAILY_GROUPS, LO_20_DAILY_GROUPS
];

export default apiHandler({
    post: testOnly
});

async function testOnly(req, res) {
    const { db } = await connectToDatabase();
    let response;
    let statusCode = 200;

    // B099 - 66fb75409aa16a5721017de8
    // B100 - 66fccd7907494604573d0127
    // B101 - 66fccdba4ba8643bc94e77e7
    // B102 - 66fd2718c8e1b50de14095b8
    // B103 - 66fe8fefc8e1b50de140f5cb

    const branchId = '66fe8fefc8e1b50de140f5cb'

    const users = await db.collection('users').find({ designatedBranch: "B103", "role.rep": 4 }).toArray();
    users.map(async user => {
      let temp = {...user};
      temp.designatedBranchId = branchId;
      temp.loNo = parseInt(user.loNo);
      delete temp._id;
      await db.collection('users').updateOne({ _id: user._id }, { $set: temp });
      temp._id = user._id;
      await createGroups(temp);
    })


    response = { success: true };

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