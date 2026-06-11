export const USER_FIELDS = `
  _id
  dateAdded
  dateModified
  designatedBranch
  email
  firstName
  lastLogin
  loNo
  logged
  number
  password
  position
  profile
  role
  status
  transactionType
  designatedBranchId
  lastName
  root
  branchManagerName
  areaId
  regionId
  divisionId
  `;

export const BRANCH_FIELDS = `
  _id
  address
  code
  dateAdded
  email
  name
  phoneNumber
  areaId
  regionId
  divisionId
  lockTransaction
  `;

export const CLIENT_FIELDS = `
  _id
  address
  addressBarangayDistrict
  birthdate
  branchId
  branchName
  contactNumber
  dateAdded
  dateModified
  delinquent
  firstName
  groupId
  groupName
  insertedBy
  lastName
  loId
  middleName
  oldGroupId
  profile
  status
  addressMunicipalityCity
  fullName
  oldLoId
  addressProvince
  addressStreetNo
  addressZipCode
  ciName,
  groupLeader,
  duplicate,
  similarityScore,
  archived,
  archivedBy,
  archivedDate,
  `;

export const LOAN_FIELDS = `
  _id
  activeLoan
  admissionDate
  advanceDays
  amountRelease
  branchId
  branchName
  clientId
  closedDate
  coMaker
  coMakerId
  currentDate
  dateGranted
  dateModified
  endDate
  fullName
  fullPaymentDate
  groupDay
  groupId
  groupName
  groupStatus
  guarantorFirstName
  guarantorLastName
  guarantorMiddleName
  history
  insertedBy
  insertedDateTime
  lastUpdated
  ldfApproved
  ldfApprovedDate
  loanBalance
  loanCycle
  loanOfficerName
  loanRelease
  loanTerms
  loId
  maturedPastDue
  maturedPD
  maturedPDDate
  mcbu
  mcbuCollection
  mcbuIntereset
  mcbuInterest
  mcbureturn
  mcbuReturnAmt
  mcbuTarget
  mcbuWithdrawal
  mispayment
  modifiedBy
  modifiedDateTime
  noBadDebtPayment
  noOfPayments
  noPastDue
  occurence
  origin
  pastDue
  pnNumber
  prevLoanFullPaymentAmount
  prevLoanFullPaymentDate
  prevLoanId
  principalLoan
  rejectReason
  remarks
  reverted
  revertedTransfer
  slotNo
  startDate
  status
  targetCollection
  transfer
  transferDate
  transferId
  transferred
  loanFor
  dateAdded
  revertedDateTime
  transferredDate
  advance
  advanceDate
  excess
  transferredReleased
  dateOfRelease
  ciName
  advanceTransaction
  admissionCollection
  lrfCollection
  cbhbCollection
  otherPassbookCollection
  otherPictureCollection
  csfCollection
  csfWithdrawal
  csf
  csfReturnAmt
  csfIn
  addHospitalization
  preApproved
  preApprovedDate
  editHistory
  bmRevertCount
  `;

export const GROUP_FIELDS = `
  _id
  availableSlots
  branchId
  branchName
  capacity
  dateAdded
  day
  groupNo
  loanOfficerId
  name
  noOfClients
  occurence
  status
  time
  dayNo
  loanOfficerName
  `;

export const HOLIDAY_FIELDS = `
  _id
  date
  dateAdded
  description
  name
  `;

export const SETTINGS_FIELDS = `
  _id
  branchAddress
  branchName
  companyAddress
  branchCode
  branchPhoneNumber
  companyEmail
  companyName
  companyPhoneNumber
  superPwd
  enableNotifications
  `;

export const TRANSACTION_SETTINGS_FIELDS = `
  _id
  serviceChargeRate
  loanDailyLimit
  loanWeeklyLimit
  mcbuRate
  allowWeekendTransaction
  startTransactionTime
  minDailyMcbuCollection
  minWeeklyMcbuCollection
  minCsfCollection
  admissionFee
  lrfRate
  cbhbFee
  otherPassbookFee
  otherPictureFee
  mcbuCsfMCBUForNM
  mcbuCsfMinimumBalance
  addHospitalization
  mcbuInterestRate
  delinquentAlertThreshold
  clientAgeThreshold
  minDailyMcbuWithdrawal
  minWeeklyMcbuWithdrawal
  minDailyMcbuWithdrawalGL
  minWeeklyMcbuWithdrawalGL
  `;

export const BAD_DEBT_COLLECTIONS_FIELDS = `
  _id
  branchId
  clientId
  dateAdded
  groupId
  insertedBy
  insertedDate
  loId
  loanId
  loanRelease
  maturedPastDue
  paymentCollection
  mcbu
  `;

export const CASH_COLLECTIONS_FIELDS = `
  _id
  activeLoan
  advanceDays
  amountRelease
  branchId
  clientId
  closedDate
  closeRemarks
  coMaker
  currentReleaseAmount
  dateAdded
  dateModified
  dcmc
  delinquent
  draft
  endDate
  error
  excess
  excused
  fullName
  fullPayment
  fullPaymentDate
  groupDay
  groupId
  groupName
  groupStatus
  history
  insertedBy
  insertedDateTime
  latePayment
  loanBalance
  loanCycle
  loanId
  loanRelease
  loanTerms
  loId
  maturedPastDue
  maturedPD
  mcbu
  mcbuCol
  mcbuInterest
  mcbuInterestFlag
  mcbuReturnAmt
  mcbuTarget
  mcbuWithdrawal
  mcbuWithdrawFlag
  mispayment
  modifiedBy
  modifiedDateTime
  mpdc
  noMispayment
  noOfPayments
  noPastDue
  occurence
  offsetTransFlag
  oldLoanId
  origin
  pastDue
  paymentCollection
  prevData
  prevLoanId
  remarks
  reverted
  revertedDate
  slotNo
  status
  targetCollection
  timeAdded
  tomorrow
  total
  transfer
  transferId
  transferred
  advance
  closingTime
  loanFor
  dateOfRelease
  transferredDate
  transferDate
  admissionCollection
  lrfCollection
  cbhbCollection
  otherPassbookCollection
  otherPictureCollection
  csfCollection
  csfWithdrawal
  csf
  csfReturnAmt
  csfIn
  otherIncome
  addHospitalization
  bmRevertCount
  `;

export const LOS_TOTALS_FIELDS = `
  _id
  branchId
  currentDate
  data
  dateAdded
  dateApproved
  dateModified
  insertedBy
  insertedDate
  insertedDateTime
  losType
  modifiedBy
  modifiedDate
  month
  occurence
  status
  userId
  userType
  year
  officeType
  `;

export const ROLE_FIELDS = `
  _id
  name
  order
  shortCode
  system
  rep
  dateAdded
  `;

export const ROLE_PERMISSION_FIELD = `
  _id
  permissions
  role
  dateAdded
  `;

export const AREA_FIELDS = `
  _id
  branchIds
  dateAdded
  managerIds
  name
  regionId
  divisionId
  `;

export const REGION_FIELDS = `
  _id
  areaIds
  dateAdded
  managerIds
  name
  divisionId
  `;

export const DIVISION_FIELDS = `
  _id
  name
  managerIds
  regionIds
  dateAdded
  `;

export const TRANSFER_CLIENT_FIELDS = `
  _id
  approveRejectDate
  branchToBranch
  currentSlotNo
  dateAdded
  loToLo
  modifiedDateTime
  occurence
  sameLo
  sourceBranchId
  status
  targetBranchId
  targetGroupId
  selectedClientId
  sourceGroupId
  targetUserId
  selectedSlotNo
  sourceUserId
  newLoanId
  oldLoanId
  `;

  export const BRANCH_COH_FIELDS = `
  _id
  amount
  branchId
  insertedBy
  dateAdded
  modifiedBy
  modifiedDateTime
  `;

  export const MCBU_WITHDRAWAL_FIELDS = `
  _id
  division_id
  region_id
  area_id
  branch_id
  lo_id
  group_id
  client_id
  loan_id
  mcbu_withdrawal_amount
  csf_withdrawal_amount
  group_leader
  status
  approved_date
  rejected_date
  reason
  inserted_date
  inserted_by
  modified_date
  modified_by
  editHistory
  `;

  export const FUND_TRANSFER_FIELDS = `
  _id
  transactionCode
  giverBranchId
  receiverBranchId
  amount
  account
  description
  status
  giverApproval
  giverApproveRejectDate
  receiverApproval
  receiverApproveRejectDate
  approvedRejectedDate
  insertedDate
  insertedById
  insertedBy { _id firstName lastName role }
  modifiedById
  modifiedBy { _id firstName lastName role }
  modifiedDate
  deleted
  deletedDate
  giverApprovalStatus
  receiverApprovalStatus
  giverRejectReason
  receiverRejectReason

  giverBranch { _id code name }
  receiverBranch { _id code name }
  giverApproval { _id firstName lastName role }
  receiverApproval { _id firstName lastName role }
  `;

  export const DENOMINATION_FIELDS = `
  _id
  group_id
  lo_id
  branch_id
  active_clients
  total_net_collection
  morning_remittance
  no_sit_down
  amount_sit_down
  afternoon_remittance
  bcc_vs_remittances
  status
  remarks
  rejection_reason
  history
  approval_date
  rejection_date
  inserted_date
  modified_date
  inserted_by
  modified_by
  date_added
  synced
`;

export const BRANCH_APPROVAL_FIELDS = `
  _id
  branchId
  userId
  userName
  status
  dateFor
  dateAdded
  dateModified
`;

export const MANAGEMENT_ACCOUNT_TYPE_FIELD = `
    _id
    type_name
    type_code
    description
    display_order
    account_groups
    display_groups
    is_active
    date_added
    inserted_date
    inserted_by
    modified_date
    modified_by
    inserted_by_user {
        _id
        firstName
        lastName
    }
    modified_by_user {
        _id
        firstName
        lastName
    }
`;

export const MANAGEMENT_ACCOUNT_FIELD = `
    _id
    account_type_id
    account_name
    description
    display_order
    account_groups
    service_charge
    service_charge_formula
    row_type
    prev_balance_formula
    debit_formula
    credit_formula
    balance_formula
    aggregate_refs
    indent_level
    parent_account_id
    is_active
    date_added
    inserted_date
    inserted_by
    modified_date
    modified_by
    account_type {
        _id
        type_name
        type_code
        account_groups
    }
    inserted_by_user {
        _id
        firstName
        lastName
    }
    modified_by_user {
        _id
        firstName
        lastName
    }
`;

export const MANAGEMENT_TRANSACTION_FIELD = `
    _id
    transaction_type
    branch_id
    account_id
    previous_balance
    debit
    credit
    total_balance
    date_added
    inserted_date
    inserted_by
    modified_date
    modified_by
    remarks
    branch {
        _id
        name
        code
    }
    account {
        _id
        account_name
        account_type_id
        account_type {
            _id
            type_name
            type_code
        }
    }
    inserted_by_user {
        _id
        firstName
        lastName
    }
    modified_by_user {
        _id
        firstName
        lastName
    }
`;

export const NOTIFICATION_FIELDS = `
  _id
  type
  title
  message
  data
  division_id
  region_id
  area_id
  branch_id
  lo_id
  client_id
  loan_id
  group_id
  created_by
  created_by_name
  read_by
  is_read
  date_added
  date_modified
`;

export const UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS = `
  _id
  client_id
  group_id
  branch_id
  area_id
  region_id
  division_id
  loan_id
  cash_collection_id
  status
  date_added
  document_url
  inserted_by
  inserted_date
  modified_by
  modified_date
`;