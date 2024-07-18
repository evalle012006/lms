const masterFileTableNames = [
  'branches',
  'client',
  'holidays',
  'roles',
  'rolesPermissions',
  'settings',
  'transactionSettings',
  'users',
  'areas',
  'regions',
  'divisions',
];

const transactionTableNames = [
  'badDebtCollections',
  'branchCOH',
  'cashCollections',
  'groups',
  'loans',
  'losTotals',
  'transferClients',
];

module.exports = {
  masterFileTableNames,
  transactionTableNames,
}