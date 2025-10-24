import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS, GROUP_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { generateUUID } from '@/lib/utils';

export default apiHandler({
    post: batchSaveDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS);
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');

async function batchSaveDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { items, date, isSubmission } = req.body; // Added isSubmission flag
    
    console.log('=== BATCH SAVE START ===');
    console.log('Items received:', items.length);
    console.log('Date:', date);
    console.log('Is Submission:', isSubmission);
    console.log('User:', user.firstName, user.lastName, '- Role:', user.role.shortCode);
    
    // Check if user has permission to save (only cashier)
    if (user.role.shortCode !== 'cashier') {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to modify denomination data'
        });
    }
    
    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No items provided for batch save'
        });
    }
    
    try {
        const currentDateTime = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        const currentDate = date || moment().format('YYYY-MM-DD');
        
        // ==========================================
        // NEW: VALIDATION FOR SUBMISSION
        // ==========================================
        if (isSubmission) {
            console.log('=== VALIDATING SUBMISSION ===');
            
            // Get all group IDs from the items being submitted
            const groupIds = items.map(item => item.entityId);
            
            // Fetch all groups to check their totalNetCollection
            const groupsQuery = await graph.query(
                queryQl(GROUP_TYPE, {
                    where: { _id: { _in: groupIds } }
                })
            );
            
            const groups = groupsQuery?.data?.groups || [];
            console.log('Found groups:', groups.length);
            
            // Build a map of groupId -> group data for easy lookup
            const groupMap = new Map();
            groups.forEach(group => {
                groupMap.set(group._id, group);
            });
            
            // Check each item being submitted
            const missingRemittances = [];
            
            for (const item of items) {
                const group = groupMap.get(item.entityId);
                
                if (!group) {
                    console.warn(`Group not found: ${item.entityId}`);
                    continue;
                }
                
                // If totalNetCollection > 0, remittance must be entered
                const totalNetCollection = parseFloat(item.totalNetCollection) || 0;
                const totalRemittance = parseFloat(item.totalRemittance) || 0;
                
                console.log(`Validating ${item.entityName}:`, {
                    totalNetCollection,
                    totalRemittance,
                    hasCollection: totalNetCollection > 0,
                    hasRemittance: totalRemittance > 0
                });
                
                if (totalNetCollection > 0 && totalRemittance === 0) {
                    missingRemittances.push({
                        entityId: item.entityId,
                        entityName: item.entityName || group.name || 'Unknown Group',
                        totalNetCollection: totalNetCollection
                    });
                }
            }
            
            // If there are groups with collection but no remittance, reject the submission
            if (missingRemittances.length > 0) {
                console.log('❌ VALIDATION FAILED: Missing remittances');
                console.log('Groups with missing remittances:', missingRemittances);
                
                return res.status(400).json({
                    success: false,
                    message: 'Cannot submit: All groups with collections must have remittances entered',
                    validationError: true,
                    missingRemittances: missingRemittances.map(mr => ({
                        name: mr.entityName,
                        collection: mr.totalNetCollection
                    }))
                });
            }
            
            console.log('✓ Validation passed: All groups with collections have remittances');
        }
        
        // ==========================================
        // EXISTING LOGIC: Process each item
        // ==========================================
        const results = {
            success: [],
            failed: [],
            reopened: [],
            reprocessed: []
        };
        
        const mutationQl = [];
        
        // Process each item and prepare mutations
        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            
            console.log(`\n--- Processing item ${i + 1}/${items.length}: ${data.entityName} ---`);
            
            try {
                // Validate required fields
                if (!data.entityId || !data.entityType) {
                    console.log('Missing required fields');
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Missing required fields: entityId and entityType'
                    });
                    continue;
                }
                
                // Validate entity type - ONLY group level denominations are saved
                if (data.entityType !== 'group') {
                    console.log('Invalid entity type:', data.entityType);
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Denominations can only be saved at group level'
                    });
                    continue;
                }
                
                // Validate numeric fields
                const totalNetCollection = parseFloat(data.totalNetCollection) || 0;
                const totalRemittance = parseFloat(data.totalRemittance) || 0;
                const activeClients = parseInt(data.activeClients) || 0;
                const amountSitDown = parseFloat(data.amountSitDown) || 0;
                
                console.log('Values:', { totalNetCollection, totalRemittance, activeClients, amountSitDown });
                
                // Validate that remittance is not negative
                if (totalRemittance < 0) {
                    console.log('Negative remittance');
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Total remittance cannot be negative'
                    });
                    continue;
                }
                
                // Validate that remittance does not exceed collection
                if (totalRemittance > totalNetCollection) {
                    console.log('Remittance exceeds collection');
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: `Total remittance (₱${totalRemittance.toFixed(2)}) cannot exceed net collection (₱${totalNetCollection.toFixed(2)})`
                    });
                    continue;
                }
                
                // Query group data to get branchId and loanOfficerId
                const groupQuery = await graph.query(
                    queryQl(GROUP_TYPE, {
                        where: { _id: { _eq: data.entityId } }
                    })
                );
                
                const group = groupQuery?.data?.groups?.[0];
                
                if (!group) {
                    console.log('Group not found');
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Group not found'
                    });
                    continue;
                }
                
                // Map group data
                const groupId = data.entityId;
                const loId = group.loanOfficerId;
                const branchId = group.branchId;
                
                console.log('Group data:', { groupId, loId, branchId });
                
                // Calculate BCC vs Remittances
                const bccVsRemittances = totalNetCollection - totalRemittance;
                
                // Check existing records
                mutationQl.push(
                    queryQl(DENOMINATION_TYPE, {
                        where: {
                            group_id: { _eq: groupId },
                            date_added: { _eq: currentDate }
                        }
                    }, `query_results_${i}`)
                );
            } catch (error) {
                console.error(`Error processing item ${i + 1}:`, error);
                results.failed.push({
                    entityId: data.entityId,
                    entityName: data.entityName || 'Unknown',
                    error: error.message
                });
            }
        }
        
        // Execute all queries in batch
        console.log('\n=== EXECUTING BATCH QUERY ===');
        const queryResults = await graph.query(mutationQl.join('\n'));
        console.log('Query results received');
        
        // Now process updates/inserts
        const mutations = [];
        
        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            
            // Skip if already failed
            if (results.failed.find(f => f.entityId === data.entityId)) {
                continue;
            }
            
            try {
                const totalNetCollection = parseFloat(data.totalNetCollection) || 0;
                const totalRemittance = parseFloat(data.totalRemittance) || 0;
                const activeClients = parseInt(data.activeClients) || 0;
                const amountSitDown = parseFloat(data.amountSitDown) || 0;
                const bccVsRemittances = totalNetCollection - totalRemittance;
                
                // Get group data again
                const groupQuery = await graph.query(
                    queryQl(GROUP_TYPE, {
                        where: { _id: { _eq: data.entityId } }
                    })
                );
                
                const group = groupQuery?.data?.groups?.[0];
                const groupId = data.entityId;
                const loId = group.loanOfficerId;
                const branchId = group.branchId;
                
                // Get existing records from batch query
                const existingRecords = queryResults?.data?.[`query_results_${i}`] || [];
                
                console.log('Existing records found:', existingRecords.length);
                if (existingRecords.length > 0) {
                    console.log('Existing record:', {
                        _id: existingRecords[0]._id,
                        group_id: existingRecords[0].group_id,
                        status: existingRecords[0].status,
                        total_remittance: existingRecords[0].total_remittance
                    });
                }
                
                // Prepare history entry
                const historyEntry = {
                    date_time: currentDateTime,
                    user_id: user._id,
                    user_name: `${user.firstName} ${user.lastName}`,
                    active_clients: activeClients,
                    total_net_collection: totalNetCollection,
                    total_remittance: totalRemittance,
                    amount_sit_down: amountSitDown,
                    bcc_vs_remittances: bccVsRemittances,
                    action: isSubmission ? 'submitted' : 'saved'
                };
                
                // Process update or insert
                if (existingRecords.length > 0) {
                    const existingRecord = existingRecords[0];
                    
                    if (existingRecord.status === 'approved') {
                        const collectionChanged = totalNetCollection !== (existingRecord.total_net_collection || 0);
                        
                        if (collectionChanged) {
                            console.log('Collection changed after approval - reopening');
                            
                            mutations.push(
                                updateQl(DENOMINATION_TYPE, {
                                    where: { _id: { _eq: existingRecord._id } },
                                    set: {
                                        active_clients: activeClients,
                                        total_net_collection: totalNetCollection,
                                        total_remittance: totalRemittance,
                                        amount_sit_down: amountSitDown,
                                        bcc_vs_remittances: bccVsRemittances,
                                        status: 'pending',
                                        modified_date: currentDateTime,
                                        modified_by: user._id,
                                        approval_date: null,
                                        rejection_reason: null,
                                        rejection_date: null
                                    },
                                    jsonAppend: {
                                        history: {
                                            ...historyEntry,
                                            note: 'Reopened due to collection change after approval'
                                        }
                                    }
                                }, `mutation_${i}`)
                            );
                            
                            results.reopened.push({
                                entityId: data.entityId,
                                entityName: data.entityName,
                                message: 'Collection changed - status reset to pending'
                            });
                        } else {
                            console.log('No collection change - updating remittance only');
                            
                            mutations.push(
                                updateQl(DENOMINATION_TYPE, {
                                    where: { _id: { _eq: existingRecord._id } },
                                    set: {
                                        total_remittance: totalRemittance,
                                        amount_sit_down: amountSitDown,
                                        bcc_vs_remittances: bccVsRemittances,
                                        modified_date: currentDateTime,
                                        modified_by: user._id
                                    },
                                    jsonAppend: {
                                        history: historyEntry
                                    }
                                }, `mutation_${i}`)
                            );
                            
                            results.success.push({
                                entityId: data.entityId,
                                entityName: data.entityName
                            });
                        }
                    } else if (existingRecord.status === 'rejected') {
                        console.log('Reprocessing rejected record');
                        
                        mutations.push(
                            updateQl(DENOMINATION_TYPE, {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    active_clients: activeClients,
                                    total_net_collection: totalNetCollection,
                                    total_remittance: totalRemittance,
                                    amount_sit_down: amountSitDown,
                                    bcc_vs_remittances: bccVsRemittances,
                                    status: 'pending',
                                    modified_date: currentDateTime,
                                    modified_by: user._id,
                                    rejection_reason: null,
                                    rejection_date: null
                                },
                                jsonAppend: {
                                    history: {
                                        ...historyEntry,
                                        note: 'Resubmitted after rejection'
                                    }
                                }
                            }, `mutation_${i}`)
                        );
                        
                        results.reprocessed.push({
                            entityId: data.entityId,
                            entityName: data.entityName,
                            message: 'Rejected entry reprocessed'
                        });
                    } else {
                        console.log('Updating pending/draft record');
                        
                        mutations.push(
                            updateQl(DENOMINATION_TYPE, {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    active_clients: activeClients,
                                    total_net_collection: totalNetCollection,
                                    total_remittance: totalRemittance,
                                    amount_sit_down: amountSitDown,
                                    bcc_vs_remittances: bccVsRemittances,
                                    status: 'pending',
                                    modified_date: currentDateTime,
                                    modified_by: user._id
                                },
                                jsonAppend: {
                                    history: historyEntry
                                }
                            }, `mutation_${i}`)
                        );
                        
                        results.success.push({
                            entityId: data.entityId,
                            entityName: data.entityName
                        });
                    }
                } else {
                    console.log('Inserting new record');
                    
                    const denominationData = {
                        _id: generateUUID(),
                        branch_id: branchId,
                        lo_id: loId,
                        group_id: groupId,
                        active_clients: activeClients,
                        total_net_collection: totalNetCollection,
                        total_remittance: totalRemittance,
                        amount_sit_down: amountSitDown,
                        bcc_vs_remittances: bccVsRemittances,
                        status: 'pending',
                        history: [historyEntry],
                        date_added: currentDate,
                        inserted_date: currentDateTime,
                        modified_date: currentDateTime,
                        inserted_by: user._id,
                        modified_by: user._id,
                        approval_date: null,
                        rejection_date: null,
                        rejection_reason: null
                    };
                    
                    mutations.push(
                        insertQl(DENOMINATION_TYPE, {
                            objects: [denominationData]
                        }, `mutation_${i}`)
                    );
                    
                    results.success.push({
                        entityId: data.entityId,
                        entityName: data.entityName
                    });
                }
            } catch (error) {
                console.error(`Error preparing mutation for item ${i + 1}:`, error);
                results.failed.push({
                    entityId: data.entityId,
                    entityName: data.entityName || 'Unknown',
                    error: error.message
                });
            }
        }
        
        // Execute all mutations
        if (mutations.length > 0) {
            console.log('\n=== EXECUTING BATCH MUTATIONS ===');
            console.log('Mutations to execute:', mutations.length);
            
            const mutationResult = await graph.mutation(mutations.join('\n'));
            
            if (mutationResult.errors && mutationResult.errors.length > 0) {
                console.error('Mutation errors:', mutationResult.errors);
                throw new Error(mutationResult.errors[0].message);
            }
            
            console.log('✓ Batch mutations completed successfully');
        }
        
        console.log('\n=== BATCH SAVE COMPLETE ===');
        console.log('Summary:', {
            successful: results.success.length,
            failed: results.failed.length,
            reopened: results.reopened.length,
            reprocessed: results.reprocessed.length
        });
        
        res.status(200).json({
            success: true,
            message: 'Batch save completed',
            results: results,
            summary: {
                total: items.length,
                successful: results.success.length,
                failed: results.failed.length,
                reopened: results.reopened.length,
                reprocessed: results.reprocessed.length
            }
        });
        
    } catch (error) {
        console.error('Error in batch save:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            success: false,
            message: 'Error saving denomination data',
            error: error.message
        });
    }
}