const { faker } = require('@faker-js/faker');

module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});

    // const branches = await db.collection('branches').find({ code: 'B001' }).toArray();
    // // const branches = await db.collection('branches').find().toArray();

    // if (branches) {
    //   branches.map(async branch => {
        const groups = await db.collection('groups').find({ branchId: '639e80c8aeb5b756302b6cf8' }).toArray();
        if (groups) {
          groups.map(group => {
            db.collection('client').insertMany([
              {
                firstName: faker.name.firstName(),
                middleName: "",
                lastName: faker.name.lastName(),
                birthdate: faker.date.past(),
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
                addressStreetNo: "",
                addressBarangayDistrict: "",
                addressMunicipalityCity: "",
                addressProvince: "",
                addressZipCode: "",
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
    //   });
    // }
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('client').deleteMany({});
  }
};
