module.exports = {
  async up(db, client) {
    db.createCollection('client');
  },

  async down(db, client) {
    db.collection('client').drop();
  }
};
