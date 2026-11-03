CREATE OR REPLACE FUNCTION cascade_area_to_users() RETURNS trigger AS $$
BEGIN
  UPDATE users SET "regionId" = NEW."regionId", "divisionId" = NEW."divisionId"
  WHERE "areaId" = NEW."_id";
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_area_users_after
AFTER UPDATE OF "regionId", "divisionId" ON areas
FOR EACH ROW EXECUTE FUNCTION cascade_area_to_users();

CREATE OR REPLACE FUNCTION cascade_branch_to_users() RETURNS trigger AS $$
BEGIN
  UPDATE users SET "areaId" = NEW."areaId", "regionId" = NEW."regionId", "divisionId" = NEW."divisionId"
  WHERE "designatedBranchId" = NEW."_id";
  RETURN NULL;
END $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_branch_users_after
AFTER UPDATE OF "areaId", "regionId", "divisionId" ON branches
FOR EACH ROW EXECUTE FUNCTION cascade_branch_to_users();