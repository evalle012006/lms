import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, updateQl, queryQl } from '@/lib/graph/graph.util';
import { DENOMINATION_FIELDS } from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import moment from 'moment';
import { getSystemDate } from '@/lib/date-utils';
import { isNotificationEnabled, notifyDenominationApproved, notifyDenominationRejected } from '@/lib/notification-service';
import { findBranches, findGroups } from '@/lib/graph.functions';

export default apiHandler({
    post: approveDenomination,
    put: rejectDenomination
});

const graph = new GraphProvider();
const DENOMINATION_TYPE = createGraphType('denomination', DENOMINATION_FIELDS)('results');

/**
 * Approve a pending denomination record
 * POST /api/v2/transactions/denomination/approve
 */
async function approveDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { id, denominationId, userRole } = req.body;
    
    const targetId = id || denominationId;
    const user_role = user.role.rep || userRole;

    const isNotificationEnabledFlag = await isNotificationEnabled();
    
    // ==========================================
    // MODIFIED: Explicitly block cashiers from approving
    // Even though cashiers now have rep=3, they should NOT be able to approve
    // ==========================================
    if (user.role.shortCode === 'cashier') {
        return res.status(403).json({
            success: false,
            message: 'Cashiers are not allowed to approve denominations. Only managers can approve.'
        });
    }
    
    // Check if user has permission to approve (managers and above - rep 3 or less, but NOT cashiers)
    // if (user_role > 3) {
    //     return res.status(403).json({
    //         success: false,
    //         message: 'You do not have permission to approve denomination data'
    //     });
    // }
    
    if (!targetId) {
        return res.status(400).json({
            success: false,
            message: 'Denomination ID is required'
        });
    }
    
    try {
        const currentDateTime = moment(getSystemDate()).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        
        // First, fetch the existing denomination to get history
        const existingQuery = await graph.query(
            queryQl(DENOMINATION_TYPE, {
                where: { _id: { _eq: targetId } }
            })
        );
        
        const existingRecord = existingQuery?.data?.results?.[0];
        
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Denomination record not found'
            });
        }
        
        // Verify the status is pending (can only approve pending records)
        if (existingRecord.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot approve: Record status is "${existingRecord.status}". Only pending records can be approved.`
            });
        }
        
        console.log('=== APPROVAL PROCESS ===');
        console.log('Approver:', user.firstName, user.lastName, '- Role:', user.role.shortCode);
        console.log('Record ID:', targetId);
        console.log('Current status:', existingRecord.status);
        
        // Update the last history entry to mark it as approved
        let updatedHistory = [...(existingRecord.history || [])];
        if (updatedHistory.length > 0) {
            const lastIndex = updatedHistory.length - 1;
            const lastEntry = updatedHistory[lastIndex];
            
            // Keep all original fields and just update the action and add approval info
            updatedHistory[lastIndex] = {
                ...lastEntry,
                action: 'approved',
                approval_user_id: user._id,
                approval_user_name: `${user.firstName} ${user.lastName}`,
                approval_date_time: currentDateTime,
                // NEW: Preserve remarks in approval history
                remarks: lastEntry.remarks || existingRecord.remarks || ''
            };
        }
        
        const result = await graph.mutation(
            updateQl(DENOMINATION_TYPE, {
                where: { _id: { _eq: targetId } },
                set: {
                    status: 'approved',
                    approval_date: currentDateTime,
                    modified_date: currentDateTime,
                    modified_by: user._id,
                    rejection_reason: null,
                    rejection_date: null,
                    history: updatedHistory,
                    synced: true
                }
            })
        );
        
        if (result.errors && result.errors.length > 0) {
            console.error('GraphQL errors:', result.errors);
            throw new Error(result.errors[0].message);
        }
        
        console.log('✓ Approval successful');
        console.log('=== APPROVAL COMPLETE ===');

        if (isNotificationEnabledFlag) {
            // Create notification for denomination approval
            try {
                const branches = await findBranches({ _id: { _eq: existingRecord.branch_id } });
                const groups = await findGroups({ _id: { _eq: existingRecord.group_id } });
                const branch = branches?.[0];
                const group = groups?.[0];

                if (branch && group) {
                    await notifyDenominationApproved({
                        groupId: existingRecord.group_id,
                        groupName: group.name,
                        branchId: existingRecord.branch_id,
                        areaId: branch.areaId,
                        regionId: branch.regionId,
                        divisionId: branch.divisionId,
                        loId: existingRecord.lo_id,
                        createdBy: user._id,
                        createdByName: `${user.firstName} ${user.lastName}`
                    });
                    
                    console.log('Notification created for denomination approval');
                }
            } catch (notifError) {
                console.error('Failed to create denomination approval notification:', notifError.message);
            }
        }
        
        res.status(200).json({
            success: true,
            message: 'Denomination approved successfully',
            data: result.data?.results?.returning?.[0]
        });
        
    } catch (error) {
        console.error('Error approving denomination:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving denomination',
            error: error.message
        });
    }
}

/**
 * Reject a pending denomination record
 * PUT /api/v2/transactions/denomination/approve
 */
async function rejectDenomination(req, res) {
    const user = await findUserById(req.auth.sub);
    const { id, denominationId, rejectionReason, userRole } = req.body;
    
    const targetId = id || denominationId;
    const user_role = user.role.rep || userRole;
    
    // ==========================================
    // MODIFIED: Explicitly block cashiers from rejecting
    // Even though cashiers now have rep=3, they should NOT be able to reject
    // ==========================================
    if (user.role.shortCode === 'cashier') {
        return res.status(403).json({
            success: false,
            message: 'Cashiers are not allowed to reject denominations. Only managers can reject.'
        });
    }
    
    // Check if user has permission to reject (managers and above - rep 3 or less, but NOT cashiers)
    if (user_role < 3) {
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to reject denomination data'
        });
    }
    
    if (!targetId) {
        return res.status(400).json({
            success: false,
            message: 'Denomination ID is required'
        });
    }
    
    if (!rejectionReason || rejectionReason.trim() === '') {
        return res.status(400).json({
            success: false,
            message: 'Rejection reason is required'
        });
    }
    
    try {
        const currentDateTime = moment(getSystemDate()).utcOffset(8).format('YYYY-MM-DD HH:mm:ss');
        
        // First, fetch the existing denomination to get history
        const existingQuery = await graph.query(
            queryQl(DENOMINATION_TYPE, {
                where: { _id: { _eq: targetId } }
            })
        );
        
        const existingRecord = existingQuery?.data?.results?.[0];
        
        if (!existingRecord) {
            return res.status(404).json({
                success: false,
                message: 'Denomination record not found'
            });
        }
        
        // Verify the status is pending (can only reject pending records)
        if (existingRecord.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `Cannot reject: Record status is "${existingRecord.status}". Only pending records can be rejected.`
            });
        }
        
        console.log('=== REJECTION PROCESS ===');
        console.log('Rejector:', user.firstName, user.lastName, '- Role:', user.role.shortCode);
        console.log('Record ID:', targetId);
        console.log('Current status:', existingRecord.status);
        console.log('Rejection reason:', rejectionReason);
        console.log('Existing history entries:', existingRecord.history?.length || 0);
        
        // Create a NEW rejection history entry (don't modify the last one)
        const rejectionHistoryEntry = {
            date_time: currentDateTime,
            action: 'rejected',
            rejection_user_id: user._id,
            rejection_user_name: `${user.firstName} ${user.lastName}`,
            rejection_date_time: currentDateTime,
            rejection_reason: rejectionReason.trim(),
            // Capture the state being rejected
            active_clients: existingRecord.active_clients,
            total_net_collection: existingRecord.total_net_collection,
            morning_remittance: existingRecord.morning_remittance,  // NEW: Include morning remittance
            afternoon_remittance: existingRecord.afternoon_remittance,  // NEW: Include afternoon remittance
            amount_sit_down: existingRecord.amount_sit_down,
            no_sit_down: existingRecord.no_sit_down,  // NEW: Include no_sit_down
            bcc_vs_remittances: existingRecord.bcc_vs_remittances,
            remarks: existingRecord.remarks || '',  // NEW: Include current remarks
            previous_status: existingRecord.status
        };
        
        console.log('Adding new rejection entry to history');
        console.log('Rejection entry:', rejectionHistoryEntry);
        
        // Use jsonAppend to ADD a new history entry
        const result = await graph.mutation(
            updateQl(DENOMINATION_TYPE, {
                where: { _id: { _eq: targetId } },
                set: {
                    status: 'rejected',
                    rejection_reason: rejectionReason.trim(),
                    rejection_date: currentDateTime,
                    modified_date: currentDateTime,
                    modified_by: user._id,
                    approval_date: null
                },
                jsonAppend: {
                    history: rejectionHistoryEntry
                }
            })
        );
        
        if (result.errors && result.errors.length > 0) {
            console.error('GraphQL errors:', result.errors);
            throw new Error(result.errors[0].message);
        }

        // Create notification for denomination rejection
        try {
            const branches = await findBranches({ _id: { _eq: existingRecord.branch_id } });
            const groups = await findGroups({ _id: { _eq: existingRecord.group_id } });
            const branch = branches?.[0];
            const group = groups?.[0];

            if (branch && group) {
                await notifyDenominationRejected({
                    groupId: existingRecord.group_id,
                    groupName: group.name,
                    branchId: existingRecord.branch_id,
                    areaId: branch.areaId,
                    regionId: branch.regionId,
                    divisionId: branch.divisionId,
                    loId: existingRecord.lo_id,
                    createdBy: user._id,
                    createdByName: `${user.firstName} ${user.lastName}`,
                    rejectReason: rejectionReason.trim()
                });
                
                console.log('Notification created for denomination rejection');
            }
        } catch (notifError) {
            console.error('Failed to create denomination rejection notification:', notifError.message);
        }
        
        console.log('✓ Rejection successful');
        console.log('=== REJECTION COMPLETE ===');
        
        res.status(200).json({
            success: true,
            message: 'Denomination rejected successfully',
            data: result.data?.results?.returning?.[0]
        });
        
    } catch (error) {
        console.error('Error rejecting denomination:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting denomination',
            error: error.message
        });
    }
}