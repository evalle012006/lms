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
        const { date, branchId, loId, groupId, filter, userId } = req.query;
        const user = await findUserById(req.auth.sub || userId);

        const currentDate = date || moment().format('YYYY-MM-DD');
        
        // console.log('=== GET INITIAL DATA ===');
        // console.log('User:', user.firstName, user.lastName, '- Role:', user.role.shortCode);
        // console.log('Query params:', { date: currentDate, branchId, loId, groupId, filter });
        // console.log('User designated branch:', user.designatedBranchId);
        
        // Build parameters matching ModernBranchCashCollections format
        const params = new URLSearchParams({
            dateAdded: currentDate,
            currentDate: currentDate,
            _name: 'get_cash_collections_page_data',
            filter: filter || 'branch'
        });
        
        // Handle cashier with designated branch
        if (user.role.shortCode === 'cashier' && user.designatedBranchId) {
            if (filter === 'lo') {
                params.append('branchId', user.designatedBranchId);
                // console.log('✓ Cashier viewing LO level for designated branch:', user.designatedBranchId);
                
                if (loId) {
                    params.append('loId', loId);
                    // console.log('✓ Filtering by specific LO:', loId);
                }
            } else if (filter === 'group') {
                params.append('branchId', user.designatedBranchId);
                if (loId) {
                    params.append('loId', loId);
                    // console.log('✓ Cashier viewing groups for LO:', loId);
                }
            }
        } else {
            // Original logic for other roles
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
        
        // console.log('Fetching cash collections from:', apiUrl);
        // console.log('Params:', Object.fromEntries(params));
        
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
            // console.error('API Response Error:', {
            //     status: response.status,
            //     statusText: response.statusText,
            //     body: errorText.substring(0, 500)
            // });
            
            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch cash collections data: ${response.status} ${response.statusText}`,
                error: errorText
            });
        }
        
        const data = await response.json();
        // console.log('API Response success:', !!data.success, 'Data count:', data.data?.length || 0);
        
        if (!data || !data.data) {
            return res.status(200).json({
                success: true,
                data: [],
                message: 'No data found'
            });
        }

        let sort = 'code';
        if (filter === 'branch') sort = 'code';
        else if (filter === 'lo') sort = 'loNo';
        else if (filter === 'group') sort = 'groupNo';

        const isNumericSort = (sortField) => {
            return sortField === 'loNo' || sortField === 'groupNo';
        };

        data.data.sort((a, b) => {
            const valA = a[sort];
            const valB = b[sort];

            const isANull = valA === null || valA === undefined || valA === '' || valA === '_total';
            const isBNull = valB === null || valB === undefined || valB === '' || valA === '_total';

            if (isANull && isBNull) {
                return 0;
            }
            if (isANull) {
                return 1;
            }
            if (isBNull) {
                return -1;
            }
            
            if (isNumericSort(sort)) {
                const numA = Number(valA);
                const numB = Number(valB);
                return numA - numB; 
            } else {
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
        
        // ==========================================
        // OPTIMIZED: Fetch ALL client data in ONE call instead of looping
        // ==========================================
        let clientDataMap = new Map();
        
        if (filter === 'group') {
            console.log('🚀 OPTIMIZED: Fetching all client data in one call');
            
            // Determine which loId to use for fetching client data
            let effectiveLoId = null;
            
            // Priority 1: loId from query params (drilling down)
            if (loId) {
                effectiveLoId = loId;
            }
            // Priority 2: User's own ID if they're a loan officer
            else if (user.role.rep === 4 && user._id) {
                effectiveLoId = user._id;
            }
            
            if (effectiveLoId) {
                try {
                    console.log(`Fetching client data for LO: ${effectiveLoId}`);
                    
                    // ✅ OPTIMIZED: Single API call with loId to get all clients at once
                    const clientParams = new URLSearchParams({
                        dateAdded: currentDate,
                        currentDate: currentDate,
                        filter: 'client',
                        loId: effectiveLoId,  // ← KEY: Pass loId instead of groupId
                        _name: 'get_cash_collections_page_data'
                    });
                    
                    const clientApiUrl = `${getLocalhost()}/api/v2/data/get_cash_collections_page_data?${clientParams.toString()}`;
                    
                    const startTime = Date.now();
                    const clientResponse = await fetch(clientApiUrl, {
                        method: 'GET',
                        headers: {
                            'Authorization': req.headers.authorization || '',
                            'Content-Type': 'application/json',
                            'Cookie': req.headers.cookie || ''
                        }
                    });
                    const fetchTime = Date.now() - startTime;
                    
                    if (clientResponse.ok) {
                        const clientData = await clientResponse.json();
                        // console.log(`✅ Fetched all client data in ${fetchTime}ms`);
                        
                        if (clientData.success && clientData.data) {
                            // ✅ OPTIMIZED: Group clients by groupId in memory
                            const clientsByGroup = new Map();
                            
                            clientData.data.forEach(client => {
                                // Skip total row
                                if (client._id === '_total' || !client.groupId) {
                                    return;
                                }
                                
                                // Initialize array for this group if not exists
                                if (!clientsByGroup.has(client.groupId)) {
                                    clientsByGroup.set(client.groupId, []);
                                }
                                
                                // Add client to their group
                                clientsByGroup.get(client.groupId).push(client);
                            });
                            
                            // console.log(`📊 Grouped clients into ${clientsByGroup.size} groups`);
                            
                            // ✅ Calculate no_sit_down for each group
                            clientsByGroup.forEach((clients, groupId) => {
                                const clientsWithZeroCollection = clients.filter(client => 
                                    client.totalNetCollection === 0 || !client.totalNetCollection
                                ).length;
                                
                                clientDataMap.set(groupId, clientsWithZeroCollection);
                            });
                            
                            // console.log(`✅ Calculated no_sit_down for ${clientDataMap.size} groups`);
                            
                            // Log sample data for verification
                            if (clientDataMap.size > 0) {
                                const firstThree = Array.from(clientDataMap.entries()).slice(0, 3);
                                // console.log('Sample no_sit_down values:', firstThree);
                            }
                        }
                    } else {
                        console.error('Failed to fetch client data:', clientResponse.status, clientResponse.statusText);
                    }
                } catch (error) {
                    console.error('Error fetching client data:', error);
                }
            } else {
                console.warn('⚠️ No loId available to fetch client data');
            }
        }
        
        // Transform the data to match denomination table structure
        const transformedData = data.data.map(item => {
            let itemName = item.name === '_total' ? "TOTAL" : item.name || item.label;
            if (filter == 'branch' && item.name !== '_total') {
                itemName = `${item.code} - ${item.name}`
            }

            // ✅ Get no_sit_down from optimized client data map
            const noSitDown = clientDataMap.get(item._id) || calculateNoSitDown(
                item.targetLoanCollection || item.loanTarget || 0,
                item.actualLoanCollection || item.total || 0,
                item.excess || 0,
                item.activeClients || 0
            );

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
                // ✅ Use optimized client-based count
                noSitDown: noSitDown,
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
        
        // console.log('Transformed data count:', transformedData.length);
        // console.log('Applied filters:', {
        //     branchId: user.role.shortCode === 'cashier' && user.designatedBranchId 
        //         ? user.designatedBranchId 
        //         : branchId,
        //     loId,
        //     groupId
        // });
        
        res.status(200).json({
            success: true,
            data: transformedData,
            parentName: data.parentName || '',
            userRole: user.role.shortCode,
            canEdit: user.role.shortCode === 'cashier'
        });
        
    } catch (error) {
        console.error('Error fetching initial denomination data:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error retrieving initial data',
            error: error.message
        });
    }
}

/**
 * Calculate No of Sit Down (fallback if client data not available)
 * Formula: (targetCollection - (actualCollection - excess)) / (targetCollection / activeClients)
 */
function calculateNoSitDown(targetCollection, actualCollection, excess, activeClients) {
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

/**
 * Calculate Amount of Sit Down
 * Formula: actualCollection - targetCollection
 */
function calculateAmountSitDown(targetCollection, actualCollection, excess, activeClients) {
    if (!targetCollection ||  targetCollection === 0 || activeClients === 0) {
        return 0;
    }

    if (actualCollection <= 0) {
        return targetCollection;
    }
    
    const result = targetCollection - (actualCollection - excess);
    
    return Math.max(0, result);
}