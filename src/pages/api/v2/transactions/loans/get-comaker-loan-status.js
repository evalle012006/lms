import { apiHandler } from "@/services/api-handler";
import { findLoans } from "@/lib/graph.functions";

export default apiHandler({
  post: getLoan,
});

async function getLoan(req, res) {
  const { clientIdList } = req.body;
  const loanStatus = [];

  clientIdList.map(async (client) => {
    const loan = await findLoans({
      clientId: { _eq: client.coMaker }
    });

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
