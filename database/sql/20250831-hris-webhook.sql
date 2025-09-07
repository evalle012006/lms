alter table branches
  add column "dateModified" timestamptz,
  add column "hrisId" varchar (36);

alter table areas
  add column "dateModified" timestamptz,
  add column "hrisId" varchar (36);

alter table regions
  add column "dateModified" timestamptz,
  add column "hrisId" varchar (36);

alter table divisions
  add column "dateModified" timestamptz,
  add column "hrisId" varchar (36);

alter table users
  add column "hrisId" varchar (36);


-- update branches
update branches set "hrisId" = '4ea408ce-0e3e-4a25-a074-63a195f3eab6' where code ilike 'B000';
update branches set "hrisId" = '81a91baf-4f0e-4acf-8677-e7b8ec374479' where code ilike 'B001';
update branches set "hrisId" = 'c6f36a44-c4fb-4443-9518-7797ed922a75' where code ilike 'B002';
update branches set "hrisId" = '376bb4ed-de54-4118-aecc-84c66eb7c991' where code ilike 'B003';
update branches set "hrisId" = 'a7394411-1d63-4c64-bf91-ed239892e260' where code ilike 'B004';
update branches set "hrisId" = '2ff2095b-9c87-4371-9c4b-df1eaf59d1ca' where code ilike 'B005';
update branches set "hrisId" = '1231e6b3-66bd-4127-9be5-5d2c80b2f79a' where code ilike 'B006';
update branches set "hrisId" = '68365041-4037-45f4-9534-5e7db85b74fa' where code ilike 'B007';
update branches set "hrisId" = '4336d3c7-83a3-458d-b044-3406628dcad8' where code ilike 'B008';
update branches set "hrisId" = '0cf4fae3-7ccf-435a-aa04-18dbc1208ab4' where code ilike 'B009';
update branches set "hrisId" = '97929e38-dd42-4c55-b8ac-71b246beeafa' where code ilike 'B010';
update branches set "hrisId" = '3f1eb955-6791-4b80-b392-3d7c53f53bc6' where code ilike 'B100';
update branches set "hrisId" = 'd89151b0-8e30-4f58-8e12-9533491a046b' where code ilike 'B101';
update branches set "hrisId" = '554ebd9a-3cd6-4f79-b299-de8bc11ad84e' where code ilike 'B102';
update branches set "hrisId" = '58b9994d-eee5-4aa6-a621-9584d4fb9805' where code ilike 'B103';
update branches set "hrisId" = 'a6aa5987-32cc-44ad-b74b-da06031d8962' where code ilike 'B104';
update branches set "hrisId" = '02a0de3a-25ce-4a1b-9310-955dfa855942' where code ilike 'B105';
update branches set "hrisId" = '52e18dbb-9576-4a70-be7b-3c153aaffbf1' where code ilike 'B106';
update branches set "hrisId" = '0fe1beb3-ed2a-4ef3-84fe-b1fb797f39be' where code ilike 'B107';
update branches set "hrisId" = '0f09e85f-cc63-4b7f-87ea-a99840c29510' where code ilike 'B108';
update branches set "hrisId" = '1b19ab15-ee75-4b52-be39-3dfeaf9c8610' where code ilike 'B109';
update branches set "hrisId" = 'a21eb0f9-d65b-437c-9351-6e8884d1a793' where code ilike 'B011';
update branches set "hrisId" = 'c735fc33-df41-4713-9639-38175db2b3a1' where code ilike 'B110';
update branches set "hrisId" = '395139e1-3b9d-43e8-8382-cf3f1588ba5a' where code ilike 'B111';
update branches set "hrisId" = '7ed706ba-4aa9-4c8d-aad0-ee347d8ab0fa' where code ilike 'B112';
update branches set "hrisId" = 'c25ee10b-a536-43c0-a776-5b3a5ece1cc8' where code ilike 'B113';
update branches set "hrisId" = '704e18d9-4aaa-49a2-8a4b-f31bd11e7900' where code ilike 'B114';
update branches set "hrisId" = 'f5c2d4af-b795-4746-92db-d0103af7027e' where code ilike 'B115';
update branches set "hrisId" = 'f8cf2cba-0ec8-498b-ae4f-eb2d5703d268' where code ilike 'B116';
update branches set "hrisId" = '51340bc3-0877-44b8-b925-c5b7eefd6cb0' where code ilike 'B117';
update branches set "hrisId" = '5118c2cd-831d-4e0e-81ed-afd779cdb87b' where code ilike 'B118';
update branches set "hrisId" = '66cf40bd-499a-4555-a958-66be95bfcbb5' where code ilike 'B119';
update branches set "hrisId" = 'd99c3c3c-d93c-4ea1-8aa9-4959fd3ca7b8' where code ilike 'B012';
update branches set "hrisId" = '62a6052d-90f1-493b-91e4-473c2bf7e5bb' where code ilike 'B120';
update branches set "hrisId" = 'ec3d2dd1-7963-4651-bb89-a65018e70e3e' where code ilike 'B121';
update branches set "hrisId" = 'ae9ea5be-364e-4e7c-bff5-47277ef0ccd1' where code ilike 'B122';
update branches set "hrisId" = '24270de9-5562-4e32-8bc3-517fa0220cef' where code ilike 'B123';
update branches set "hrisId" = '447c4337-f469-4cec-aa1b-dc8a78e800d2' where code ilike 'B124';
update branches set "hrisId" = 'a9f6367c-e0e8-406e-bca2-2109e073e960' where code ilike 'B125';
update branches set "hrisId" = 'faead4c3-026a-45f4-ae27-8d9d3ceaad17' where code ilike 'B126';
update branches set "hrisId" = '3a800924-2ea3-490b-8e07-9b11e6436d6d' where code ilike 'B127';
update branches set "hrisId" = '3f352c74-d3a2-43c8-b395-b17e3f84b9ec' where code ilike 'B128';
update branches set "hrisId" = 'c1cf4c7f-1457-493d-8dbe-9d3199c25bd1' where code ilike 'B129';
update branches set "hrisId" = '439e4dbd-1592-4285-bde4-8d17b509a93e' where code ilike 'B013';
update branches set "hrisId" = '669514fd-7dd8-4d78-b2fc-f83277a1adb2' where code ilike 'B130';
update branches set "hrisId" = '14b08104-2628-4cd3-a281-292caf41cff6' where code ilike 'B131';
update branches set "hrisId" = '1c2eba01-1c25-44ce-941d-0861a3e5f67f' where code ilike 'B132';
update branches set "hrisId" = 'b33854f3-65ba-4b0f-b67c-74f11c999988' where code ilike 'B133';
update branches set "hrisId" = 'efec6c01-040c-4466-a3a0-3445daeb0db6' where code ilike 'B134';
update branches set "hrisId" = 'd71093b0-0240-46c7-af59-7ed183498d41' where code ilike 'B135';
update branches set "hrisId" = 'd9cb241c-ea55-4cc5-a379-dc38f21c906b' where code ilike 'B136';
update branches set "hrisId" = 'fd4965c4-8a13-4dfc-b8d2-5b7220c0cc11' where code ilike 'B137';
update branches set "hrisId" = 'd30ae47e-5a20-4fbb-80b1-3cffb1f253f6' where code ilike 'B014';
update branches set "hrisId" = '51dd0d42-e1ad-40b0-b833-5ad639628dfb' where code ilike 'B015';
update branches set "hrisId" = '010df054-345c-4b89-b489-64eba631b01d' where code ilike 'B016';
update branches set "hrisId" = '2b1ee127-b218-47da-923c-70f2cc8aeb2c' where code ilike 'B017';
update branches set "hrisId" = '9e57468a-f64b-4f5a-bb60-008aadbbbb60' where code ilike 'B018';
update branches set "hrisId" = '620ba845-b684-4f6f-9619-c50d145344e2' where code ilike 'B019';
update branches set "hrisId" = 'e34f8d4a-95d6-4398-a420-9b852481ef7c' where code ilike 'B020';
update branches set "hrisId" = '54e8ae28-ebe4-4803-a637-81993b2c6bac' where code ilike 'B021';
update branches set "hrisId" = '274785df-eefe-4be2-83ca-c9e1525b3b02' where code ilike 'B022';
update branches set "hrisId" = '9b8cdd01-7121-4ec1-8556-4c0a54de6d3b' where code ilike 'B023';
update branches set "hrisId" = 'c6eec70b-4d7f-45a0-b5b9-478dbc83b588' where code ilike 'B024';
update branches set "hrisId" = '190b7bd3-6616-471e-82b9-f4b5d41b9836' where code ilike 'B025';
update branches set "hrisId" = 'ab3aebbd-89e8-4586-94eb-9628e65a38c2' where code ilike 'B026';
update branches set "hrisId" = 'b5b9cb1a-13ea-43d8-a113-1b9dbddd1f39' where code ilike 'B027';
update branches set "hrisId" = 'dbb68f32-545f-46b5-af46-9273b5cad57f' where code ilike 'B028';
update branches set "hrisId" = '261277f4-9b5c-497d-9362-535a80e061f5' where code ilike 'B029';
update branches set "hrisId" = 'fcd8c0c8-0403-44d2-bb22-d86927380dae' where code ilike 'B030';
update branches set "hrisId" = '4d0cd82d-f0cc-4773-a262-d1ad47270a2f' where code ilike 'B031';
update branches set "hrisId" = '05f86b04-4d09-47e8-8ab6-a4fa6766eaf6' where code ilike 'B032';
update branches set "hrisId" = '1b0df50c-c981-4f4f-9617-f1f3423f3480' where code ilike 'B033';
update branches set "hrisId" = 'cc394f2a-dba9-484f-96bb-b4f0222c0a82' where code ilike 'B034';
update branches set "hrisId" = 'a61a3b8d-ef8d-49c6-8df9-78db92d26a80' where code ilike 'B035';
update branches set "hrisId" = '7057662a-edfa-47f3-8eb9-e79346302543' where code ilike 'B036';
update branches set "hrisId" = '834105a3-ac00-43e8-a6f1-04208dfaad3a' where code ilike 'B037';
update branches set "hrisId" = 'd69dda60-5226-4601-9d21-25c31b2f9a00' where code ilike 'B038';
update branches set "hrisId" = 'a815dd5a-f965-4edc-ac8e-2942416fec2a' where code ilike 'B039';
update branches set "hrisId" = 'ae4569ac-3349-43b1-a273-c4e95968823f' where code ilike 'B040';
update branches set "hrisId" = '039f0230-fc39-4eac-b942-33d173ac979b' where code ilike 'B041';
update branches set "hrisId" = '830baecd-4b74-467f-9a65-1c643a7a2f1f' where code ilike 'B042';
update branches set "hrisId" = 'f4e63fcc-32bf-4c82-b25f-2d24011afad9' where code ilike 'B043';
update branches set "hrisId" = '1cbbfbd7-8e37-46fb-8412-7f0b376df885' where code ilike 'B044';
update branches set "hrisId" = 'c4e55fc2-74ec-4c52-b027-cac72217a029' where code ilike 'B045';
update branches set "hrisId" = '8a7bd7b6-8e9a-46fa-b0b8-8a3ce21d0558' where code ilike 'B046';
update branches set "hrisId" = '27e3cfb0-06b9-45c6-9911-1c90153e4532' where code ilike 'B047';
update branches set "hrisId" = 'a041a6b2-55dc-429f-b44d-310bcf133d0b' where code ilike 'B048';
update branches set "hrisId" = 'e5505d4b-b5d9-4245-a0db-a631f6810dc1' where code ilike 'B049';
update branches set "hrisId" = 'eb11c8f8-4556-4a8c-a8e2-0af7090f4542' where code ilike 'B050';
update branches set "hrisId" = 'cfca9907-49c0-4636-b99d-7cca97964a04' where code ilike 'B051';
update branches set "hrisId" = 'fd64c01f-93ee-4f7f-852d-0fc56999ed80' where code ilike 'B052';
update branches set "hrisId" = '7e892838-7d57-4cbc-9d38-065fec1c00ce' where code ilike 'B053';
update branches set "hrisId" = 'd1038049-c38a-4ef6-bfdc-7b96522ceef0' where code ilike 'B054';
update branches set "hrisId" = '840ff15e-2b50-444f-b1fd-0870836731e7' where code ilike 'B055';
update branches set "hrisId" = 'dcc86d29-74eb-4d28-82a4-5bc3b6f3cf8f' where code ilike 'B056';
update branches set "hrisId" = 'f715d612-82f8-4ca4-8cf0-c908d9d65afd' where code ilike 'B057';
update branches set "hrisId" = '5f91cdc6-229f-4367-827b-d71c3e07bbc7' where code ilike 'B058';
update branches set "hrisId" = 'a33d2b37-02e7-42c3-b8bc-ff9f71231553' where code ilike 'B059';
update branches set "hrisId" = '5a67e2f5-e40e-416c-8858-7aa2d4a29dc1' where code ilike 'B060';
update branches set "hrisId" = 'f14cede2-d320-47b8-8381-24b096db568e' where code ilike 'B061';
update branches set "hrisId" = 'b842d6e0-981a-4ef9-8ead-507c78fdaccd' where code ilike 'B062';
update branches set "hrisId" = '87520cd4-b625-4710-b749-38dbb5ab14f3' where code ilike 'B063';
update branches set "hrisId" = 'c2ea15f9-1689-4edb-b8ab-712f26835e9d' where code ilike 'B064';
update branches set "hrisId" = 'a359807d-af75-4b83-9a34-435bc787438c' where code ilike 'B065';
update branches set "hrisId" = 'be2aa5fd-3a5a-47fb-929c-87d58406beb1' where code ilike 'B066';
update branches set "hrisId" = '1bbfba42-e6c1-4a8d-8aff-774a0d082036' where code ilike 'B067';
update branches set "hrisId" = '58ab8298-91bb-4825-91dd-a0db292c3a76' where code ilike 'B068';
update branches set "hrisId" = '8f21a895-e96e-4b95-a791-3f15042318eb' where code ilike 'B069';
update branches set "hrisId" = 'a6bf88a1-3712-4454-8566-4ab0dd553ca6' where code ilike 'B070';
update branches set "hrisId" = 'a2ab20c7-e048-42c2-a035-c4f1b27587bb' where code ilike 'B071';
update branches set "hrisId" = '229744ee-a555-4a79-8692-859803a1af93' where code ilike 'B072';
update branches set "hrisId" = 'f131a435-20ad-4628-9d10-38cfa6bf516b' where code ilike 'B073';
update branches set "hrisId" = 'fb43e0fe-0f14-4dad-a8ef-58bc1c2200a0' where code ilike 'B074';
update branches set "hrisId" = '22c7f9e6-2736-426b-94dc-b5021e54012d' where code ilike 'B075';
update branches set "hrisId" = 'a0bebf65-5397-4992-949f-1de609cf2e45' where code ilike 'B076';
update branches set "hrisId" = 'ec3233be-52ad-434b-89fe-b7a4bda44339' where code ilike 'B077';
update branches set "hrisId" = 'c2e27c73-9b69-4d41-951c-9676a1f83562' where code ilike 'B078';
update branches set "hrisId" = 'fe675bae-8f60-43ba-a7e5-c585fd821f54' where code ilike 'B079';
update branches set "hrisId" = 'a8fc6d2b-9612-42cd-b78f-ab7c0a02e37f' where code ilike 'B080';
update branches set "hrisId" = '717ab33b-43b7-4649-b64a-3aa92f386aff' where code ilike 'B081';
update branches set "hrisId" = 'ecb65f79-03c0-4c8f-bb5b-e45f5bff0cb5' where code ilike 'B082';
update branches set "hrisId" = '394c2ae5-a0bc-4fae-8c2f-60837789c37a' where code ilike 'B083';
update branches set "hrisId" = 'da088813-1ae6-42a2-b143-3b2f681ce7b5' where code ilike 'B084';
update branches set "hrisId" = 'd85ab523-56e5-4f94-b7d2-358cbd23b22d' where code ilike 'B085';
update branches set "hrisId" = 'bc0081c6-80f1-4384-a2a2-4817b588abad' where code ilike 'B086';
update branches set "hrisId" = '53492123-7e6c-4efa-8c08-944016c7e52a' where code ilike 'B087';
update branches set "hrisId" = 'c8db79ff-bf7f-4b93-9881-9f0bf6aaba55' where code ilike 'B088';
update branches set "hrisId" = '65b9493a-a180-468a-835a-20868eade373' where code ilike 'B089';
update branches set "hrisId" = 'ecacd503-492d-4f23-b3da-d1881cd879ed' where code ilike 'B090';
update branches set "hrisId" = '31271e5a-e17b-4f77-a5c3-6971fb41c914' where code ilike 'B091';
update branches set "hrisId" = '671f5941-ae9c-4609-aac3-6b851eaa09c6' where code ilike 'B092';
update branches set "hrisId" = '4d05ff71-8bce-477b-8991-9dcb08d5d0ea' where code ilike 'B093';
update branches set "hrisId" = '7af19565-333f-4a37-b953-5af5f74ddefd' where code ilike 'B094';
update branches set "hrisId" = '54222a46-a415-496a-8d89-1fb52302d69f' where code ilike 'B095';
update branches set "hrisId" = '783056f5-bc5b-4ed4-b0b4-eda59fd525c3' where code ilike 'B096';
update branches set "hrisId" = '787e26c9-3599-401e-8d71-3060b8ed5212' where code ilike 'B097';
update branches set "hrisId" = 'abc1819e-55cb-44f1-bfbb-3f9e2ae3c259' where code ilike 'B098';
update branches set "hrisId" = '8ba2919c-6f60-42b5-8cdf-457db0dacbd1' where code ilike 'B099';


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


-- update regions
update regions set "hrisId" = '72ebd111-8e80-4b43-8b78-7e37160b37ae' where name ilike 'BICOL REGION I (ALBAY)';
update regions set "hrisId" = '798c16a1-026d-4bcd-91de-9face5447dd6' where name ilike ' BICOL REGION II (CAMARINES SUR)';
update regions set "hrisId" = '957ca5b2-e91a-41d9-90e3-d39b060d3133' where name ilike 'CALABARZON REGION ';
update regions set "hrisId" = '7f1af434-f493-45af-8b33-e8240cfb71c5' where name ilike 'CARAGA ';
update regions set "hrisId" = '0aa1c05b-1c7b-4f45-9e35-944c3373a093' where name ilike 'CENTRAL LUZON II';
update regions set "hrisId" = 'cc32b7ed-61a5-4249-833e-0db4b124a005' where name ilike 'CENTRAL LUZON I';
update regions set "hrisId" = '41c07e4c-a384-4469-8af7-b637ef299465' where name ilike ' CENTRAL VISAYAS I - REGION VII';
update regions set "hrisId" = '7e50004c-a8a5-4768-80ad-af3ba9760b8e' where name ilike 'CENTRAL VISAYAS II';
update regions set "hrisId" = '853eb555-f399-4caf-a382-fc730a21a4de' where name ilike 'NCR I ';
update regions set "hrisId" = '27041683-3430-4a69-a377-855ffbef8e42' where name ilike 'NCR II';
update regions set "hrisId" = 'f61bea74-ad2c-4c9a-93e1-083b5df8f4f8' where name ilike 'NCR III ';
update regions set "hrisId" = 'ca2063a0-7010-46d8-b811-50683d507fd2' where name ilike 'ZAMBOANGA PENINSULA';
update regions set "hrisId" = '0e29ff03-83db-46ff-8df1-5fbc15018dce' where name ilike 'NORTHERN MINDANAO';
update regions set "hrisId" = 'bc68ffc6-a1d7-447b-94eb-d348083c2d77' where name ilike 'REGIONAL MAIN OFFICE';
update regions set "hrisId" = '49e2989b-a81d-4183-b382-16e75c513ce5' where name ilike 'WESTERN VISAYAS ';
update regions set "hrisId" = '88655427-c3e2-4ea7-a3b7-db3ec1835ef0' where name ilike 'WESTERN VISAYAS II';


-- update divisions
update divisions set "hrisId" = 'abe3bcbd-2f5c-4e1e-b12b-46ffeca7fc8c' where name ilike 'MAIN OFFICE';
update divisions set "hrisId" = '77bd73f7-10e3-4766-a74c-9f4cde65eda8' where name ilike 'DIVISION I';
update divisions set "hrisId" = '40b70b11-f891-42b4-8123-546c3aba49b8' where name ilike 'DIVISION II';
update divisions set "hrisId" = '44cef068-44be-477d-82a0-be5b8c37f125' where name ilike 'DIVISION III';
update divisions set "hrisId" = '63b8caac-f5ef-4dac-b3c4-a5d3bea70b5b' where name ilike 'DIVISION IV';
update divisions set "hrisId" = 'fd9e60f0-f9b2-47af-8306-db9660145e5d' where name ilike 'DIVISION V';
update divisions set "hrisId" = '6e1ae376-3fd0-41f6-a5ef-41e4ab3db6fc' where name ilike 'DIVISION VI';
update divisions set "hrisId" = 'd73591fd-6e7e-4710-9508-467a7b9f9f9d' where name ilike 'DIVISION VII';
update divisions set "hrisId" = '71b25671-32b7-4716-a378-e00cb5881d65' where name ilike 'DIVISION VIII';
