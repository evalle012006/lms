-- Entity index (the backfill joins and the trigger both look up by entityId)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_entity ON audit_logs ("entityId");

-- Backfill: loan events
UPDATE audit_logs a SET "clientId" = l."clientId"
FROM loans l
WHERE a."clientId" IS NULL AND a."entityId" = l."_id" AND l."clientId" IS NOT NULL;

-- Backfill: LAF events (entityId = temporaryLoanApplications._id)
UPDATE audit_logs a SET "clientId" = COALESCE(t."promotedClientId", t."existingClientId")
FROM "temporaryLoanApplications" t
WHERE a."clientId" IS NULL AND a."entityId" = t."_id"
  AND COALESCE(t."promotedClientId", t."existingClientId") IS NOT NULL;

-- Backfill: anything carrying ciReferenceCode in metadata
UPDATE audit_logs a SET "clientId" = COALESCE(t."promotedClientId", t."existingClientId")
FROM "temporaryLoanApplications" t
WHERE a."clientId" IS NULL AND a.metadata->>'ciReferenceCode' = t."ciReferenceCode"
  AND COALESCE(t."promotedClientId", t."existingClientId") IS NOT NULL;

-- Safety net: new audit rows resolve clientId themselves, so no logAudit call site has to change
CREATE OR REPLACE FUNCTION audit_logs_fill_client_id() RETURNS trigger AS $$
BEGIN
  IF NEW."clientId" IS NULL AND NEW."entityId" IS NOT NULL THEN
    SELECT l."clientId" INTO NEW."clientId" FROM loans l WHERE l."_id" = NEW."entityId";
    IF NEW."clientId" IS NULL THEN
      SELECT COALESCE(t."promotedClientId", t."existingClientId") INTO NEW."clientId"
      FROM "temporaryLoanApplications" t WHERE t."_id" = NEW."entityId";
    END IF;
  END IF;
  IF NEW."clientId" IS NULL AND NEW.metadata ? 'ciReferenceCode' THEN
    SELECT COALESCE(t."promotedClientId", t."existingClientId") INTO NEW."clientId"
    FROM "temporaryLoanApplications" t
    WHERE t."ciReferenceCode" = NEW.metadata->>'ciReferenceCode' LIMIT 1;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_fill_client_id
  BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_fill_client_id();