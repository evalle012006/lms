import { createGraphType } from "@/lib/graph/graph.util";
import { BAD_DEBT_COLLECTIONS_FIELDS } from "@/lib/graph.fields";

export const createBadDebtCollectionsType = (fields = BAD_DEBT_COLLECTIONS_FIELDS) =>
  createGraphType("badDebtCollections", fields)();

export const fieldsForList = `
  ${BAD_DEBT_COLLECTIONS_FIELDS}
  client { _id, name:fullName }
  loanOfficer { _id, firstName, lastName }
  branch { _id, name }
  group { _id, name }
  loan { _id, pastDue }
  `;

export function toDto(rowData) {
  const { client, loanOfficer, branch, group, loan, ...data } = rowData ?? {};

  if (loan) {
    loan.pastDue = loan.pastDue ?? 0;
  }

  return {
    ...data,
    client: client ? [client] : [],
    lo: loanOfficer ? [loanOfficer] : [],
    branch: branch ? [branch] : [],
    group: group ? [group] : [],
    loan: loan ? [loan] : [],
  };
}