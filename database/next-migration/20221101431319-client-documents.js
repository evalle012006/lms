const { faker } = require('@faker-js/faker');

module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});

    const branch = await db.collection('branches').find({ code: 'B001' }).toArray();

    if (branch) {
      const groups = await db.collection('groups').find({ branchId: branch[0]._id + '' }).toArray();

      if (groups) {
        groups.map(group => {
          db.collection('client').insertMany([
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            },
            {
              firstName: faker.name.firstName(),
              middleName: "",
              lastName: faker.name.lastName(),
              birthdate: faker.date.past(),
              addressStreetNo: "PUROK 2",
              addressBarangayDistrict: "SUNSET VIEW",
              addressMunicipalityCity: "ZAMBOANGA CITY",
              addressProvince: "ZAMBOANGA DEL SUR",
              addressZipCode: "7000",
              contactNumber: "0933457101",
              groupId: group._id + '',
              branchId: group.branchId,
              groupName: group.name,
              branchName: group.branchName,
              loId: group.loanOfficerId,
              status: "pending",
              delinquent: false,
              insertedBy: "automation",
              dateAdded: new Date()
            }
          ]);
        });
      }
    }
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('client').deleteMany({});
  }
};
