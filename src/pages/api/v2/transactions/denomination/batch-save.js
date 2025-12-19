import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl, deleteQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS, GROUP_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { generateUUID } from '@/lib/utils';
import { getSystemDate } from '@/lib/date-utils';

export default apiHandler({
    post: batchSaveDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS);
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS);

async function batchSaveDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { items, date, isSubmission, isAdminAdjustment } = req.body;

    const isAdmin = user.role.rep === 1;
    const isCashier = user.role.shortCode === 'cashier';
    
    if (!isCashier && !isAdmin) {
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
        const currentDateTime = moment(getSystemDate()).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        const currentDate = date || moment(getSystemDate()).format('YYYY-MM-DD');
        
        // ==========================================
        // FIX: DEDUPLICATE ITEMS BY ENTITY ID
        // Keep only the last occurrence of each entityId
        // ==========================================
        const deduplicatedItems = [];
        const seenEntityIds = new Set();
        
        // Process in reverse to keep the last occurrence
        for (let i = items.length - 1; i >= 0; i--) {
            const item = items[i];
            if (item.entityId && !seenEntityIds.has(item.entityId)) {
                seenEntityIds.add(item.entityId);
                deduplicatedItems.unshift(item);
            }
        }
        
        console.log(`Deduplicated items: ${items.length} -> ${deduplicatedItems.length}`);
        
        // Use deduplicated items from here on
        const processItems = deduplicatedItems;
        
        // ==========================================
        // VALIDATION FOR SUBMISSION
        // ==========================================
        if (isSubmission && !isAdminAdjustment) {
            const groupIds = processItems.map(item => item.entityId);
            
            // Fetch all groups - single query
            const groupsQuery = await graph.query(
                queryQl(GROUP_TYPE(), {
                    where: { _id: { _in: groupIds } }
                })
            );
            
            const groups = groupsQuery?.data?.groups || [];
            
            const groupMap = new Map();
            groups.forEach(group => {
                groupMap.set(group._id, group);
            });
            
            const missingRemittances = [];
            
            for (const item of processItems) {
                const group = groupMap.get(item.entityId);
                
                if (!group) {
                    console.warn(`Group not found: ${item.entityId}`);
                    continue;
                }
                
                const totalNetCollection = parseFloat(item.totalNetCollection) || 0;
                const morningRemittance = parseFloat(item.morningRemittance) || 0;
                const afternoonRemittance = parseFloat(item.afternoonRemittance) || 0;
                const totalRemittance = morningRemittance + afternoonRemittance;
                
                if (totalNetCollection > 0 && totalRemittance === 0) {
                    missingRemittances.push({
                        entityId: item.entityId,
                        entityName: item.entityName || group.name || 'Unknown Group',
                        totalNetCollection: totalNetCollection
                    });
                }
            }
            
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
        }
        
        // ==========================================
        // FIX: BATCH FETCH ALL EXISTING RECORDS FIRST
        // This ensures we get the latest state before any mutations
        // ==========================================
        const allGroupIds = processItems
            .filter(item => item.entityType === 'group')
            .map(item => item.entityId);
        
        let existingRecordsMap = new Map();
        
        if (allGroupIds.length > 0) {
            const existingQuery = await graph.query(
                queryQl(DENOMINATION_TYPE('existing'), {
                    where: {
                        group_id: { _in: allGroupIds },
                        date_added: { _eq: currentDate }
                    }
                })
            );
            
            const existingRecords = existingQuery?.data?.existing || [];
            
            // FIX: Handle duplicates - keep the most recent one for each group
            // Group records by group_id
            const recordsByGroup = new Map();
            existingRecords.forEach(record => {
                const groupId = record.group_id;
                if (!recordsByGroup.has(groupId)) {
                    recordsByGroup.set(groupId, []);
                }
                recordsByGroup.get(groupId).push(record);
            });
            
            // For each group, pick the most recent record and mark others for cleanup
            const duplicatesToDelete = [];
            
            recordsByGroup.forEach((records, groupId) => {
                if (records.length > 1) {
                    console.warn(`⚠️ Found ${records.length} duplicate records for group ${groupId} on ${currentDate}`);
                    
                    // Sort by modified_date descending, then by approval_date
                    records.sort((a, b) => {
                        // Prioritize approved records
                        if (a.status === 'approved' && b.status !== 'approved') return -1;
                        if (b.status === 'approved' && a.status !== 'approved') return 1;
                        
                        // Then by modified_date
                        const dateA = new Date(a.modified_date || a.inserted_date);
                        const dateB = new Date(b.modified_date || b.inserted_date);
                        return dateB - dateA;
                    });
                    
                    // Keep the first (most recent/approved), delete the rest
                    existingRecordsMap.set(groupId, records[0]);
                    
                    for (let i = 1; i < records.length; i++) {
                        duplicatesToDelete.push(records[i]._id);
                        console.log(`  - Marking duplicate for deletion: ${records[i]._id} (status: ${records[i].status})`);
                    }
                } else {
                    existingRecordsMap.set(groupId, records[0]);
                }
            });
            
            // Clean up duplicates if found
            if (duplicatesToDelete.length > 0) {
                console.log(`🧹 Cleaning up ${duplicatesToDelete.length} duplicate records`);
                
                try {
                    await graph.mutation(
                        deleteQl(DENOMINATION_TYPE('cleanup'), {
                            where: { _id: { _in: duplicatesToDelete } }
                        })
                    );
                    console.log('✓ Duplicate records cleaned up');
                } catch (cleanupError) {
                    console.error('Error cleaning up duplicates:', cleanupError);
                    // Continue processing even if cleanup fails
                }
            }
        }
        
        // ==========================================
        // PROCESS EACH ITEM
        // ==========================================
        const results = {
            success: [],
            failed: [],
            reopened: [],
            reprocessed: []
        };
        
        const mutationList = [];
        const addToMutationList = addToList => mutationList.push(addToList(`mutation_${mutationList.length}`));
        
        // Track which groups we're inserting to prevent duplicates within this batch
        const insertingGroups = new Set();
        
        for (let i = 0; i < processItems.length; i++) {
            const data = processItems[i];
            
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
                
                // Validate entity type
                if (data.entityType !== 'group') {
                    console.log('Invalid entity type:', data.entityType);
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: 'Denominations can only be saved at group level'
                    });
                    continue;
                }
                
                const totalNetCollection = (data.totalNetCollection && data.totalNetCollection > 0) ? parseFloat(data.totalNetCollection) : data.totalNetCollection < 0 ? data.totalNetCollection : 0;
                const morningRemittance = (data.morningRemittance && data.morningRemittance > 0) ? parseFloat(data.morningRemittance) : data.morningRemittance < 0 ? data.morningRemittance : 0;
                const afternoonRemittance = (data.afternoonRemittance && data.afternoonRemittance > 0) ? parseFloat(data.afternoonRemittance) : data.afternoonRemittance < 0 ? data.afternoonRemittance : 0;
                const totalRemittance = morningRemittance + afternoonRemittance;
                const activeClients = parseInt(data.activeClients) || 0;
                const bccVsRemittances = totalNetCollection - totalRemittance;
                const remarks = data.remarks || '';
                
                // Get existing record from our pre-fetched map
                const existingRecord = existingRecordsMap.get(data.entityId);
                
                // ==========================================
                // FIX: PRESERVE SIT DOWN VALUES
                // Once saved, no_sit_down and amount_sit_down should NEVER be overridden
                // Use existing saved values if available, otherwise use incoming data
                // ==========================================
                let amountSitDown;
                let noSitDown;
                
                if (existingRecord) {
                    // ALWAYS use the existing saved values - never override
                    amountSitDown = existingRecord.amount_sit_down !== undefined && existingRecord.amount_sit_down !== null
                        ? parseFloat(existingRecord.amount_sit_down)
                        : (parseFloat(data.amountSitDown) || 0);
                    noSitDown = existingRecord.no_sit_down !== undefined && existingRecord.no_sit_down !== null
                        ? parseInt(existingRecord.no_sit_down)
                        : (parseInt(data.noSitDown) || 0);
                    
                    console.log(`Preserving sit down values for ${data.entityName}: noSitDown=${noSitDown}, amountSitDown=${amountSitDown} (from existing record)`);
                } else {
                    // New record - use incoming data
                    amountSitDown = parseFloat(data.amountSitDown) || 0;
                    noSitDown = parseInt(data.noSitDown) || 0;
                    
                    console.log(`New record sit down values for ${data.entityName}: noSitDown=${noSitDown}, amountSitDown=${amountSitDown}`);
                }
                
                // Validate total remittance doesn't exceed collection (skip for admin adjustments)
                if (!isAdminAdjustment && totalRemittance > totalNetCollection) {
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: `Total remittances (₱${totalRemittance.toFixed(2)}) cannot exceed net collection (₱${totalNetCollection.toFixed(2)})`
                    });
                    continue;
                }
                
                // Get group data
                const groupQuery = await graph.query(
                    queryQl(GROUP_TYPE(), {
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
                
                const groupId = data.entityId;
                const loId = group.loanOfficerId;
                const branchId = group.branchId;
                
                // Prepare history entry - use preserved sit down values
                const historyEntry = {
                    date_time: currentDateTime,
                    user_id: user._id,
                    user_name: `${user.firstName} ${user.lastName}`,
                    active_clients: activeClients,
                    total_net_collection: totalNetCollection,
                    morning_remittance: morningRemittance,
                    afternoon_remittance: afternoonRemittance,
                    no_sit_down: noSitDown,
                    amount_sit_down: amountSitDown,
                    bcc_vs_remittances: bccVsRemittances,
                    remarks: remarks,
                    action: isAdminAdjustment ? 'admin_adjustment' : (isSubmission ? 'submitted' : 'saved'),
                    ...(isAdminAdjustment && { note: 'Admin balance adjustment' })
                };
                
                // Process update or insert
                if (existingRecord) {
                    // UPDATE EXISTING RECORD
                    
                    if (isAdmin && isAdminAdjustment) {
                        console.log('Admin adjustment - updating record:', existingRecord._id);
                        
                        // NOTE: Even for admin adjustments, we preserve sit down values
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                bcc_vs_remittances: bccVsRemittances,
                                remarks: remarks,
                                // DO NOT update no_sit_down and amount_sit_down - preserve original values
                                modified_date: currentDateTime,
                                modified_by: user._id
                            },
                            jsonAppend: {
                                history: {
                                    ...historyEntry,
                                    previous_morning_remittance: existingRecord.morning_remittance,
                                    previous_afternoon_remittance: existingRecord.afternoon_remittance,
                                    previous_bcc_vs_remittances: existingRecord.bcc_vs_remittances,
                                    previous_remarks: existingRecord.remarks || ''
                                }
                            }
                        }));
                        
                        results.success.push({
                            entityId: data.entityId,
                            entityName: data.entityName,
                            adminAdjustment: true
                        });
                        continue;
                    }
                    
                    if (existingRecord.status === 'approved') {
                        const collectionChanged = totalNetCollection !== (existingRecord.total_net_collection || 0);
                        
                        if (collectionChanged) {
                            console.log('Collection changed after approval - reopening:', existingRecord._id);
                            
                            addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    active_clients: activeClients,
                                    total_net_collection: totalNetCollection,
                                    morning_remittance: morningRemittance,
                                    afternoon_remittance: afternoonRemittance,
                                    // DO NOT update no_sit_down and amount_sit_down - preserve original values
                                    bcc_vs_remittances: bccVsRemittances,
                                    remarks: remarks,
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
                            }));
                            
                            results.reopened.push({
                                entityId: data.entityId,
                                entityName: data.entityName,
                                message: 'Collection changed - status reset to pending'
                            });
                        } else {
                            console.log('No collection change - updating remittances only:', existingRecord._id);
                            
                            addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    morning_remittance: morningRemittance,
                                    afternoon_remittance: afternoonRemittance,
                                    // DO NOT update no_sit_down and amount_sit_down - preserve original values
                                    bcc_vs_remittances: bccVsRemittances,
                                    remarks: remarks,
                                    modified_date: currentDateTime,
                                    modified_by: user._id
                                },
                                jsonAppend: {
                                    history: historyEntry
                                }
                            }));
                            
                            results.success.push({
                                entityId: data.entityId,
                                entityName: data.entityName
                            });
                        }
                    } else if (existingRecord.status === 'rejected') {
                        console.log('Reprocessing rejected record:', existingRecord._id);
                        
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                active_clients: activeClients,
                                total_net_collection: totalNetCollection,
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                // DO NOT update no_sit_down and amount_sit_down - preserve original values
                                bcc_vs_remittances: bccVsRemittances,
                                remarks: remarks,
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
                        }));
                        
                        results.reprocessed.push({
                            entityId: data.entityId,
                            entityName: data.entityName,
                            message: 'Rejected entry reprocessed'
                        });
                    } else {
                        console.log('Updating pending/draft record:', existingRecord._id);
                        
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                active_clients: activeClients,
                                total_net_collection: totalNetCollection,
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                // DO NOT update no_sit_down and amount_sit_down - preserve original values
                                bcc_vs_remittances: bccVsRemittances,
                                remarks: remarks,
                                status: 'pending',
                                modified_date: currentDateTime,
                                modified_by: user._id
                            },
                            jsonAppend: {
                                history: historyEntry
                            }
                        }));
                        
                        results.success.push({
                            entityId: data.entityId,
                            entityName: data.entityName
                        });
                    }
                } else {
                    // INSERT NEW RECORD
                    
                    // FIX: Check if we're already inserting for this group in this batch
                    if (insertingGroups.has(groupId)) {
                        console.log(`⚠️ Skipping duplicate insert for group ${groupId} - already queued in this batch`);
                        continue;
                    }
                    
                    insertingGroups.add(groupId);
                    console.log('Inserting new record for group:', groupId);
                    
                    const denominationData = {
                        _id: generateUUID(),
                        branch_id: branchId,
                        lo_id: loId,
                        group_id: groupId,
                        active_clients: activeClients,
                        total_net_collection: totalNetCollection,
                        morning_remittance: morningRemittance,
                        afternoon_remittance: afternoonRemittance,
                        no_sit_down: noSitDown,
                        amount_sit_down: amountSitDown,
                        bcc_vs_remittances: bccVsRemittances,
                        remarks: remarks,
                        status: 'pending',
                        history: [historyEntry],
                        date_added: currentDate,
                        inserted_date: currentDateTime,
                        modified_date: currentDateTime,
                        inserted_by: user._id,
                        modified_by: user._id,
                        approval_date: null,
                        rejection_date: null,
                        rejection_reason: null,
                        synced: true
                    };
                    
                    addToMutationList(alias => insertQl(DENOMINATION_TYPE(alias), {
                        objects: [denominationData],
                        // FIX: Use on_conflict to handle race conditions
                        // This requires a unique constraint on (group_id, date_added)
                        on_conflict: {
                            constraint: 'denomination_group_id_date_added_key',
                            update_columns: [
                                'active_clients',
                                'total_net_collection',
                                'morning_remittance',
                                'afternoon_remittance',
                                // NOTE: Intentionally NOT including no_sit_down and amount_sit_down
                                // to preserve the original values on conflict
                                'bcc_vs_remittances',
                                'remarks',
                                'status',
                                'modified_date',
                                'modified_by'
                            ]
                        }
                    }));
                    
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
        if (mutationList.length > 0) {
            console.log('\n=== EXECUTING BATCH MUTATIONS ===');
            console.log('Mutations to execute:', mutationList.length);
            
            await graph.mutation(...mutationList);
            
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
            message: isAdminAdjustment ? 'Admin adjustments saved successfully' : 'Batch save completed',
            results: results,
            summary: {
                total: processItems.length,
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