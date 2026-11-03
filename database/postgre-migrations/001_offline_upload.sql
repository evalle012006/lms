-- 001_offline_upload.sql
-- LOR offline upload: audit tables + batch marker on cashCollections.
--
-- DEPLOY ORDER (matters, because CASH_COLLECTIONS_FIELDS will select "uploadBatchId"):
--   1. run this migration
--   2. reload Hasura metadata and TRACK both new tables
--   3. deploy the API / front-end code
-- The API uses the admin secret, so no role permissions are needed on the new tables.

-- 1. batch marker on the legacy table (camelCase, text ids)
ALTER TABLE "cashCollections" ADD COLUMN IF NOT EXISTS "uploadBatchId" text;

CREATE INDEX IF NOT EXISTS idx_cashcollections_upload_batch
    ON "cashCollections" ("uploadBatchId")
    WHERE "uploadBatchId" IS NOT NULL;

-- 2. one row per upload attempt that reached the commit step
CREATE TABLE IF NOT EXISTS cash_collection_uploads (
    _id                text PRIMARY KEY,
    group_id           text        NOT NULL,
    branch_id          text        NOT NULL,
    lo_id              text,
    occurence          text        NOT NULL,            -- daily | weekly
    date_added         date        NOT NULL,            -- the collection date the rows were posted to
    uploaded_by        text        NOT NULL,
    uploaded_by_name   text,
    uploaded_at        timestamptz NOT NULL DEFAULT now(),  -- real clock, not getSystemDate()
    file_name          text,
    file_hash          text        NOT NULL,            -- sha256 of the uploaded file
    template_version   text,
    reason             text        NOT NULL,            -- why the data was collected offline
    row_count          integer     NOT NULL DEFAULT 0,
    applied_count      integer     NOT NULL DEFAULT 0,
    skipped_count      integer     NOT NULL DEFAULT 0,
    status             text        NOT NULL DEFAULT 'applied',   -- applied | nothing_applied
    totals             jsonb                                -- payment / mcbu / csf sums of the applied rows
);

-- NOT unique on purpose: a file that had skipped rows may be re-uploaded after the cause is fixed.
-- "Same file fully applied already" is checked in code.
CREATE INDEX IF NOT EXISTS idx_cc_uploads_group_date
    ON cash_collection_uploads (group_id, date_added, file_hash);

-- 3. one row per template row, including the ones that were skipped
CREATE TABLE IF NOT EXISTS cash_collection_upload_rows (
    _id                 text PRIMARY KEY,
    upload_id           text        NOT NULL REFERENCES cash_collection_uploads (_id),
    cash_collection_id  text,
    loan_id             text        NOT NULL,
    client_id           text,
    slot_no             integer,
    action              text        NOT NULL,           -- inserted | updated | skipped
    skip_reason         text,
    before_data         jsonb,                          -- full previous cashCollections row (updates only)
    after_data          jsonb,                          -- what was written
    inserted_date       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cc_upload_rows_upload ON cash_collection_upload_rows (upload_id);
CREATE INDEX IF NOT EXISTS idx_cc_upload_rows_loan   ON cash_collection_upload_rows (loan_id);