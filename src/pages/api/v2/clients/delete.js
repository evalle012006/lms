import { apiHandler } from "@/services/api-handler";
import { createGraphType, deleteQl, queryQl } from "@/lib/graph/graph.util";
import { GraphProvider } from "@/lib/graph/graph.provider";

const graph = new GraphProvider();
const LOAN_TYPE = createGraphType("loans", "_id")();
const CLIENT_TYPE = createGraphType("client", "_id")();

export default apiHandler({
  post: deleteUser,
});

async function deleteUser(req, res) {
  const { _id = null } = req.body;

  let statusCode = 200;
  let response = {};

  const [loan] = await graph.query(
    queryQl(LOAN_TYPE, {
      where: { 
        clientId: { _eq: _id },
        status: { _neq: 'reject' },
      },
      limit: 1,
    })
  ).then(res => res.data.loans);

  if (!!loan) {
    response = {
      error: true,
      fields: ["id"],
      message: `Error. Client has a loan already.`,
    };
  } else {
    const [client] = await graph
      .query(queryQl(CLIENT_TYPE, { where: { _id: { _eq: _id } } }))
      .then((res) => res.data.client);

    if (!!client) {
      await graph.mutation(
        deleteQl(CLIENT_TYPE, {
          _id: { _eq: _id },
        })
      );

      // TODO: need to cleanup the profile picture

      response = {
        success: true,
      };
    } else {
      response = {
        error: true,
        fields: ["id"],
        message: `Client with the id "${_id}" not exists`,
      };
    }
  }

  res
    .status(statusCode)
    .setHeader("Content-Type", "application/json")
    .end(JSON.stringify(response));
}
