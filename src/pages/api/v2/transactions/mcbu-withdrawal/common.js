import { createGraphType } from "@/lib/graph/graph.util";
import { MCBU_WITHDRAWAL_FIELDS } from "@/lib/graph.fields";

export const createMcbuWithdrawalsTypes = (fields = MCBU_WITHDRAWAL_FIELDS) =>
  createGraphType("mcbu_withdrawals", fields)();

// Admin level fields
export const adminFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  division { _id, name }
  region { _id, name }
  area { _id, name }
  branch { _id, name }
  loanOfficer { _id, firstName, lastName }
  group { _id, name }
  client { _id, name:fullName }
`;

// Division level fields
export const divisionFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  region { _id, name }
  area { _id, name }
  branch { _id, name }
  loanOfficer { _id, firstName, lastName }
  group { _id, name }
  client { _id, name:fullName }
`;

// Region level fields
export const regionFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  area { _id, name }
  branch { _id, name }
  loanOfficer { _id, firstName, lastName }
  group { _id, name }
  client { _id, name:fullName }
`;

// Area level fields
export const areaFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  branch { _id, name }
  loanOfficer { _id, firstName, lastName }
  group { _id, name }
  client { _id, name:fullName }
`;

// Branch level fields
export const branchFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  loanOfficer { _id, firstName, lastName }
  group { _id, name }
  client { _id, name:fullName }
`;

// Loan officer level fields
export const loanOfficerFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  group { _id, name }
  client { _id, name:fullName }
`;

// Group level fields
export const groupFields = `
  ${MCBU_WITHDRAWAL_FIELDS}
  client { _id, name:fullName }
`;

// Default/backward compatibility
export const mcbuWithdrawalList = adminFields;

export function toMcbuWithdrawalDto(rowData) {
  const { division, region, area, branch, loanOfficer, group, client, ...data } = rowData ?? {};

  return {
    ...data,
    division: division ? [division] : [],
    region: region ? [region] : [],
    area: area ? [area] : [],
    branch: branch ? [branch] : [],
    loanOfficer: loanOfficer ? [loanOfficer] : [],
    group: group ? [group] : [],
    client: client ? [client] : [],
  };
}