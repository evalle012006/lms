const { faker } = require('@faker-js/faker');

module.exports = {
  async up(db, client) {
    const ObjectId = require('mongodb').ObjectId;
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});

    // const branches = await db.collection('branches').find({ code: 'B001' }).toArray();
    // // const branches = await db.collection('branches').find().toArray();
    // {groupId: '639e860636491596e49ed916', branchId: '639e80c8aeb5b756302b6d00', status: 'active', startDate: '2022-12-20'}
    // clientId: 639ea401aa53b08ea845591e
    // if (branches) {
    //   branches.map(async branch => {
      // 639e9c4d1ccc1d5fd9f319b4  
        // const groups = await db.collection('groups').find({ _id: ObjectId('639eac7e17b307a654da971b') }).toArray();    // {email: "lo4mabalacat@ambercashph.com"}
        const groups = await db.collection('groups').find({ branchId: "63ec80275f28f2393ec01264", occurence: 'weekly' }).toArray();
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
