const { faker } = require('@faker-js/faker');

module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});

    // const branches = await db.collection('branches').find({ code: 'B001' }).toArray();
    // // const branches = await db.collection('branches').find().toArray();

    // if (branches) {
    //   branches.map(async branch => {
        const groups = await db.collection('groups').find({ branchId: '639e80c8aeb5b756302b6cf7' }).toArray();
        if (groups) {
          groups.map(group => {
            db.collection('groupCashCollections').insertOne(
              {
                branchId: group.branchId,
                groupId: group._id + '',
                groupName: group.name,
                loId: group.loanOfficerId,
                dateAdded: "2022-12-19",
                insertBy: "automation",
                mode: "daily",
                status: "pending"
              }
            );
          });
        }
    //   });
    // }
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('client').deleteMany({});
  }
};
