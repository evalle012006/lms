-- 011_group_slots_trigger.sql
-- Keeps groups."noOfClients", groups."availableSlots" and groups.status in step with the loans table, so the
-- 'update-group-clients' Hasura cron is no longer needed. Same rules the cron used:
--   noOfClients    = loans of the group with status active / pending / completed
--   availableSlots = slots 1..capacity (40 if capacity is null) not used by those loans
--   status         = 'full' when noOfClients >= capacity, else 'available'
-- Only writes to groups when something actually changed.
-- Test on staging first. Deploy order: run this, verify, THEN delete the 'update-group-clients' Hasura cron trigger.

CREATE OR REPLACE FUNCTION refresh_group_slots(gid text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  cnt   integer;
  cap   numeric;
  slots jsonb;
  st    text;
BEGIN
  IF gid IS NULL THEN RETURN; END IF;

  SELECT capacity INTO cap FROM groups WHERE _id = gid;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT count(*) INTO cnt
  FROM loans l
  WHERE l."groupId" = gid AND l.status IN ('active', 'pending', 'completed');

  SELECT COALESCE(jsonb_agg(s ORDER BY s), '[]'::jsonb) INTO slots
  FROM generate_series(1, COALESCE(cap::int, 40)) AS s
  WHERE NOT EXISTS (
    SELECT 1 FROM loans l
    WHERE l."groupId" = gid AND l.status IN ('active', 'pending', 'completed') AND l."slotNo" = s
  );

  st := CASE WHEN cap IS NOT NULL AND cnt >= cap THEN 'full' ELSE 'available' END;

  UPDATE groups g
  SET "noOfClients" = cnt, "availableSlots" = slots, status = st
  WHERE g._id = gid
    AND (g."noOfClients" IS DISTINCT FROM cnt
      OR g."availableSlots" IS DISTINCT FROM slots
      OR g.status IS DISTINCT FROM st);
END $$;

CREATE OR REPLACE FUNCTION trg_loans_refresh_group() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_group_slots(OLD."groupId");
  ELSE
    PERFORM refresh_group_slots(NEW."groupId");
    IF TG_OP = 'UPDATE' AND OLD."groupId" IS DISTINCT FROM NEW."groupId" THEN
      PERFORM refresh_group_slots(OLD."groupId");
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_loans_refresh_group_ins ON loans;
CREATE TRIGGER trg_loans_refresh_group_ins AFTER INSERT ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_loans_refresh_group();

DROP TRIGGER IF EXISTS trg_loans_refresh_group_upd ON loans;
CREATE TRIGGER trg_loans_refresh_group_upd AFTER UPDATE OF status, "groupId", "slotNo" ON loans
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status
     OR OLD."groupId" IS DISTINCT FROM NEW."groupId"
     OR OLD."slotNo" IS DISTINCT FROM NEW."slotNo")
  EXECUTE FUNCTION trg_loans_refresh_group();

DROP TRIGGER IF EXISTS trg_loans_refresh_group_del ON loans;
CREATE TRIGGER trg_loans_refresh_group_del AFTER DELETE ON loans
  FOR EACH ROW EXECUTE FUNCTION trg_loans_refresh_group();

-- One-time backfill (what the cron did). Safe to re-run.
SELECT refresh_group_slots(_id) FROM groups;
