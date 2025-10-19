import { apiHandler } from '@/services/api-handler';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { getLocalhost } from '@/lib/constants';

export default apiHandler({
    get: getInitialData
});

/**
 * This endpoint reuses the existing cash collections page data API
 * to get the initial data for the denomination feature
 */
async function getInitialData(req, res) {
    try {
        const user = await findUserById(req.auth.sub);
        const { date, branchId, loId, groupId, filter } = req.query;
        
        const currentDate = date || moment().format('YYYY-MM-DD');
        
        // Build parameters matching ModernBranchCashCollections format
        const params = new URLSearchParams({
            dateAdded: currentDate,
            currentDate: currentDate,
            _name: 'get_cash_collections_page_data',
            filter: filter || 'branch'
        });
        
        // Add entity-specific filters
        if (branchId) {
            params.append('branchId', branchId);
        } else if (user.designatedBranchId) {
            params.append('branchId', user.designatedBranchId);
        }
        
        if (loId) {
            params.append('loId', loId);
        }
        
        if (groupId) {
            params.append('groupId', groupId);
        }
        
        // Add hierarchical filters based on user role
        if (user.areaId) {
            params.append('areaId', user.areaId);
        }
        
        if (user.regionId) {
            params.append('regionId', user.regionId);
        }
        
        if (user.divisionId) {
            params.append('divisionId', user.divisionId);
        }
        
        // Construct full URL for internal API call
        const protocol = req.headers['x-forwarded-proto'] || 
                        (req.connection.encrypted ? 'https' : 'http');
        const host = req.headers['host'] || req.headers['x-forwarded-host'];
        
        if (!host) {
            throw new Error('Unable to determine host from request headers');
        }
        
        const apiUrl = `${getLocalhost()}/api/v2/data/get_cash_collections_page_data?${params.toString()}`;
        
        console.log('Fetching cash collections from:', apiUrl);
        console.log('Params:', Object.fromEntries(params));
        
        // Make the internal API call with proper headers
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': req.headers.authorization || '',
                'Content-Type': 'application/json',
                'Cookie': req.headers.cookie || ''
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Response Error:', {
                status: response.status,
                statusText: response.statusText,
                body: errorText.substring(0, 500) // Log first 500 chars
            });
            
            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch cash collections data: ${response.status} ${response.statusText}`,
                error: errorText
            });
        }
        
        const data = await response.json();
        console.log('API Response success:', !!data.success, 'Data count:', data.data?.length || 0);
        
        if (!data || !data.data) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No data found'
            });
        }

        let sort = 'code';
        if (filter === 'branch') sort = 'code'; // string
        else if (filter === 'lo') sort = 'loNo'; // integer
        else if (filter === 'group') sort = 'groupNo'; // integer

        // Function to check if the current 'sort' field should be treated as a number
        const isNumericSort = (sortField) => {
            return sortField === 'loNo' || sortField === 'groupNo';
        };

        data.data.sort((a, b) => {
            const valA = a[sort];
            const valB = b[sort];

            // --- 1. Null/Empty Value Logic (Prioritized) ---
            const isANull = valA === null || valA === undefined || valA === '' || valA === '_total';
            const isBNull = valB === null || valB === undefined || valB === '' || valA === '_total';

            if (isANull && isBNull) {
                return 0;
            }
            if (isANull) {
                return 1; // Push A to the bottom
            }
            if (isBNull) {
                return -1; // Push B to the bottom
            }

            // --- 2. Sorting Logic (for non-null/non-empty values) ---
            
            if (isNumericSort(sort)) {
                // --- NUMERIC SORTING ---
                // Convert values to actual numbers for correct comparison
                const numA = Number(valA);
                const numB = Number(valB);
                
                // This is the standard way to sort numbers ascendingly
                return numA - numB; 

            } else {
                // --- STRING SORTING (Case-Insensitive) ---
                const strA = String(valA).toLowerCase();
                const strB = String(valB).toLowerCase();

                if (strA < strB) {
                    return -1;
                }
                if (strA > strB) {
                    return 1;
                }
                return 0;
            }
        });
        
        // Transform the data to match denomination table structure
        const transformedData = data.data.map(item => {
            let itemName = item.name === '_total' ? "TOTAL" : item.name || item.label;
            if (filter == 'branch' && item.name !== '_total') {
                itemName = `${item.code} - ${item.name}`
            }

            return {
                entityId: item._id || item.id,
                entityName: itemName,
                entityType: filter || 'branch',
                entityCode: item.code || item.loNo || item.groupNo,
                activeClients: item.activeClients || 0,
                totalNetCollection: item.totalNetCollection || 0,
                targetCollection: item.targetLoanCollection || item.loanTarget || 0,
                actualCollection: item.actualLoanCollection || item.total || 0,
                excess: item.excess || 0,
                // Calculate amount sit down
                amountSitDown: calculateAmountSitDown(
                    item.targetLoanCollection || item.loanTarget || 0,
                    item.actualLoanCollection || item.total || 0,
                    item.excess || 0,
                    item.activeClients || 0
                ),
                hasCollection: item.totalNetCollection > 0,
            };
        });
        
        console.log('Transformed data count:', transformedData.length);
        
        res.status(200).json({
            success: true,
            data: transformedData,
            parentName: data.parentName || '',
            userRole: user.role.shortCode,
            canEdit: user.role.shortCode === 'cashier'
        });
        
    } catch (error) {
        console.error('Error fetching initial denomination data:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving initial data',
            error: error.message
        });
    }
}

/**
 * Calculate Amount of Sit Down
 * Formula: (targetCollection - (actualCollection - excess)) / (targetCollection / activeClients)
 */
function calculateAmountSitDown(targetCollection, actualCollection, excess, activeClients) {
    if (!targetCollection || !activeClients || targetCollection === 0 || activeClients === 0) {
        return 0;
    }
    
    const numerator = targetCollection - (actualCollection - excess);
    const denominator = targetCollection / activeClients;
    
    if (denominator === 0) {
        return 0;
    }
    
    const result = numerator / denominator;
    return Math.max(0, result);
}