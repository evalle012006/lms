module.exports = {
  async up(db, client) {
    db.createCollection('branches');
  },

  async down(db, client) {
    db.collection('branches').drop();
  }
};
