module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    db.collection('permissions').insertMany([
      { name: 'dashboard', shortCode: 'dashboard', rep: 1 },
      { name: 'branches', shortCode: 'branches', rep: 2 },
      { name: 'view branches', shortCode: 'view_branches', rep: 2.1 },
      { name: 'create branches', shortCode: 'create_branches', rep: 2.2 },
      { name: 'edit branches', shortCode: 'edit_branches', rep: 2.3 },
      { name: 'delete branches', shortCode: 'delete_branches', rep: 2.4 },
      { name: 'transactions', shortCode: 'transactions', rep: 3 },
      { name: 'view loans', shortCode: 'view_loans', rep: 3.1 },
      { name: 'create loans', shortCode: 'create_loans', rep: 3.2 },
      { name: 'edit loans', shortCode: 'edit_loans', rep: 3.3 },
      { name: 'delete loans', shortCode: 'delete_loans', rep: 3.4 },
      { name: 'loans application', shortCode: 'loans_application', rep: 3.5 },
      { name: 'settings', shortCode: 'settings', rep: 4 },
      { name: 'users', shortCode: 'users', rep: 5 },
      { name: 'view users', shortCode: 'view_users', rep: 5.1 },
      { name: 'create users', shortCode: 'create_users', rep: 5.2 },
      { name: 'edit users', shortCode: 'edit_users', rep: 5.3 },
      { name: 'delete users', shortCode: 'delete_users', rep: 5.4 },
      { name: 'groups', shortCode: 'groups', rep: 6 },
      { name: 'view groups', shortCode: 'view_groups', rep: 6.1 },
      { name: 'create groups', shortCode: 'create_groups', rep: 6.2 },
      { name: 'edit groups', shortCode: 'edit_groups', rep: 6.3 },
      { name: 'delete groups', shortCode: 'delete_groups', rep: 6.4 },
      { name: 'roles', shortCode: 'roles', rep: 7 },
      { name: 'view roles', shortCode: 'view_roles', rep: 7.1 },
      { name: 'create roles', shortCode: 'create_roles', rep: 7.2 },
      { name: 'edit roles', shortCode: 'edit_roles', rep: 7.3 },
      { name: 'delete roles', shortCode: 'delete_roles', rep: 7.4 },
    ]);
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('permmissions').deleteMany({});
  }
};
