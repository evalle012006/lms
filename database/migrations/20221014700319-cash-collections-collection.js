module.exports = {
  async up(db, client) {
    db.createCollection('cashCollections');
  },

  async down(db, client) {
    db.collection('cashCollections').drop();
  }
};
