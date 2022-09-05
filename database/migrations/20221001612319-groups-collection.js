module.exports = {
  async up(db, client) {
    db.createCollection('groups');
  },

  async down(db, client) {
    db.collection('groups').drop();
  }
};
