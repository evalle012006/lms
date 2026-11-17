-- Safety net: an ACTIVE client must have a group and LO.
-- Code paths that approve loans now assign them (src/lib/client-assignment.js), but the v1 routes,
-- the mobile app, scripts and direct Hasura writes can still activate a client without one.
-- This trigger fills the gap from the client's current loan. It raises a LOG line every time it
-- heals a row: grep the Postgres log for 'client_fill_assignment' and treat any hit as a code bug.
-- Test on staging first.

CREATE OR REPLACE FUNCTION client_fill_assignment() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE g text; lo text; gn text; br text;
BEGIN
  IF NEW.status = 'active' AND (NEW."groupId" IS NULL OR NEW."loId" IS NULL) THEN
    SELECT l."groupId", l."loId", l."groupName", l."branchId" INTO g, lo, gn, br
    FROM loans l
    WHERE l."clientId" = NEW._id
      AND l.status IN ('active', 'completed')
      AND l."loanCycle" <> 0
    ORDER BY (l.status = 'active') DESC, l."dateGranted" DESC NULLS LAST
    LIMIT 1;

    IF FOUND THEN
      NEW."groupId"   := COALESCE(NEW."groupId", g);
      NEW."loId"      := COALESCE(NEW."loId", lo);
      NEW."groupName" := COALESCE(NEW."groupName", gn);
      NEW."branchId"  := COALESCE(NEW."branchId", br);
      RAISE LOG 'client_fill_assignment healed client % (no group/LO on activate)', NEW._id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_client_fill_assignment ON client;
CREATE TRIGGER trg_client_fill_assignment
BEFORE INSERT OR UPDATE ON client
FOR EACH ROW EXECUTE FUNCTION client_fill_assignment();

-- Monitoring: must return 0.
-- select count(*) from client c where c.status='active' and c."groupId" is null
--   and exists (select 1 from loans l where l."clientId"=c._id
--               and l.status in ('active','completed') and l."loanCycle"<>0);
