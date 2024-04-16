create index "ix_loans__branchId" on loans("branchId");
create index "ix_loans__loId" on loans("loId");
create index "ix_loans__maturedPD" on loans("maturedPD");
create index "ix_loans__prevLoanId" on loans("prevLoanId");
create index "ix_loans__status" on loans("status");
create index "ix_loans__groupId" on loans("groupId");
create index "ix_loans__clientId" on loans("clientId");


create index "ix_branches__code" on branches(code);
create index "ix_branches__areaId" on branches("areaId");
create index "ix_branches__regionId" on branches("regionId");
create index "ix_branches__divisionId" on branches("divisionId");


create index "ix_badDebtCollections__branchId" on "badDebtCollections"("branchId");
create index "ix_badDebtCollections__loId" on "badDebtCollections"("loId");
create index "ix_badDebtCollections__groupId" on "badDebtCollections"("groupId");
create index "ix_badDebtCollections__clientId" on "badDebtCollections"("clientId");


create index "ix_client__status" on client("status");
create index "ix_client__branchId" on client("branchId");
create index "ix_client__loId" on client("loId");
create index "ix_client__oldLoId" on client("oldLoId");
create index "ix_client__groupId" on client("groupId");
create index "ix_client__oldGroupId" on client("oldGroupId");


create index "ix_groups__branchId" on groups("branchId");
create index "ix_groups__loanOfficerId" on groups("loanOfficerId");
create index "ix_groups__status" on groups("status");


create index "ix_losTotals__userId" on "losTotals"("userId");
create index "ix_losTotals__month" on "losTotals"("month");
create index "ix_losTotals__year" on "losTotals"("year");


create index "ix_users__root" on "users"("root");
create index "ix_users__role" on "users"("role");
create index "ix_users__designatedBranch" on "users"("designatedBranch");
create index "ix_users__designatedBranchId" on "users"("designatedBranchId");
create index "ix_users__loNo" on "users"("loNo");
create index "ix_users__email" on "users"("email");
create index "ix_users__status" on "users"("status");