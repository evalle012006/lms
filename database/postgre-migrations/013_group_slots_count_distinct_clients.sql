-- 013_group_slots_count_distinct_clients.sql
-- Fix: refresh_group_slots (011) counted every active/pending/completed loan as a client, so a client who
-- reloaned (old completed loan + new loan in the same group) took 2 of the capacity and the group flipped
-- back to 'full' early, even right after capacity was increased.
-- noOfClients is now the number of DISTINCT clients holding a loan in the group.
-- availableSlots logic is unchanged (by slotNo). Safe to re-run.

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

  SELECT count(DISTINCT l."clientId") INTO cnt
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

-- Re-sync every group with the corrected rule.
SELECT refresh_group_slots(_id) FROM groups;
