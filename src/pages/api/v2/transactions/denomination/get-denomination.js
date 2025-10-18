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
        // Build where clause based on user role and parameters
        let where = {
            date_added: { _eq: currentDate }
        };
        
        // Apply role-based filtering
        if (user.role.shortCode === 'cashier' || user.role.rep === 4) {
            // Cashier - filter by their assigned branch
            if (user.designatedBranchId) {
                where.branch_id = { _eq: branchId || user.designatedBranchId };
            }
        } else if (user.role.rep === 3) {
            // Branch manager - filter by their branch
            if (user.designatedBranchId) {
                where.branch_id = { _eq: branchId || user.designatedBranchId };
            }
        } else if (user.role.rep === 2) {
            // Area level - filter by specific branch if provided
            if (branchId) {
                where.branch_id = { _eq: branchId };
            }
        } else if (user.role.rep === 1 || user.root) {
            // Admin/Root - apply filters if provided
            if (branchId) {
                where.branch_id = { _eq: branchId };
            }
            if (loId) {
                where.lo_id = { _eq: loId };
            }
            if (groupId) {
                where.group_id = { _eq: groupId };
            }
        } else {
            // Other roles - filter by branch if provided
            if (branchId) {
                where.branch_id = { _eq: branchId };
            }
        }
        
        // Query denomination data
        const result = await graph.query(
            queryQl(DENOMINATION_TYPE, where)
        );
        
        const denominations = result?.data?.results || [];
        
        res.status(200).json({
            success: true,
            data: denominations,
            currentDate,
            userRole: user.role.shortCode,
            canEdit: user.role.shortCode === 'cashier' || user.role.rep === 4
        });
        
    } catch (error) {
        console.error('Error fetching denomination data:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving denomination data',
            error: error.message
        });
    }
}