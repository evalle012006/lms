module.exports = {
  async up(db, client) {
    db.createCollection('cashCollectionTotals');
  },

  async down(db, client) {
    db.collection('cashCollectionTotals').drop();
  }
};
