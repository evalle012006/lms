-- NOTE: backup the data first before cleanup
-- all
delete from "areas" where (true);
delete from "badDebtCollections" where (true);
delete from "cashCollections" where (true);
delete from "branchCOH" where (true);
delete from "branches" where (true);
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
delete from "client" where (true);
delete from "badDebtCollections" where (true);
delete from "cashCollections" where (true);
delete from "branchCOH" where (true);
delete from "loans" where (true);
delete from "losTotals" where (true);
delete from "transferClients" where (true);


--- data verification
select l._id, l."clientId", l."branchId" from loans l
left join client c on c._id = l."clientId"
where c._id is null;


select _id, "clientId" from loans order by "dateGranted" desc limit 1;


select _id, name from branches
where _id in (
             '669e68c727e6c5308696b769',
             '647e678eb021fc463ed63cec',
             '64f124140336c342acde9ae8',
             '651e1f38fe9e9b760e604ba1',
             '66a0d74727e6c5308698aef7',
             '669e402627e6c5308696b09c',
             '66b4c34c823bcfcd2b1ededf',
             '639e80c8aeb5b756302b6cf8',
             '66a37bed27e6c530869adb66',
             '669105df70f4e8c8f67f7ca5',
             '6690e36670f4e8c8f67f3c1e',
             '639e80c8aeb5b756302b6cf4'
  )