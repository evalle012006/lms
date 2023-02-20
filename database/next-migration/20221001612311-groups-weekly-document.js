module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    const branches = await db.collection('branches').find().toArray();
    const users = await db.collection('users').find().toArray();

    if (branches && users) {
      branches.map(branch => {
        const branchUserLO = users.filter(u => u.designatedBranch === branch.code);
        if (branchUserLO) {
            branchUserLO.filter(u => u.role.rep === 4).map(user => {
                db.collection('groups').insertMany([
                  {
                    name: "APPLE",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "monday",
                    dayNo: 1,
                    time: "7:30AM-7:45AM",
                    groupNo: 1,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "BANANA",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "monday",
                    dayNo: 1,
                    time: "7:30AM-7:45AM",
                    groupNo: 2,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "ORANGE",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "monday",
                    dayNo: 1,
                    time: "7:30AM-7:45AM",
                    groupNo: 3,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "MANGO",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "tuesday",
                    dayNo: 2,
                    time: "7:30AM-7:45AM",
                    groupNo: 4,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "PINEAPPLE",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "tuesday",
                    dayNo: 2,
                    time: "7:30AM-7:45AM",
                    groupNo: 5,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "WATERMELON",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "tuesday",
                    dayNo: 2,
                    time: "7:30AM-7:45AM",
                    groupNo: 6,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "GRAPES",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "wednesday",
                    dayNo: 3,
                    time: "7:30AM-7:45AM",
                    groupNo: 7,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "KIWI",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "wednesday",
                    dayNo: 3,
                    time: "7:30AM-7:45AM",
                    groupNo: 8,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "PEAR",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "wednesday",
                    dayNo: 3,
                    time: "7:30AM-7:45AM",
                    groupNo: 9,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "PEACH",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "thursday",
                    dayNo: 4,
                    time: "7:30AM-7:45AM",
                    groupNo: 10,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "STRAWBERRY",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "thursday",
                    dayNo: 4,
                    time: "7:30AM-7:45AM",
                    groupNo: 11,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "BLUEBERRY",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "thursday",
                    dayNo: 4,
                    time: "7:30AM-7:45AM",
                    groupNo: 12,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "RASPBERRY",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "friday",
                    dayNo: 5,
                    time: "7:30AM-7:45AM",
                    groupNo: 13,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "LEMON",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "friday",
                    dayNo: 5,
                    time: "7:30AM-7:45AM",
                    groupNo: 14,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  },
                  {
                    name: "LIME",
                    branchId: branch._id + '',
                    branchName: branch.name,
                    day: "friday",
                    dayNo: 5,
                    time: "7:30AM-7:45AM",
                    groupNo: 15,
                    occurence: "weekly",
                    loanOfficerId: user._id + '',
                    loanOfficerName: user.lastName + ', ' + user.firstName,
                    availableSlots: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40],
                    capacity: 30,
                    noOfClients: 0,
                    status: "available",
                    dateAdded: new Date()
                  }
                ]);
            });
        } 
      });
    }
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('groups').deleteMany({});
  }
};