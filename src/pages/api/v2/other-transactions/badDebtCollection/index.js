import { apiHandler } from "@/services/api-handler";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { queryQl, updateQl } from "@/lib/graph/graph.util";
import { createBadDebtCollectionsType } from "@/pages/api/v2/other-transactions/badDebtCollection/common";
import { BAD_DEBT_COLLECTIONS_FIELDS } from "@/lib/graph.fields";

const graph = new GraphProvider();

export default apiHandler({
  get: getData,
  post: updateData,
});

async function getData(req, res) {
  const { _id } = req.query;
  const fields = `
        ${BAD_DEBT_COLLECTIONS_FIELDS}
        client { _id, name:fullName }
        loanOfficer { _id, firstName, lastName }
        branch { _id, name }
        group { _id, name }
        loan { _id, pastDue }
    `;

  const { data: graphData } = await graph.query(
    queryQl(createBadDebtCollectionsType(fields), {
      where: { _id: { _eq: _id } },
    })
  );

  const { client, loanOfficer, branch, group, loan, ...data } =
    graphData.badDebtCollections?.[0] ?? {};

  if (loan) {
    loan.pastDue = loan.pastDue ?? 0;
  }

  res.send({
    success: true,
    data: {
      ...data,
      client: [client],
      lo: [loanOfficer],
      branch: [branch],
      group: [group],
      loan: [loan],
    },
  });
}

async function updateData(req, res) {
  const { _id, ...payload } = req.body;
  const { data } = await graph.mutation(
    updateQl(createBadDebtCollectionsType(), {
      set: payload,
      where: { _id: { _eq: _id } },
    })
  );
  res.send({ success: true, data: data?.returning?.badDebtCollections?.[0] });
}
