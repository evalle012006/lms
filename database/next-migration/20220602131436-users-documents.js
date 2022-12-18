
function roman_to_Int(str1) {
  if(str1 == null) return -1;
  var num = char_to_int(str1.charAt(0));
  var pre, curr;
  
  for(var i = 1; i < str1.length; i++) {
      curr = char_to_int(str1.charAt(i));
      pre = char_to_int(str1.charAt(i-1));
      if(curr <= pre) {
          num += curr;
      } else {
          num = num - pre*2 + curr;
      }
  }
  
  return num;
}
  
function char_to_int  (c) {
  switch (c) {
      case 'I': return 1;
      case 'V': return 5;
      case 'X': return 10;
      case 'L': return 50;
      case 'C': return 100;
      case 'D': return 500;
      case 'M': return 1000;
      default: return -1;
  }
}

module.exports = {
  async up(db, client) {
    // TODO write your migration here.
    // See https://github.com/seppevs/migrate-mongo/#creating-a-new-migration-script
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: true}});
    const bcrypt = require("bcryptjs");
    const role = await db.collection('roles').find({ rep: 1 }).project({ _id: 0 }).toArray();
    const areaManagerRole = await db.collection('roles').find({ rep: 2 }).project({ _id: 0 }).toArray();
    const branchManagerRole = await db.collection('roles').find({ rep: 3 }).project({ _id: 0 }).toArray();
    const loanOfficerRole = await db.collection('roles').find({ rep: 4 }).project({ _id: 0 }).toArray();
    const branches = await db.collection('branches').find().toArray();

    db.collection('users').insertOne(
      {
        firstName: 'SUPER',
        lastName: 'USER',
        email: 'admin@ambercashph.com',
        password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null),
        number: '04911111111',
        position: 'Administrator',
        logged: false,
        status: 'active',
        lastLogin: null,
        dateAdded: new Date,
        role: role[0],
        root: true
      }
    );

    if (branches) {
      branches.map(branch => {
        const nameArr = branch.name.split(' ');
        let name = branch.name.toLowerCase();
        if (nameArr.length === 2) {
          name = nameArr[0] + roman_to_Int(nameArr[1]);
          name = name.toLowerCase();
        } else if (nameArr.length === 3) {
          name = nameArr[0] + nameArr[1] + roman_to_Int(nameArr[2]);
          name = name.toLowerCase();
        }
        
        const email = name + '@ambercashph.com';
        
        db.collection('users').insertMany([
          // {
          //   firstName: 'Area Manager',
          //   lastName: branch.name,
          //   email: 'AM' + email,
          //   password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
          //   number: '04911111111',
          //   position: 'Area Manager',
          //   logged: false,
          //   status: 'active',
          //   lastLogin: null,
          //   dateAdded: new Date,
          //   role: areaManagerRole[0]
          // },
          {
            firstName: 'Branch Manager',
            lastName: branch.name,
            email: 'BM' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Branch Manager',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: branchManagerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 1',
            lastName: branch.name,
            email: 'lo1' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 2',
            lastName: branch.name,
            email: 'lo2' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 3',
            lastName: branch.name,
            email: 'lo3' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 4',
            lastName: branch.name,
            email: 'lo4' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 5',
            lastName: branch.name,
            email: 'lo5' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 6',
            lastName: branch.name,
            email: 'lo6' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 7',
            lastName: branch.name,
            email: 'lo7' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 8',
            lastName: branch.name,
            email: 'lo8' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 9',
            lastName: branch.name,
            email: 'lo9' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          },
          {
            firstName: 'LO 10',
            lastName: branch.name,
            email: 'lo10' + email,
            password: bcrypt.hashSync('password', bcrypt.genSaltSync(8), null), // remove in official
            number: '04911111111',
            position: 'Loan Officer',
            logged: false,
            status: 'active',
            lastLogin: null,
            dateAdded: new Date,
            role: loanOfficerRole[0],
            designatedBranchId: branch._id + '',
            designatedBranch: branch.code
          }
        ]);
      });
    }
  },

  async down(db, client) {
    // TODO write the statements to rollback your migration (if possible)
    // Example:
    // await db.collection('albums').updateOne({artist: 'The Beatles'}, {$set: {blacklisted: false}});
    db.collection('users').deleteMany({ name: 'SUPER USER' });
  }
};
