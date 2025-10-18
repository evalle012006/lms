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
    const { items, date } = req.body;
    
    console.log('=== BATCH SAVE START ===');
    console.log('Items received:', items.length);
    console.log('Date:', date);
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
        
        const results = {
            success: [],
            failed: [],
            reopened: [],
            reprocessed: []  // NEW: Track reprocessed rejected items
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
                    console.log('Group not found:', data.entityId);
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Group not found'
                    });
                    continue;
                }
                
                // Map group data to denomination fields
                const groupId = data.entityId;
                const loId = group.loanOfficerId;
                const branchId = group.branchId;
                
                console.log('Group info:', { groupId, groupName: group.name, loId, branchId });
                
                // Calculate BCC vs Remittances
                const bccVsRemittances = totalNetCollection - totalRemittance;
                
                // Check if record exists for this specific group and date
                const existingQuery = await graph.query(
                    queryQl(DENOMINATION_TYPE(`query_results_${i}`), {
                        where: {
                            group_id: { _eq: groupId },
                            date_added: { _eq: currentDate }
                        }
                    })
                );
                
                const existingRecords = existingQuery?.data?.[`query_results_${i}`] || [];
                
                console.log('Existing records found:', existingRecords.length);
                if (existingRecords.length > 0) {
                    console.log('Existing record:', {
                        _id: existingRecords[0]._id,
                        group_id: existingRecords[0].group_id,
                        status: existingRecords[0].status,
                        total_remittance: existingRecords[0].total_remittance,
                        rejection_reason: existingRecords[0].rejection_reason
                    });
                }
                
                // Prepare history entry for new submission
                const historyEntry = {
                    date_time: currentDateTime,
                    user_id: user._id,
                    user_name: `${user.firstName} ${user.lastName}`,
                    active_clients: activeClients,
                    total_net_collection: totalNetCollection,
                    total_remittance: totalRemittance,
                    amount_sit_down: amountSitDown,
                    bcc_vs_remittances: bccVsRemittances,
                    action: 'saved'
                };
                
                // NOW PROCESS: Update or Insert
                if (existingRecords.length > 0) {
                    // UPDATE PATH
                    const existingRecord = existingRecords[0];
                    
                    if (existingRecord.status === 'approved') {
                        // APPROVED STATUS HANDLING
                        const collectionChanged = totalNetCollection !== (existingRecord.total_net_collection || 0);
                        
                        if (collectionChanged) {
                            console.log('Reopening approved record due to collection change');
                            
                            // Archive the approved record in history
                            const approvedSnapshot = {
                                date_time: currentDateTime,
                                action: 'reopened_due_to_collection_change',
                                user_id: user._id,
                                user_name: `${user.firstName} ${user.lastName}`,
                                previous_status: 'approved',
                                active_clients: activeClients,
                                amount_sit_down: amountSitDown,
                                previous_total_net_collection: existingRecord.total_net_collection,
                                previous_total_remittance: existingRecord.total_remittance,
                                previous_bcc_vs_remittances: existingRecord.bcc_vs_remittances,
                                previous_approval_date: existingRecord.approval_date,
                                new_total_net_collection: totalNetCollection,
                                total_remittance: totalRemittance,
                                bcc_vs_remittances: bccVsRemittances,
                                reason: `Collection updated from ₱${existingRecord.total_net_collection.toFixed(2)} to ₱${totalNetCollection.toFixed(2)}`
                            };
                            
                            const updateData = {
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
                            };
                            
                            mutationQl.push(
                                updateQl(DENOMINATION_TYPE(`update_results_${mutationQl.length}`), {
                                    where: { 
                                        _id: { _eq: existingRecord._id },
                                        group_id: { _eq: groupId }
                                    },
                                    set: updateData,
                                    jsonAppend: {
                                        history: approvedSnapshot
                                    }
                                })
                            );
                            
                            results.reopened.push({
                                entityId: data.entityId,
                                entityName: data.entityName || 'Unknown',
                                message: 'Reopened due to collection change'
                            });
                            
                            console.log('Added UPDATE mutation (reopened)');
                        } else {
                            console.log('Cannot modify approved record without collection change');
                            results.failed.push({
                                entityId: data.entityId,
                                entityName: data.entityName || 'Unknown',
                                error: 'Cannot modify approved denomination without collection changes'
                            });
                        }
                        // to do:
                        // - add total in the denomination
                        // - in closing of transaction, update the query to check for pending denomination
                        // - freeze the column row and the first column like the moderncashcollection page
                        // - filter by branch should show in filter = lo so that it can be easily switch data of branch
                    } else if (existingRecord.status === 'rejected') {
                        // REJECTED STATUS HANDLING - Allow reprocessing
                        console.log('Reprocessing rejected record');
                        
                        // Get the LAST history entry to find the actual previous values
                        const historyArray = existingRecord.history || [];
                        const lastHistoryEntry = historyArray.length > 0 ? historyArray[historyArray.length - 1] : null;
                        
                        // Use values from the rejection history entry (which has the correct values)
                        const actualPreviousRemittance = lastHistoryEntry?.total_remittance || existingRecord.total_remittance || 0;
                        const actualPreviousCollection = lastHistoryEntry?.total_net_collection || existingRecord.total_net_collection || 0;
                        const actualPreviousBccVsRemittances = actualPreviousCollection - actualPreviousRemittance;
                        
                        console.log('Previous values from history:', {
                            previousRemittance: actualPreviousRemittance,
                            previousCollection: actualPreviousCollection,
                            previousBccVsRemittances: actualPreviousBccVsRemittances
                        });
                        
                        // Create reprocessed history entry with CORRECT previous values
                        const reprocessedEntry = {
                            date_time: currentDateTime,
                            action: 'reprocessed_after_rejection',
                            user_id: user._id,
                            user_name: `${user.firstName} ${user.lastName}`,
                            previous_status: 'rejected',
                            previous_rejection_reason: existingRecord.rejection_reason,
                            previous_rejection_date: existingRecord.rejection_date,
                            previous_total_net_collection: actualPreviousCollection,
                            previous_total_remittance: actualPreviousRemittance,
                            previous_bcc_vs_remittances: actualPreviousBccVsRemittances,
                            active_clients: activeClients,
                            total_net_collection: totalNetCollection,
                            total_remittance: totalRemittance,
                            amount_sit_down: amountSitDown,
                            bcc_vs_remittances: bccVsRemittances,
                            reason: `Reprocessed after rejection. Previous remittance: ₱${actualPreviousRemittance.toFixed(2)}, New remittance: ₱${totalRemittance.toFixed(2)}`
                        };
                        
                        const updateData = {
                            active_clients: activeClients,
                            total_net_collection: totalNetCollection,
                            total_remittance: totalRemittance,
                            amount_sit_down: amountSitDown,
                            bcc_vs_remittances: bccVsRemittances,
                            status: 'pending',  // Change back to pending
                            modified_date: currentDateTime,
                            modified_by: user._id,
                            rejection_reason: null,  // Clear rejection info
                            rejection_date: null
                        };
                        
                        mutationQl.push(
                            updateQl(DENOMINATION_TYPE(`update_results_${mutationQl.length}`), {
                                where: { 
                                    _id: { _eq: existingRecord._id },
                                    group_id: { _eq: groupId }
                                },
                                set: updateData,
                                jsonAppend: {
                                    history: reprocessedEntry
                                }
                            })
                        );
                        
                        results.reprocessed.push({
                            entityId: data.entityId,
                            entityName: data.entityName || 'Unknown',
                            message: 'Reprocessed after rejection',
                            previousRejectionReason: existingRecord.rejection_reason
                        });
                        
                        console.log('Added UPDATE mutation (reprocessed from rejected)');
                    } else {
                        // PENDING/DRAFT STATUS HANDLING
                        console.log('Updating pending/draft record');
                        
                        // Validate remittance - must be >= previously saved amount
                        if (totalRemittance < (existingRecord.total_remittance || 0)) {
                            console.log('Remittance too low');
                            results.failed.push({
                                entityId: data.entityId,
                                entityName: data.entityName || 'Unknown',
                                error: `Remittance cannot be less than previously saved amount (₱${existingRecord.total_remittance.toFixed(2)})`
                            });
                        } else {
                            const updateData = {
                                active_clients: activeClients,
                                total_net_collection: totalNetCollection,
                                total_remittance: totalRemittance,
                                amount_sit_down: amountSitDown,
                                bcc_vs_remittances: bccVsRemittances,
                                status: 'pending',
                                modified_date: currentDateTime,
                                modified_by: user._id
                            };
                            
                            mutationQl.push(
                                updateQl(DENOMINATION_TYPE(`update_results_${mutationQl.length}`), {
                                    where: { 
                                        _id: { _eq: existingRecord._id },
                                        group_id: { _eq: groupId }
                                    },
                                    set: updateData,
                                    jsonAppend: {
                                        history: historyEntry
                                    }
                                })
                            );
                            
                            results.success.push({
                                entityId: data.entityId,
                                entityName: data.entityName || 'Unknown'
                            });
                            
                            console.log('Added UPDATE mutation (normal)');
                        }
                    }
                } else {
                    // INSERT PATH - No existing record
                    console.log('Creating new record');
                    
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
                    
                    mutationQl.push(
                        insertQl(DENOMINATION_TYPE(`insert_results_${mutationQl.length}`), {
                            objects: [denominationData]
                        })
                    );
                    
                    results.success.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown'
                    });
                    
                    console.log('Added INSERT mutation');
                }
                
            } catch (itemError) {
                console.error(`Error processing item ${data.entityId}:`, itemError);
                results.failed.push({
                    entityId: data.entityId,
                    entityName: data.entityName || 'Unknown',
                    error: itemError.message
                });
            }
        }
        
        console.log('\n=== MUTATION SUMMARY ===');
        console.log('Total mutations to execute:', mutationQl.length);
        console.log('Success:', results.success.length);
        console.log('Reprocessed:', results.reprocessed.length);
        console.log('Reopened:', results.reopened.length);
        console.log('Failed:', results.failed.length);
        
        // Execute all mutations in a single request
        if (mutationQl.length > 0) {
            console.log('Executing mutations...');
            
            const mutationResult = await graph.mutation(...mutationQl);
            
            if (mutationResult.errors && mutationResult.errors.length > 0) {
                console.error('GraphQL mutation errors:', mutationResult.errors);
                throw new Error(mutationResult.errors[0].message);
            }
            
            console.log('Mutations executed successfully');
        } else {
            console.log('No mutations to execute');
        }
        
        // Determine overall success
        const totalProcessed = results.success.length + results.failed.length + results.reopened.length + results.reprocessed.length;
        const allSuccessful = results.failed.length === 0;
        
        // Build success message
        let successMessage = '';
        const successfulCount = results.success.length + results.reopened.length + results.reprocessed.length;
        
        if (allSuccessful) {
            if (results.reprocessed.length > 0) {
                successMessage = `${successfulCount} record(s) saved successfully (${results.reprocessed.length} reprocessed after rejection)`;
            } else if (results.reopened.length > 0) {
                successMessage = `${successfulCount} record(s) saved successfully (${results.reopened.length} reopened)`;
            } else {
                successMessage = `All ${totalProcessed} denomination record(s) saved successfully`;
            }
        } else {
            successMessage = `${successfulCount} saved, ${results.failed.length} failed`;
        }
        
        console.log('=== BATCH SAVE COMPLETE ===\n');
        
        res.status(200).json({
            success: allSuccessful,
            message: successMessage,
            results: results,
            summary: {
                total: totalProcessed,
                successful: results.success.length,
                reprocessed: results.reprocessed.length,
                reopened: results.reopened.length,
                failed: results.failed.length
            }
        });
        
    } catch (error) {
        console.error('Error in batch save denomination:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving denomination data',
            error: error.message
        });
    }
}