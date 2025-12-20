import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { getSystemDate } from '@/lib/date-utils';

export default apiHandler({
    get: getDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS)('results');

async function getDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { date, branchId, loId, groupId } = req.query;
    
    const currentDate = date || moment(getSystemDate()).format('YYYY-MM-DD');
    
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
                }
            }
            // Branch Manager (rep 3)
            else if (user.role.rep === 3 && user.designatedBranchId) {
                where.branch_id = { _eq: user.designatedBranchId };
                filterApplied = `role(rep=3):branchId=${user.designatedBranchId}`;
            }
            // Loan Officer (rep 4)
            else if (user.role.rep === 4 && user._id) {
                where.lo_id = { _eq: user._id };
                filterApplied = `role(rep=4):loId=${user._id}`;
            }
            // Admin/Higher level roles - hierarchical filtering
            else if (user.role.rep <= 2 || user.root) {
                // Step 1: Determine which hierarchical filter to apply
                let branchWhere = {};
                
                if (user.areaId) {
                    branchWhere.areaId = { _eq: user.areaId };
                    filterApplied = `hierarchy:areaId=${user.areaId}`;
                } else if (user.regionId) {
                    branchWhere.regionId = { _eq: user.regionId };
                    filterApplied = `hierarchy:regionId=${user.regionId}`;
                } else if (user.divisionId) {
                    branchWhere.divisionId = { _eq: user.divisionId };
                    filterApplied = `hierarchy:divisionId=${user.divisionId}`;
                } else {
                    filterApplied = 'none (show all)';
                }
                
                // Step 2: If we have a hierarchical filter, fetch matching branch IDs
                if (Object.keys(branchWhere).length > 0) {
                    const BRANCH_ID_TYPE = createGraphType('branches', '_id')('branches');
                    const branchResult = await graph.query(
                        queryQl(BRANCH_ID_TYPE, { where: branchWhere })
                    );
                    
                    const branchIds = branchResult?.data?.branches?.map(b => b._id) || [];
                    
                    if (branchIds.length > 0) {
                        // Filter denominations by the fetched branch IDs
                        where.branch_id = { _in: branchIds };
                        console.log(`✓ Hierarchical filter: Found ${branchIds.length} matching branches`);
                    } else {
                        // No branches match the criteria, return empty result
                        where.branch_id = { _eq: 'no-match-found' };
                        console.log('⚠ Hierarchical filter: No matching branches found');
                    }
                }
            }
        }
        
        // Query denomination data
        // NOTE: DENOMINATION_FIELDS should include 'remarks' field
        const result = await graph.query(
            queryQl(DENOMINATION_TYPE, { where })
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
            canEdit: user.role.shortCode === 'cashier' || user.role.rep === 1,
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