-- 014_group_slots_ignore_departed_clients.sql
-- Fix: refresh_group_slots (011/013) counted every 'completed' loan as holding a slot, even when the client
-- had already left the group. On offset the app clears client."groupId" and releases the slot, but the
-- loan stays 'completed' with its old groupId, so the next recompute took the slot back
-- (availableSlots gone, status flipped to 'full', manual fixes by support wiped).
--
-- A loan now holds a slot only if:
--   * status is 'active' or 'pending', OR
--   * status is 'completed' AND the client is still assigned to this group (can still reloan).
-- Also refreshes the group when a client's groupId changes (offset / transfer), so group and client stay in step.
-- Supersedes the function body from 013. Safe to re-run.

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

  WITH held AS (
    SELECT l."clientId" AS client_id, l."slotNo"::int AS slot_no
    FROM loans l
    LEFT JOIN client c ON c._id = l."clientId"
    WHERE l."groupId" = gid
      AND (l.status IN ('active', 'pending')
           OR (l.status = 'completed' AND c."groupId" = gid))
  )
  SELECT
    (SELECT count(DISTINCT client_id) FROM held),
    COALESCE((SELECT jsonb_agg(gs.n ORDER BY gs.n)
              FROM generate_series(1, COALESCE(cap::int, 40)) AS gs(n)
              WHERE NOT EXISTS (SELECT 1 FROM held h WHERE h.slot_no = gs.n)), '[]'::jsonb)
  INTO cnt, slots;

  st := CASE WHEN cap IS NOT NULL AND cnt >= cap THEN 'full' ELSE 'available' END;

  UPDATE groups g
  SET "noOfClients" = cnt, "availableSlots" = slots, status = st
  WHERE g._id = gid
    AND (g."noOfClients" IS DISTINCT FROM cnt
      OR g."availableSlots" IS DISTINCT FROM slots
      OR g.status IS DISTINCT FROM st);
END $$;

CREATE OR REPLACE FUNCTION trg_client_refresh_group() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_group_slots(OLD."groupId");
  PERFORM refresh_group_slots(NEW."groupId");
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_client_refresh_group_upd ON client;
CREATE TRIGGER trg_client_refresh_group_upd AFTER UPDATE OF "groupId" ON client
  FOR EACH ROW
  WHEN (OLD."groupId" IS DISTINCT FROM NEW."groupId")
  EXECUTE FUNCTION trg_client_refresh_group();

-- Re-sync every group. A DO block runs to completion on the server; a bare
-- SELECT refresh_group_slots(_id) FROM groups only runs for the rows the SQL client fetches.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT _id FROM groups LOOP
    PERFORM refresh_group_slots(r._id);
  END LOOP;
END $$;
