module.exports = {
  async up(db, client) {
    db.createCollection('holidays');
  },

  async down(db, client) {
    db.collection('holidays').drop();
  }
};
