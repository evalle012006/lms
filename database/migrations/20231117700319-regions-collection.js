module.exports = {
  async up(db, client) {
    db.createCollection('regions');
  },

  async down(db, client) {
    db.collection('regions').drop();
  }
};
