create table public.areas (
  _id character varying primary key not null,
  "branchIds" character varying,
  "dateAdded" date,
  "managerIds" character varying,
  name character varying,
  "regionId" character varying,
  "divisionId" character varying
);

create table public."badDebtCollections"
(
  _id                 varchar not null
    primary key,
  "branchId"          varchar,
  "clientId"          varchar,
  "dateAdded"         date,
  "groupId"           varchar,
  "insertedBy"        varchar,
  "insertedDate"      date,
  "loId"              varchar,
  "loanId"            varchar,
  "loanRelease"       numeric(10, 2),
  "maturedPastDue"    numeric(10, 2),
  "paymentCollection" numeric(10, 2),
  mcbu                numeric(10, 2)
);

create index "ix_badDebtCollections__branchId"
  on public."badDebtCollections" ("branchId");

create index "ix_badDebtCollections__loId"
  on public."badDebtCollections" ("loId");

create index "ix_badDebtCollections__groupId"
  on public."badDebtCollections" ("groupId");

create index "ix_badDebtCollections__clientId"
  on public."badDebtCollections" ("clientId");

create table public.branches
(
  _id           varchar not null
    primary key,
  address       varchar,
  code          varchar,
  "dateAdded"   date,
  email         varchar,
  name          varchar,
  "phoneNumber" varchar,
  "areaId"      varchar,
  "regionId"    varchar,
  "divisionId"  varchar
);

create index ix_branches__code
  on public.branches (code);

create index "ix_branches__areaId"
  on public.branches ("areaId");

create index "ix_branches__regionId"
  on public.branches ("regionId");

create index "ix_branches__divisionId"
  on public.branches ("divisionId");

create table public."cashCollections"
(
  _id                    varchar not null
    primary key,
  "activeLoan"           numeric(10, 2),
  "advanceDays"          numeric(10, 2),
  "amountRelease"        numeric(10, 2),
  "branchId"             varchar
    references public.branches
      on update restrict on delete restrict,
  "clientId"             varchar,
  "closedDate"           date,
  "closeRemarks"         varchar,
  "coMaker"              varchar,
  "currentReleaseAmount" numeric(10, 2),
  "dateAdded"            date,
  "dateModified"         date,
  dcmc                   boolean,
  delinquent             boolean,
  draft                  boolean,
  "endDate"              varchar,
  error                  boolean,
  excess                 numeric(10, 2),
  excused                boolean,
  "fullName"             varchar,
  "fullPayment"          numeric(10, 2),
  "fullPaymentDate"      date,
  "groupDay"             varchar,
  "groupId"              varchar,
  "groupName"            varchar,
  "groupStatus"          varchar,
  history                jsonb,
  "insertedBy"           varchar,
  "insertedDateTime"     timestamp with time zone,
  "latePayment"          boolean,
  "loanBalance"          numeric(10, 2),
  "loanCycle"            numeric(16, 2),
  "loanId"               varchar,
  "loanRelease"          numeric(10, 2),
  "loanTerms"            varchar,
  "loId"                 varchar,
  "maturedPastDue"       numeric(10, 2),
  "maturedPD"            boolean,
  mcbu                   numeric(10, 2),
  "mcbuCol"              numeric(10, 2),
  "mcbuInterest"         numeric(10, 2),
  "mcbuInterestFlag"     boolean,
  "mcbuReturnAmt"        numeric(10, 2),
  "mcbuTarget"           numeric(10, 2),
  "mcbuWithdrawal"       numeric(10, 2),
  "mcbuWithdrawFlag"     boolean,
  mispayment             boolean,
  "modifiedBy"           varchar,
  "modifiedDateTime"     timestamp with time zone,
  mpdc                   boolean,
  "noMispayment"         numeric(10, 2),
  "noOfPayments"         numeric(10, 2),
  "noPastDue"            numeric(10, 2),
  occurence              varchar,
  "offsetTransFlag"      boolean,
  "oldLoanId"            varchar,
  origin                 varchar,
  "pastDue"              numeric(10, 2),
  "paymentCollection"    numeric(10, 2),
  "prevData"             jsonb,
  "prevLoanId"           varchar,
  remarks                jsonb,
  reverted               boolean,
  "revertedDate"         date,
  "slotNo"               numeric(10, 2),
  status                 varchar,
  "targetCollection"     numeric(10, 2),
  "timeAdded"            varchar,
  tomorrow               boolean,
  total                  numeric(10, 2),
  transfer               boolean,
  "transferId"           varchar,
  transferred            boolean,
  advance                boolean,
  "closingTime"          varchar,
  "loanFor"              varchar,
  "dateOfRelease"        date,
  "transferredDate"      date,
  "transferDate"         date
);

create index "loanId_idx"
  on public."cashCollections" ("loanId");

create index "branchId_idx"
  on public."cashCollections" ("branchId");

create index "ix_cashCollections__transferId"
  on public."cashCollections" ("transferId");

create index "oldLoanId_idx"
  on public."cashCollections" ("oldLoanId");

create index "loId_idx"
  on public."cashCollections" ("loId");

create index "groupId"
  on public."cashCollections" ("groupId");

create index "dateAdded"
  on public."cashCollections" ("dateAdded");

create table public.client
(
  _id                       varchar not null
    primary key,
  address                   varchar,
  "addressBarangayDistrict" varchar,
  birthdate                 varchar,
  "branchId"                varchar,
  "branchName"              varchar,
  "contactNumber"           varchar,
  "dateAdded"               date,
  "dateModified"            date,
  delinquent                boolean,
  "firstName"               varchar,
  "groupId"                 varchar,
  "groupName"               varchar,
  "insertedBy"              varchar,
  "lastName"                varchar,
  "loId"                    varchar,
  "middleName"              varchar,
  "oldGroupId"              varchar,
  profile                   varchar,
  status                    varchar,
  "addressMunicipalityCity" varchar,
  "fullName"                varchar,
  "oldLoId"                 varchar,
  "addressProvince"         varchar,
  "addressStreetNo"         varchar,
  "addressZipCode"          varchar,
  "oldGroupid"              varchar,
  duplicate                 boolean,
  archived                  boolean,
  "archivedBy"              varchar,
  "archivedDate"            timestamp with time zone
);

create index ix_client__status
  on public.client (status);

create index "ix_client__branchId"
  on public.client ("branchId");

create index "ix_client__loId"
  on public.client ("loId");

create index "ix_client__oldLoId"
  on public.client ("oldLoId");

create index "ix_client__groupId"
  on public.client ("groupId");

create index "ix_client__oldGroupId"
  on public.client ("oldGroupId");

create table public.divisions (
  _id character varying primary key not null,
  name character varying,
  "managerIds" jsonb,
  "regionIds" jsonb,
  "dateAdded" date
);

create table public.groups
(
  _id               varchar not null
    primary key,
  "availableSlots"  jsonb,
  "branchId"        varchar,
  "branchName"      varchar,
  capacity          numeric(10, 2),
  "dateAdded"       date,
  day               varchar,
  "groupNo"         numeric(10, 2),
  "loanOfficerId"   varchar,
  name              varchar,
  "noOfClients"     integer,
  occurence         varchar,
  status            varchar,
  time              varchar,
  "dayNo"           integer,
  "loanOfficerName" varchar
);

create index "ix_groups__branchId"
  on public.groups ("branchId");

create index "ix_groups__loanOfficerId"
  on public.groups ("loanOfficerId");

create index ix_groups__status
  on public.groups (status);

create table public.holidays
(
  _id         varchar not null
    primary key,
  date        varchar,
  "dateAdded" date,
  description varchar,
  name        varchar
);

create table public.loans
(
  _id                         varchar               not null
    primary key,
  "activeLoan"                numeric(10, 2),
  "admissionDate"             varchar,
  "advanceDays"               numeric(10, 2),
  "amountRelease"             numeric(10, 2),
  "branchId"                  varchar,
  "branchName"                varchar,
  "clientId"                  varchar,
  "closedDate"                date,
  "coMaker"                   varchar,
  "coMakerId"                 varchar,
  "currentDate"               date,
  "dateGranted"               date,
  "dateModified"              date,
  "endDate"                   varchar,
  "fullName"                  varchar,
  "fullPaymentDate"           date,
  "groupDay"                  varchar,
  "groupId"                   varchar,
  "groupName"                 varchar,
  "groupStatus"               varchar,
  "guarantorFirstName"        varchar,
  "guarantorLastName"         varchar,
  "guarantorMiddleName"       varchar,
  history                     jsonb,
  "insertedBy"                varchar,
  "insertedDateTime"          timestamp with time zone,
  "lastUpdated"               timestamp with time zone,
  "ldfApproved"               boolean default false not null,
  "ldfApprovedDate"           date,
  "loanBalance"               numeric(10, 2),
  "loanCycle"                 numeric(16, 2),
  "loanOfficerName"           varchar,
  "loanRelease"               numeric(10, 2),
  "loanTerms"                 numeric(10, 2),
  "loId"                      varchar,
  "maturedPastDue"            numeric(10, 2),
  "maturedPD"                 boolean default false not null,
  "maturedPDDate"             date,
  mcbu                        numeric(10, 2),
  "mcbuCollection"            numeric(10, 2),
  "mcbuIntereset"             numeric(10, 2),
  "mcbuInterest"              numeric(10, 2),
  mcbureturn                  numeric(10, 2),
  "mcbuReturnAmt"             numeric(10, 2),
  "mcbuTarget"                numeric(10, 2),
  "mcbuWithdrawal"            numeric(10, 2),
  mispayment                  numeric(10, 2),
  "modifiedBy"                varchar,
  "modifiedDateTime"          timestamp with time zone,
  "noBadDebtPayment"          numeric(10, 2),
  "noOfPayments"              numeric(10, 2),
  "noPastDue"                 numeric(10, 2),
  occurence                   varchar,
  origin                      varchar,
  "pastDue"                   numeric(10, 2),
  "pnNumber"                  varchar,
  "prevLoanFullPaymentAmount" numeric(10, 2),
  "prevLoanFullPaymentDate"   date,
  "prevLoanId"                varchar,
  "principalLoan"             numeric(10, 2),
  "rejectReason"              varchar,
  remarks                     varchar,
  reverted                    boolean default false not null,
  "revertedTransfer"          boolean default false not null,
  "slotNo"                    numeric(10, 2),
  "startDate"                 varchar,
  status                      varchar,
  "targetCollection"          numeric(10, 2),
  transfer                    boolean default false not null,
  "transferDate"              date,
  "transferId"                varchar,
  transferred                 boolean default false not null,
  "loanFor"                   varchar,
  "dateAdded"                 date,
  "revertedDateTime"          timestamp with time zone,
  "transferredDate"           date,
  advance                     boolean default false not null,
  "advanceDate"               date,
  excess                      numeric(10, 2),
  "transferredReleased"       boolean default false not null,
  "dateOfRelease"             date,
  "advanceTransaction"        boolean default false not null
);

create index "ix_loans__branchId"
  on public.loans ("branchId");

create index "ix_loans__maturedPD"
  on public.loans ("maturedPD");

create index ix_loans__status
  on public.loans (status);

create index "ix_loans__loId"
  on public.loans ("loId");

create index "ix_loans__prevLoanId"
  on public.loans ("prevLoanId");

create index "ix_loans__groupId"
  on public.loans ("groupId");

create index "ix_loans__clientId"
  on public.loans ("clientId");

create table public."losTotals"
(
  _id                varchar not null
    primary key,
  "branchId"         varchar,
  "currentDate"      date,
  data               jsonb,
  "dateAdded"        date,
  "dateApproved"     date,
  "dateModified"     date,
  "insertedBy"       varchar,
  "insertedDate"     date,
  "insertedDateTime" timestamp with time zone,
  "losType"          varchar,
  "modifiedBy"       varchar,
  "modifiedDate"     date,
  month              integer,
  occurence          varchar,
  status             varchar,
  "userId"           varchar,
  "userType"         varchar,
  year               integer,
  "officeType"       varchar
);

create index "ix_losTotals__userId"
  on public."losTotals" ("userId");

create index "ix_losTotals__month"
  on public."losTotals" (month);

create index "ix_losTotals__year"
  on public."losTotals" (year);

create index "ix_losTotals__officeType"
  on public."losTotals" ("officeType");

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
  "superPwd" character varying
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
