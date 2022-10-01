module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    const bcrypt = require("bcryptjs");
    const role = await db.collection('platformRoles').find({ rep: 1 }).project({ _id: 0 }).toArray();

    db.collection('users').insertOne({
      firstName: 'SUPER',
      lastName: 'USER',
      email: 'admin@ambercashph.com',
      password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null),
      number: '04911111111',
      position: 'Administrator',
      logged: false,
      status: 'active',
      lastLogin: null,
      dateAdded: new Date,
      role: role[0],
      root: true
    });
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('users').deleteMany({ name: 'SUPER USER' });
  }
};
