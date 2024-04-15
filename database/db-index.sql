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