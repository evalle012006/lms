module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    db.collection('rolesPermissions').insertMany([
      { role: 1, permission: [0] },
      { role: 2, permission: [1, 2, 2.1, 2.3, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 5, 5.1, 5.2, 5.3, 5.4, 6, 6.1, 6.2, 6.3, 6.4] },
      { role: 3, permission: [1, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 5, 5.1, 5.2, 5.3, 5.4, 6, 6.1, 6.2, 6.3, 6.4] },
      { role: 4, permission: [1, 3, 3.1, 3.2, 3.3, 3.4, 3.5, 5, 5.1, 5.2, 5.3, 5.4, 6, 6.1, 6.2, 6.3, 6.4] }
    ]);
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('rolesPermissions').deleteMany({});
  }
};
