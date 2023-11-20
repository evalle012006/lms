module.exports = {
  async up(db, client) {
    db.createCollection('divisions');
  },

  async down(db, client) {
    db.collection('divisions').drop();
  }
};
