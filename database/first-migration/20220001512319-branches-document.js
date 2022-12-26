module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});

    db.collection('branches').insertMany([
      {
        name: 'Zamboanga I',
        code: 'B001',
        email: 'aczamboanga1@ambercashph.com',
        phoneNumber: '123',
        address: 'Zamboanga del Sur',
        dateAdded: new Date()
      },
      {
        name: 'Zamboanga II',
        code: 'B002',
        email: 'aczamboanga2@ambercashph.com',
        phoneNumber: '123',
        address: 'Josefina drive Don toribio st, Tetuan, Zamboanga City',
        dateAdded: new Date()
      },
      {
        name: 'Zamboanga III',
        code: 'B003',
        email: 'aczamboanga3@ambercashph.com',
        phoneNumber: '123',
        address: 'Zamboanga del Sur',
        dateAdded: new Date()
      },
      {
        name: 'San Fernando',
        code: 'B004',
        email: 'acsanfernando@ambercashph.com',
        phoneNumber: '123',
        address: 'Pampanga',
        dateAdded: new Date()
      },
      {
        name: 'Pasig I',
        code: 'B005',
        email: 'acpasig1@ambercashph.com',
        phoneNumber: '123',
        address: 'Pasig',
        dateAdded: new Date()
      },
      {
        name: 'Mabalacat',
        code: 'B006',
        email: 'acmabalacat@ambercashph.com',
        phoneNumber: '123',
        address: 'Pampanga',
        dateAdded: new Date()
      },
      {
        name: 'Angeles',
        code: 'B007',
        email: 'acangeles@ambercashph.com',
        phoneNumber: '123',
        address: 'Pampanga',
        dateAdded: new Date()
      },
      {
        name: 'Sangali',
        code: 'B008',
        email: 'acsangali@ambercashph.com',
        phoneNumber: '123',
        address: 'Zamboanga',
        dateAdded: new Date()
      },
      {
        name: 'Floridablanca',
        code: 'B009',
        email: 'acfloridablanca@ambercashph.com',
        phoneNumber: '123',
        address: 'Pampanga',
        dateAdded: new Date()
      },
      {
        name: 'Pasig II',
        code: 'B010',
        email: 'acpasig2@ambercashph.com',
        phoneNumber: '123',
        address: 'Pasig',
        dateAdded: new Date()
      },
      {
        name: 'Pasig III',
        code: 'B011',
        email: 'acpasig3@ambercashph.com',
        phoneNumber: '123',
        address: 'Pasig',
        dateAdded: new Date()
      },
      {
        name: 'Zamboanga V',
        code: 'B012',
        email: 'aczamboanga5@ambercashph.com',
        phoneNumber: '123',
        address: 'Zamboanga del Sur',
        dateAdded: new Date()
      },
      {
        name: 'Taguig I',
        code: 'B013',
        email: 'actaguig1@ambercashph.com',
        phoneNumber: '123',
        address: 'Taguig',
        dateAdded: new Date()
      },
      {
        name: 'Taguig II',
        code: 'B014',
        email: 'actaguig2@ambercashph.com',
        phoneNumber: '123',
        address: 'Taguig',
        dateAdded: new Date()
      },
      {
        name: 'Isabela',
        code: 'B015',
        email: 'acisabela@ambercashph.com',
        phoneNumber: '123',
        address: 'Isabela',
        dateAdded: new Date()
      },
      {
        name: 'Zamboanga VI',
        code: 'B016',
        email: 'aczamboanga6@ambercashph.com',
        phoneNumber: '123',
        address: 'Zamboanga del Sur',
        dateAdded: new Date()
      },
      {
        name: 'Quezon City I',
        code: 'B017',
        email: 'acquezoncity@ambercashph.com',
        phoneNumber: '123',
        address: 'Quezon City',
        dateAdded: new Date()
      },
      {
        name: 'Quezon City II',
        code: 'B018',
        email: 'acquezoncity2@ambercashph.com',
        phoneNumber: '123',
        address: 'Quezon City',
        dateAdded: new Date()
      },
      {
        name: 'Rizal I',
        code: 'B019',
        email: 'acrizal@ambercashph.com',
        phoneNumber: '123',
        address: 'Rizal',
        dateAdded: new Date()
      },
      {
        name: 'Rizal II',
        code: 'B020',
        email: 'acrizal2@ambercashph.com',
        phoneNumber: '123',
        address: 'Rizal',
        dateAdded: new Date()
      },
      {
        name: 'Porac',
        code: 'B021',
        email: 'acporac@ambercashph.com',
        phoneNumber: '123',
        address: 'Pampanga',
        dateAdded: new Date()
      }
    ]);
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('branches').deleteMany({});
  }
};
