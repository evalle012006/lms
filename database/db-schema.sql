create table "badDebtCollections" (
  "_id" varchar primary key,
  "branchId" varchar,
  "clientId" varchar,
  "dateAdded" timestamptz,
  "groupId" varchar,
  "insertedBy" varchar,
  "insertedDate" timestamptz,
  "loId" varchar,
  "loanId" varchar,
  "loanRelease" numeric(10, 2),
  "maturedPastDue" numeric(10, 2),
  "paymentCollection" numeric(10, 2),
  "mcbu" numeric(10, 2)
);

create table "branches" (
  "_id" varchar primary key,
  "address" varchar,
  "code" varchar,
  "dateAdded" timestamptz,
  "email" varchar,
  "name" varchar,
  "phoneNumber" varchar
);

create table "cashCollections" (
  "_id" varchar primary key,
  "activeLoan" numeric(10, 2),
  "amountRelease" numeric(10, 2),
  "branchId" varchar,
  "clientId" varchar,
  "collection" numeric(10, 2),
  "currentReleaseAmount" numeric(10, 2),
  "dateAdded" timestamptz,
  "draft" boolean,
  "excess" numeric(10, 2),
  "fullPayment" numeric(10, 2),
  "groupId" varchar,
  "groupName" varchar,
  "groupStatus" varchar,
  "insertedDateTime" timestamptz,
  "loId" varchar,
  "loanBalance" numeric(10, 2),
  "loanCycle" numeric(10, 2),
  "loanId" varchar,
  "mcbu" numeric(10, 2),
  "mcbuCol" numeric(10, 2),
  "mcbuReturnAmt" numeric(10, 2),
  "mcbuWithdrawal" numeric(10, 2),
  "mispayment" boolean,
  "mispaymentStr" varchar,
  "modifiedDate" timestamptz,
  "noOfPayments" numeric(10, 2),
  "occurence" varchar,
  "origin" varchar,
  "paymentCollection" numeric(10, 2),
  "remarks" varchar,
  "slotNo" numeric(10, 2),
  "status" varchar,
  "targetCollection" numeric(10, 2),
  "total" numeric(10, 2)
);

create table "clients" (
  "_id" varchar primary key,
  "address" varchar,
  "addressBarangayDistrict" varchar,
  "birthdate" date,
  "branchId" varchar,
  "branchName" varchar,
  "contactNumber" varchar,
  "dateAdded" timestamptz,
  "dateModified" timestamptz,
  "delinquent" boolean,
  "firstName" varchar,
  "groupId" varchar,
  "groupName" varchar,
  "insertedBy" varchar,
  "lastName" varchar,
  "loId" varchar,
  "mcbuHistory" jsonb,
  "middleName" varchar,
  "oldGroupId" varchar,
  "profile" varchar,
  "status" varchar,
  "addressMunicipalityCity" varchar,
  "fullName" varchar,
  "oldLoId" varchar,
  "addressProvince" varchar,
  "addressStreetNo" varchar,
  "addressZipCode" varchar
);

create table "groups" (
  "_id" varchar primary key,
  "availableSlots" jsonb,
  "branchId" varchar,
  "branchName" varchar,
  "capacity" numeric(10, 2),
  "dateAdded" timestamptz,
  "day" varchar,
  "groupNo" numeric(10, 2),
  "loanOfficerId" varchar,
  "name" varchar,
  "noOfClients" int,
  "occurence" varchar,
  "status" varchar,
  "time" varchar,
  "dayNo" int,
  "loanOfficerName" varchar
);

create table "holidays" (
  "_id" varchar primary key,
  "date" date,
  "dateAdded" timestamptz,
  "description" varchar,
  "name" varchar
);

create table "loans" (
  "_id" varchar primary key,
  "activeLoan" numeric(10, 2),
  "admissionDate" date,
  "amountRelease" numeric(10, 2),
  "brancName" varchar,
  "branchId" varchar,
  "clientId" varchar,
  "dateGranted" date,
  "dateModified" timestamptz,
  "endDate" date,
  "fullName" varchar,
  "fullPaymentDate" date,
  "groupId" varchar,
  "groupName" varchar,
  "groupStatus" varchar,
  "insertedBy" varchar,
  "insertedDateTime" timestamptz,
  "lastUpdated" timestamptz,
  "loId" varchar,
  "loanBalance" numeric(10, 2),
  "loanCycle" numeric(10, 2),
  "loanOfficerName" varchar,
  "loanRelease" numeric(10, 2),
  "mcbu" numeric(10, 2),
  "mcbuCollection" numeric(10, 2),
  "mcbuInterest" numeric(10, 2),
  "mcbuTarget" numeric(10, 2),
  "mcbuWithdrawal" numeric(10, 2),
  "mispayment" numeric(10, 2),
  "modifiedDateTime" timestamptz,
  "noOfPayments" int,
  "occurence" varchar,
  "origCoMaker" varchar,
  "pastDue" numeric(10, 2),
  "pnNumber" varchar,
  "principalLoan" numeric(10, 2),
  "remarks" varchar,
  "revertedDate" timestamptz,
  "slotNo" int,
  "startDate" date,
  "status" varchar,
  "advanceDays" int,
  "closedDate" timestamptz,
  "loanTerms" numeric(10, 2),
  "noPastDue" numeric(10, 2),
  "coMaker" varchar,
  "history" jsonb
);

create table "losTotals" (
  "_id" varchar primary key,
  "branchId" varchar,
  "data" jsonb,
  "dateAdded" timestamptz,
  "dateModified" timestamptz,
  "losType" varchar,
  "modifiedBy" varchar,
  "modifiedDate" timestamptz,
  "month" int,
  "occurence" varchar,
  "userId" varchar,
  "userType" varchar,
  "year" int
);

create table "roles" (
  "_id" varchar primary key,
  "name" varchar,
  "order" int,
  "rep" varchar,
  "shortCode" varchar,
  "system" boolean
);

create table "rolesPermissions" (
  "_id" varchar primary key,
  "permissions" jsonb,
  "role" numeric(10, 2)
);

create table "settings" (
  "_id" varchar primary key,
  "branchAddress" varchar,
  "branchName" varchar,
  "companyAddress" varchar,
  "branchCode" varchar,
  "branchPhoneNumber" varchar,
  "companyEmail" varchar,
  "companyName" varchar,
  "companyPhoneNumber" varchar
);

create table "transactionSettings" (
  "_id" varchar primary key,
  "loanDailyLimit" numeric(10, 2),
  "loanWeeklyLimit" numeric(10, 2),
  "mcbuRate" numeric(10, 2)
);

create table "transferClients" (
  "_id" varchar primary key,
  "approveRejectDate" timestamptz,
  "branchToBranch" boolean,
  "currentSlotNo" numeric(10, 2),
  "dateAdded" timestamptz,
  "loToLo" boolean,
  "loanId" varchar,
  "modifiedDateTime" timestamptz,
  "occurence" varchar,
  "sameLo" boolean,
  "sourceBranchId" varchar,
  "status" varchar,
  "targetBranchId" varchar,
  "targetGroupId" varchar,
  "selectedClientId" varchar,
  "sourceGroupId" varchar,
  "targetUserId" varchar,
  "selectedSlotNo" numeric(10, 2),
  "sourceUserId" varchar
);

create table "users" (
  "_id" varchar primary key,
  "dateAdded" timestamptz,
  "dateModified" timestamptz,
  "designatedBranch" varchar,
  "email" varchar,
  "firstName" varchar,
  "lastLogin" timestamptz,
  "loNo" numeric(10, 2),
  "logged" boolean,
  "number" varchar,
  "password" varchar,
  "position" varchar,
  "profile" varchar,
  "role" jsonb,
  "status" varchar,
  "transactionType" varchar,
  "designatedBranchId" varchar,
  "lastName" varchar,
  "root" boolean
);