const masterFileTableNames = [
  'regions',
  'areas',
  'branches',
  'groups',
  'divisions',
  'client',
  'holidays',
  'roles',
  'rolesPermissions',
  'settings',
  'transactionSettings',
  'users',
];

const transactionTableNames = [
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