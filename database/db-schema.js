const masterFileTableNames = [
  'regions',
  'areas',
  'branches',
  'divisions',
  'holidays',
  'roles',
  'rolesPermissions',
  'settings',
  'transactionSettings',
  'users',
];

const transactionTableNames = [
  'groups',
  'client',
  'badDebtCollections',
  'branchCOH',
  'cashCollections',
  'loans',
  'losTotals',
  'transferClients',
];

const getDateAddedFilterFieldForCollection = (collectionName) => {
  switch (collectionName) {
    // don't filter by date
    case 'groups':
      return null;
    case 'loans':
      return 'insertedDateTime';
    default:
      return 'dateAdded';
  }
};

const getCustomBranchFilterForCollection = async (collectionName, branchFilter, mongoDb) => {
  switch (collectionName) {
    case 'losTotals':
      const userIds = await mongoDb.collection('users').find({designatedBranchId: branchFilter.branchId}).map(r => r._id.toString()).toArray();
      const date = new Date();
      const current = { year: date.getFullYear(), month: date.getMonth() + 1 };

      date.setMonth(date.getMonth() - 1);
      const lastMonth = { year: date.getFullYear(), month: date.getMonth() + 1, losType: 'commulative' }

      return {
        $and: [
          {
            $or: [ branchFilter, { userId: {$in: userIds} }]
          },
          {
            $or: [current, lastMonth]
          }
        ]
      };
      // console.log(JSON.stringify(filter));
      // return filter;

    default:
      return branchFilter;
  }
}

module.exports = {
  masterFileTableNames,
  transactionTableNames,
  getDateAddedFilterFieldForCollection,
  getCustomBranchFilterForCollection,
}