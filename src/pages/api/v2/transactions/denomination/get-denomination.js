import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';

export default apiHandler({
    get: getDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS)('results');

async function getDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { date, branchId, loId, groupId } = req.query;
    
    const currentDate = date || moment().format('YYYY-MM-DD');
    
    try {
        // Build where clause - MUST start with date
        let where = {
            date_added: { _eq: currentDate }
        };
        
        // Track which filter was applied
        let filterApplied = 'date only';
        
        // Priority 1: Specific query parameters (highest priority)
        if (branchId) {
            where.branch_id = { _eq: branchId };
            filterApplied = `branchId=${branchId}`;
        } else if (loId) {
            where.lo_id = { _eq: loId };
            filterApplied = `loId=${loId}`;
        } else if (groupId) {
            where.group_id = { _eq: groupId };
            filterApplied = `groupId=${groupId}`;
        }
        // Priority 2: User role-based filtering (if no query params)
        else {
            if (user.role.shortCode === 'cashier') {
                if (user.designatedBranchId && user.designatedBranchId !== '') {
                    // Assigned cashier - filter by their designated branch
                    where.branch_id = { _eq: user.designatedBranchId };
                    filterApplied = `role(cashier):branchId=${user.designatedBranchId}`;
                } else {
                    // Unassigned cashier - no branch filter (show all branches)
                    filterApplied = 'role(cashier):no designation (show all branches)';
                    // console.log('✓ Unassigned cashier - showing all branches');
                }
            }
            // Branch Manager (rep 3)
            else if (user.role.rep === 3 && user.designatedBranchId) {
                where.branch_id = { _eq: user.designatedBranchId };
                filterApplied = `role(rep=3):branchId=${user.designatedBranchId}`;
            }
            // Cashier with designated branch
            else if (user.role.shortCode === 'cashier' && user.designatedBranchId) {
                where.branch_id = { _eq: user.designatedBranchId };
                filterApplied = `role(cashier):branchId=${user.designatedBranchId}`;
            }
            // Loan Officer (rep 4, not cashier with branch)
            else if (user.role.rep === 4 && user._id) {
                where.lo_id = { _eq: user._id };
                filterApplied = `role(rep=4):loId=${user._id}`;
            }
            // Admin/Higher level roles - hierarchical filtering
            else if (user.role.rep <= 2 || user.root) {
                // For hierarchical filters, we need to use branch relationship
                // Note: This requires the denomination table to have a relationship to branches
                if (user.areaId) {
                    where.branch = { area_id: { _eq: user.areaId } };
                    filterApplied = `hierarchy:areaId=${user.areaId}`;
                } else if (user.regionId) {
                    where.branch = { region_id: { _eq: user.regionId } };
                    filterApplied = `hierarchy:regionId=${user.regionId}`;
                } else if (user.divisionId) {
                    where.branch = { division_id: { _eq: user.divisionId } };
                    filterApplied = `hierarchy:divisionId=${user.divisionId}`;
                } else {
                    filterApplied = 'none (show all)';
                    // console.log('✓ [No Filter] Showing all denominations');
                }
            }
        }
        
        // Query denomination data - Pass where inside a condition object
        const result = await graph.query(
            queryQl(DENOMINATION_TYPE, { where })  // <-- CRITICAL: Pass as { where: where }
        );
        
        const denominations = result?.data?.results || [];
        
        // Verify filtering worked - check if all returned records match the filter
        if (branchId && denominations.length > 0) {
            const mismatch = denominations.find(d => d.branch_id !== branchId);
            if (mismatch) {
                console.error('❌ FILTER FAILED - Found record with wrong branch_id:', {
                    expected: branchId,
                    actual: mismatch.branch_id,
                    record_id: mismatch._id
                });
            }
        }
        
        res.status(200).json({
            success: true,
            data: denominations,
            currentDate,
            userRole: user.role.shortCode,
            canEdit: user.role.shortCode === 'cashier' || user.role.rep === 4,
            appliedFilters: {
                filterType: filterApplied,
                branchId: branchId || (user.role.rep === 3 && user.designatedBranchId) || 
                         (user.role.shortCode === 'cashier' && user.designatedBranchId) || null,
                loId: loId || (user.role.rep === 4 && user._id) || null,
                groupId: groupId || null,
                hierarchical: {
                    areaId: user.areaId || null,
                    regionId: user.regionId || null,
                    divisionId: user.divisionId || null
                }
            },
            debug: {
                whereClause: where,
                recordCount: denominations.length
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching denomination data:', error);
        console.error('Error stack:', error.stack);
        
        // If it's a GraphQL error, log the query that failed
        if (error.message) {
            console.error('Error message:', error.message);
        }
        
        res.status(500).json({
            success: false,
            message: 'Error retrieving denomination data',
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}