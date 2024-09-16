-- NOTE: backup the data first before cleanup
-- all
delete from "areas" where (true);
delete from "badDebtCollections" where (true);
delete from "cashCollections" where (true);
delete from "branchCOH" where (true);
delete from "branches" where (true);
delete from "client" where (true);
delete from "divisions" where (true);
delete from "groups" where (true);
delete from "holidays" where (true);
delete from "loans" where (true);
delete from "losTotals" where (true);
delete from "regions" where (true);
delete from "roles" where (true);
delete from "rolesPermissions" where (true);
delete from "settings" where (true);
delete from "transactionSettings" where (true);
delete from "transferClients" where (true);
delete from "users" where (true);


-- transactions only
delete from "badDebtCollections" where (true);
delete from "cashCollections" where (true);
delete from "branchCOH" where (true);
delete from "loans" where (true);
delete from "losTotals" where (true);
delete from "transferClients" where (true);
