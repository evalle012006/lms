import { insertOrUpdateBranch } from "@/pages/api/webhook/hris-webhook-handlers/branch";
import { insertOrUpdateArea } from "@/pages/api/webhook/hris-webhook-handlers/area";
import { insertOrUpdateRegion } from "@/pages/api/webhook/hris-webhook-handlers/region";
import { insertOrUpdateDivision } from "@/pages/api/webhook/hris-webhook-handlers/division";
import { insertEmployee, updateEmployee } from "@/pages/api/webhook/hris-webhook-handlers/employee";

/**
 * A Record of HRIS webhook handler functions for INSERT and UPDATE events per table.
 */
export const webhookHandlers = {
  branches: {
    INSERT: insertOrUpdateBranch,
    UPDATE: insertOrUpdateBranch,
  },
  areas: {
    INSERT: insertOrUpdateArea,
    UPDATE: insertOrUpdateArea,
  },
  regions: {
    INSERT: insertOrUpdateRegion,
    UPDATE: insertOrUpdateRegion,
  },
  divisions: {
    INSERT: insertOrUpdateDivision,
    UPDATE: insertOrUpdateDivision,
  },
  employees: {
    INSERT: insertEmployee,
    UPDATE: updateEmployee,
  },
};