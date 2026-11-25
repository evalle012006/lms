-- Validates 'completed' loans whose client is assigned to a different group than the loan (not offset).
-- Under 014 these loans no longer hold a slot in the loan's group. Verdict per row:
--   TRANSFERRED_OK    -> an approved transfer moved the client out of this group; nothing to fix.
--   NO_TRANSFER_FOUND -> no transfer record; client's groupId was changed by hand/script. Review.
--   TRANSFER_PENDING  -> a transfer exists but is not approved yet. Review.
SELECT
  l._id               AS loan_id,
  l."clientId",
  l."groupId"         AS loan_group,
  l."slotNo",
  c."groupId"         AS client_group,
  c.status            AS client_status,
  t._id               AS transfer_id,
  t.status            AS transfer_status,
  t."approveRejectDate",
  CASE
    WHEN t._id IS NULL                    THEN 'NO_TRANSFER_FOUND'
    WHEN t.status = 'approved'            THEN 'TRANSFERRED_OK'
    ELSE 'TRANSFER_PENDING'
  END AS verdict
FROM loans l
JOIN client c ON c._id = l."clientId"
LEFT JOIN LATERAL (
  SELECT tc.* FROM "transferClients" tc
  WHERE tc."selectedClientId" = l."clientId"
    AND tc."sourceGroupId" = l."groupId"
    AND tc."targetGroupId" = c."groupId"
  ORDER BY tc."approveRejectDate" DESC NULLS LAST, tc."dateAdded" DESC
  LIMIT 1
) t ON true
WHERE l.status = 'completed'
  AND c."groupId" IS DISTINCT FROM l."groupId"
  AND c.status <> 'offset'
ORDER BY verdict DESC, l."groupId";
