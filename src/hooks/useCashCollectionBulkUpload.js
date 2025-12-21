import { useState, useCallback, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { setCashCollectionGroup } from '@/redux/actions/cashCollectionActions';
import { formatPricePhp, safeNumber } from '@/lib/utils';
import { toast } from 'react-toastify';

/**
 * Custom hook for managing cash collection bulk upload functionality
 * 
 * This hook provides:
 * - Logic to determine if bulk upload should be available
 * - Data application from uploaded template
 * - State management for the upload process
 * 
 * @param {Object} options Configuration options
 * @param {Array} options.groupData Current group cash collection data
 * @param {string} options.mode 'daily' or 'weekly'
 * @param {string} options.currentDate Current transaction date
 * @param {string} options.dayName Day name of the group (for weekly validation)
 * @param {Object} options.transactionSettings Transaction settings from redux
 */
const useCashCollectionBulkUpload = ({
    groupData,
    mode = 'daily',
    currentDate,
    dayName,
    transactionSettings = {}
}) => {
    const dispatch = useDispatch();
    const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);

    /**
     * Check if bulk upload should be available
     * 
     * For Daily:
     * - No current transactions exist for the day
     * - All paymentCollection values are 0 or empty
     * - No remarks added
     * 
     * For Weekly:
     * - Check if it's the correct day for the group
     * - No paymentCollection or all are 0
     * - No remarks added in any transaction
     */
    const isBulkUploadAvailable = useMemo(() => {
        if (!groupData || groupData.length === 0) return false;

        // Filter out totals row and empty slots
        const clientData = groupData.filter(
            g => g.status !== 'totals' && g.fullName && g.fullName !== '-'
        );

        if (clientData.length === 0) return false;

        if (mode === 'daily') {
            // For daily: Check if no transactions have been entered
            const hasAnyTransaction = clientData.some(client => {
                const hasPayment = safeNumber(client.paymentCollection) > 0;
                const hasMcbuCol = safeNumber(client.mcbuCol) > 0;
                const hasCsfCol = safeNumber(client.csfCollection) > 0;
                const hasRemarks = client.remarks?.value && client.remarks.value !== '';
                
                return hasPayment || hasMcbuCol || hasCsfCol || hasRemarks;
            });

            return !hasAnyTransaction;
        } else {
            // For weekly: Check based on the requirements
            // Since weekly has pre-save function, check if any real data has been entered
            const hasAnyRealData = clientData.some(client => {
                const hasPayment = safeNumber(client.paymentCollection) > 0;
                const hasRemarks = client.remarks?.value && client.remarks.value !== '';
                
                return hasPayment || hasRemarks;
            });

            return !hasAnyRealData;
        }
    }, [groupData, mode]);

    /**
     * Apply uploaded data to the cash collection form
     * This maps the uploaded data to the existing group data format
     * and dispatches the update to Redux
     */
    const applyUploadedData = useCallback((uploadedData) => {
        if (!uploadedData || !groupData) return;

        try {
            // Create a map of uploaded data by slotNo for quick lookup
            const uploadedMap = new Map();
            uploadedData.forEach(item => {
                uploadedMap.set(item.slotNo, item);
            });

            // Find totals index
            const totalIdx = groupData.findIndex(g => g.status === 'totals');

            // Map the existing group data with uploaded values
            const updatedData = groupData.map((client, idx) => {
                // Skip totals row
                if (client.status === 'totals') return client;
                
                // Skip empty slots
                if (!client.fullName || client.fullName === '-') return client;

                const uploaded = uploadedMap.get(client.slotNo);
                
                if (!uploaded || !uploaded.hasUploadedData) {
                    return client;
                }

                // Create a copy of the client data
                let updatedClient = JSON.parse(JSON.stringify(client));

                // Store previous data for potential calculations
                if (!updatedClient.prevData) {
                    updatedClient.prevData = {
                        amountRelease: updatedClient.amountRelease,
                        paymentCollection: updatedClient.paymentCollection,
                        excess: updatedClient.excess !== '-' ? updatedClient.excess : 0,
                        loanBalance: updatedClient.loanBalance,
                        activeLoan: updatedClient.activeLoan,
                        noOfPayments: updatedClient.noOfPayments,
                        total: updatedClient.total,
                        pastDue: updatedClient.pastDue,
                        mcbu: updatedClient.mcbu,
                        csf: updatedClient.csf,
                        advanceDays: updatedClient.advanceDays,
                        csfCollection: updatedClient.csfCollection,
                        mcbuCol: updatedClient.mcbuCol
                    };
                }

                // Apply Payment Collection
                if (uploaded.uploadedPaymentCollection > 0) {
                    const paymentCollection = uploaded.uploadedPaymentCollection;
                    const activeLoan = safeNumber(updatedClient.activeLoan);
                    
                    updatedClient.paymentCollection = paymentCollection;
                    updatedClient.paymentCollectionStr = formatPricePhp(paymentCollection);
                    
                    // Calculate number of payments
                    if (activeLoan > 0) {
                        updatedClient.noOfPayments = Math.floor(paymentCollection / activeLoan);
                    }
                    
                    // Calculate loan balance
                    const prevLoanBalance = safeNumber(updatedClient.prevData.loanBalance);
                    updatedClient.loanBalance = prevLoanBalance - paymentCollection;
                    updatedClient.loanBalanceStr = formatPricePhp(updatedClient.loanBalance);
                    
                    // Calculate excess (advance payment)
                    if (paymentCollection > activeLoan) {
                        const excess = paymentCollection - activeLoan;
                        updatedClient.excess = excess;
                        updatedClient.excessStr = formatPricePhp(excess);
                    }
                    
                    // Update total
                    updatedClient.total = paymentCollection;
                    
                    updatedClient._dirty = true;
                }

                // Apply MCBU Collection
                if (uploaded.uploadedMcbuCol > 0) {
                    const mcbuCol = uploaded.uploadedMcbuCol;
                    updatedClient.mcbuCol = mcbuCol;
                    updatedClient.mcbuColStr = formatPricePhp(mcbuCol);
                    
                    // Add to MCBU balance
                    const prevMcbu = safeNumber(updatedClient.prevData?.mcbu || updatedClient.mcbu);
                    updatedClient.mcbu = prevMcbu + mcbuCol;
                    updatedClient.mcbuStr = formatPricePhp(updatedClient.mcbu);
                    
                    updatedClient._dirty = true;
                }

                // Apply CSF Collection
                if (uploaded.uploadedCsfCol > 0) {
                    const csfCol = uploaded.uploadedCsfCol;
                    updatedClient.csfCollection = csfCol;
                    updatedClient.csfCollectionStr = formatPricePhp(csfCol);
                    
                    // Add to CSF balance
                    const prevCsf = safeNumber(updatedClient.prevData?.csf || updatedClient.csf);
                    updatedClient.csf = prevCsf + csfCol;
                    updatedClient.csfStr = formatPricePhp(updatedClient.csf);
                    
                    updatedClient._dirty = true;
                }

                // Apply Remarks
                if (uploaded.uploadedRemarks?.value) {
                    updatedClient.remarks = uploaded.uploadedRemarks;
                    updatedClient._dirty = true;
                }

                // Apply MCBU Withdrawal flag
                if (uploaded.uploadedMcbuWithdrawal > 0) {
                    updatedClient.mcbuWithdrawal = uploaded.uploadedMcbuWithdrawal;
                    updatedClient.mcbuWithdrawalStr = formatPricePhp(uploaded.uploadedMcbuWithdrawal);
                    updatedClient.mcbuWithdrawFlag = true;
                    updatedClient._dirty = true;
                }

                // Apply Advance Days
                if (uploaded.uploadedAdvanceDays > 0) {
                    updatedClient.advanceDays = uploaded.uploadedAdvanceDays;
                    updatedClient._dirty = true;
                }

                return updatedClient;
            });

            // Recalculate totals
            if (totalIdx > -1) {
                updatedData[totalIdx] = calculateTotals(updatedData);
            }

            // Sort by slot number
            updatedData.sort((a, b) => {
                if (a.status === 'totals') return 1;
                if (b.status === 'totals') return -1;
                return a.slotNo - b.slotNo;
            });

            // Dispatch to Redux
            dispatch(setCashCollectionGroup(updatedData));

            return updatedData;
        } catch (error) {
            console.error('Error applying uploaded data:', error);
            toast.error('Failed to apply uploaded data');
            return null;
        }
    }, [groupData, dispatch]);

    /**
     * Calculate totals for the cash collection
     */
    const calculateTotals = (data) => {
        const clients = data.filter(d => d.status !== 'totals' && d.fullName !== '-');
        
        return {
            status: 'totals',
            fullName: 'TOTAL',
            paymentCollection: clients.reduce((sum, c) => sum + safeNumber(c.paymentCollection), 0),
            paymentCollectionStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.paymentCollection), 0)),
            mcbuCol: clients.reduce((sum, c) => sum + safeNumber(c.mcbuCol), 0),
            mcbuColStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.mcbuCol), 0)),
            csfCollection: clients.reduce((sum, c) => sum + safeNumber(c.csfCollection), 0),
            csfCollectionStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.csfCollection), 0)),
            mcbu: clients.reduce((sum, c) => sum + safeNumber(c.mcbu), 0),
            mcbuStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.mcbu), 0)),
            csf: clients.reduce((sum, c) => sum + safeNumber(c.csf), 0),
            csfStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.csf), 0)),
            excess: clients.reduce((sum, c) => sum + safeNumber(c.excess), 0),
            excessStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.excess), 0)),
            loanBalance: clients.reduce((sum, c) => sum + safeNumber(c.loanBalance), 0),
            loanBalanceStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.loanBalance), 0)),
            targetCollection: clients.reduce((sum, c) => sum + safeNumber(c.targetCollection || c.activeLoan), 0),
            targetCollectionStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.targetCollection || c.activeLoan), 0)),
            mcbuWithdrawal: clients.reduce((sum, c) => sum + safeNumber(c.mcbuWithdrawal), 0),
            mcbuWithdrawalStr: formatPricePhp(clients.reduce((sum, c) => sum + safeNumber(c.mcbuWithdrawal), 0)),
            totalCollection: clients.reduce((sum, c) => sum + safeNumber(c.paymentCollection) + safeNumber(c.mcbuCol) + safeNumber(c.csfCollection), 0),
        };
    };

    /**
     * Open the bulk upload modal
     */
    const openBulkUploadModal = useCallback(() => {
        if (isBulkUploadAvailable) {
            setShowBulkUploadModal(true);
        } else {
            toast.warning('Bulk upload is not available. Transactions have already been entered for this group.');
        }
    }, [isBulkUploadAvailable]);

    /**
     * Close the bulk upload modal
     */
    const closeBulkUploadModal = useCallback(() => {
        setShowBulkUploadModal(false);
    }, []);

    /**
     * Handle upload completion
     */
    const handleUploadComplete = useCallback((uploadedData) => {
        const result = applyUploadedData(uploadedData);
        if (result) {
            setShowBulkUploadModal(false);
        }
    }, [applyUploadedData]);

    return {
        // State
        showBulkUploadModal,
        isBulkUploadAvailable,
        
        // Actions
        openBulkUploadModal,
        closeBulkUploadModal,
        handleUploadComplete,
        applyUploadedData,
    };
};

export default useCashCollectionBulkUpload;