module.exports = {
  async up(db, client) {
    db.createCollection('transactionSettings');
  },

  async down(db, client) {
    db.collection('transactionSettings').drop();
  }
};
