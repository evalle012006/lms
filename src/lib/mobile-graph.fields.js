// Field allow-lists for client-facing (mobile) endpoints.
//
// Deliberately NOT reusing CLIENT_FIELDS / LOAN_FIELDS / CASH_COLLECTIONS_FIELDS
// from lib/graph.fields.js — those include internal audit blobs (`history`,
// `editHistory`) and biometric/ID material (`faceTemplate`, `biometricPublicKey`,
// `governmentIdNumber`, `governmentIdPhotoKey`, `selfieWithIdPhotoKey`) that a
// client's own device has no business receiving, even for their own record.
// Add fields here explicitly, one at a time, only when a mobile screen needs them.

export const CLIENT_ACCOUNT_TYPE_FIELDS = `
  _id
  client_id
  contact_number
  status
  enrollment_method
  last_login_at
  verified_at
`;

export const CLIENT_PROFILE_MOBILE_FIELDS = `
  _id
  firstName
  middleName
  lastName
  fullName
  contactNumber
  profile
  address
  addressStreetNo
  addressBarangayDistrict
  addressMunicipalityCity
  addressProvince
  addressZipCode
  branchName
  groupName
  status
  delinquent
  dateAdded
  groupLeader
  qrToken
  governmentIdType
  governmentIdNumber
`;

export const LOAN_MOBILE_FIELDS = `
  _id
  loanCycle
  status
  activeLoan
  occurence
  principalLoan
  amountRelease
  loanRelease
  loanBalance
  loanTerms
  dateGranted
  dateModified
  dateOfRelease
  endDate
  fullPaymentDate
  noOfPayments
  targetCollection
  pastDue
  maturedPastDue
  mcbu
  mcbuTarget
  csf
  noBadDebtPayment
  noPastDue
  mispayment
  remarks
  transferId
  transferredDate
  transferDate
  branchName
  groupName
  loanOfficerName
`;

// Maps to a row in `cashCollections` (this is the payment ledger — there is
// no separate "payments" table in the current schema).
export const PAYMENT_MOBILE_FIELDS = `
  _id
  loanId
  dateAdded
  paymentCollection
  mcbuCol
  csfCollection
  loanBalance
  fullPayment
  latePayment
  mispayment
  status
  insertedBy
  modifiedBy
  loId
  remarks
`;

export const WITHDRAWAL_MOBILE_FIELDS = `
  _id
  client_id
  loan_id
  mcbu_withdrawal_amount
  csf_withdrawal_amount
  status
  approved_date
  rejected_date
  reason
  inserted_date
`;

// LAF application status, for a client tracking their own loan application.
export const LAF_MOBILE_FIELDS = `
  _id
  status
  loanAmount
  loanPurpose
  submittedAt
  branchId
`;

// Credit investigation records — linked to a LAF application via
// tempApplicationId, not directly to a client. Deliberately excludes
// `findings`, `ciAnswers`, `offlinePayload`, `picUserId`/`picUserName` —
// those are internal staff notes, not something to show the applicant.
export const CI_INVESTIGATION_MOBILE_FIELDS = `
  _id
  tempApplicationId
  ciReferenceCode
  decision
  declineReason
  businessVerified
  addressVerified
  investigatedAt
`;

// Guarantor name, from the LAF application linked to the client's latest
// APPROVED credit investigation (see guarantor.js). Note: temporaryLoanApplications
// only has guarantorFirstName/guarantorLastName — no guarantorMiddleName
// (that field only exists on the separate `loans` table's own guarantor
// fields, a different table entirely — verified against lib/graph.fields.js
// after the first version of this guessed wrong and broke the query).
export const GUARANTOR_MOBILE_FIELDS = `
  _id
  guarantorFirstName
  guarantorLastName
  guarantorRelationship
`;

// A client's enrolled programs (scholarships, etc.) — snake_case, new
// Postgres-native table. picture_key is resolved to a signed URL separately
// (documents.js), never sent as a raw storage key.
export const CLIENT_PROGRAM_MOBILE_FIELDS = `
  _id
  program_type
  scholar_name
  year_level
  school_name
  course
  grant_date
  status
`;