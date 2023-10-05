module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    db.collection('roles').insertMany([
      { name: 'administrator', shortCode: 'admin', rep: 1, order: 1, system: true },
      { name: 'deputy director', shortCode: 'deputy_director', rep: 2, order: 2, system: true },
      { name: 'regional manager', shortCode: 'regional_admin', rep: 2, order: 3, system: true },
      { name: 'area manager', shortCode: 'area_admin', rep: 2, order: 4, system: true },
      { name: 'branch manager', shortCode: 'branch_manager', rep: 3, order: 5, system: true },
      { name: 'loan officer', shortCode: 'loan_officer', rep: 4, order: 6, system: true }
    ]);
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('roles').deleteMany({});
  }
};
