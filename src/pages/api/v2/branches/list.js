import { getCurrentDateV2 } from '@/lib/date-utils';
import { BRANCH_COH_FIELDS, BRANCH_FIELDS } from '@/lib/graph.fields';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';


const graph = new GraphProvider();

const addDatedAddedCondition = (date) => !date ? ` { _is_null: true } ` : ` { _eq: "${date}" }`;

const BRANCH_TYPE = (date) => createGraphType('branches', `
    ${BRANCH_FIELDS}
    noOfLO: users_aggregate(where: {
        role: {
            _contains: {
                rep: 4
            }
        }
    }) {
        aggregate {  count }
    }

    cashOnHand: branchCOHs (where: { dateAdded: ${addDatedAddedCondition(date) } }){
        ${BRANCH_COH_FIELDS}
    }
`)('branches');

export default apiHandler({
    get: list
});

async function list(req, res) {
    let statusCode = 200;
    let response = {};

    const { branchCode = null, branchCodes = null, date } = req.query;

    const userId = req?.auth?.sub;

    if (!userId) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized.",
        });
    }

    // Get authenticated user
    const userResult = await graph.query(
        queryQl(
            createGraphType(
                "users",
                `
                    _id
                    areaId
                    designatedBranchId
                    role
                `
            )("users"),
            {
                where: {
                    _id: { _eq: userId },
                },
                limit: 1,
            }
        )
    );

    const currentUser = userResult.data?.users?.[0];

    if (!currentUser) {
        return res.status(403).json({
            success: false,
            message: "User account not found.",
        });
    }

    const roleRep = Number(currentUser.role?.rep);

    const isAdmin = roleRep === 1;

    const isAreaManager =
        roleRep === 2 &&
        String(currentUser.role?.shortCode || "")
            .trim()
            .toLowerCase() === "area_admin";

    const isBranchManager = roleRep === 3;
    const isLoanOfficer = roleRep === 4;

    // Existing branch code filters
    const codes = [
        branchCode,
        ...(branchCodes?.split(",") ?? []),
    ].filter(Boolean);

    const where = {
        code: codes.length
            ? { _in: codes }
            : { _is_null: false },
    };

    // Apply role-based restrictions
    if (isAreaManager) {
        if (!currentUser.areaId) {
            return res.status(403).json({
                success: false,
                message: "Area Manager has no assigned area.",
            });
        }

        where.areaId = {
            _eq: currentUser.areaId,
        };
    } else if (isBranchManager || isLoanOfficer) {
        if (!currentUser.designatedBranchId) {
            return res.status(403).json({
                success: false,
                message: "User has no designated branch.",
            });
        }

        where._id = {
            _eq: currentUser.designatedBranchId,
        };
    } else if (!isAdmin) {
        return res.status(403).json({
            success: false,
            message: "You do not have permission to access branches.",
        });
    }

    const branches = await graph.query(
        queryQl(BRANCH_TYPE(date ?? getCurrentDateV2()), {
            where,
            order_by: [{ code: 'asc' }]
        }, )
    ).then(res => res.data.branches)
      .then(branches =>
        branches.map(branch => ({
            ... branch,
            noOfLO: {
                count: branch.noOfLO.aggregate.count,
            }
        }))
        // .filter(branch => branch.code !== 'B000')
    );

    response = {
        success: true,
        branches
    };

    res.status(statusCode)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));

}
