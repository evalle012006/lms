import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { GraphProvider } from '@/lib/graph/graph.provider';
import { LOAN_FIELDS } from '@/lib/graph.fields';

const loansType = createGraphType("loans", LOAN_FIELDS)();
const graph = new GraphProvider();

export default apiHandler({
  get: checkPNNumber,
});

async function checkPNNumber(req, res) {
  const { pnNumber, branchId } = req.query;

  const loans = (await graph.query(queryQl(loansType, {
    where: {
      branchId: { _eq: branchId },
      pnNumber: { _eq: pnNumber },
      status: { _eq: 'active' },
    }
  })))?.data?.loans;

  const message = (loans && loans.length > 0)
    ? "PN Number already in used."
    : null;


  const response = { success: true, loans: loans, message: message };
  res.send(response);
}
