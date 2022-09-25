module.exports = {
  async up(db, client) {
    db.createCollection('cash-collections');
  },

  async down(db, client) {
    db.collection('cash-collections').drop();
  }
};
