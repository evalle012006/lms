CREATE TABLE IF NOT EXISTS client_face_enrollments (
  _id                text PRIMARY KEY,
  client_id          text NOT NULL,
  version            integer NOT NULL,
  status             text NOT NULL CHECK (status IN ('active','superseded')),
  source             text NOT NULL,  -- 'original' | 'disbursement_first' | 'disbursement_recapture'
  face_template      text,
  photo_key          text,
  liveness_score     numeric,
  enrolled_at        timestamptz,
  reason             text,
  trigger_attempt_id text,
  loan_id            text,
  branch_id          text,
  captured_by        text,
  approved_by        text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  superseded_at      timestamptz,
  UNIQUE (client_id, version)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cfe_one_active
  ON client_face_enrollments (client_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_cfe_client_loan
  ON client_face_enrollments (client_id, loan_id, source);

ALTER TABLE face_verify_attempts ADD COLUMN IF NOT EXISTS enrollment_id text;
CREATE INDEX IF NOT EXISTS idx_fva_client_captured ON face_verify_attempts (client_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_fva_loan ON face_verify_attempts (loan_id);

ALTER TABLE audit_logs ADD COLUMN IF NOT EXISTS "clientId" varchar;

UPDATE audit_logs SET "clientId" = "entityId"
  WHERE "entityType" = 'client' AND "clientId" IS NULL;
UPDATE audit_logs SET "clientId" = metadata->>'clientId'
  WHERE "clientId" IS NULL AND metadata ? 'clientId';
UPDATE audit_logs a SET "clientId" = l."clientId"
  FROM loans l
  WHERE a."clientId" IS NULL AND a."entityId" = l."_id" AND l."clientId" IS NOT NULL;
UPDATE audit_logs a SET "clientId" = COALESCE(t."promotedClientId", t."existingClientId")
  FROM "temporaryLoanApplications" t
  WHERE a."clientId" IS NULL AND a."entityId" = t."_id"
    AND COALESCE(t."promotedClientId", t."existingClientId") IS NOT NULL;
UPDATE audit_logs a SET "clientId" = COALESCE(t."promotedClientId", t."existingClientId")
  FROM "temporaryLoanApplications" t
  WHERE a."clientId" IS NULL AND a.metadata->>'ciReferenceCode' = t."ciReferenceCode"
    AND COALESCE(t."promotedClientId", t."existingClientId") IS NOT NULL;

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

DROP TRIGGER IF EXISTS trg_audit_logs_fill_client_id ON audit_logs;
CREATE TRIGGER trg_audit_logs_fill_client_id
  BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION audit_logs_fill_client_id();