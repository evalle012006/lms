module.exports = {
  async up(db, client) {
    db.createCollection('transferClients');
  },

  async down(db, client) {
    db.collection('transferClients').drop();
  }
};
