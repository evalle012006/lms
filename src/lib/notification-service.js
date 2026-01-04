import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl } from '@/lib/graph/graph.util';
import { generateUUID } from '@/lib/utils';
import { filterGraphFields } from '@/lib/graph.functions';
import moment from 'moment';
import { NOTIFICATION_FIELDS } from './graph.fields';

const graph = new GraphProvider();

const NOTIFICATION_TYPE = createGraphType('notifications', NOTIFICATION_FIELDS);

// Notification types enum
export const NOTIFICATION_TYPES = {
    // Client Events
    PROSPECT_CLIENT_CREATED: 'prospect_client_created',
    GROUP_LEADER_UPDATED: 'group_leader_updated',
    CLIENT_DELINQUENT_MARKED: 'client_delinquent_marked',
    
    // Loan Events
    LOAN_CREATED: 'loan_created',
    RELOAN_CREATED: 'reloan_created',
    LOAN_OFFSET: 'loan_offset',
    LOAN_APPROVED: 'loan_approved',
    LOAN_REJECTED: 'loan_rejected',
    
    // Withdrawal Events
    MCBU_WITHDRAWAL: 'mcbu_withdrawal',
    CSF_WITHDRAWAL: 'csf_withdrawal',
    MCBU_WITHDRAWAL_APPROVED: 'mcbu_withdrawal_approved',
    MCBU_WITHDRAWAL_REJECTED: 'mcbu_withdrawal_rejected',
    
    // Denomination Events
    DENOMINATION_CREATED: 'denomination_created',
    DENOMINATION_APPROVED: 'denomination_approved',
    DENOMINATION_REJECTED: 'denomination_rejected',
    
    // Transfer Events
    TRANSFER_CLIENT: 'transfer_client',
    TRANSFER_CLIENT_APPROVED: 'transfer_client_approved',
    TRANSFER_CLIENT_REJECTED: 'transfer_client_rejected',
    FUND_TRANSFER_APPROVED: 'fund_transfer_approved',
    FUND_TRANSFER_REJECTED: 'fund_transfer_rejected',
    
    // Collection Events
    CASH_COLLECTION_SAVED: 'cash_collection_saved',
    TRANSACTION_CLOSED: 'transaction_closed',
    BRANCH_TRANSACTION_APPROVED: 'branch_transaction_approved'
};

/**
 * Check if notifications are enabled in system settings
 * Uses the 'settings' table (system settings), not 'transactionSettings'
 * @returns {Promise<boolean>}
 */
export async function isNotificationEnabled() {
    try {
        const result = await graph.query(
            queryQl(
                createGraphType('settings', 'enableNotifications')('systemSettings'),
                { limit: 1 }
            )
        );

        const settings = result?.data?.systemSettings?.[0];
        
        // Default to true if setting doesn't exist (backward compatibility)
        if (!settings || settings.enableNotifications === undefined || settings.enableNotifications === null) {
            return true;
        }

        return settings.enableNotifications === true;
    } catch (error) {
        console.error('Error checking notification enabled status:', error);
        return true; // Default to enabled on error
    }
}

// Notification templates with title and message generators
const NOTIFICATION_TEMPLATES = {
    [NOTIFICATION_TYPES.PROSPECT_CLIENT_CREATED]: {
        title: 'New Prospect Client',
        getMessage: (data) => `${data.clientName} has been added as a prospect client in ${data.groupName || 'a group'}.`
    },
    [NOTIFICATION_TYPES.LOAN_CREATED]: {
        title: 'New Loan Created',
        getMessage: (data) => `A new loan of ₱${data.amount?.toLocaleString() || 0} has been created for ${data.clientName}.`
    },
    [NOTIFICATION_TYPES.RELOAN_CREATED]: {
        title: 'Reloan Created',
        getMessage: (data) => `A reloan (cycle ${data.loanCycle}) of ₱${data.amount?.toLocaleString() || 0} has been created for ${data.clientName}.`
    },
    [NOTIFICATION_TYPES.LOAN_OFFSET]: {
        title: 'Loan Offset',
        getMessage: (data) => `${data.clientName}'s loan has been offset. Previous balance: ₱${data.previousBalance?.toLocaleString() || 0}.`
    },
    [NOTIFICATION_TYPES.LOAN_APPROVED]: {
        title: 'Loan Approved',
        getMessage: (data) => `${data.clientName}'s loan application of ₱${data.amount?.toLocaleString() || 0} has been approved.`
    },
    [NOTIFICATION_TYPES.LOAN_REJECTED]: {
        title: 'Loan Rejected',
        getMessage: (data) => `${data.clientName}'s loan application has been rejected. Reason: ${data.rejectReason || 'Not specified'}.`
    },
    [NOTIFICATION_TYPES.MCBU_WITHDRAWAL]: {
        title: 'MCBU Withdrawal Request',
        getMessage: (data) => `${data.clientName} has requested an MCBU withdrawal of ₱${data.amount?.toLocaleString() || 0}.`
    },
    [NOTIFICATION_TYPES.CSF_WITHDRAWAL]: {
        title: 'CSF Withdrawal Request',
        getMessage: (data) => `${data.clientName} has requested a CSF withdrawal of ₱${data.amount?.toLocaleString() || 0}.`
    },
    [NOTIFICATION_TYPES.MCBU_WITHDRAWAL_APPROVED]: {
        title: 'Withdrawal Approved',
        getMessage: (data) => `${data.clientName}'s ${data.isCsf ? 'CSF' : 'MCBU'} withdrawal of ₱${data.amount?.toLocaleString() || 0} has been approved.`
    },
    [NOTIFICATION_TYPES.MCBU_WITHDRAWAL_REJECTED]: {
        title: 'Withdrawal Rejected',
        getMessage: (data) => `${data.clientName}'s ${data.isCsf ? 'CSF' : 'MCBU'} withdrawal has been rejected. Reason: ${data.rejectReason || 'Not specified'}.`
    },
    [NOTIFICATION_TYPES.GROUP_LEADER_UPDATED]: {
        title: 'Group Leader Updated',
        getMessage: (data) => `${data.clientName} has been ${data.isGroupLeader ? 'assigned as' : 'removed from'} group leader of ${data.groupName || 'a group'}.`
    },
    [NOTIFICATION_TYPES.CLIENT_DELINQUENT_MARKED]: {
        title: 'Client Delinquent Status',
        getMessage: (data) => `${data.clientName} has been ${data.isDelinquent ? 'marked as' : 'unmarked from'} delinquent status.`
    },
    [NOTIFICATION_TYPES.DENOMINATION_CREATED]: {
        title: 'Denomination Submitted',
        getMessage: (data) => `Denomination for ${data.groupName || 'group'} has been submitted with total collection ₱${data.totalCollection?.toLocaleString() || 0}.`
    },
    [NOTIFICATION_TYPES.DENOMINATION_APPROVED]: {
        title: 'Denomination Approved',
        getMessage: (data) => `Denomination for ${data.groupName || 'group'} has been approved.`
    },
    [NOTIFICATION_TYPES.DENOMINATION_REJECTED]: {
        title: 'Denomination Rejected',
        getMessage: (data) => `Denomination for ${data.groupName || 'group'} has been rejected. Reason: ${data.rejectReason || 'Not specified'}.`
    },
    [NOTIFICATION_TYPES.TRANSFER_CLIENT]: {
        title: 'Client Transfer Request',
        getMessage: (data) => `${data.clientName} transfer request from ${data.sourceGroup || 'source'} to ${data.targetGroup || 'target'} has been submitted.`
    },
    [NOTIFICATION_TYPES.TRANSFER_CLIENT_APPROVED]: {
        title: 'Client Transfer Approved',
        getMessage: (data) => `${data.clientName}'s transfer to ${data.targetGroup || 'new group'} has been approved.`
    },
    [NOTIFICATION_TYPES.TRANSFER_CLIENT_REJECTED]: {
        title: 'Client Transfer Rejected',
        getMessage: (data) => `${data.clientName}'s transfer request has been rejected. Reason: ${data.rejectReason || 'Not specified'}.`
    },
    [NOTIFICATION_TYPES.FUND_TRANSFER_APPROVED]: {
        title: 'Fund Transfer Approved',
        getMessage: (data) => `Fund transfer of ₱${data.amount?.toLocaleString() || 0} from ${data.giverBranch || 'giver'} to ${data.receiverBranch || 'receiver'} has been approved.`
    },
    [NOTIFICATION_TYPES.FUND_TRANSFER_REJECTED]: {
        title: 'Fund Transfer Rejected',
        getMessage: (data) => `Fund transfer request has been rejected. Reason: ${data.rejectReason || 'Not specified'}.`
    },
    [NOTIFICATION_TYPES.CASH_COLLECTION_SAVED]: {
        title: 'Cash Collection Saved',
        getMessage: (data) => `Cash collection for ${data.groupName || 'group'} has been saved with total ₱${data.totalCollection?.toLocaleString() || 0}.`
    },
    [NOTIFICATION_TYPES.TRANSACTION_CLOSED]: {
        title: 'Transaction Closed',
        getMessage: (data) => `Transactions for ${data.loName || 'Loan Officer'} have been closed for ${data.date || 'today'}.`
    },
    [NOTIFICATION_TYPES.BRANCH_TRANSACTION_APPROVED]: {
        title: 'Branch Transaction Approved',
        getMessage: (data) => `All branch transactions for ${data.branchName || 'branch'} have been approved for ${data.date || 'today'}.`
    }
};

/**
 * Create a notification
 * @param {Object} params - Notification parameters
 * @returns {Promise<Object>} Created notification
 */
export async function createNotification({
    type,
    data = {},
    divisionId,
    regionId,
    areaId,
    branchId,
    loId,
    clientId,
    loanId,
    groupId,
    createdBy,
    createdByName
}) {
    try {
        // Check if notifications are enabled in system settings
        const enabled = await isNotificationEnabled();
        if (!enabled) {
            console.log('Notifications disabled in system settings, skipping:', type);
            return null;
        }

        const template = NOTIFICATION_TEMPLATES[type];
        if (!template) {
            console.error(`Unknown notification type: ${type}`);
            return null;
        }

        const currentDateTime = moment().format('YYYY-MM-DD HH:mm:ss');

        const notificationData = {
            _id: generateUUID(),
            type,
            title: template.title,
            message: template.getMessage(data),
            data: data,
            division_id: divisionId || null,
            region_id: regionId || null,
            area_id: areaId || null,
            branch_id: branchId || null,
            lo_id: loId || null,
            client_id: clientId || null,
            loan_id: loanId || null,
            group_id: groupId || null,
            created_by: createdBy || null,
            created_by_name: createdByName || null,
            read_by: [],
            is_read: false,
            date_added: currentDateTime,
            date_modified: currentDateTime
        };

        const result = await graph.mutation(
            insertQl(NOTIFICATION_TYPE('notification'), {
                objects: [filterGraphFields(NOTIFICATION_FIELDS, notificationData)]
            })
        );

        if (result.errors && result.errors.length > 0) {
            console.error('Error creating notification:', result.errors);
            return null;
        }

        return result.data?.notification?.returning?.[0];
    } catch (error) {
        console.error('Failed to create notification:', error.message);
        return null;
    }
}

// ============================================
// HELPER FUNCTIONS FOR SPECIFIC NOTIFICATION TYPES
// ============================================

export async function notifyProspectClientCreated(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.PROSPECT_CLIENT_CREATED,
        data: {
            clientName: params.clientName,
            groupName: params.groupName
        },
        ...params
    });
}

export async function notifyLoanCreated(params) {
    const type = params.isReloan ? NOTIFICATION_TYPES.RELOAN_CREATED : NOTIFICATION_TYPES.LOAN_CREATED;
    return createNotification({
        type,
        data: {
            clientName: params.clientName,
            amount: params.amount,
            loanCycle: params.loanCycle
        },
        ...params
    });
}

export async function notifyLoanApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.LOAN_APPROVED,
        data: {
            clientName: params.clientName,
            amount: params.amount
        },
        ...params
    });
}

export async function notifyLoanRejected(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.LOAN_REJECTED,
        data: {
            clientName: params.clientName,
            rejectReason: params.rejectReason
        },
        ...params
    });
}

export async function notifyLoanOffset(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.LOAN_OFFSET,
        data: {
            clientName: params.clientName,
            previousBalance: params.previousBalance
        },
        ...params
    });
}

export async function notifyWithdrawal(params) {
    const type = params.isCsf ? NOTIFICATION_TYPES.CSF_WITHDRAWAL : NOTIFICATION_TYPES.MCBU_WITHDRAWAL;
    return createNotification({
        type,
        data: {
            clientName: params.clientName,
            amount: params.amount
        },
        ...params
    });
}

export async function notifyWithdrawalApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.MCBU_WITHDRAWAL_APPROVED,
        data: {
            clientName: params.clientName,
            amount: params.amount,
            isCsf: params.isCsf
        },
        ...params
    });
}

export async function notifyWithdrawalRejected(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.MCBU_WITHDRAWAL_REJECTED,
        data: {
            clientName: params.clientName,
            rejectReason: params.rejectReason,
            isCsf: params.isCsf
        },
        ...params
    });
}

export async function notifyGroupLeaderUpdated(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.GROUP_LEADER_UPDATED,
        data: {
            clientName: params.clientName,
            groupName: params.groupName,
            isGroupLeader: params.isGroupLeader
        },
        ...params
    });
}

export async function notifyClientDelinquent(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.CLIENT_DELINQUENT_MARKED,
        data: {
            clientName: params.clientName,
            isDelinquent: params.isDelinquent
        },
        ...params
    });
}

export async function notifyDenominationCreated(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.DENOMINATION_CREATED,
        data: {
            groupName: params.groupName,
            totalCollection: params.totalCollection
        },
        ...params
    });
}

export async function notifyDenominationApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.DENOMINATION_APPROVED,
        data: {
            groupName: params.groupName
        },
        ...params
    });
}

export async function notifyDenominationRejected(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.DENOMINATION_REJECTED,
        data: {
            groupName: params.groupName,
            rejectReason: params.rejectReason
        },
        ...params
    });
}

export async function notifyTransferClient(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.TRANSFER_CLIENT,
        data: {
            clientName: params.clientName,
            sourceGroup: params.sourceGroup,
            targetGroup: params.targetGroup
        },
        ...params
    });
}

export async function notifyTransferClientApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.TRANSFER_CLIENT_APPROVED,
        data: {
            clientName: params.clientName,
            targetGroup: params.targetGroup
        },
        ...params
    });
}

export async function notifyTransferClientRejected(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.TRANSFER_CLIENT_REJECTED,
        data: {
            clientName: params.clientName,
            rejectReason: params.rejectReason
        },
        ...params
    });
}

export async function notifyFundTransferApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.FUND_TRANSFER_APPROVED,
        data: {
            amount: params.amount,
            giverBranch: params.giverBranch,
            receiverBranch: params.receiverBranch
        },
        ...params
    });
}

export async function notifyFundTransferRejected(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.FUND_TRANSFER_REJECTED,
        data: {
            rejectReason: params.rejectReason
        },
        ...params
    });
}

export async function notifyTransactionClosed(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.TRANSACTION_CLOSED,
        data: {
            loName: params.loName,
            date: params.date
        },
        ...params
    });
}

export async function notifyBranchTransactionApproved(params) {
    return createNotification({
        type: NOTIFICATION_TYPES.BRANCH_TRANSACTION_APPROVED,
        data: {
            branchName: params.branchName,
            date: params.date
        },
        ...params
    });
}