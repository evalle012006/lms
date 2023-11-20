module.exports = {
  async up(db, client) {
    db.createCollection('areas');
  },

  async down(db, client) {
    db.collection('areas').drop();
  }
};
