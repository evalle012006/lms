import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, updateQl } from "@/lib/graph/graph.util";
import { findLoans } from "@/lib/graph.functions";

const graph = new GraphProvider();
const loansType = createGraphType('loans', '_id')();

export default apiHandler({
  post: syncLoans,
});

async function syncLoans(req, res) {
    const { clientId, coMaker, groupId } = req.body;
    const currentLoan = await findLoans({
      status: { _eq: "active" },
      clientId: { _eq: clientId },
    });
    
    const coMakerLoan = await findLoans({
      status: { _eq: "active" },
      slotNo: { _eq: coMaker },
      groupId: { _eq: groupId },
    });

    let response;
    if (currentLoan.length === 0 ) {
        response = { error: true, message: 'No Active Loan associated to this client.' };
    } else if (coMakerLoan.length === 0) {
        response = { error: true, message: 'Selected CoMaker does not exist.' };
    } else {
        let loan = currentLoan[0];
        const cmLoan = coMakerLoan[0];
        loan.coMaker = coMaker;
        loan.coMakerId = cmLoan.clientId;
        console.log(loan, cmLoan)

        const loanId = loan._id;
        delete loan._id;
        const resp = await graph.mutation(updateQl(loansType, {
          where: { _id: { _eq: loanId } },
          set: { ...loan }
        }));
        response = { success: true, response: resp };
    }

    res.send(response);
}