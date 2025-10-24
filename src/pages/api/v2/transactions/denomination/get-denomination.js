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
    
    console.log('=== GET DENOMINATION ===');
    console.log('User:', user.firstName, user.lastName, '- Role:', user.role.shortCode, 'rep:', user.role.rep);
    console.log('Query params:', { date: currentDate, branchId, loId, groupId });
    console.log('User context:', {
        designatedBranchId: user.designatedBranchId,
        areaId: user.areaId,
        regionId: user.regionId,
        divisionId: user.divisionId,
        userId: user._id
    });
    
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
            console.log('✓ [Query Param] Filtering by branch_id:', branchId);
        } else if (loId) {
            where.lo_id = { _eq: loId };
            filterApplied = `loId=${loId}`;
            console.log('✓ [Query Param] Filtering by lo_id:', loId);
        } else if (groupId) {
            where.group_id = { _eq: groupId };
            filterApplied = `groupId=${groupId}`;
            console.log('✓ [Query Param] Filtering by group_id:', groupId);
        }
        // Priority 2: User role-based filtering (if no query params)
        else {
            // Branch Manager (rep 3)
            if (user.role.rep === 3 && user.designatedBranchId) {
                where.branch_id = { _eq: user.designatedBranchId };
                filterApplied = `role(rep=3):branchId=${user.designatedBranchId}`;
                console.log('✓ [Role] Branch Manager filter: branch_id =', user.designatedBranchId);
            }
            // Cashier with designated branch
            else if (user.role.shortCode === 'cashier' && user.designatedBranchId) {
                where.branch_id = { _eq: user.designatedBranchId };
                filterApplied = `role(cashier):branchId=${user.designatedBranchId}`;
                console.log('✓ [Role] Cashier filter: branch_id =', user.designatedBranchId);
            }
            // Loan Officer (rep 4, not cashier with branch)
            else if (user.role.rep === 4 && user._id) {
                where.lo_id = { _eq: user._id };
                filterApplied = `role(rep=4):loId=${user._id}`;
                console.log('✓ [Role] Loan Officer filter: lo_id =', user._id);
            }
            // Admin/Higher level roles - hierarchical filtering
            else if (user.role.rep <= 2 || user.root) {
                // For hierarchical filters, we need to use branch relationship
                // Note: This requires the denomination table to have a relationship to branches
                if (user.areaId) {
                    where.branch = { area_id: { _eq: user.areaId } };
                    filterApplied = `hierarchy:areaId=${user.areaId}`;
                    console.log('✓ [Hierarchy] Area filter: branch.area_id =', user.areaId);
                } else if (user.regionId) {
                    where.branch = { region_id: { _eq: user.regionId } };
                    filterApplied = `hierarchy:regionId=${user.regionId}`;
                    console.log('✓ [Hierarchy] Region filter: branch.region_id =', user.regionId);
                } else if (user.divisionId) {
                    where.branch = { division_id: { _eq: user.divisionId } };
                    filterApplied = `hierarchy:divisionId=${user.divisionId}`;
                    console.log('✓ [Hierarchy] Division filter: branch.division_id =', user.divisionId);
                } else {
                    filterApplied = 'none (show all)';
                    console.log('✓ [No Filter] Showing all denominations');
                }
            }
        }
        
        console.log('Final where clause:', JSON.stringify(where, null, 2));
        console.log('Filter applied:', filterApplied);
        
        // Query denomination data - Pass where inside a condition object
        const result = await graph.query(
            queryQl(DENOMINATION_TYPE, { where })  // <-- CRITICAL: Pass as { where: where }
        );
        
        const denominations = result?.data?.results || [];
        
        console.log('✓ Query executed successfully');
        console.log('✓ Found', denominations.length, 'denomination records');
        
        // Debug: Log first 3 results if exist
        if (denominations.length > 0) {
            denominations.slice(0, 3).forEach((d, idx) => {
                console.log(`  [${idx + 1}]`, {
                    _id: d._id?.substring(0, 8) + '...',
                    branch_id: d.branch_id,
                    lo_id: d.lo_id?.substring(0, 8) + '...',
                    group_id: d.group_id?.substring(0, 8) + '...',
                    date_added: d.date_added,
                    status: d.status
                });
            });
        } else {
            console.log('⚠️ No records found - this might be expected if no denominations exist for the filters');
        }
        
        // Verify filtering worked - check if all returned records match the filter
        if (branchId && denominations.length > 0) {
            const mismatch = denominations.find(d => d.branch_id !== branchId);
            if (mismatch) {
                console.error('❌ FILTER FAILED - Found record with wrong branch_id:', {
                    expected: branchId,
                    actual: mismatch.branch_id,
                    record_id: mismatch._id
                });
            } else {
                console.log('✅ Filter verification passed - all records match branchId');
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