import { apiHandler } from "@/services/api-handler";
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { LOAN_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';

const loansType = createGraphType("loans", LOAN_FIELDS)();
const graph = new GraphProvider();

export default apiHandler({
  post: getLoan,
});

async function getLoan(req, res) {
  const { clientIdList } = req.body;
  const loanStatus = [];

  clientIdList.map(async (client) => {
    const loan = (await graph.query(queryQl(loansType, {
      where: {
        clientId: { _eq: client.coMaker }
      }
    })))?.data?.loans;

    if (loan) {
      const latestLoan = loan[loan.length - 1];
      loanStatus.push({
        clientId: latestLoan.clientId,
        status: latestLoan.status,
        slotNo: client.slotNo,
      });
    }
  });

  const response = { success: true, data: loanStatus };
  res.send(response);
}
