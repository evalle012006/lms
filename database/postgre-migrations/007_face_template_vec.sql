-- 007_face_template_vec.sql — pgvector support for face duplicate detection.
-- Prerequisite: pgvector in the DB image (checked on staging: extension 0.8.6).
-- Same file for staging and production. Staging already had the column and the index (created by hand earlier),
-- so on staging those steps are no-ops; on production they create them. Both end up identical.
-- Deploy order: run this SQL -> track function fn_find_duplicate_faces in Hasura -> reload metadata -> deploy code.
-- The code fails soft when the function is missing, so deploying code first is also safe (checks are skipped).

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE client ADD COLUMN IF NOT EXISTS "faceTemplateVec" vector(128);

-- Safe parse: a malformed template yields NULL instead of aborting the write.
CREATE OR REPLACE FUNCTION client_face_vec_or_null(t text) RETURNS vector(128)
LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF t IS NULL OR t = '' THEN RETURN NULL; END IF;
  RETURN t::vector(128);
EXCEPTION WHEN others THEN
  RETURN NULL;
END $$;

-- Backfill FIRST, with the assignment trigger switched off for the duration:
-- trg_client_fill_assignment fires on every UPDATE of client and would otherwise also "heal"
-- group/LO on any active client it touches — a side effect this backfill must not have.
-- (Run inside one transaction; ALTER TABLE ... DISABLE TRIGGER is transactional.)
BEGIN;
ALTER TABLE client DISABLE TRIGGER trg_client_fill_assignment;
UPDATE client
   SET "faceTemplateVec" = client_face_vec_or_null("faceTemplate"::text)
 WHERE "faceTemplate" IS NOT NULL AND "faceTemplateVec" IS NULL;
ALTER TABLE client ENABLE TRIGGER trg_client_fill_assignment;
COMMIT;

-- Keep it in step from now on, so enroll-face / recapture-face need no change.
CREATE OR REPLACE FUNCTION client_sync_face_vec() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW."faceTemplateVec" := client_face_vec_or_null(NEW."faceTemplate"::text);
  IF NEW."faceTemplate" IS NOT NULL AND NEW."faceTemplate"::text <> '' AND NEW."faceTemplateVec" IS NULL THEN
    RAISE LOG 'client_sync_face_vec: unparseable faceTemplate for client %', NEW._id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_client_sync_face_vec ON client;
CREATE TRIGGER trg_client_sync_face_vec
  BEFORE INSERT OR UPDATE OF "faceTemplate" ON client
  FOR EACH ROW EXECUTE FUNCTION client_sync_face_vec();

-- Index: see 008_face_template_vec_idx.sql (CONCURRENTLY, so it must be its own file, outside any transaction).

-- Look-up used by the API. Track it in Hasura as a QUERY function (STABLE, returns SETOF client).
--   vec          JSON array text of 128 numbers
--   exclude_id   the client being enrolled (never matches itself)
--   max_distance same scale as FACE_MATCH_THRESHOLD (0.5)
-- The inner ORDER BY/LIMIT lets the HNSW index do the work; the distance and status filters run on those few rows.
CREATE OR REPLACE FUNCTION fn_find_duplicate_faces(
  vec text, exclude_id text, max_distance double precision DEFAULT 0.5, max_rows integer DEFAULT 5
) RETURNS SETOF client
LANGUAGE sql STABLE AS $$
  SELECT c.*
  FROM (
    SELECT * FROM client
    WHERE "faceTemplateVec" IS NOT NULL
    ORDER BY "faceTemplateVec" <-> vec::vector(128)
    LIMIT 50
  ) c
  WHERE c._id <> exclude_id
    AND COALESCE(c.status, '') NOT IN ('merged', 'archived')
    AND (c."faceTemplateVec" <-> vec::vector(128)) <= max_distance
  ORDER BY c."faceTemplateVec" <-> vec::vector(128)
  LIMIT max_rows
$$;
