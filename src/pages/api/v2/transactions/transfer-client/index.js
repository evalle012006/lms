import { apiHandler } from "@/services/api-handler";
import {
  createGraphType,
  insertQl,
  queryQl,
  updateQl,
} from "@/lib/graph/graph.util";
import {
  BRANCH_FIELDS,
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
  USER_FIELDS,
} from "@/lib/graph.fields";
import { GraphProvider } from "@/lib/graph/graph.provider";
import {
  findBranches,
  findTransferClients,
  findUsers,
} from "@/lib/graph.functions";

const transferClientsType = createGraphType(
  "transferClients",
  `${TRANSFER_CLIENT_FIELDS}
   client {${CLIENT_FIELDS}}
   loan {${LOAN_FIELDS}}
   sourceBranch {${BRANCH_FIELDS}}
   sourceGroup {${GROUP_FIELDS}}
   sourceUser {${USER_FIELDS}}
   targetBranch {${BRANCH_FIELDS}}
   targetGroup {${GROUP_FIELDS}}
   targetUser {${USER_FIELDS}}
  `
)();

const graph = new GraphProvider();

export default apiHandler({
  post: saveUpdate,
  get: getList,
});

async function saveUpdate(req, res) {
  let response;
  const clientData = req.body;

  if (clientData?._id) {
    const transferId = clientData._id;
    await graph.mutation(
      updateQl(transferClientsType, {
        where: { _id: { _eq: transferId } },
        set: {
          ...clientData,
          insertedDateTime: new Date(),
        },
      })
    );
    response = { success: true };
  } else {
    const exist = await findTransferClients({
      selectedClientId: { _eq: clientData.selectedClientId },
      status: { _eq: "pending" },
    });

    if (exist.length === 0) {
      await graph.mutation(
        insertQl(transferClientsType, {
          objects: [{ ...clientData, modifiedDateTime: new Date() }],
        })
      );
      response = { success: true };
    } else {
      response = {
        error: true,
        message: "Client has an existing pending transfer.",
      };
    }
  }

  res.send(response);
}

const responseMapper = (row) => ({
  ...row,
  loans: [row.loan],
});

async function getList(req, res) {
  const { _id, branchId } = req.query;

  let response;

  if (_id) {
    const user = await findUsers({ id: { _eq: _id } });
    if (user.length > 0) {
      let branchIds = [];
      if (user[0].areaId && user[0].role.shortCode === "area_admin") {
        const branches = await findBranches(
          { areaId: { _eq: user[0].areaId } },
          "_id"
        );
        branchIds = branches.map((branch) => branch._id.toString());
      } else if (
        user[0].regionId &&
        user[0].role.shortCode === "regional_manager"
      ) {
        const branches = await findBranches(
          { regionId: { _eq: user[0].regionId } },
          "_id"
        );
        branchIds = branches.map((branch) => branch._id.toString());
      } else if (
        user[0].divisionId &&
        user[0].role.shortCode === "deputy_director"
      ) {
        const branches = await findBranches(
          { divisionId: { _eq: user[0].divisionId } },
          "_id"
        );
        branchIds = branches.map((branch) => branch._id.toString());
      }

      const transferClients =
        (
          await graph.query(
            queryQl(transferClientsType, {
              where: {
                status: { _eq: "pending" },
                sourceBranchId: { _in: branchIds },
              },
            })
          )
        ).data?.transferClients?.map(responseMapper()) ?? [];

      response = { success: true, data: transferClients };
    } else {
      response = { error: true, message: "No data found." };
    }
  } else if (branchId) {
    const transferClients =
      (
        await graph.query(
          queryQl(transferClientsType, {
            where: {
              status: { _eq: "pending" },
              sourceBranchId: { _eq: branchId },
            },
          })
        )
      ).data?.transferClients?.map(responseMapper()) ?? [];

    response = { success: true, data: transferClients };
  } else {
    const transferClients =
      (
        await graph.query(
          queryQl(transferClientsType, {
            where: { status: { _eq: "pending" } },
          })
        )
      ).data?.transferClients?.map(responseMapper()) ?? [];

    response = { success: true, data: transferClients };
  }

  res.send(response);
}
