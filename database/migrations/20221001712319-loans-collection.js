module.exports = {
  async up(db, client) {
    db.createCollection('loans');
  },

  async down(db, client) {
    db.collection('loans').drop();
  }
};
