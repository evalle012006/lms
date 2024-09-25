const masterFileTableNames = [
  'regions',
  'areas',
  'branches',
  'groups',
  'divisions',
  'holidays',
  'roles',
  'rolesPermissions',
  'settings',
  'transactionSettings',
  'users',
];

const transactionTableNames = [
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

module.exports = {
  masterFileTableNames,
  transactionTableNames,
  getDateAddedFilterFieldForCollection,
}