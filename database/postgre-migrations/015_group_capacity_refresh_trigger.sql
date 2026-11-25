-- 015_group_capacity_refresh_trigger.sql
-- Fix: changing groups.capacity (Hasura console, admin/groups UI, scripts) did not recompute
-- availableSlots / status, so a group could stay 'full' or lose its new slots until some later loan event
-- rebuilt them. Now any change to capacity re-runs refresh_group_slots (014) for that group, so the
-- result no longer depends on which route made the edit.
-- Not recursive: refresh_group_slots only sets noOfClients / availableSlots / status, never capacity.
-- Requires 011 + 014. Safe to re-run.

CREATE OR REPLACE FUNCTION trg_groups_capacity_refresh() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM refresh_group_slots(NEW._id);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_groups_capacity_refresh_upd ON groups;
CREATE TRIGGER trg_groups_capacity_refresh_upd AFTER UPDATE OF capacity ON groups
  FOR EACH ROW
  WHEN (OLD.capacity IS DISTINCT FROM NEW.capacity)
  EXECUTE FUNCTION trg_groups_capacity_refresh();
