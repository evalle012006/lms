import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS, GROUP_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { generateUUID } from '@/lib/utils';

export default apiHandler({
    post: saveDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS)('results');
const GROUP_TYPE = createGraphType('groups', GROUP_FIELDS)('groups');

async function saveDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const data = req.body;
    
    // Check if user has permission to save (only cashier)
    if (user.role.shortCode !== 'cashier') {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to modify denomination data'
        });
    }
    
    try {
        const currentDateTime = moment().utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        const currentDate = moment().format('YYYY-MM-DD');
        
        // Validate required fields
        if (!data.entityId || !data.entityType) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: entityId and entityType'
            });
        }
        
        // Validate entity type - ONLY group level denominations are saved
        if (data.entityType !== 'group') {
            return res.status(400).json({
                success: false,
                message: 'Denominations can only be saved at group level'
            });
        }
        
        // Validate numeric fields
        const totalNetCollection = parseFloat(data.totalNetCollection) || 0;
        const totalRemittance = parseFloat(data.totalRemittance) || 0;
        const activeClients = parseInt(data.activeClients) || 0;
        const amountSitDown = parseFloat(data.amountSitDown) || 0;
        
        // Validate that remittance is not negative
        if (totalRemittance < 0) {
            return res.status(400).json({
                success: false,
                message: 'Total remittance cannot be negative'
            });
        }
        
        // Initialize entity IDs
        let branchId = null;
        let loId = null;
        let groupId = null;
        
        // Query group data to get branchId and loanOfficerId
        const groupQuery = await graph.query(
            queryQl(GROUP_TYPE, {
                _id: { _eq: data.entityId }
            })
        );
        
        const group = groupQuery?.data?.groups?.[0];
        
        if (!group) {
            return res.status(404).json({
                success: false,
                message: 'Group not found'
            });
        }
        
        // Map group data to denomination fields
        groupId = data.entityId;
        loId = group.loanOfficerId;
        branchId = group.branchId;
        
        console.log('Group data retrieved:', {
            groupId,
            loId,
            branchId,
            groupName: group.name
        });
        
        // Calculate BCC vs Remittances
        const bccVsRemittances = totalNetCollection - totalRemittance;
        
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
            action: 'save'
        };
        
        // Check if record exists for this specific group and date
        const existingQuery = await graph.query(
            queryQl(DENOMINATION_TYPE, {
                group_id: { _eq: groupId },
                date_added: { _eq: data.date || currentDate }
            })
        );
        
        console.log('Checking for existing denomination:', {
            groupId,
            date: data.date || currentDate
        });
        
        const existingRecords = existingQuery?.data?.results || [];
        
        console.log('Existing denomination records found:', existingRecords.length, {
            groupId: groupId,
            existingRecordIds: existingRecords.map(r => ({ _id: r._id, status: r.status }))
        });
        
        let result;
        
        if (existingRecords.length > 0) {
            // Update existing record
            const existingRecord = existingRecords[0];
            
            // Special case: If record is approved but net collection has changed
            if (existingRecord.status === 'approved') {
                const collectionChanged = totalNetCollection !== (existingRecord.total_net_collection || 0);
                
                if (collectionChanged) {
                    // Archive the approved record in history with complete current data
                    const approvedSnapshot = {
                        date_time: currentDateTime,
                        action: 'reopened_due_to_collection_change',
                        user_id: user._id,
                        user_name: `${user.firstName} ${user.lastName}`,
                        previous_status: 'approved',
                        active_clients: activeClients,  // Current active clients
                        amount_sit_down: amountSitDown, // Current sit down
                        previous_total_net_collection: existingRecord.total_net_collection,
                        previous_total_remittance: existingRecord.total_remittance,
                        previous_bcc_vs_remittances: existingRecord.bcc_vs_remittances,
                        previous_approval_date: existingRecord.approval_date,
                        new_total_net_collection: totalNetCollection,
                        total_remittance: totalRemittance, // Current remittance (715)
                        bcc_vs_remittances: bccVsRemittances, // Current BCC vs Remittances
                        reason: `Collection updated from ₱${existingRecord.total_net_collection} to ₱${totalNetCollection}`
                    };
                    
                    // Update to draft status with new values
                    const updateData = {
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
                        // Keep approval_date to show it was previously approved
                    };
                    
                    if (branchId) updateData.branch_id = branchId;
                    if (loId) updateData.lo_id = loId;
                    if (groupId) updateData.group_id = groupId;
                    
                    result = await graph.mutation(
                        updateQl(DENOMINATION_TYPE, {
                            where: { _id: { _eq: existingRecord._id } },
                            set: updateData,
                            jsonAppend: {
                                history: approvedSnapshot
                            }
                        })
                    );
                    
                    console.log('Reopened approved record due to collection change:', existingRecord._id);
                    
                    return res.status(200).json({
                        success: true,
                        message: 'Collection amount changed. Record reopened for review.',
                        data: result.data?.results?.returning?.[0],
                        reopened: true
                    });
                } else {
                    // No collection change, cannot modify approved record
                    return res.status(400).json({
                        success: false,
                        message: 'Cannot modify approved denomination data without collection changes'
                    });
                }
            }
            
            // Check if record is rejected - can be resubmitted
            if (existingRecord.status === 'rejected') {
                // Allow resubmission of rejected records
                console.log('Resubmitting rejected record');
            }
            
            // For pending/draft records, validate remittance
            if (totalRemittance < (existingRecord.total_remittance || 0)) {
                return res.status(400).json({
                    success: false,
                    message: `Remittance cannot be less than previously saved amount (₱${existingRecord.total_remittance.toFixed(2)})`
                });
            }
            
            // Normal update for pending/draft records
            // DON'T update group_id, lo_id, branch_id - they're immutable!
            const updateData = {
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
            };
            
            result = await graph.mutation(
                updateQl(DENOMINATION_TYPE, {
                    where: { 
                        _id: { _eq: existingRecord._id },
                        group_id: { _eq: groupId } // Extra safety check
                    },
                    set: updateData,
                    jsonAppend: {
                        history: historyEntry
                    }
                })
            );
            
            console.log('Updated denomination record:', existingRecord._id);
        } else {
            // Insert new record with all three IDs properly set
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
                date_added: data.date || currentDate,
                inserted_date: currentDateTime,
                modified_date: currentDateTime,
                inserted_by: user._id,
                modified_by: user._id,
                approval_date: null,
                rejection_date: null,
                rejection_reason: null
            };
            
            console.log('Inserting denomination with IDs:', {
                branch_id: branchId,
                lo_id: loId,
                group_id: groupId
            });
            
            result = await graph.mutation(
                insertQl(DENOMINATION_TYPE, {
                    objects: [denominationData]
                })
            );
            
            console.log('Inserted new denomination record');
        }
        
        if (result.errors && result.errors.length > 0) {
            console.error('GraphQL errors:', result.errors);
            throw new Error(result.errors[0].message);
        }
        
        const returnedData = result.data?.results?.returning?.[0] || result.data?.results?.[0];
        
        res.status(200).json({
            success: true,
            message: existingRecords.length > 0 
                ? 'Denomination data updated successfully' 
                : 'Denomination data saved successfully',
            data: returnedData
        });
        
    } catch (error) {
        console.error('Error saving denomination:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving denomination data',
            error: error.message
        });
    }
}