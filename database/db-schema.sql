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
  "phoneNumber" varchar,
  "areaId" varchar,
  "regionId" varchar,
  "divisionId" varchar
);

-- drop table "cashCollections";
create table "cashCollections" (
  "_id" varchar primary key,
  "activeLoan" numeric(10, 2),
  "advanceDays" numeric(10,2),
  "amountRelease" numeric(10, 2),
  "branchId" varchar,
  "branchToBranch" boolean,
  "clientId" varchar,
  "clientStatus" varchar,
  "closedDate" timestamptz,
  "closeRemarks" varchar,
  "collection" numeric(10, 2),
  "collectionId" varchar,
  "coMaker" varchar,
  "currentRelease" jsonb,
  "currentReleaseAmount" numeric(10, 2),
  "dateAdded" timestamptz,
  "dateModified" timestamptz,
  "dcmc" boolean,
  "delinquent" boolean,
  "draft" boolean,
  "endDate" varchar, -- TODO: change to date
  "error" boolean,
  "excess" numeric(10, 2),
  "excused" boolean,
  "fullName" varchar,
  "fullPayment" numeric(10, 2),
  "fullPaymentDate" timestamptz,
  "groupDay" varchar,
  "groupId" varchar,
  "groupName" varchar,
  "groupStatus" varchar,
  "guarantorFirstName" varchar,
  "guarantorLastName" varchar,
  "guarantorMiddleName" varchar,
  "history" jsonb,
  "insertedBy" varchar,
  "insertedDateTime" timestamptz,
  "label" varchar,
  "latePayment" boolean,
  "loanBalance" numeric(10, 2),
  "loanCycle" numeric(16, 2),
  "loanId" varchar,
  "loanRelease" numeric(10, 2),
  "loans" jsonb,
  "loanTerms" varchar,
  "loId" varchar,
  "loToLo" boolean,
  "maturedPastDue" numeric(10, 2),
  "maturedPD" boolean,
  "mcbu" numeric(10, 2),
  "mcbuCol" numeric(10, 2),
  "mcbucoll" numeric(10, 2),
  "mcbuHistory" jsonb,
  "mcbuInterest" numeric(10, 2),
  "mcbuInterestFlag" boolean,
  "mcbuReturnAmt" numeric(10, 2),
  "mcbuTarget" numeric(10, 2),
  "mcbuWithdrawal" numeric(10, 2),
  "mcbuWithdrawFlag" boolean,
  "mispayment" varchar, -- TODO: convert to boolean
  "mispaymentStr" varchar,
  "mispyament" boolean,
  "modifiedBy" varchar,
  "modifiedDate" timestamptz,
  "modifiedDateTime" timestamptz,
  "mpdc" boolean,
  "noMispayment" numeric(10, 2),
  "noOfPayments" numeric(10, 2),
  "noPastDue" numeric(10, 2),
  "notCalculate" boolean,
  "occurence" varchar,
  "offsetTransFlag" boolean,
  "oldLoanId" varchar,
  "origin" varchar,
  "pastDue" numeric(10, 2),
  "paymentCollection" numeric(10, 2),
  "pending" boolean,
  "pnNumber" varchar,
  "prevData" jsonb,
  "previousDraft" boolean,
  "prevLoanId" varchar,
  "remarks" varchar,
  "reverted" boolean,
  "revertedDate" timestamptz,
  "sameLo" boolean,
  "slotNo" numeric(10, 2),
  "startDate" varchar, -- TODO: change to date
  "status" varchar,
  "targetCollection" numeric(10, 2),
  "targetCollectionStr" varchar,
  "timeAdded" varchar,
  "tomorrow" boolean,
  "total" numeric(10, 2),
  "transfer" boolean,
  "transferId" varchar,
  "transferred" boolean,
  "updateMessage" varchar,
  "value" varchar
);

-- drop table "client"
create table "client" (
  "_id" varchar primary key,
  "address" varchar,
  "addressBarangayDistrict" varchar,
  "addressMunicipalityCity" varchar,
  "addressProvince" varchar,
  "addressStreetNo" varchar,
  "addressZipCode" varchar,
  "birthdate" date,
  "branchId" varchar,
  "branchName" varchar,
  "contactNumber" varchar,
  "dateAdded" timestamptz,
  "dateModified" timestamptz,
  "delinquent" boolean,
  "deliquent" boolean, -- TODO: to be removed
  "firstName" varchar,
  "fullName" varchar,
  "groupId" varchar,
  "groupName" varchar,
  "insertedBy" varchar,
  "lastName" varchar,
  "loId" varchar,
  "mcbuHistory" jsonb,
  "middleName" varchar,
  "oldGroupId" varchar,
  "oldLoId" varchar,
  "profile" varchar,
  "status" varchar
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

-- drop table "holidays"
create table "holidays" (
  "_id" varchar primary key,
  "date" varchar,
  "dateAdded" timestamptz,
  "description" varchar,
  "name" varchar
);

create unique index "holidays__uix_date" on "holidays" (date);


-- drop table "loans"
create table "loans" (
  "_id" varchar primary key,
  "activeLoan" numeric(10, 2),
  "admissionDate" varchar, -- TODO: convert to date
  "advanceDays" numeric(10, 2),
  "amountRelease" numeric(10, 2),
  "branchId" varchar,
  "branchName" varchar,
  "brancName" varchar,
  "clientId" varchar,
  "closedDate" timestamptz,
  "coMaker" varchar,
  "coMakerId" varchar,
  "currentDate" timestamptz,
  "dateGranted" date,
  "dateModified" timestamptz,
  "endDate" varchar, -- TODO: convert to date
  "fullName" varchar,
  "fullPaymentDate" date,
  "groupDay" varchar,
  "groupId" varchar,
  "groupName" varchar,
  "groupStatus" varchar,
  "guarantorFirstName" varchar,
  "guarantorLastName" varchar,
  "guarantorMiddleName" varchar,
  "history" jsonb,
  "insertedBy" varchar,
  "insertedDateTime" timestamptz,
  "lastUpdated" timestamptz,
  "ldfApproved" boolean,
  "ldfApprovedDate" timestamptz,
  "loanBalance" numeric(10, 2),
  "loanCycle" numeric(16, 2),
  "loanOfficerName" varchar,
  "loanRelease" numeric(10, 2),
  "loanTerms" numeric(10, 2),
  "loId" varchar,
  "manual" boolean,
  "maturedPastDue" numeric(10, 2),
  "maturedPD" boolean,
  "maturedPDDate" timestamptz,
  "mcbu" numeric(10, 2),
  "mcbuCollection" numeric(10, 2),
  "mcbuIntereset" numeric(10, 2),
  "mcbuInterest" numeric(10, 2),
  "mcbureturn" numeric(10, 2),
  "mcbuReturnAmount" numeric(10, 2),
  "mcbuReturnAmt" numeric(10, 2),
  "mcbuTarget" numeric(10, 2),
  "mcbuWithdrawal" numeric(10, 2),
  "mispayment" numeric(10, 2),
  "modifiedBy" varchar,
  "modifiedDate" timestamptz,
  "modifiedDateTime" timestamptz,
  "noBadDebtPayment" numeric(10, 2),
  "noOfPayments" numeric(10, 2),
  "noPastDue" numeric(10, 2),
  "occurence" varchar,
  "origCoMaker" varchar,
  "origin" varchar,
  "pastDue" numeric(10, 2),
  "pnNumber" varchar,
  "prevLoanFullPaymentAmount" numeric(10, 2),
  "prevLoanFullPaymentDate" timestamptz,
  "prevLoanId" varchar,
  "principalLoan" numeric(10, 2),
  "rejectReason" varchar,
  "remarks" varchar,
  "remediated" varchar,
  "reverted" boolean,
  "revertedDate" timestamptz,
  "revertedTransfer" boolean,
  "selected" boolean,
  "slotNo" numeric(10, 2),
  "startDate" varchar, -- TODO: conver to date
  "status" varchar,
  "targetCollection" numeric(10, 2),
  "transfer" boolean,
  "transferDate" timestamptz,
  "transferId" varchar,
  "transferred" boolean
);

-- drop table "losTotals"
create table "losTotals" (
  "_id" varchar primary key,
  "branchId" varchar,
  "currentDate" timestamptz,
  "data" jsonb,
  "dateAdded" timestamptz,
  "dateApproved" timestamptz,
  "dateModified" timestamptz,
  "insertedBy" varchar,
  "insertedDate" timestamptz,
  "insertedDateTime" timestamptz,
  "losType" varchar,
  "modifiedBy" varchar,
  "modifiedDate" timestamptz,
  "month" int,
  "occurence" varchar,
  "status" varchar,
  "userId" varchar,
  "userType" varchar,
  "year" int
);

create table "roles" (
  "_id" varchar primary key,
  "name" varchar,
  "order" int,
  "rep" int,
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
  "root" boolean,
  "branchManagerName" varchar
);

-- drop table "areas"
create table "areas" (
  "_id" varchar primary key,
  "branchIds" varchar,
  "dateAdded" timestamptz,
  "managerIds" varchar,
  "name" varchar,
  "regionId" varchar
  "divisionId" varchar
);

-- drop table "regions"
create table "regions" (
  "_id" varchar primary key,
  "areaIds" varchar,
  "dateAdded" timestamptz,
  "managerIds" varchar,
  "name" varchar,
  "divisionId" varchar
);

create table "divisions" (
  "_id" varchar primary key,
  "name" varchar,
  "managerIds" jsonb,
  "regionIds" jsonb,
  "dateAdded" timestamptz
);