module.exports = {
  async up(db, client) {
    db.createCollection('groupCashCollections');
  },

  async down(db, client) {
    db.collection('groupCashCollections').drop();
  }
};
