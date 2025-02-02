create table public.areas (
  _id character varying primary key not null,
  "branchIds" character varying,
  "dateAdded" date,
  "managerIds" character varying,
  name character varying,
  "regionId" character varying,
  "divisionId" character varying
);

create table public."badDebtCollections" (
  _id character varying primary key not null,
  "branchId" character varying,
  "clientId" character varying,
  "dateAdded" date,
  "groupId" character varying,
  "insertedBy" character varying,
  "insertedDate" date,
  "loId" character varying,
  "loanId" character varying,
  "loanRelease" numeric(10,2),
  "maturedPastDue" numeric(10,2),
  "paymentCollection" numeric(10,2),
  mcbu numeric(10,2)
);
create index "ix_badDebtCollections__branchId" on "badDebtCollections" using btree ("branchId");
create index "ix_badDebtCollections__loId" on "badDebtCollections" using btree ("loId");
create index "ix_badDebtCollections__groupId" on "badDebtCollections" using btree ("groupId");
create index "ix_badDebtCollections__clientId" on "badDebtCollections" using btree ("clientId");

create table public.branches (
  _id character varying primary key not null,
  address character varying,
  code character varying,
  "dateAdded" date,
  email character varying,
  name character varying,
  "phoneNumber" character varying,
  "areaId" character varying,
  "regionId" character varying,
  "divisionId" character varying
);
create index ix_branches__code on branches using btree (code);
create index "ix_branches__areaId" on branches using btree ("areaId");
create index "ix_branches__regionId" on branches using btree ("regionId");
create index "ix_branches__divisionId" on branches using btree ("divisionId");

create table public."cashCollections" (
  _id character varying primary key not null,
  "activeLoan" numeric(10,2),
  "advanceDays" numeric(10,2),
  "amountRelease" numeric(10,2),
  "branchId" character varying,
  "clientId" character varying,
  "closedDate" date,
  "closeRemarks" character varying,
  "coMaker" character varying,
  "currentReleaseAmount" numeric(10,2),
  "dateAdded" date,
  "dateModified" date,
  dcmc boolean,
  delinquent boolean,
  draft boolean,
  "endDate" character varying,
  error boolean,
  excess numeric(10,2),
  excused boolean,
  "fullName" character varying,
  "fullPayment" numeric(10,2),
  "fullPaymentDate" date,
  "groupDay" character varying,
  "groupId" character varying,
  "groupName" character varying,
  "groupStatus" character varying,
  history jsonb,
  "insertedBy" character varying,
  "insertedDateTime" timestamp with time zone,
  "latePayment" boolean,
  "loanBalance" numeric(10,2),
  "loanCycle" numeric(16,2),
  "loanId" character varying,
  "loanRelease" numeric(10,2),
  "loanTerms" character varying,
  "loId" character varying,
  "maturedPastDue" numeric(10,2),
  "maturedPD" boolean,
  mcbu numeric(10,2),
  "mcbuCol" numeric(10,2),
  "mcbuInterest" numeric(10,2),
  "mcbuInterestFlag" boolean,
  "mcbuReturnAmt" numeric(10,2),
  "mcbuTarget" numeric(10,2),
  "mcbuWithdrawal" numeric(10,2),
  "mcbuWithdrawFlag" boolean,
  mispayment boolean,
  "modifiedBy" character varying,
  "modifiedDateTime" timestamp with time zone,
  mpdc boolean,
  "noMispayment" numeric(10,2),
  "noOfPayments" numeric(10,2),
  "noPastDue" numeric(10,2),
  occurence character varying,
  "offsetTransFlag" boolean,
  "oldLoanId" character varying,
  origin character varying,
  "pastDue" numeric(10,2),
  "paymentCollection" numeric(10,2),
  "prevData" jsonb,
  "prevLoanId" character varying,
  remarks jsonb,
  reverted boolean,
  "revertedDate" date,
  "slotNo" numeric(10,2),
  status character varying,
  "targetCollection" numeric(10,2),
  "timeAdded" character varying,
  tomorrow boolean,
  total numeric(10,2),
  transfer boolean,
  "transferId" character varying,
  transferred boolean,
  advance boolean,
  "closingTime" time with time zone,
  "loanFor" character varying,
  "dateOfRelease" date,
  "transferredDate" date,
  "transferDate" date,
  foreign key ("branchId") references public.branches (_id)
  match simple on update restrict on delete restrict
);
create index "dateAdded" on "cashCollections" using btree ("dateAdded");
create index "loanId_idx" on "cashCollections" using btree ("loanId");
create index "branchId_idx" on "cashCollections" using btree ("branchId");
create index "ix_cashCollections__transferId" on "cashCollections" using btree ("transferId");
create index "oldLoanId_idx" on "cashCollections" using btree ("oldLoanId");
create index "loId_idx" on "cashCollections" using btree ("loId");
create index "groupId" on "cashCollections" using btree ("groupId");

create table public.client (
  _id character varying primary key not null,
  address character varying,
  "addressBarangayDistrict" character varying,
  birthdate character varying,
  "branchId" character varying,
  "branchName" character varying,
  "contactNumber" character varying,
  "dateAdded" date,
  "dateModified" date,
  delinquent boolean,
  "firstName" character varying,
  "groupId" character varying,
  "groupName" character varying,
  "insertedBy" character varying,
  "lastName" character varying,
  "loId" character varying,
  "middleName" character varying,
  "oldGroupId" character varying,
  profile character varying,
  status character varying,
  "addressMunicipalityCity" character varying,
  "fullName" character varying,
  "oldLoId" character varying,
  "addressProvince" character varying,
  "addressStreetNo" character varying,
  "addressZipCode" character varying,
  "oldGroupid" character varying,
  duplicate boolean,
  "ciName" character varying,
  groupLeader boolean,
);
create index ix_client__status on client using btree (status);
create index "ix_client__branchId" on client using btree ("branchId");
create index "ix_client__loId" on client using btree ("loId");
create index "ix_client__oldLoId" on client using btree ("oldLoId");
create index "ix_client__groupId" on client using btree ("groupId");
create index "ix_client__oldGroupId" on client using btree ("oldGroupId");

create table public.divisions (
  _id character varying primary key not null,
  name character varying,
  "managerIds" jsonb,
  "regionIds" jsonb,
  "dateAdded" date
);

create table public.groups (
  _id character varying primary key not null,
  "availableSlots" jsonb,
  "branchId" character varying,
  "branchName" character varying,
  capacity numeric(10,2),
  "dateAdded" date,
  day character varying,
  "groupNo" numeric(10,2),
  "loanOfficerId" character varying,
  name character varying,
  "noOfClients" integer,
  occurence character varying,
  status character varying,
  time character varying,
  "dayNo" integer,
  "loanOfficerName" character varying
);
create index "ix_groups__branchId" on groups using btree ("branchId");
create index "ix_groups__loanOfficerId" on groups using btree ("loanOfficerId");
create index ix_groups__status on groups using btree (status);

create table public.holidays (
  _id character varying primary key not null,
  date character varying,
  "dateAdded" date,
  description character varying,
  name character varying
);
create unique index holidays__uix_date on holidays using btree (date);

create table public.loans (
  _id character varying primary key not null,
  "activeLoan" numeric(10,2),
  "admissionDate" character varying,
  "advanceDays" numeric(10,2),
  "amountRelease" numeric(10,2),
  "branchId" character varying,
  "branchName" character varying,
  "clientId" character varying,
  "closedDate" date,
  "coMaker" character varying,
  "coMakerId" character varying,
  "currentDate" date,
  "dateGranted" date,
  "dateModified" date,
  "endDate" character varying,
  "fullName" character varying,
  "fullPaymentDate" date,
  "groupDay" character varying,
  "groupId" character varying,
  "groupName" character varying,
  "groupStatus" character varying,
  "guarantorFirstName" character varying,
  "guarantorLastName" character varying,
  "guarantorMiddleName" character varying,
  history jsonb,
  "insertedBy" character varying,
  "insertedDateTime" timestamp with time zone,
  "lastUpdated" timestamp with time zone,
  "ldfApproved" boolean not null default false,
  "ldfApprovedDate" date,
  "loanBalance" numeric(10,2),
  "loanCycle" numeric(16,2),
  "loanOfficerName" character varying,
  "loanRelease" numeric(10,2),
  "loanTerms" numeric(10,2),
  "loId" character varying,
  "maturedPastDue" numeric(10,2),
  "maturedPD" boolean not null default false,
  "maturedPDDate" date,
  mcbu numeric(10,2),
  "mcbuCollection" numeric(10,2),
  "mcbuIntereset" numeric(10,2),
  "mcbuInterest" numeric(10,2),
  mcbureturn numeric(10,2),
  "mcbuReturnAmt" numeric(10,2),
  "mcbuTarget" numeric(10,2),
  "mcbuWithdrawal" numeric(10,2),
  mispayment numeric(10,2),
  "modifiedBy" character varying,
  "modifiedDateTime" timestamp with time zone,
  "noBadDebtPayment" numeric(10,2),
  "noOfPayments" numeric(10,2),
  "noPastDue" numeric(10,2),
  occurence character varying,
  origin character varying,
  "pastDue" numeric(10,2),
  "pnNumber" character varying,
  "prevLoanFullPaymentAmount" numeric(10,2),
  "prevLoanFullPaymentDate" date,
  "prevLoanId" character varying,
  "principalLoan" numeric(10,2),
  "rejectReason" character varying,
  remarks character varying,
  reverted boolean not null default false,
  "revertedTransfer" boolean not null default false,
  "slotNo" numeric(10,2),
  "startDate" character varying,
  status character varying,
  "targetCollection" numeric(10,2),
  transfer boolean not null default false,
  "transferDate" date,
  "transferId" character varying,
  transferred boolean not null default false,
  "loanFor" character varying,
  "dateAdded" date,
  "revertedDateTime" timestamp with time zone,
  "transferredDate" date,
  advance boolean not null default false,
  "advanceDate" date,
  excess numeric(10,2),
  "transferredReleased" boolean not null default false,
  "dateOfRelease" date,
  advancetransaction boolean not null default false,
  "ciName" character varying
);
create index "ix_loans__branchId" on loans using btree ("branchId");
create index "ix_loans__maturedPD" on loans using btree ("maturedPD");
create index ix_loans__status on loans using btree (status);
create index "ix_loans__loId" on loans using btree ("loId");
create index "ix_loans__prevLoanId" on loans using btree ("prevLoanId");
create index "ix_loans__groupId" on loans using btree ("groupId");
create index "ix_loans__clientId" on loans using btree ("clientId");

create table public."losTotals" (
  _id character varying primary key not null,
  "branchId" character varying,
  "currentDate" date,
  data jsonb,
  "dateAdded" date,
  "dateApproved" date,
  "dateModified" date,
  "insertedBy" character varying,
  "insertedDate" date,
  "insertedDateTime" timestamp with time zone,
  "losType" character varying,
  "modifiedBy" character varying,
  "modifiedDate" date,
  month integer,
  occurence character varying,
  status character varying,
  "userId" character varying,
  "userType" character varying,
  year integer,
  "officeType" character varying
);
create index "ix_losTotals__userId" on "losTotals" using btree ("userId");
create index "ix_losTotals__month" on "losTotals" using btree (month);
create index "ix_losTotals__year" on "losTotals" using btree (year);
create index "ix_losTotals__officeType" on "losTotals" using btree ("officeType");

create table public.regions (
  _id character varying primary key not null,
  "areaIds" character varying,
  "dateAdded" date,
  "managerIds" character varying,
  name character varying,
  "divisionId" character varying
);

create table public.roles (
  _id character varying primary key not null,
  name character varying,
  "order" integer,
  "shortCode" character varying,
  system boolean,
  rep integer,
  "dateAdded" date
);

create table public."rolesPermissions" (
  _id character varying primary key not null,
  permissions jsonb,
  role numeric(10,2),
  "dateAdded" date
);

create table public.settings (
  _id character varying primary key not null,
  "branchAddress" character varying,
  "branchName" character varying,
  "companyAddress" character varying,
  "branchCode" character varying,
  "branchPhoneNumber" character varying,
  "companyEmail" character varying,
  "companyName" character varying,
  "companyPhoneNumber" character varying
);

create table public."transactionSettings" (
  _id character varying primary key not null,
  "loanDailyLimit" numeric(10,2),
  "loanWeeklyLimit" numeric(10,2),
  "mcbuRate" numeric(10,2),
  "allowWeekendTransaction" boolean,
  "startTransactionTime" character varying,
  "superPwd" character varying,
);

create table public."transferClients" (
  _id character varying primary key not null,
  "approveRejectDate" date,
  "branchToBranch" boolean,
  "currentSlotNo" numeric(10,2),
  "dateAdded" date,
  "loToLo" boolean,
  "loanId" character varying,
  "modifiedDateTime" timestamp with time zone,
  occurence character varying,
  "sameLo" boolean,
  "sourceBranchId" character varying,
  status character varying,
  "targetBranchId" character varying,
  "targetGroupId" character varying,
  "selectedClientId" character varying,
  "sourceGroupId" character varying,
  "targetUserId" character varying,
  "selectedSlotNo" numeric(10,2),
  "sourceUserId" character varying
);

create table public.users (
  _id character varying primary key not null,
  "dateAdded" date,
  "dateModified" date,
  "designatedBranch" character varying,
  email character varying,
  "firstName" character varying,
  "lastLogin" timestamp with time zone,
  "loNo" numeric(10,2),
  logged boolean,
  number character varying,
  password character varying,
  position character varying,
  profile character varying,
  role jsonb,
  status character varying,
  "transactionType" character varying,
  "designatedBranchId" character varying,
  "lastName" character varying,
  root boolean,
  "branchManagerName" character varying,
  "areaId" character varying,
  "regionId" character varying,
  "divisionId" character varying
);
create index ix_users__root on users using btree (root);
create index ix_users__role on users using btree (role);
create index "ix_users__designatedBranch" on users using btree ("designatedBranch");
create index "ix_users__designatedBranchId" on users using btree ("designatedBranchId");
create index "ix_users__loNo" on users using btree ("loNo");
create index ix_users__email on users using btree (email);
create index ix_users__status on users using btree (status);

create table public."branchCOH" (
  _id character varying primary key not null,
  amount numeric(10,2),
  "branchId" character varying,
  "insertedBy" character varying,
  "dateAdded" date,
  "modifiedBy" character varying,
  "modifiedDateTime" timestamp with time zone,
  foreign key ("branchId") references public.branches (_id)
  match simple on update no action on delete no action,
  foreign key ("insertedBy") references public.users (_id)
  match simple on update no action on delete no action,
  foreign key ("modifiedBy") references public.users (_id)
  match simple on update no action on delete no action
);
