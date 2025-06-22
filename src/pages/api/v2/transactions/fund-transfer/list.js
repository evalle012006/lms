import { FUND_TRANSFER_FIELDS } from "@/lib/graph.fields";
import { findUserById } from "@/lib/graph.functions";
import { GraphProvider } from "@/lib/graph/graph.provider";
import { createGraphType, insertQl, queryQl, updateQl } from "@/lib/graph/graph.util";
import { generateUUID } from "@/lib/utils";
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

    // Check if user has access to this page
    if (user.role.rep > 3) {
        return res.status(403).send({
            success: false,
            message: "Access denied. Insufficient permissions."
        });
    }

    const status_condition = { 
        status: { _eq: status ?? 'pending' }, 
        deletedDate: { _is_null: true } 
    };

    let where = { ...status_condition };

    // Apply role-based filtering
    if (user.role.rep === 1 || user.root === true || user.role.shortCode === 'finance') {
        // Show all records for admin/root users
        // No additional filtering needed
    } else if (user.role.rep === 3) {
        // Branch level - show only records where user's branch is giver or receiver
        if (user.designatedBranchId) {
            where = {
                ...status_condition,
                _or: [
                    { giverBranchId: { _eq: user.designatedBranchId } },
                    { receiverBranchId: { _eq: user.designatedBranchId } }
                ]
            };
        }
    } else {
        // For other roles (area, region, division), filter based on their jurisdiction OR if they are the creator
        const branch_conditions = [];

        if (user.areaId) {
            branch_conditions.push({
                areaId: { _eq: user.areaId }
            });
        }

        if (user.regionId) {
            branch_conditions.push({
                regionId: { _eq: user.regionId }
            });
        }

        if (user.divisionId) {
            branch_conditions.push({
                divisionId: { _eq: user.divisionId }
            });
        }

        // Build the main filter conditions
        const jurisdiction_conditions = [];
        
        if (branch_conditions.length > 0) {
            jurisdiction_conditions.push(
                {
                    giverBranch: {
                        _and: branch_conditions
                    }
                },
                {
                    receiverBranch: {
                        _and: branch_conditions
                    }
                }
            );
        }

        // Add condition for transfers created by this user
        jurisdiction_conditions.push({
            insertedById: { _eq: user._id }
        });

        where = {
            ...status_condition,
            _or: jurisdiction_conditions
        };
    }

    // Apply mode-specific filtering if provided
    if (mode === 'due_to_main') {
        const modeFilter = {
            receiverBranch: {
                code: { _eq: "B000" }
            }
        };
        
        if (user.role.rep === 1 || user.root === true) {
            where = {
                ...status_condition,
                ...modeFilter
            };
        } else {
            // For non-admin users, combine with existing jurisdiction/creator filters
            where = {
                ...where,
                ...modeFilter
            };
        }
    }

    if (mode === 'branch_to_branch') {
        const modeFilter = {
            receiverBranch: {
                code: { _neq: "B000" }
            }
        };
        
        if (user.role.rep === 1 || user.root === true) {
            where = {
                ...status_condition,
                ...modeFilter
            };
        } else {
            // For non-admin users, combine with existing jurisdiction/creator filters
            where = {
                ...where,
                ...modeFilter
            };
        }
    }

    if (mode === 'padala') {
        const modeFilter = {
            giverBranch: {
                code: { _neq: "B000" }
            }
        };
        
        if (user.role.rep === 1 || user.root === true) {
            where = {
                ...status_condition,
                ...modeFilter
            };
        } else {
            // For non-admin users, combine with existing jurisdiction/creator filters
            where = {
                ...where,
                ...modeFilter
            };
        }
    }

    try {
        const results = await graph.query(
            queryQl(FUND_TRANSFER_TYPE, {
                where
            })
        ).then(res => res.data.results ?? []);

        res.send({
            success: true,
            data: results,
        });
    } catch (error) {
        console.error('Error fetching fund transfers:', error);
        res.status(500).send({
            success: false,
            message: "Error fetching fund transfers"
        });
    }
}