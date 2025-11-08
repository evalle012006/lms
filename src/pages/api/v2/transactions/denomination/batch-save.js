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
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS);

async function batchSaveDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { items, date, isSubmission } = req.body;
    
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
        const currentDateTime = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        const currentDate = date || moment().format('YYYY-MM-DD');
        
        // ==========================================
        // VALIDATION FOR SUBMISSION
        // ==========================================
        if (isSubmission) {
            const groupIds = items.map(item => item.entityId);
            
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
            
            for (const item of items) {
                const group = groupMap.get(item.entityId);
                
                if (!group) {
                    console.warn(`Group not found: ${item.entityId}`);
                    continue;
                }
                
                const totalNetCollection = parseFloat(item.totalNetCollection) || 0;
                const morningRemittance = parseFloat(item.morningRemittance) || 0;
                const afternoonRemittance = parseFloat(item.afternoonRemittance) || 0;
                const totalRemittance = morningRemittance + afternoonRemittance;
                
                // NEW: Check if at least one remittance is entered when there's collection
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
        // PROCESS EACH ITEM
        // ==========================================
        const results = {
            success: [],
            failed: [],
            reopened: [],
            reprocessed: []
        };
        
        const queryList = [];
        const addToQueryList = addToList => queryList.push(addToList(`query_${queryList.length}`));
        const queryIndexMap = {};
        
        // Process each item and prepare queries
        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            
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
                const amountSitDown = parseFloat(data.amountSitDown) || 0;
                const noSitDown = parseInt(data.noSitDown) || 0;
                
                // // Validate remittances are not negative
                // if (morningRemittance == 0 || afternoonRemittance == 0) {
                //     console.log('Negative remittance');
                //     results.failed.push({
                //         entityId: data.entityId,
                //         entityName: data.entityName || 'Unknown',
                //         error: 'Remittances cannot be zero'
                //     });
                //     continue;
                // }
                
                // NEW: Validate total remittance doesn't exceed collection
                if (totalRemittance > totalNetCollection) {
                    // console.log('Remittance exceeds collection');
                    results.failed.push({
                        entityId: data.entityId,
                        entityName: data.entityName || 'Unknown',
                        error: `Total remittances (₱${totalRemittance.toFixed(2)}) cannot exceed net collection (₱${totalNetCollection.toFixed(2)})`
                    });
                    continue;
                }
                
                // Query group data - single query
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
                
                // console.log('Group data:', { groupId, loId, branchId });
                
                // NEW: Calculate BCC vs Remittances with both morning and afternoon
                const bccVsRemittances = totalNetCollection - totalRemittance;
                
                // Track query index for this entity
                queryIndexMap[data.entityId] = queryList.length;
                
                addToQueryList(alias => queryQl(DENOMINATION_TYPE(alias), {
                    where: {
                        group_id: { _eq: groupId },
                        date_added: { _eq: currentDate }
                    }
                }));
                
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
        // console.log('\n=== EXECUTING BATCH QUERY ===');
        const queryResults = queryList.length > 0 ? await graph.query(...queryList) : { data: {} };
        // console.log('Query results received');
        
        // Now process updates/inserts
        const mutationList = [];
        const addToMutationList = addToList => mutationList.push(addToList(`mutation_${mutationList.length}`));
        
        for (let i = 0; i < items.length; i++) {
            const data = items[i];
            
            // Skip if already failed
            if (results.failed.find(f => f.entityId === data.entityId)) {
                continue;
            }
            
            try {
                const totalNetCollection = parseFloat(data.totalNetCollection) || 0;
                const morningRemittance = parseFloat(data.morningRemittance) || 0;
                const afternoonRemittance = parseFloat(data.afternoonRemittance) || 0;
                const totalRemittance = morningRemittance + afternoonRemittance;
                const activeClients = parseInt(data.activeClients) || 0;
                const amountSitDown = parseFloat(data.amountSitDown) || 0;
                const noSitDown = parseInt(data.noSitDown) || 0;
                const bccVsRemittances = totalNetCollection - totalRemittance;
                
                // Get group data again
                const groupQuery = await graph.query(
                    queryQl(GROUP_TYPE(), {
                        where: { _id: { _eq: data.entityId } }
                    })
                );
                
                const group = groupQuery?.data?.groups?.[0];
                const groupId = data.entityId;
                const loId = group.loanOfficerId;
                const branchId = group.branchId;
                
                // Get existing records from batch query
                const queryIndex = queryIndexMap[data.entityId];
                const existingRecords = queryIndex !== undefined 
                    ? (queryResults?.data?.[`query_${queryIndex}`] || [])
                    : [];
                
                // console.log('Existing records found:', existingRecords.length);
                
                // NEW: Prepare history entry with both remittances
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
                    action: isAdmin ? 'admin_adjustment' : (isSubmission ? 'submitted' : 'saved'),
                    ...(isAdmin && { note: 'Admin balance adjustment' })
                };
                
                // Process update or insert
                if (existingRecords.length > 0) {
                    const existingRecord = existingRecords[0];

                    // NEW: Admin can edit regardless of status when balancing
                    if (isAdmin && bccVsRemittances === 0 && existingRecord.bcc_vs_remittances !== 0) {
                        // console.log('Admin balancing adjustment');
                        
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                bcc_vs_remittances: bccVsRemittances,
                                modified_date: currentDateTime,
                                modified_by: user._id
                            },
                            jsonAppend: {
                                history: {
                                    ...historyEntry,
                                    previous_morning_remittance: existingRecord.morning_remittance,
                                    previous_afternoon_remittance: existingRecord.afternoon_remittance,
                                    previous_bcc_vs_remittances: existingRecord.bcc_vs_remittances
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
                            // console.log('Collection changed after approval - reopening');
                            
                            addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    active_clients: activeClients,
                                    total_net_collection: totalNetCollection,
                                    morning_remittance: morningRemittance,
                                    afternoon_remittance: afternoonRemittance,
                                    no_sit_down: noSitDown,
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
                            }));
                            
                            results.reopened.push({
                                entityId: data.entityId,
                                entityName: data.entityName,
                                message: 'Collection changed - status reset to pending'
                            });
                        } else {
                            // console.log('No collection change - updating remittances only');
                            
                            addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                                where: { _id: { _eq: existingRecord._id } },
                                set: {
                                    morning_remittance: morningRemittance,
                                    afternoon_remittance: afternoonRemittance,
                                    no_sit_down: noSitDown,
                                    amount_sit_down: amountSitDown,
                                    bcc_vs_remittances: bccVsRemittances,
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
                        // console.log('Reprocessing rejected record');
                        
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                active_clients: activeClients,
                                total_net_collection: totalNetCollection,
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                no_sit_down: noSitDown,
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
                        }));
                        
                        results.reprocessed.push({
                            entityId: data.entityId,
                            entityName: data.entityName,
                            message: 'Rejected entry reprocessed'
                        });
                    } else {
                        // console.log('Updating pending/draft record');
                        
                        addToMutationList(alias => updateQl(DENOMINATION_TYPE(alias), {
                            where: { _id: { _eq: existingRecord._id } },
                            set: {
                                active_clients: activeClients,
                                total_net_collection: totalNetCollection,
                                morning_remittance: morningRemittance,
                                afternoon_remittance: afternoonRemittance,
                                no_sit_down: noSitDown,
                                amount_sit_down: amountSitDown,
                                bcc_vs_remittances: bccVsRemittances,
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
                    // console.log('Inserting new record');
                    
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
                        objects: [denominationData]
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