alter table branches
  add column "hrisId" varchar (36);

alter table areas
  add column "hrisId" varchar (36),
  add column "dateModified" timestamptz;

alter table regions
  add column "hrisId" varchar (36);

alter table divisions
  add column "hrisId" varchar (36);

alter table users
  add column "hrisId" varchar (36);


-- update areas
update areas set "hrisId" = 'ad310fa9-7c8e-4ec0-b339-8572621ee511' where name ilike 'AGUSAN DEL NORTE I';
update areas set "hrisId" = '775095d5-08e5-4dda-8d6a-c9d61099deb7' where name ilike 'AGUSAN DEL NORTE II';
update areas set "hrisId" = 'b8cecade-656f-4985-9065-522155d91700' where name ilike 'ALBAY I';
update areas set "hrisId" = '0df2525c-f653-4636-8a13-d3c047b6d6da' where name ilike 'ALBAY II';
update areas set "hrisId" = '06d95294-059c-4d87-89eb-5c75c61a4f8b' where name ilike 'ALBAY III';
update areas set "hrisId" = '01a138f5-a7d0-430c-8db3-cd4d9f90d8e3' where name ilike 'BACOLOD AREA';
update areas set "hrisId" = 'b5000388-839e-48f2-8b1f-07cd57f70be3' where name ilike 'BASILAN';
update areas set "hrisId" = 'bb915724-a8d7-458f-9c86-408b63ca76bc' where name ilike 'BATANGAS I';
update areas set "hrisId" = 'c2355a6f-da32-4ca4-afa7-68cedd71041c' where name ilike 'BULACAN I';
update areas set "hrisId" = 'b5324364-d35d-4b99-9990-ba5cce6fb73b' where name ilike 'CAGAYAN DE ORO I';
update areas set "hrisId" = '0e6712a9-c185-4b50-a9f4-58869d05070d' where name ilike 'CAGAYAN DE ORO II';
update areas set "hrisId" = 'ed84cf6a-a241-4b3a-9e50-d2ec28caa6a4' where name ilike 'CALOOCAN';
update areas set "hrisId" = '1fa07d3c-142e-4940-b096-66b6190995e4' where name ilike 'CAMARINES SUR I';
update areas set "hrisId" = 'e71229a3-227c-4539-94ad-82ad93919d42' where name ilike 'CAMARINES SUR II';
update areas set "hrisId" = '267b4732-2d7d-41b5-a66b-881ac658d48b' where name ilike 'CAVITE';
update areas set "hrisId" = 'aad836f2-dce3-4190-bde0-f9c243f19c07' where name ilike 'CEBU CENTRAL';
update areas set "hrisId" = 'c2f4f713-2132-4968-83b3-8fd7d2e94a29' where name ilike 'CEBU NORTH I';
update areas set "hrisId" = 'c3bd4bb3-9ac9-40db-a089-79561a18899d' where name ilike 'CEBU NORTH II';
update areas set "hrisId" = 'f10ab2fe-5199-48b2-955e-cd7d61959321' where name ilike 'CEBU NORTH III';
update areas set "hrisId" = 'c7741124-28b4-4d02-91b6-98975e265e86' where name ilike 'CEBU SOUTH';
update areas set "hrisId" = 'fc8d4c5c-ec45-4063-8494-b77c346e55a9' where name ilike 'CEBU SOUTH II';
update areas set "hrisId" = '716aa441-e1d3-49d6-b46d-78a15f3f2d67' where name ilike 'CEBU SOUTH III';
update areas set "hrisId" = 'a78e90d6-d586-4f55-9ae1-fe5d7ea89a0f' where name ilike 'ILIGAN';
update areas set "hrisId" = '1940aa44-6d21-4bc0-aa60-4777a6fe1c69' where name ilike 'LAGUNA';
update areas set "hrisId" = 'f0eec216-18b0-4adb-90dd-d2e5eac1cd6f' where name ilike 'LAS PIÑAS';
update areas set "hrisId" = '9fba2e00-c30d-4cc5-96d9-5d766baaefbb' where name ilike 'MAIN OFFICE';
update areas set "hrisId" = '1e96f319-50c6-496e-8686-9e67a9cfb6dd' where name ilike 'MISAMIS ORIENTAL ';
update areas set "hrisId" = '0b676403-316d-4592-911e-275cd5e5cbb0' where name ilike 'NEGROS OCCIDENTAL I';
update areas set "hrisId" = '63086fd5-39c2-40be-9f6a-3a8c4b03fd34' where name ilike 'NEGROS OCCIDENTAL II';
update areas set "hrisId" = 'd9dae9b3-3417-465a-af03-ccbc69f31fd4' where name ilike 'NEGROS OCCIDENTAL III';
update areas set "hrisId" = 'b69c440c-4c8d-49c0-a87b-a9617e6e8657' where name ilike 'NEGROS ORIENTAL I';
update areas set "hrisId" = '8fdd86f5-cdab-48fd-a581-68624bc5b207' where name ilike 'NUEVA ECIJA I';
update areas set "hrisId" = '2d81f356-503c-4f3f-982b-f8e62db4cd47' where name ilike 'NUEVA ECIJA II';
update areas set "hrisId" = 'bdc3e3f4-bd33-47b5-a1cf-2cdb0fb1331f' where name ilike 'NUEVA ECIJA III';
update areas set "hrisId" = 'f02fd68f-6414-4cda-a1eb-f61fb8953b71' where name ilike 'PAMPANGA I';
update areas set "hrisId" = '9662137b-b09e-4bac-a518-8f3e5017b09c' where name ilike 'PAMPANGA II';
update areas set "hrisId" = 'c9bd634a-db35-4a1d-b481-f72c9d58f5ff' where name ilike 'PARAÑAQUE ';
update areas set "hrisId" = '905f8f92-acc1-4542-ace6-a747c0c50940' where name ilike 'PASIG';
update areas set "hrisId" = 'de2cacda-424b-4331-b588-6df3d1f3611c' where name ilike 'QUEZON CITY';
update areas set "hrisId" = '45a4c3af-49cf-474d-8793-487857728ec1' where name ilike 'RIZAL I';
update areas set "hrisId" = '4cf2f971-5430-4d61-95a2-8bca2bfb457a' where name ilike 'RIZAL II';
update areas set "hrisId" = '5c9c8b70-ff24-48eb-b210-6678d5b83255' where name ilike 'SURIGAO AREA';
update areas set "hrisId" = '07ff063c-19d8-468d-af0b-3b85e5c6bc94' where name ilike 'TAGUIG';
update areas set "hrisId" = 'c9e09b41-f0e1-4b87-88c3-7f8fe28711fa' where name ilike 'TARLAC';
update areas set "hrisId" = '1daf3d75-ffbc-4fe9-a275-dc546377adde' where name ilike 'ZAMBOANGA I';
update areas set "hrisId" = 'f4f505ee-745b-48e1-bb8a-5b2f16a03127' where name ilike 'ZAMBOANGA II';
update areas set "hrisId" = 'fe037d13-2185-4aef-9070-66bea6f7cc6a' where name ilike 'ZAMBOANGA III';
update areas set "hrisId" = '0b4a0256-053c-4d6b-99c8-cf30c0b1c9f6' where name ilike 'ZAMBOANGA DEL SUR';
update areas set "hrisId" = '87d9eb07-b7fa-45e4-b86d-4b20751d6fdb' where name ilike 'ZAMBOANGA SIBUGAY';

