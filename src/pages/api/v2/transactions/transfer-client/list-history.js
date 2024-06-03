import { apiHandler } from "@/services/api-handler";
import {
  findBranches,
  findTransferClients,
  findUsers,
} from "@/lib/graph.functions";
import {
  CLIENT_FIELDS,
  GROUP_FIELDS,
  LOAN_FIELDS,
  TRANSFER_CLIENT_FIELDS,
} from "@/lib/graph.fields";

const transferFields = `
  ${TRANSFER_CLIENT_FIELDS}
  client {${CLIENT_FIELDS}}
  loan {${LOAN_FIELDS}}
  sourceGroup {${GROUP_FIELDS}}
  targetGroup {${GROUP_FIELDS}}
`;

export default apiHandler({
  get: getList,
});

let statusCode = 200;
let response = {};

async function getList(req, res) {
    const { _id } = req.query;

    if (_id) {
        const user = await findUsers({ _id: { _eq: _id } });
        if (user.length > 0) {
            let branchIds = [];
            if (user[0].areaId && user[0].role.shortCode === 'area_admin') {
                const branches = await findBranches({ areaId: { _eq: user[0].areaId } });
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].regionId && user[0].role.shortCode === 'regional_manager') {
                const branches = await findBranches({ regionId: { _eq: user[0].regionId } });
                branchIds = branches.map(branch => branch._id.toString());
            } else if (user[0].divisionId && user[0].role.shortCode === 'deputy_director') {
                const branches = await findBranches({ divisionId: { _eq: user[0].divisionId } });
                branchIds = branches.map(branch => branch._id.toString());
            }

            const transferClients = (await findTransferClients({
              status: { _eq: 'approved' },
              sourceBranchId: { _in: branchIds }
            }, transferFields))
              .map(tc => ({...tc, loans: [tc.loan] }));

            response = { success: true, data: transferClients };
            
        } else {
            response = { error: true, message: "No data found." };
        }
    } else {
        const transferClients = (await findTransferClients({ status: { _eq: 'approved'} }, transferFields))
          .map(tc => ({ ...tc, loans: [tc.loan] }));

        response = { success: true, data: transferClients };
    }

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}