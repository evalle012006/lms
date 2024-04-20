import { apiHandler } from "@/services/api-handler";
import { getCurrentDate } from "@/lib/utils";
import moment from "moment";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl, updateQl } from '@/lib/graph/graph.util'
import { LOAN_FIELDS } from '@/lib/graph.fields'
import { createBadDebtCollectionsType } from '@/pages/api/v2/other-transactions/badDebtCollection/common'

const graph = new GraphProvider();
const loanType = createGraphType("loans", LOAN_FIELDS)();

export default apiHandler({
  post: save,
});

async function save(req, res) {
  const formData = req.body;
  const loan = await findMaturedLoan(formData.loanId);

  if (loan) {
    const maturedPD = formData.maturedPastDue - formData.paymentCollection;
    loan.maturedPastDue = maturedPD;
    if (loan.noBadDebtPayment) {
      loan.noBadDebtPayment += 1;
    } else {
      loan.noBadDebtPayment = 1;
    }

    if (maturedPD <= 0) {
      loan.maturedPastDue = 0;
    }

    delete loan._id;

    const operations = [
      updateQl(loanType, {
        where: { _id: { _eq: formData.loanId } },
        set: loan,
      }),
      insertQl(createBadDebtCollectionsType(), {
        objects: [{
          ...formData,
          maturedPastDue: maturedPD,
          dateAdded: moment(getCurrentDate()).format("YYYY-MM-DD"),
        }]
      })
    ];

    const { data } = await graph.mutation(...operations);

    res.send({
      success: true,
      data: data?.badDebtCollections?.returning?.[0],
    });
  } else {
    res.send({
      error: true,
      message: "No matured loan detected for this client!",
    });
  }
}

async function findMaturedLoan(loanId) {
  const res = await graph.query(
    queryQl(loanType, {
      where: {
        _id: { _eq: loanId },
        maturedPD: { _eq: true },
      },
    })
  );
  return res.data?.loans?.[0];
}
