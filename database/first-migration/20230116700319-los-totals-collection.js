module.exports = {
  async up(db, client) {
    db.createCollection('losTotals');
  },

  async down(db, client) {
    db.collection('losTotals').drop();
  }
};
