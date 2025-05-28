
import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, queryQl } from "@/lib/graph/graph.util";
import { apiHandler } from "@/services/api-handler";

export default apiHandler({
    get: getFundTransfers,
});

const graph = new GraphProvider();
const FUND_TRANSFER_TYPE = createGraphType('fund_transfer', `
    ${FUND_TRANSFER_FIELDS}
`)('results');

async function getFundTransfers(req, res) {
    const user = await findUserById(req.auth.sub);
    const { mode, status } = req.query;

    const status_condition = { status: { _eq: status ?? 'pending' }, deletedDate: { _is_null: true } };
    const branch_conditions = [];

    if(!!user.designatedBranchId) {
        branch_conditions.push({
            _id: { _eq: user.designatedBranchId }
        })
    }

    if(!!user.areaId) {
        branch_conditions.push({
            areaId: { _eq: user.areaId }
        })
    }

    if(!!user.divisionId) {
        branch_conditions.push({
            areaId: { _eq: user.divisionId }
        })
    }

    if(!!user.regionId) {
        branch_conditions.push({
            areaId: { _eq: user.regionId }
        })
    }

    let where = { ... status_condition };

    if (mode === 'due_to_main') {
        where = {
            ... status_condition,
            receiverBranch: {
                code: { _eq: "B000" }
            },
            giverBranch: {
                _and: branch_conditions
            }
        }
    }

    if (mode === 'branch_to_branch') {
        where = {
            ... status_condition,
            receiverBranch: {
                code: { _neq: "B000" }
            },
            giverBranch: {
                _and: branch_conditions
            }
        }
    }

    if (mode === 'padala') {
        where = {
            ... status_condition,
            giverBranch: {
                code: { _neq: "B000" }
            },
            receiverBranch: {
                _and: branch_conditions
            }
        }
    }

    const results = await graph.query(
        queryQl(FUND_TRANSFER_TYPE, {
            where
        })
    ).then(res => res.data.results ?? []);


    res.send({
        success: true,
        data: results,
      });

}

