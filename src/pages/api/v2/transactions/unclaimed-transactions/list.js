import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { 
    CASH_COLLECTIONS_FIELDS, 
    BRANCH_FIELDS,
    UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS 
} from '@/lib/graph.fields';
import { findUserById } from '@/lib/graph.functions';
import { getSystemDate } from '@/lib/date-utils';
import logger from '@/logger';
import moment from 'moment';

const graph = new GraphProvider();

// Create types with relationships
const UNCLAIMED_TRANSACTION_TYPE = createGraphType('unclaimed_amount_transactions', `
    ${UNCLAIMED_AMOUNT_TRANSACTIONS_FIELDS}
`)('unclaimedTransactions');

const CASH_COLLECTION_WITH_BRANCH = createGraphType('cashCollections', `
    ${CASH_COLLECTIONS_FIELDS}
    branch {
        ${BRANCH_FIELDS}
    }
`)('cashCollections');

export default apiHandler({
    get: listUnclaimedTransactions
});

/**
 * Get list of unclaimed amount transactions from cash collections
 * Supports role-based filtering similar to cash-collection/index.js
 */
async function listUnclaimedTransactions(req, res) {
    const user_id = req?.auth?.sub;
    const { status, branchId, loId, groupId } = req.query;

    try {
        // Get current user for role-based filtering
        const currentUser = await findUserById(user_id);
        
        if (!currentUser) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized'
            });
        }

        logger.debug({
            user_id,
            page: 'List Unclaimed Transactions',
            role: currentUser.role.shortCode,
            status
        });

        // Build where clause for cash collections with remark 'offset-unclaimed'
        // remarks is a JSONB field: { "label": "...", "value": "offset-unclaimed" }
        // IMPORTANT: Only show past transactions (dateAdded < current date)
        const currentSystemDate = moment(getSystemDate()).format('YYYY-MM-DD');
        
        let cashCollectionWhere = {
            remarks: {
                _contains: { value: 'offset-unclaimed' }
            },
            dateAdded: {
                _lt: currentSystemDate  // Only past dates, exclude current date
            }
        };

        // Apply role-based filtering
        // Priority: Query params > User role-based filtering
        if (branchId) {
            cashCollectionWhere.branchId = { _eq: branchId };
        } else if (loId) {
            cashCollectionWhere.loId = { _eq: loId };
        } else if (groupId) {
            cashCollectionWhere.groupId = { _eq: groupId };
        } else {
            // Apply user role-based filtering
            if (currentUser.role.shortCode === 'deputy_director') {
                cashCollectionWhere.divisionId = { _eq: currentUser.divisionId };
            } else if (currentUser.role.shortCode === 'regional_manager') {
                cashCollectionWhere.regionId = { _eq: currentUser.regionId };
            } else if (currentUser.role.shortCode === 'area_admin' || currentUser.role.shortCode === 'area_manager') {
                cashCollectionWhere.areaId = { _eq: currentUser.areaId };
            } else if (currentUser.role.rep === 3) {
                // Branch manager
                cashCollectionWhere.branchId = { _eq: currentUser.designatedBranchId };
            } else if (currentUser.role.rep === 4) {
                // Loan officer
                cashCollectionWhere.loId = { _eq: currentUser._id };
            }
        }

        // Different logic for claimed vs unclaimed
        if (status === 'claimed') {
            // For claimed transactions, fetch from unclaimed_amount_transactions table first
            const claimedTransactions = await graph.query(
                queryQl(UNCLAIMED_TRANSACTION_TYPE, {
                    where: { status: { _eq: 'claimed' } }
                })
            );

            const claimedTxList = claimedTransactions.data?.unclaimedTransactions || [];
            
            if (claimedTxList.length === 0) {
                return res.status(200).json({
                    success: true,
                    data: [],
                    total: 0
                });
            }

            // Get all cashCollection IDs
            const cashCollectionIds = claimedTxList.map(tx => tx.cash_collection_id);

            // Fetch the corresponding cashCollections for display data
            const cashCollections = await graph.query(
                queryQl(CASH_COLLECTION_WITH_BRANCH, {
                    where: {
                        _id: { _in: cashCollectionIds }
                    }
                })
            );

            const cashCollectionsList = cashCollections.data?.cashCollections || [];
            const ccMap = new Map(cashCollectionsList.map(cc => [cc._id, cc]));

            // Build result from claimed transactions
            const result = claimedTxList
                .map(tx => {
                    const cc = ccMap.get(tx.cash_collection_id);
                    if (!cc) return null; // Skip if cashCollection not found

                    const unclaimedAmount = (cc.mcbu || 0) + (cc.csf || 0) - (cc.loanBalance || 0);

                    return {
                        _id: cc._id,
                        cashCollectionId: cc._id,
                        dateOfOffset: cc.dateAdded,
                        branchName: cc.branch?.name || '-',
                        groupName: cc.groupName || '-',
                        slotNo: cc.slotNo || '-',
                        clientName: cc.fullName || '-',
                        amountRelease: cc.amountRelease || 0,
                        loanBalance: cc.loanBalance || 0,
                        mcbu: cc.mcbu || 0,
                        csf: cc.csf || 0,
                        unclaimedAmount: unclaimedAmount,
                        status: tx.status,
                        dateClaimed: tx.date_added,
                        documentUrl: tx.document_url,
                        transactionId: tx._id,
                        // Include IDs for reference
                        clientId: cc.clientId,
                        groupId: cc.groupId,
                        branchId: cc.branchId,
                        areaId: cc.areaId || cc.branch?.areaId || null,
                        regionId: cc.regionId || cc.branch?.regionId || null,
                        divisionId: cc.divisionId || cc.branch?.divisionId || null,
                        loanId: cc.loanId,
                        loId: cc.loId
                    };
                })
                .filter(Boolean); // Remove nulls

            return res.status(200).json({
                success: true,
                data: result,
                total: result.length
            });
        }

        // For unclaimed transactions, use original logic
        // Fetch cash collections with offset-unclaimed remark
        const cashCollections = await graph.query(
            queryQl(CASH_COLLECTION_WITH_BRANCH, {
                where: cashCollectionWhere,
                order_by: [{ dateAdded: 'desc' }]
            })
        );

        const cashCollectionsList = cashCollections.data?.cashCollections || [];

        // Fetch existing unclaimed transactions to filter out claimed ones
        const existingTransactions = await graph.query(
            queryQl(UNCLAIMED_TRANSACTION_TYPE, {})
        );

        const existingTxMap = new Map(
            (existingTransactions.data?.unclaimedTransactions || []).map(tx => [
                tx.cash_collection_id,
                tx
            ])
        );

        // Process and combine data
        const result = cashCollectionsList.map(cc => {
            const existingTx = existingTxMap.get(cc._id);
            
            // Skip if already claimed
            if (existingTx && existingTx.status === 'claimed') {
                return null;
            }
            
            const unclaimedAmount = (cc.mcbu || 0) + (cc.csf || 0) - (cc.loanBalance || 0);

            return {
                _id: cc._id,
                cashCollectionId: cc._id,
                dateOfOffset: cc.dateAdded,
                branchName: cc.branch?.name || '-',
                groupName: cc.groupName || '-',
                slotNo: cc.slotNo || '-',
                clientName: cc.fullName || '-',
                amountRelease: cc.amountRelease || 0,
                loanBalance: cc.loanBalance || 0,
                mcbu: cc.mcbu || 0,
                csf: cc.csf || 0,
                unclaimedAmount: unclaimedAmount,
                status: existingTx?.status || 'unclaimed',
                dateClaimed: existingTx?.date_added || null,
                documentUrl: existingTx?.document_url || null,
                transactionId: existingTx?._id || null,
                // Include IDs for creating transaction record
                clientId: cc.clientId,
                groupId: cc.groupId,
                branchId: cc.branchId,
                // Get from cashCollections if available, otherwise from branch
                areaId: cc.areaId || cc.branch?.areaId || null,
                regionId: cc.regionId || cc.branch?.regionId || null,
                divisionId: cc.divisionId || cc.branch?.divisionId || null,
                loanId: cc.loanId,
                loId: cc.loId
            };
        }).filter(Boolean); // Remove nulls (claimed transactions)

        // No need to filter by status again since we already filtered claimed ones
        res.status(200).json({
            success: true,
            data: result,
            total: result.length
        });

    } catch (error) {
        logger.error({
            page: 'List Unclaimed Transactions',
            message: 'Error fetching unclaimed transactions',
            error: error.message,
            stack: error.stack
        });

        res.status(500).json({
            success: false,
            message: 'Error fetching unclaimed transactions',
            error: error.message
        });
    }
}