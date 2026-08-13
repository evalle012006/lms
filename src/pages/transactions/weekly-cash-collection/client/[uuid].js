import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import React from 'react';
import { setCashCollectionGroup } from '@/redux/actions/cashCollectionActions';
import { setGroup, setGroupList } from '@/redux/actions/groupActions';
import DetailsHeader from '@/components/groups/DetailsHeader';
import moment from 'moment';
import { containsAnyLetters, formatPricePhp, hasValidGroupLeader, isValidCoMaker, normalizeCoMaker, displayCoMaker, safeNumber, UppercaseFirstLetter, isCoMakerSlotValid } from '@/lib/utils';
import { ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon, CurrencyDollarIcon, ExclamationTriangleIcon, ReceiptPercentIcon, StopCircleIcon } from '@heroicons/react/24/outline';
import { Info } from 'lucide-react';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import AddUpdateLoan from '@/components/transactions/loan-application/AddUpdateLoanDrawer';
import Dialog from '@/lib/ui/Dialog';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { setBranch, setBranchList } from '@/redux/actions/branchActions';
import { BehaviorSubject } from 'rxjs';
import Modal from '@/lib/ui/Modal';
import ClientDetailPage from '@/components/clients/ClientDetailPage';
import { setClient } from '@/redux/actions/clientActions';
import { LOR_NO_CSF_IN_REMARKS, LOR_ONLY_OFFSET_REMARKS, LOR_WEEKLY_REMARKS, getApiBaseUrl } from '@/lib/constants';
import CheckBox from '@/lib/ui/checkbox';
import ActionDropDown from '@/lib/ui/action-dropdown';
import WarningIconWithTooltip from '@/lib/ui/icons/warning-icon';
import AddUpdateMcbuWithdrawalDrawer from '@/components/transactions/mcbu-withdrawal/AddUpdateMcbuWithdrawalDrawer';
import mcbuInterestService from '@/services/mcbu-interest-service';
import McbuInterestBreakdownModal from '@/components/transactions/McbuInterestBreakdownModal';
import CashCollectionDetailsExcelExport from '@/components/transactions/CashCollectionDetailsExcelExport';
import { 
    saveCashCollectionWithRetry, 
    dateWatcher, 
    transactionStateManager,
    isNearMidnight,
    ERROR_CODES,
    canEditCurrentRelease, 
    canEditWithdrawal, 
} from '@/lib/transaction-utils';
import SaveProgressModal, { useSaveProgress } from '@/lib/ui/SaveProgressModal';
import EditAmountReleaseModal from '@/components/transactions/EditAmountReleaseModal';
import EditMcbuCsfWithdrawalModal from '@/components/transactions/EditMcbuCsfWithdrawalModal';
import { PencilSquareIcon } from '@heroicons/react/24/outline';
import { useMemo } from 'react';

const CashCollectionDetailsPage = () => {
    const isV2TransactionApiEnabled = process.env.NEXT_PUBLIC_TRANSACTION_API_VERSION === 'v2';
    const isStaging = process.env.NEXT_PUBLIC_STAGING ? process.env.NEXT_PUBLIC_STAGING : false
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const last5DaysOfTheMonth = useSelector(state => state.systemSettings.last5DaysOfTheMonth);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const currentBranch = useSelector(state => state.branch.data);
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupClients = useSelector(state => state.cashCollection.group);
    const [editMode, setEditMode] = useState(true);
    const [revertMode, setRevertMode] = useState(false);
    const [groupSummaryIsClose, setGroupSummaryIsClose] = useState(false);
    const [data, setData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentGroup, setCurrentGroup] = useState();
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentMonth = moment(currentDate).month();
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const [dateFilter, setDateFilter] = useState(currentDate);
    const dateFilterMonth = useMemo(() => moment(dateFilter).month(), [dateFilter])
    const [loan, setLoan] = useState();
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();
    const [offsetUseMCBU, setOffsetUseMCBU] = useState(false);
    const [closeLoan, setCloseLoan] = useState();
    const [remarksArr, setRemarksArr] = useState(LOR_WEEKLY_REMARKS);
    const [filter, setFilter] = useState(false);
    const maxDays = 24;
    const [groupFilter, setGroupFilter] = useState();
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);
    const [allowMcbuWithdrawal, setAllowMcbuWithdrawal] = useState(false);
    const [allowOffsetTransaction, setAllowOffsetTransaction] = useState(false);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const [mcbuRate, setMcbuRate] = useState(transactionSettings.mcbu || 8);
    const [hasDraft, setHasDraft] = useState(false);
    const [draftsCollection, setDraftsCollection] = useState([]);

    const [selectedSlot, setSelectedSlot] = useState();
    const [showWaningDialog, setShowWarningDialog] = useState(false);
    const [changeRemarks, setChangeRemarks] = useState(false);
    const [prevDraft, setPrevDraft] = useState(false);
    const [allowMcbuInterest, setAllowMcbuInterest] = useState(false);

    const [selectAll, setSelectAll] = useState(false);

    const [showMcbuWithdrawalDrawer, setShowMcbuWithdrawalDrawer] = useState(false);
    const [hasGroupLeader, setHasGroupLeader] = useState(false);

    const [mcbuInterestLoading, setMcbuInterestLoading] = useState(false);
    const [showMcbuBreakdownModal, setShowMcbuBreakdownModal] = useState(false);
    const [mcbuBreakdownData, setMcbuBreakdownData] = useState({
        breakdown: [],
        totalInterest: 0,
        year: new Date().getFullYear(),
        clientName: '',
        offsetDate: null,
        lackingAmount: 0
    });

    const [pageStale, setPageStale] = useState(false);
    const saveProgress = useSaveProgress();

    // Regional Manager Edit States
    const [showEditLoanModal, setShowEditLoanModal] = useState(false);
    const [showEditWithdrawalModal, setShowEditWithdrawalModal] = useState(false);
    const [editLoanCashCollection, setEditLoanCashCollection] = useState(null);
    const [editWithdrawalData, setEditWithdrawalData] = useState(null);
    const [editWithdrawalType, setEditWithdrawalType] = useState('mcbu');

    const [highlightedSlotNo, setHighlightedSlotNo] = useState(null);
    
    const handleHighlightCoMaker = (coMakerSlotNo) => {
        // Normalize and validate the coMaker value
        const normalizedSlotNo = normalizeCoMaker(coMakerSlotNo);
        
        if (!normalizedSlotNo) {
            console.log('Invalid coMaker value:', coMakerSlotNo);
            return;
        }
        
        // Check if the co-maker slot exists and has a client
        if (!isCoMakerSlotValid(coMakerSlotNo, data)) {
            console.log('Co-maker slot is empty or does not exist:', normalizedSlotNo);
            toast.info(`Co-maker slot #${normalizedSlotNo} is empty`);
            return;
        }
        
        console.log('Looking for slot:', normalizedSlotNo);
        
        // Set the highlighted slot number
        setHighlightedSlotNo(normalizedSlotNo);
        
        // Find the row element and scroll to it
        setTimeout(() => {
            const rowElement = document.querySelector(`[data-slot-no="${normalizedSlotNo}"]`);
            
            if (rowElement) {
                rowElement.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center' 
                });
                console.log('Found and scrolling to row:', normalizedSlotNo);
            } else {
                console.log('Row not found for slot:', normalizedSlotNo);
            }
            
            // Clear highlight after 3 seconds
            setTimeout(() => {
                setHighlightedSlotNo(null);
            }, 3000);
        }, 100);
    };

    /**
     * Handler for editing current release (principal loan)
     * @param {object} cc - Cash collection record
     */
    const handleEditCurrentRelease = (cc) => {
        setEditLoanCashCollection(cc);
        setShowEditLoanModal(true);
    };

    /**
     * Handler for editing withdrawal amounts
     * @param {object} cc - Cash collection record
     * @param {object} loan - The loan object
     * @param {string} type - 'mcbu' or 'csf'
     */
    const handleEditWithdrawal = (cc, type) => {
        setEditWithdrawalData({
            cashCollection: cc,
            mcbuWithdrawalRecord: cc.mcbuWithdrawalList?.[0] || null
        });
        setEditWithdrawalType(type);
        setShowEditWithdrawalModal(true);
    };

    /**
     * Handler for closing edit loan modal
     */
    const handleEditLoanModalClose = () => {
        setShowEditLoanModal(false);
        setEditLoanCashCollection(null);
        getCashCollections();
    };

    /**
     * Handler for closing edit withdrawal modal  
     */
    const handleEditWithdrawalModalClose = () => {
        setShowEditWithdrawalModal(false);
        setEditWithdrawalData(null);
        setEditWithdrawalType(null);
        // Refresh data after modal closes
        getCashCollections();
    };
    
    useEffect(() => {
        // Check for any interrupted transactions from previous sessions
        const interrupted = transactionStateManager.checkForInterruptedTransactions();
        if (interrupted.length > 0) {
            toast.warning(
                'Previous transaction may not have completed. Please verify your data.',
                { autoClose: 8000 }
            );
        }
        
        // Start watching for date changes
        dateWatcher.start(({ initialDate, currentDate }) => {
            console.warn('Date changed from', initialDate, 'to', currentDate);
            setPageStale(true);
            toast.warning(
                'The date has changed. Please refresh the page before submitting new transactions.',
                { autoClose: false }
            );
        });
        
        // Cleanup on unmount
        return () => {
            dateWatcher.stop();
        };
    }, []);

    const handleShowMcbuBreakdown = (selected) => {
        if (selected.mcbuInterestBreakdown && selected.mcbuInterestBreakdown.length > 0) {
            setMcbuBreakdownData({
                breakdown: selected.mcbuInterestBreakdown,
                totalInterest: selected.mcbuInterest || 0,
                year: selected.mcbuInterestYear || new Date().getFullYear(),
                clientName: selected.fullName || '',
                offsetDate: selected.mcbuInterestOffsetDate || null,
                lackingAmount: selected.mcbuInterestLacking || 0
            });
            setShowMcbuBreakdownModal(true);
        } else {
            toast.info('No breakdown data available. Calculate MCBU Interest first.');
        }
    };

    const handleCloseMcbuWithdrawalDrawer = () => {
        setShowMcbuWithdrawalDrawer(false);
        setTimeout(() => {
            getCashCollections();
        }, 500);
    }

    const handleShowWarningDialog = (e) => {
        e.stopPropagation();

        const hasSelected = data.filter(d => d.selected);
        if (hasSelected.length > 0) {
            // const currentDayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
            // if (currentDayName !== hasSelected[0].group.day) {
            //     toast.error('Selected client/s are not part of the group for today!');
            //     return;
            // }
            setShowWarningDialog(true);
        } else {
            toast.error('Please select at least one row to revert!');
        }
    }

    const handleShowClientInfoModal = (selected) => {
        if (selected.status !== 'totals') {
            const selectedClient = {...selected.client, profile: selected.client.profile ? selected.client.profile : ''};
            dispatch(setClient(selectedClient));
            setShowClientInfoModal(true);
        }
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
        setTimeout(async () => {
            window.location.reload();
        }, 1000);
    }

    const handleGroupFilter = (selected) => {
        setLoading(true);
        setGroupFilter(selected._id);
        setCurrentGroup(selected);
        router.push('/transactions/weekly-cash-collection/client/' + selected._id);
        setTimeout(() => {
            window.location.reload();
        }, 200);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
        if (filteredDate === currentDate) {
            setLoading(true);
            setFilter(false);
            getCashCollections();
        } else {
            setLoading(true);
            setFilter(true);
            getCashCollections(filteredDate);
        }
    }

    const getCashCollections = async (date) => {
        setLoading(true);
        const type = date ? 'filter' : 'current';
        let url = getApiBaseUrl() + 'transactions/cash-collections/get-loan-by-group-cash-collection?'
            + new URLSearchParams({ date: date ? date : currentDate, mode: 'weekly', groupId: uuid, type: type });
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];
            let selectedGroup = response.data.collection.length > 0 ? response.data.collection[0].group : {};
            let dataCollection = response.data.collection;
            let transactionStatus;
            if (type === 'filter') {
                dataCollection = dataCollection.filter(cc => cc.loanId !== null );
                transactionStatus = dataCollection.filter(cc => cc.status !== 'pending').filter(cc => cc.groupStatus === 'closed');
            } else {
                transactionStatus = dataCollection.filter(cc => cc.status !== 'pending').filter(cc => cc?.current[0]?.groupStatus === 'closed');
            }

            if (transactionStatus.length === 0 && (!date || currentDate === date)) {
                setEditMode(true);
                setGroupSummaryIsClose(false);

                if (selectedGroup && selectedGroup.day !== dayName) {
                    setEditMode(false);
                }
            } else {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }

            if (dataCollection.length === 0) {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }

            const currentCollections = dataCollection.filter(cc => !!cc.current?.[0]);
            if (currentCollections.length == dataCollection.length) {
                // setEditMode(false);
            }
            
            dataCollection.map(cc => {
                // Parse loan-level remarks if it comes back as a string
                if (cc.remarks && typeof cc.remarks === 'string') {
                    try { cc.remarks = JSON.parse(cc.remarks); } catch (e) { cc.remarks = null; }
                }

                let collection;
                let transferStr = '-';
                if ((cc?.transferred == true && cc.transferredDate == currentDate) || ((cc?.transfer == true && cc.transferDate == currentDate) && cc?.current?.length == 0)) {
                    let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + cc.loanTerms : '-';
                    if (date) {
                        numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + cc.loanTerms : '-';
                    }
                    let activeLoan = 0;
                    let excess = 0;
                    let paymentCollection = 0;
                    let mcbuCol = 0;
                    let mcbu = 0;
                    let mcbuWithdrawal = cc.mcbuWithdrawal;
                    let mcbuReturnAmt = cc.mcbuReturnAmt;
                    let amountRelease = 0;
                    let loanBalance = 0;
                    let mispayment = false;
                    // let coMaker = (cc.coMaker && typeof cc.coMaker == 'number') ? cc.coMaker : '-';
                    let currentReleaseAmount = 0;
                    let noOfPayments = cc.noOfPayments;
                    let fullPayment = cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0;
                    let csf = 0;
                    let csfCollection = 0;
                    let csfWithdrawal = 0;
                    let csfReturnAmt = 0;
                    let csfIn = 0;
                    if (cc.current.length > 0) {
                        const current = cc.current[0];
                        mispayment = current.mispayment;
                        if (cc?.transfer) {
                            transferStr = 'TCR';
                            mcbu = current.mcbu;
                            amountRelease = current.amountRelease;
                            loanBalance = current.loanBalance;
                            numMispayment = '';
                            csf = current.csf;
                        }

                        if (cc?.transferred) {
                            transferStr = 'TCG';
                            mcbuCol = current.mcbuCol;
                            mcbuWithdrawal = current.mcbuWithdrawal;
                            mcbuReturnAmt = current.mcbuReturnAmt;
                            activeLoan = cc.fullPaymentDate ? cc.history.activeLoan : cc.activeLoan;
                            excess = cc.fullPaymentDate ? cc.history.excess : cc.excess;
                            paymentCollection = cc.fullPaymentDate ? cc.history.collection : cc.paymentCollection;
                            coMaker = '-';
                            csfCollection = current.csfCollection;
                            csfWithdrawal = current.csfWithdrawal;
                            csfReturnAmt = current.csfReturnAmt;
                            csfIn = current.csfIn;
                        }

                        if (current.status == "tomorrow") {
                            activeLoan = (current.transferred && current.paymentCollection == 0)? 0 : current.activeLoan;
                            currentReleaseAmount = current.transferred ? current.currentReleaseAmount : 0;
                        }

                        if (current.status == 'tomorrow' || current.status == 'pending') {
                            noOfPayments = 24;
                        }
                    } else {
                        mispayment = cc.mispayment;
                        if (cc?.transfer) {
                            transferStr = 'TCR';
                            mcbu = cc.mcbu;
                            amountRelease = cc.amountRelease;
                            loanBalance = cc.loanBalance;
                            numMispayment = '';
                            fullPayment = 0;
                            csf = cc.csf;
                        }

                        if (cc?.transferred) {
                            transferStr = 'TCG';
                            mcbuCol = cc.mcbuCol;
                            mcbuWithdrawal = cc.mcbuWithdrawal;
                            mcbuReturnAmt = cc.mcbuReturnAmt;
                            csfCollection = cc.csfCollection;
                            csfWithdrawal = cc.csfWithdrawal;
                            csfReturnAmt = cc.csfReturnAmt;
                            if (cc.status == 'active') {
                                activeLoan = cc.activeLoan;
                                excess = cc.excess;
                                paymentCollection = cc.paymentCollection;
                            } else {
                                activeLoan = cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan;
                                excess = cc?.history?.excess > 0 ? cc.history.excess : cc.excess;
                                paymentCollection = cc?.history?.collection ? cc.history.collection : 0;
                            }

                            if (cc.status == 'tomorrow' || cc.status == 'pending') {
                                noOfPayments = 24;
                            }

                            if (cc.status == "tomorrow") {
                                currentReleaseAmount = cc.currentReleaseAmount;
                            }
                        }
                    }

                    collection = {
                        ...cc,
                        group: cc.group,
                        coMaker: normalizeCoMaker(cc.coMaker),
                        loId: cc.loId,
                        loanId: cc.loanId,
                        branchId: cc.branchId,
                        groupId: cc.groupId,
                        groupName: cc.groupName,
                        clientId: cc.clientId,
                        slotNo: cc.slotNo,
                        groupLeader: cc.client.groupLeader,
                        fullName: cc.transfer ? cc.client.lastName + ', ' + cc.client.firstName : '-',
                        loanCycle: cc.transfer ? cc?.history?.loanCycle ? cc?.history?.loanCycle : cc.loanCycle : '-',
                        mispayment: mispayment,
                        mispaymentStr: mispayment ? "Yes" : "No",
                        noMispayment: date ? cc.noMispayment : cc.mispayment,
                        noMispaymentStr: numMispayment,
                        collection: 0,
                        excess: excess,
                        excessStr: excess > 0 ? formatPricePhp(excess) : '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: noOfPayments,
                        noOfPaymentStr: noOfPayments + ' / ' + cc.loanTerms,
                        activeLoan: activeLoan,
                        targetCollection: activeLoan,
                        targetCollectionStr: activeLoan > 0 ? formatPricePhp(activeLoan) : '-',
                        mcbu: cc.transferred ? 0 : mcbu,
                        mcbuStr: (cc.transfer && mcbu > 0) ? formatPricePhp(mcbu) : '-',
                        mcbuCol: mcbuCol ,
                        mcbuColStr: mcbuCol > 0 ? formatPricePhp(mcbuCol) : '-',
                        mcbuWithdrawal: mcbuWithdrawal,
                        mcbuWithdrawalStr: mcbuWithdrawal > 0 ? formatPricePhp(mcbuWithdrawal) : '-',
                        mcbuReturnAmt: mcbuReturnAmt > 0 ? mcbuReturnAmt : 0,
                        mcbuReturnAmtStr: mcbuReturnAmt > 0 ? formatPricePhp(mcbuReturnAmt) : '-',
                        mcbuInterest: cc.mcbuInterest ? cc.mcbuInterest : 0,
                        mcbuInterestStr: cc.mcbuInterest > 0 ? formatPricePhp(cc.mcbuInterest) : '-',
                        amountRelease: amountRelease,
                        amountReleaseStr: amountRelease > 0 ? formatPricePhp(amountRelease) : '-',
                        loanBalance: loanBalance,
                        loanBalanceStr: loanBalance > 0 ? formatPricePhp(loanBalance) : '-',
                        paymentCollection: paymentCollection,
                        paymentCollectionStr: paymentCollection > 0 ? formatPricePhp(paymentCollection) : '-',
                        occurence: cc.group.occurence,
                        currentReleaseAmount: currentReleaseAmount,
                        currentReleaseAmountStr: currentReleaseAmount > 0 ? formatPricePhp(currentReleaseAmount) : '-',
                        fullPayment: fullPayment,
                        fullPaymentStr: fullPayment > 0 ? formatPricePhp(fullPayment) : '-',
                        remarks: cc.remarks ? cc.remarks : '',
                        pastDue: cc.pastDue ? cc.pastDue : 0,
                        pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                        clientStatus: cc.client.status ? cc.client.status : '-',
                        delinquent: cc.client.delinquent,
                        fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                        history: cc.history,
                        prevData: cc.prevData,
                        loanTerms: cc.loanTerms,
                        transferStr: transferStr,
                        csf: csf,
                        csfStr: safeNumber(csf) > 0 ? formatPricePhp(csf) : '-',
                        csfCollection: csfCollection,
                        csfCollectionStr: csfCollection > 0 ? formatPricePhp(csfCollection) : '-',
                        csfWithdrawal: csfWithdrawal,
                        csfWithdrawalStr: csfWithdrawal > 0 ? formatPricePhp(csfWithdrawal) : '-',
                        csfReturnAmt: csfReturnAmt,
                        csfReturnAmtStr: csfReturnAmt > 0 ? formatPricePhp(csfReturnAmt) : '-',
                        csfIn: csfIn,
                        csfInStr: csfIn > 0 ? formatPricePhp(csfIn) : '-',
                        maturedPD: cc.maturedPD,
                        maturedPDPrevTransaction: cc.maturedPD,
                        editHistory: cc.editHistory ? cc.editHistory : [],
                    }

                    if (cc?.transferred && loanBalance > 0) {
                        collection.transferred = true;
                    }
                    // setEditMode(false);
                } else {
                    if (cc.status === "tomorrow" || cc.status === "pending") { // only when filter
                        let numMispayment = 0;
                        if (date) {
                            numMispayment = cc.noMispayment && cc.noMispayment !== '-' ? cc.noMispayment : 0;
                        } else {
                            numMispayment = cc.mispayment ? cc.mispayment : 0;
                        }
                        collection = {
                            ...cc,
                            group: cc.group,
                            coMaker: normalizeCoMaker(cc.coMaker),
                            loanId: cc.loanId,
                            branchId: cc.branchId,
                            loId: cc.loId,
                            groupId: cc.groupId,
                            groupName: cc.groupName,
                            clientId: cc.clientId,
                            slotNo: cc.slotNo,
                            groupLeader: cc.client.groupLeader,
                            fullName: cc.client.lastName + ', ' + cc.client.firstName,
                            loanCycle: cc.loanCycle,
                            mispayment: '-',
                            mispaymentStr: '-',
                            noMispayment: numMispayment,
                            noMispaymentStr: numMispayment > 0 ? numMispayment + ' / ' + maxDays : '-',
                            collection: 0,
                            excess: cc.excess > 0 ? cc.excess : 0,
                            excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                            total: 0,
                            totalStr: '-',
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            mcbu: cc.mcbu,
                            mcbuStr: cc.mcbu > 0 ? formatPricePhp(cc.mcbu) : '-',
                            mcbuCol: cc.mcbuCol,
                            mcbuColStr: cc.mcbuCol > 0 ? formatPricePhp(cc.mcbuCol) : '-',
                            mcbuWithdrawal: cc.mcbuWithdrawal,
                            mcbuWithdrawalStr: cc.mcbuWithdrawal > 0 ? formatPricePhp(cc.mcbuWithdrawal) : '-',
                            mcbuReturnAmt: cc.mcbuReturnAmt,
                            mcbuReturnAmtStr: cc.mcbuReturnAmt > 0 ? formatPricePhp(cc.mcbuReturnAmt) : '-',
                            mcbuInterest: cc.mcbuInterest ? cc.mcbuInterest : 0,
                            mcbuInterestStr: cc.mcbuInterest > 0 ? formatPricePhp(cc.mcbuInterest) : '-',
                            activeLoan: '-',
                            targetCollection: cc.prevData != null ? cc.prevData.activeLoan : 0,
                            targetCollectionStr: cc.prevData != null ? formatPricePhp(cc.prevData.activeLoan) : 0,
                            amountRelease: '-',
                            amountReleaseStr: '-',
                            loanBalance: '-',
                            loanBalanceStr: '-',
                            paymentCollection: cc.paymentCollection,
                            paymentCollectionStr: cc.paymentCollection > 0 ? formatPricePhp(cc.paymentCollection) : '-',
                            occurence: cc.group.occurence,
                            currentReleaseAmount: cc.currentReleaseAmount,
                            currentReleaseAmountStr: formatPricePhp(cc.currentReleaseAmount),
                            fullPayment: (cc.prevData != null && cc.fullPayment.length > 0) ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentStr: (cc.prevData != null && cc.fullPayment.length > 0) ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-',
                            remarks: cc.remarks ? cc.remarks : '',
                            pastDue: cc.pastDue ? cc.pastDue : 0,
                            pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                            clientStatus: cc.client.status ? cc.client.status : '-',
                            delinquent: cc.client.delinquent,
                            fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                            history: cc.history,
                            prevData: cc.prevData,
                            loanTerms: cc.loanTerms,
                            otherIncome: cc.otherPassbookCollection + cc.otherPictureCollection,
                            csf: safeNumber(cc.csf),
                            csfStr: safeNumber(cc.csf) > 0 ? formatPricePhp(cc.csf) : '-',
                            csfCollection: cc.csfCollection,
                            csfCollectionStr: cc.csfCollection > 0 ? formatPricePhp(cc.csfCollection) : '-',
                            csfWithdrawal: cc.csfWithdrawal,
                            csfWithdrawalStr: cc.csfWithdrawal > 0 ? formatPricePhp(cc.csfWithdrawal) : '-',
                            csfReturnAmt: cc.csfReturnAmt,
                            csfReturnAmtStr: cc.csfReturnAmt > 0 ? formatPricePhp(cc.csfReturnAmt) : '-',
                            maturedPD: cc.maturedPD,
                            maturedPDPrevTransaction: cc.maturedPD,
                            editHistory: cc.editHistory ? cc.editHistory : [],
                        }

                        setEditMode(false);
                    } else if (cc.status === "closed") {
                        let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + maxDays : '-';
                        if (date) {
                            numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + maxDays : '-';
                        }
                        let activeLoan = 0;
                        let paymentCollection = 0;
                        let mcbuCol = 0;
                        let mcbu = cc.mcbu;
                        let mcbuWithdrawal = cc.mcbuWithdrawal;
                        let mcbuReturnAmt = cc.mcbuReturnAmt;
                        let amountRelease = 0;
                        let loanBalance = 0;
                        let mispayment = false;
                        let prevData = cc.prevData;
                        let draft = false;
                        let reverted = false;
                        let remarks = cc.remarks ? cc.remarks : '';
                        let ccId = cc._id;
                        let loanId = cc._id;
                        let csf = cc.csf;
                        let csfCollection = cc.csfCollection;
                        let csfWithdrawal = cc.csfWithdrawal;
                        let csfIn = 0;
                        let admissionCollection = loan?.admissionCollection ?? 0;
                        let lrfCollection = loan?.lrfCollection ?? 0;
                        let cbhbCollection = loan?.cbhbCollection ?? 0;
                        let addHospitalization = loan?.addHospitalization ?? 0;
                        let otherPassbookCollection = loan?.otherPassbookCollection ?? 0;
                        let otherPictureCollection = loan?.otherPictureCollection ?? 0;
                        let otherIncome = (loan?.otherPassbookCollection ?? 0) + (loan?.otherPictureCollection ?? 0);
                        
                        if (cc?.current?.length > 0) {
                            const current = cc.current.find(cur => cur?.transfer !== true);
                            if (current) {
                                if (current?.transferred) {
                                    amountRelease = current.amountRelease;
                                    loanBalance = current.loanBalance;
                                    mispayment = current.mispayment;
                                }
    
                                mcbu = current.mcbu;
                                mcbuCol = current.mcbuCol;
                                mcbuWithdrawal = current.mcbuWithdrawal;
                                mcbuReturnAmt = current.mcbuReturnAmt;
                                prevData = current.prevData;
                                draft = current.draft;
                                reverted = current.reverted;
                                remarks = current.remarks ? current.remarks : '';
                                ccId = current._id;
                                loanId = current.loanId;
                                csf = current.csf;
                                csfCollection = current.csfCollection;
                                csfWithdrawal = current.csfWithdrawal;
                                csfIn = current.csfIn;
                                admissionCollection = current.admissionCollection;
                                lrfCollection = current.lrfCollection;
                                cbhbCollection = current.cbhbCollection;
                                addHospitalization = current.addHospitalization;
                                otherPassbookCollection = current.otherPassbookCollection;
                                otherPictureCollection = current.otherPictureCollection;
                                otherIncome = current.otherPassbookCollection + current.otherPictureCollection;
                            }
                        }

                        if (cc.maturedPD) {
                            amountRelease = cc.amountRelease;
                            paymentCollection = cc?.current?.length > 0 ? cc.current[0].paymentCollection : cc.paymentCollection;
                        }

                        if (!cc?.maturedPD) {
                            activeLoan = cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan;
                            paymentCollection = cc?.history?.collection ? cc.history.collection : 0;
                        }
                        
                        collection = {
                            ...cc,
                            _id: ccId,
                            loanId: loanId,
                            group: cc.group,
                            coMaker: normalizeCoMaker(cc.coMaker),
                            loId: cc.loId,
                            branchId: cc.branchId,
                            groupId: cc.groupId,
                            groupName: cc.groupName,
                            clientId: cc.clientId,
                            slotNo: cc.slotNo,
                            groupLeader: cc.client.groupLeader,
                            fullName: cc.client.lastName + ', ' + cc.client.firstName,
                            loanCycle: cc.history?.loanCycle,
                            mispayment: mispayment,
                            mispaymentStr: mispayment ? "Yes" : "No",
                            noMispayment: date ? cc.noMispayment : cc.mispayment,
                            noMispaymentStr: numMispayment,
                            collection: 0,
                            excess: cc.history?.excess > 0 ? cc.history?.excess : 0,
                            excessStr: cc.history?.excess > 0 ? formatPricePhp(cc.history?.excess) : '-',
                            total: 0,
                            totalStr: '-',
                            noOfPayments: cc.noOfPayments,
                            noOfPaymentStr: cc.noOfPayments + ' / ' + maxDays,
                            mcbu: mcbu,
                            mcbuStr: mcbu > 0 ? formatPricePhp(mcbu) : '-',
                            mcbuCol: mcbuCol ,
                            mcbuColStr: mcbuCol > 0 ? formatPricePhp(mcbuCol) : '-',
                            mcbuWithdrawal: mcbuWithdrawal,
                            mcbuWithdrawalStr: mcbuWithdrawal > 0 ? formatPricePhp(mcbuWithdrawal) : '-',
                            mcbuReturnAmt: mcbuReturnAmt,
                            mcbuReturnAmtStr: mcbuReturnAmt > 0 ? formatPricePhp(mcbuReturnAmt) : '-',
                            mcbuInterest: cc.mcbuInterest ? cc.mcbuInterest : 0,
                            mcbuInterestStr: cc.mcbuInterest > 0 ? formatPricePhp(cc.mcbuInterest) : '-',
                            activeLoan: activeLoan,
                            targetCollection: activeLoan,
                            targetCollectionStr: activeLoan > 0 ? formatPricePhp(activeLoan) : '-',
                            amountRelease: amountRelease,
                            amountReleaseStr: amountRelease > 0 ? formatPricePhp(amountRelease) : '-',
                            loanBalance: loanBalance,
                            loanBalanceStr: loanBalance > 0 ? formatPricePhp(loanBalance) : '-',
                            paymentCollection: paymentCollection,
                            paymentCollectionStr: paymentCollection > 0 ? formatPricePhp(paymentCollection) : '-',
                            occurence: cc.group.occurence,
                            currentReleaseAmount: 0,
                            currentReleaseAmountStr: '-',
                            fullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-',
                            remarks: remarks,
                            pastDue: cc.pastDue ? cc.pastDue : 0,
                            pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                            clientStatus: cc.client.status ? cc.client.status : '-',
                            delinquent: cc.client.delinquent,
                            fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                            history: cc.history,
                            prevData: prevData,
                            loanTerms: cc.loanTerms,
                            draft: draft,
                            reverted: reverted,
                            otherIncome: cc.otherPassbookCollection + cc.otherPictureCollection,
                            csf: safeNumber(cc.csf),
                            csfStr: safeNumber(cc.csf) > 0 ? formatPricePhp(cc.csf) : '-',
                            csfCollection: csfCollection,
                            csfCollectionStr: csfCollection > 0 ? formatPricePhp(csfCollection) : '-',
                            csfWithdrawal: csfWithdrawal,
                            csfWithdrawalStr: csfWithdrawal > 0 ? formatPricePhp(csfWithdrawal) : '-',
                            csfIn: csfIn,
                            csfInStr: csfIn > 0 ? formatPricePhp(csfIn) : '-',
                            admissionCollection: admissionCollection,
                            lrfCollection: lrfCollection,
                            cbhbCollection: cbhbCollection,
                            addHospitalization: addHospitalization,
                            otherPassbookCollection: otherPassbookCollection,
                            otherPictureCollection: otherPictureCollection,
                            otherIncome: otherIncome,
                            maturedPD: cc.maturedPD,
                            maturedPDPrevTransaction: cc.maturedPD,
                            editHistory: cc.editHistory ? cc.editHistory : [],
                        }
    
                        if (loanBalance > 0) {
                            collection.transferred = true;
                        }
                        setEditMode(false);
                    } else if (cc.status !== "closed" || (type !== 'filter' && cc?.current?.length < 2)) {
                        let noPaymentsStr = (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments + ' / ' + maxDays : '-';
                        let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + maxDays : '-';
                        let noMispayment = date ? cc.noMispayment ? cc.noMispayment : 0 : cc.mispayment;
                        if (date) {
                            numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + maxDays : '-';
                        }

                        let activeLoan = cc.activeLoan;
                        let mispaymentStr = (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? 'No' : '-';
                        if (cc?.transfer && cc?.transferDate === currentDate) {
                            numMispayment = '';
                            noMispayment = 0;
                            mispaymentStr = '-';
                            noPaymentsStr = '-';
                            activeLoan = 0;
                        }

                        let history = cc.history;
                        if (cc.status == "completed" && cc.fullPaymentDate !== currentDate) {
                            history = {
                                amountRelease: history?.amountRelease,
                                loanBalance: 0,
                                activeLoan: 0,
                                excess: 0,
                                collection: 0,
                                remarks: history?.remarks,
                                advanceDays: 0
                            }
                        }

                        let remarks = cc.remarks ? cc.remarks : "";
                        if (cc.status == "completed") {
                            if (type !== 'filter') {
                                remarks = "";
                            } else {
                                remarks = cc.history?.remarks;
                            }
                        }

                        if (cc?.maturedPD) {
                            remarks = cc.history?.remarks;
                        }
                        
                        collection = {
                            client: cc.client,
                            groupLeader: cc.client.groupLeader,
                            coMaker: normalizeCoMaker(cc.coMaker),
                            group: cc.group,
                            loanId: cc._id,
                            loId: cc.loId,
                            branchId: cc.branchId,
                            groupId: cc.groupId,
                            groupName: cc.groupName,
                            clientId: cc.clientId,
                            slotNo: cc.slotNo,
                            fullName: cc.client.lastName + ', ' + cc.client.firstName,
                            loanCycle: cc.loanCycle,
                            mispayment: false,
                            mispaymentStr: mispaymentStr,
                            noMispayment: noMispayment,
                            noMispaymentStr: numMispayment,
                            collection: 0,
                            excess: cc.excess,
                            excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                            total: 0,
                            totalStr: '-',
                            noOfPayments: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments : 0,
                            noOfPaymentStr: noPaymentsStr,
                            mcbu: cc.mcbu,
                            mcbuStr: cc.mcbu > 0 ? formatPricePhp(cc.mcbu) : '-',
                            mcbuCol: cc.mcbuCol,
                            mcbuColStr: cc.mcbuCol > 0 ? formatPricePhp(cc.mcbuCol) : '-',
                            mcbuWithdrawal: type == 'filter' ? cc.mcbuWithdrawal :  0,
                            mcbuWithdrawalStr: type == 'filter' ? formatPricePhp(cc.mcbuWithdrawal) : '-',
                            mcbuReturnAmt: type == 'filter' ? cc.mcbuReturnAmt : 0,
                            mcbuReturnAmtStr: type == 'filter' ? formatPricePhp(cc.mcbuReturnAmt) : '-',
                            mcbuInterest: 0,
                            mcbuInterestStr: '-',
                            activeLoan: activeLoan,
                            targetCollection: activeLoan,
                            targetCollectionStr: activeLoan > 0 ? formatPricePhp(activeLoan) : '-',
                            amountRelease: cc.amountRelease,
                            amountReleaseStr: cc.amountRelease > 0 ? formatPricePhp(cc.amountRelease) : '-',
                            loanBalance: cc.loanBalance,
                            loanBalanceStr: cc.loanBalance > 0 ? formatPricePhp(cc.loanBalance) : '-',
                            paymentCollection: cc.paymentCollection ? cc.paymentCollection : 0,
                            paymentCollectionStr: cc.paymentCollection ? formatPricePhp(cc.paymentCollection) : '-',
                            occurence: cc.group.occurence,
                            currentReleaseAmount: cc.currentReleaseAmount ? cc.currentReleaseAmount : 0,
                            currentReleaseAmountStr: cc.currentReleaseAmount ? formatPricePhp(cc.currentReleaseAmount) : '-',
                            fullPayment: cc.fullPaymentAmount ? cc.fullPaymentAmount : 0,
                            fullPaymentStr: cc.fullPaymentAmount > 0 ? formatPricePhp(cc.fullPaymentAmount) : '-',
                            remarks: remarks,
                            pastDue: cc.pastDue ? cc.pastDue : 0,
                            pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                            clientStatus: cc.client.status ? cc.client.status : '-',
                            delinquent: cc.client.delinquent,
                            fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                            history: cc.history,
                            advanceDays: cc.advanceDays ? cc.advanceDays : 0,
                            status: cc.status,
                            loanTerms: cc.loanTerms,
                            startDate: cc.startDate,
                            endDate: cc.endDate,
                            reverted: cc.reverted ? cc.reverted : false,
                            pnNumber: cc.pnNumber,
                            guarantorFirstName: cc.guarantorFirstName,
                            guarantorMiddleName: cc.guarantorMiddleName,
                            guarantorLastName: cc.guarantorLastName,
                            loanRelease: cc.loanRelease,
                            maturedPD: cc.maturedPD ? cc.maturedPD : false,
                            maturedPDPrevTransaction: cc.maturedPD,
                            advance: cc.advance ? cc.advance : false,
                            csf: safeNumber(cc.csf),
                            csfStr: safeNumber(cc.csf) > 0 ? formatPricePhp(cc.csf) : '-',
                            csfCollection: 0,
                            csfCollectionStr: '-',
                            csfWithdrawal: 0,
                            csfWithdrawalStr: '-',
                            csfReturnAmt: 0,
                            csfReturnAmtStr: '-',
                            _dirty: true,
                            editHistory: cc.editHistory ? cc.editHistory : [],
                        }
    
                        delete cc._id;
                        if (cc.current.length > 0) {
                            const current = cc.current.find(cur => cur.transferId == null);
                            if (current) {
                                collection.targetCollection = current.targetCollection;
                                collection.targetCollectionStr = collection.targetCollection > 0 ? formatPricePhp(collection.targetCollection) : '-';
                                collection.excess = current.excess;
                                collection.excessStr = collection.excess > 0 ? formatPricePhp(collection.excess) : '-';
                                collection.paymentCollection = current.paymentCollection;
                                collection.paymentCollectionStr = collection.paymentCollection > 0 ? formatPricePhp(collection.paymentCollection) : '-';
                                collection.mispayment = current.mispayment;
                                collection.mispaymentStr = current.mispaymentStr = current.mispayment ? 'Yes' : 'No';
                                collection.remarks = current.remarks;
                                collection.delinquent = current.delinquent ? current.delinquent : false;
                                collection._id = current._id;
                                collection.prevData = current.prevData;
                                collection.pastDue = current.pastDue ? current.pastDue > 0 ? current.pastDue : collection.pastDue : collection.pastDue > 0 ? collection.pastDue: 0;
                                collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                                collection.mcbuCol = current.mcbuCol;
                                collection.mcbuColStr = current.mcbuCol > 0 ? formatPricePhp(current.mcbuCol) : '-';
                                collection.mcbuWithdrawal = current.mcbuWithdrawal;
                                collection.mcbuWithdrawalStr = current.mcbuWithdrawal > 0 ? formatPricePhp(current.mcbuWithdrawal) : '-';
                                collection.mcbuReturnAmt = current.mcbuReturnAmt;
                                collection.mcbuReturnAmtStr = current.mcbuReturnAmt > 0 ? formatPricePhp(current.mcbuReturnAmt) : '-';
                                collection.mcbuInterest = current.mcbuInterest ? cc.mcbuInterest : 0,
                                collection.mcbuInterestStr = current.mcbuInterest > 0 ? formatPricePhp(current.mcbuInterest) : '-',
                                collection.advanceDays = current.advanceDays ? current.advanceDays : 0;
                                collection.draft = current.draft;
                                collection.dcmc = current.dcmc;
                                collection.excused = current.excused ? current.excused : false;
                                collection.latePayment = current.latePayment ? current.latePayment : false;
                                collection._dirty = !!current.draft;
                                collection.csfCollection = current.csfCollection;
                                collection.csfCollectionStr = current.csfCollection > 0 ? formatPricePhp(current.csfCollection) : '-';
                                collection.csfWithdrawal = current.csfWithdrawal;
                                collection.csfWithdrawalStr = current.csfWithdrawal > 0 ? formatPricePhp(current.csfWithdrawal) : '-';
                                collection.csfReturnAmt = current.csfReturnAmt;
                                collection.csfReturnAmtStr = current.csfReturnAmt > 0 ? formatPricePhp(current.csfReturnAmt) : '-';
                                collection.csfIn = current.csfIn;
                                collection.csfInStr = current.csfIn > 0 ? formatPricePhp(current.csfIn) : '-';
    
                                if (current?.origin) {
                                    collection.origin = current.origin;
                                    if (collection.origin !== 'pre-save') {
                                        setEditMode(false);
                                    } else {
                                        // pre-save rows are always editable — mark dirty so they're included on save
                                        collection._dirty = true;
                                    }
                                } else if (current.draft) {
                                    collection.error = current.error;
                                    collection.mcbu = current.mcbu;
                                    collection.mcbuStr = current.mcbu > 0 ? formatPricePhp(current.mcbu) : '-',
                                    collection.loanBalance = current.loanBalance;
                                    collection.loanBalanceStr = formatPricePhp(current.loanBalance);
                                    collection.noOfPayments = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? current.noOfPayments : 0;
                                    collection.noOfPaymentStr = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? current.noOfPayments + ' / ' + maxDays : '-';
                                    collection.total = current.total;
                                    collection.fullPayment = current.fullPayment;
                                    collection.fullPaymentStr = formatPricePhp(current.fullPayment);
                                    collection.fullPaymentDate = current.fullPaymentDate;
                                    collection.history = current.history;
                                    collection.amountRelease = current.amountRelease;
                                    collection.amountReleaseStr = formatPricePhp(current.amountRelease);
                                    collection.csf = current.csf;
                                    collection.csfStr = formatPricePhp(current.csf);
                                    setEditMode(true);
                                } else {
                                    setEditMode(false);
                                }
                            }
                        }
        
                        if (cc.currentRelease.length > 0) {
                            collection.currentReleaseAmount = cc.currentRelease[0].currentReleaseAmount;
                            collection.currentReleaseAmountStr = cc.currentRelease[0].currentReleaseAmount ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : '-';
                        }
        
                        if (cc.fullPayment.length > 0) {
                            collection.fullPayment = cc.fullPayment[0].fullPaymentAmount;
                            collection.fullPaymentStr = cc.fullPayment[0].fullPaymentAmount ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-';
                        }
        
                        if (cc.loanBalance <= 0  && cc.status !== 'completed') {
                            if (cc.fullPaymentDate === currentDate) {
                                collection.paymentCollection = cc.history ? cc.history?.collection : 0;
                                collection.paymentCollectionStr = formatPricePhp(collection.paymentCollection);
                            }
    
                            // collection.notCalculate = true;
                            collection.remarks = cc.history ? cc.history?.remarks : '-';
                        }

                        if (cc?.transfer && cc?.transferDate === currentDate) {
                            collection.fullPayment = 0;
                            collection.fullPaymentStr = '-';
                            collection.transfer = true;
                            transferStr = 'TCR';
                        }

                        if (!collection.prevData) {
                            collection.prevData = {
                                amountRelease: collection.amountRelease,
                                paymentCollection: collection.paymentCollection,
                                excess: collection.excess !== '-' ? collection.excess : 0,
                                loanBalance: collection.loanBalance,
                                activeLoan: collection.activeLoan,
                                noOfPayments: collection.noOfPayments,
                                total: collection.total,
                                pastDue: collection.pastDue,
                                mcbu: collection.mcbu,
                                advanceDays: collection.advanceDays,
                                mcbuCol: collection.mcbuCol,
                                csf: collection.csf,
                                csfCollection: collection.csfCollection
                            };
                        }
                    } else {
                        return;
                    }

                    collection.transferStr = transferStr;
                }

                if (!date && cc?.pastDue) {
                    // if pastDue === loanBalance then make target collection 0
                    if (collection.pastDue === collection.loanBalance && collection.loanBalance > 0) {
                        collection.targetCollection = 0;
                        collection.activeLoan = 0;
                    }
                }

                collection.groupDay = collection.group.day;
                collection.mcbuWithdrawFlag = false;
                collection.offsetTransFlag = false;
                collection.mcbuInterestFlag = false;

                if (!date || currentDate === date) {
                    if (selectedGroup && selectedGroup.day !== dayName) {
                        collection.otherDay = true;
                    }
                } else {
                    collection.otherDay = false;
                }

                collection.hasMcbuWithdrawal = false;
                collection.hasCsfWithdrawal = false;
                if (cc.mcbuWithdrawalList.length > 0) {
                    const mcbuWithdrawal = cc.mcbuWithdrawalList[cc.mcbuWithdrawalList.length - 1];
                    if (mcbuWithdrawal) {
                        if (mcbuWithdrawal.group_leader && mcbuWithdrawal.csf_withdrawal_amount > 0) {
                            collection.hasCsfWithdrawal = true;
                            collection.csfWithdrawalIsPending = mcbuWithdrawal.status == 'pending' ? true : false;
                            collection.csfWithdrawalId = mcbuWithdrawal._id;
                            if (mcbuWithdrawal?.status == 'pending') {
                                collection.csfWithdrawal = mcbuWithdrawal.csf_withdrawal_amount || 0;
                                collection.csfWithdrawalStr = collection.csfWithdrawal > 0 ? formatPricePhp(collection.csfWithdrawal) : '-';
                            }
                        }

                        if (mcbuWithdrawal.mcbu_withdrawal_amount > 0) {
                            collection.hasMcbuWithdrawal = true;
                            collection.mcbuWithdrawalIsPending = mcbuWithdrawal.status == 'pending' ? true : false;
                            collection.mcbuWithdrawalId = mcbuWithdrawal._id;
                            if (mcbuWithdrawal?.status == 'pending') {
                                collection.mcbuWithdrawal = mcbuWithdrawal.mcbu_withdrawal_amount || 0;
                                collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                            }
                        }
                    }
                }

                if (collection.status === 'completed') {
                    collection.noOfPayments = 24;
                    collection.noOfPaymentStr = '24 / 24';
                    if (collection.fullPaymentDate == currentDate) {
                        collection.fullPayment = collection?.loanRelease;
                        collection.fullPaymentStr = collection.fullPayment > 0 ? formatPricePhp(collection.fullPayment) : '-';
                    }
                }

                collection.hasMcbuInterest = safeNumber(cc.mcbuInterest) > 0 ? true : false;
                collection.bmRevertCount = cc.bmRevertCount ? cc.bmRevertCount : 0;

                collection.selected = false;
                cashCollection.push(collection);
            });

            response.data.tomorrowPending.map(loan => {
                const currentLoan = cashCollection.find(l => l.slotNo === loan.slotNo && l.clientId === loan.clientId);
                const dateOfRelease = loan?.dateOfRelease ? loan?.dateOfRelease : null;
                let diff = 0;
                if (dateOfRelease) {
                    diff = moment(currentDate).diff(dateOfRelease);
                }

                if (currentLoan && currentLoan.status !== 'pending' && (loan?.loanFor == 'today' || (loan?.loanFor == 'tomorrow' && diff >= 0))) {
                    const index = cashCollection.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) { // fullpayment with pending/tomorrow
                        cashCollection[index] = {
                            ...cashCollection[index],
                            client: currentLoan.client,
                            coMaker: normalizeCoMaker(loan.coMaker),
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            prevLoanId: loan.prevLoanId,
                            groupId: loan.groupId,
                            branchId: loan.branchId,
                            loId: loan.loId,
                            clientId: loan.clientId,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountRelease: 0, 
                            amountReleaseStr: 0, 
                            loanBalance: 0,
                            loanBalanceStr: 0,
                            targetCollection: currentLoan.history?.activeLoan ? currentLoan.history.activeLoan : 0,
                            targetCollectionStr: currentLoan.history?.activeLoan ? formatPricePhp(currentLoan.history.activeLoan) : '-',
                            mispayment: currentLoan.mispayment,
                            mispaymentStr: currentLoan.mispayment ? 'Yes' : 'No',
                            noMispayment: currentLoan.noMispayment,
                            noMispaymentStr: currentLoan.noMispayment > 0 ? currentLoan.noMispayment + ' / ' + maxDays : '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : 0,
                            noOfPayments: '-',
                            noOfPaymentStr: (currentLoan.noOfPayments !== '-' && currentLoan.status !== 'totals') ? currentLoan.noOfPayments + ' / ' + maxDays : '-',
                            mcbu: loan.mcbu,
                            mcbuStr: loan.mcbu > 0 ? formatPricePhp(loan.mcbu) : '-',
                            mcbuCol: currentLoan.mcbuCol,
                            mcbuColStr: currentLoan.mcbuCol > 0 ? formatPricePhp(currentLoan.mcbuCol) : '-',
                            mcbuWithdrawal: currentLoan.mcbuWithdrawal,
                            mcbuWithdrawalStr: currentLoan.mcbuWithdrawal > 0 ? formatPricePhp(currentLoan.mcbuWithdrawal) : '-',
                            mcbuReturnAmt: currentLoan.mcbuReturnAmt,
                            mcbuReturnAmtStr: currentLoan.mcbuReturnAmt > 0 ? formatPricePhp(currentLoan.mcbuReturnAmt) : '-',
                            mcbuInterest: loan.mcbuInterest,
                            mcbuInterestStr: loan.mcbuInterest > 0 ? formatPricePhp(loan.mcbuInterest) : '-',
                            excess: currentLoan.history?.excess ? currentLoan.history.excess : 0,
                            excessStr: currentLoan.history?.excess ? formatPricePhp(currentLoan.history.excess) : '-',
                            paymentCollection: currentLoan.history?.collection ? currentLoan.history.collection : 0,
                            paymentCollectionStr: currentLoan.history?.collection ? formatPricePhp(currentLoan.history.collection) : '-',
                            remarks: currentLoan.history?.remarks,
                            fullPayment: currentLoan.fullPayment,
                            fullPaymentStr: currentLoan.fullPayment ? currentLoan.fullPaymentStr : 0,
                            pastDue: currentLoan.pastDue ? currentLoan.pastDue : 0,
                            pastDueStr: currentLoan.pastDue ? formatPricePhp(currentLoan.pastDue) : '-',
                            clientStatus: currentLoan.clientStatus,
                            delinquent: currentLoan.delinquent,
                            advanceDays: currentLoan.advanceDays,
                            status: loan.status === "active" ? "tomorrow" : loan.status,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false,
                            loanTerms: loan.loanTerms,
                            reverted: currentLoan.reverted,
                            history: currentLoan.history,
                            selected: false,
                            advanceTransaction: currentLoan?.advanceTransaction ? currentLoan.advanceTransaction : false,
                            dateOfRelease: dateOfRelease,
                             admissionCollection: loan.admissionCollection,
                            lrfCollection: loan.lrfCollection,
                            cbhbCollection: loan.cbhbCollection,
                            addHospitalization: loan.addHospitalization,
                            otherPassbookCollection: loan.otherPassbookCollection,
                            otherPictureCollection: loan.otherPictureCollection,
                            otherIncome: loan.otherPassbookCollection + loan.otherPictureCollection,
                            csf: loan.csf,
                            csfStr: loan.csf > 0 ? formatPricePhp(loan.csf) : '-',
                            csfCollection: safeNumber(currentLoan.csfCollection),
                            csfCollectionStr: safeNumber(currentLoan.csfCollection) > 0 ? formatPricePhp(safeNumber(currentLoan.csfCollection)) : '-',
                            csfWithdrawal: safeNumber(currentLoan.csfWithdrawal),
                            csfWithdrawalStr: safeNumber(currentLoan.csfWithdrawal) > 0 ? formatPricePhp(safeNumber(currentLoan.csfWithdrawal)) : '-',
                            csfReturnAmt: safeNumber(currentLoan.csfReturnAmt),
                            csfReturnAmtStr: safeNumber(currentLoan.csfReturnAmt) > 0 ? formatPricePhp(safeNumber(currentLoan.csfReturnAmt)) : '-',
                            editHistory: loan.editHistory ? loan.editHistory : [],
                        };

                        if (currentLoan?.current?.length > 0 && currentLoan.current[0] !== null) {
                            cashCollection[index]._id = currentLoan.current[0]._id;
                            cashCollection[index].prevData = currentLoan.current[0].prevData;
                            cashCollection[index].mcbuInterest = currentLoan.current[0].mcbuInterest;
                            cashCollection[index].mcbuInterestStr = currentLoan.current[0].mcbuInterest > 0 ? formatPricePhp(currentLoan.current[0].mcbuInterest) : '-';
                        } else if (loan?.current?.length > 0 && loan.current[0] !== null) {
                            cashCollection[index]._id = loan.current[0]._id;
                            cashCollection[index].prevData = loan.current[0].prevData;
                            cashCollection[index].mcbuCol = loan.current[0].mcbuCol;
                            cashCollection[index].mcbuColStr = loan.current[0].mcbuCol > 0 ? formatPricePhp(loan.current[0].mcbuCol) : '-';
                            cashCollection[index].mcbuInterest = loan.current[0].mcbuInterest;
                            cashCollection[index].mcbuInterestStr = loan.current[0].mcbuInterest > 0 ? formatPricePhp(loan.current[0].mcbuInterest) : '-';
                            cashCollection[index].targetCollection = loan.current[0].history?.activeLoan ? loan.current[0].history.activeLoan : 0;
                            cashCollection[index].targetCollectionStr = loan.current[0].history?.activeLoan ? formatPricePhp(loan.current[0].history.activeLoan) : '-';
                            cashCollection[index].excess = loan.current[0].history?.excess ? loan.current[0].history?.excess : 0;
                            cashCollection[index].excessStr = loan.current[0].history?.excess ? formatPricePhp(loan.current[0].history?.excess) : '-';
                            cashCollection[index].paymentCollection = loan.current[0].history?.collection ? loan.current[0].history?.collection : 0;
                            cashCollection[index].paymentCollectionStr = loan.current[0].history?.collection ? formatPricePhp(loan.current[0].history?.collection) : '-';
                            cashCollection[index].remarks = loan.current[0].history?.remarks;
                            cashCollection[index].csfCollection = loan.current[0].csfCollection;
                            cashCollection[index].csfCollectionStr = loan.current[0].csfCollection > 0 ? formatPricePhp(loan.current[0].csfCollection) : '-';
                        }
                    } else if (currentLoan.status == 'completed' && !currentLoan?.advance  && (loan?.loanFor == 'today' || (loan?.loanFor == 'tomorrow' && diff >= 0))) {
                        cashCollection[index] = {
                            ...cashCollection[index],
                            client: currentLoan.client,
                            coMaker: normalizeCoMaker(loan.coMaker),
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            prevLoanId: loan.prevLoanId,
                            groupId: loan.groupId,
                            loId: loan.loId,
                            branchId: loan.branchId,
                            clientId: loan.clientId,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayment: false,
                            mispaymentStr: '-',
                            noMispaymentStr: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : '-',
                            noOfPayments: '-',
                            mcbu: loan.mcbu,
                            mcbuStr: loan.mcbu > 0 ? formatPricePhp(loan.mcbu) : '-',
                            mcbuCol: loan.mcbuCol,
                            mcbuColStr: loan.mcbuCol > 0 ? formatPricePhp(loan.mcbuCol) : '-',
                            mcbuWithdrawal: loan.mcbuWithdrawal,
                            mcbuWithdrawalStr: loan.mcbuWithdrawal > 0 ? formatPricePhp(loan.mcbuWithdrawal) : '-',
                            mcbuReturnAmt: loan.mcbuReturnAmt,
                            mcbuReturnAmtStr: loan.mcbuReturnAmt > 0 ? formatPricePhp(loan.mcbuReturnAmt) : '-',
                            mcbuInterest: loan.mcbuInterest,
                            mcbuInterestStr: loan.mcbuInterest > 0 ? formatPricePhp(loan.mcbuInterest) : '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: currentLoan.prevData ? formatPricePhp(currentLoan.prevData.paymentCollection) : '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            loanTerms: loan.loanTerms,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false,
                            reverted: currentLoan.reverted,
                            history: currentLoan.history,
                            selected: false,
                            advanceTransaction: currentLoan?.advanceTransaction ? currentLoan.advanceTransaction : false,
                            dateOfRelease: dateOfRelease,
                            admissionCollection: loan.admissionCollection,
                            lrfCollection: loan.lrfCollection,
                            cbhbCollection: loan.cbhbCollection,
                            addHospitalization: loan.addHospitalization,
                            otherPassbookCollection: loan.otherPassbookCollection,
                            otherPictureCollection: loan.otherPictureCollection,
                            otherIncome: loan.otherPassbookCollection + loan.otherPictureCollection,
                            csf: loan.csf,
                            csfStr: loan.csf > 0 ? formatPricePhp(loan.csf) : '-',
                            csfCollection: safeNumber(currentLoan.csfCollection),
                            csfCollectionStr: safeNumber(currentLoan.csfCollection) > 0 ? formatPricePhp(safeNumber(currentLoan.csfCollection)) : '-',
                            csfWithdrawal: safeNumber(currentLoan.csfWithdrawal),
                            csfWithdrawalStr: safeNumber(currentLoan.csfWithdrawal) > 0 ? formatPricePhp(safeNumber(currentLoan.csfWithdrawal)) : '-',
                            csfReturnAmt: safeNumber(currentLoan.csfReturnAmt),
                            csfReturnAmtStr: safeNumber(currentLoan.csfReturnAmt) > 0 ? formatPricePhp(safeNumber(currentLoan.csfReturnAmt)) : '-',
                            csfIn: safeNumber(currentLoan.csfIn),
                            csfInStr: safeNumber(currentLoan.csfIn) > 0 ? formatPricePhp(safeNumber(currentLoan.csfIn)) : '-',
                            editHistory: loan.editHistory ? loan.editHistory : [],
                        };

                        if (currentLoan.current.length > 0 && currentLoan.current[0] !== null) {
                            cashCollection[index]._id = currentLoan.current[0]._id;
                            cashCollection[index].prevData = currentLoan.current[0].prevData;
                            cashCollection[index].mcbuInterest = currentLoan.current[0].mcbuInterest;
                            cashCollection[index].mcbuInterestStr = currentLoan.current[0].mcbuInterest > 0 ? formatPricePhp(currentLoan.current[0].mcbuInterest) : '-';
                        } else if (loan.current.length > 0 && loan.current[0] !== null) {
                            cashCollection[index]._id = loan.current[0]._id;
                            cashCollection[index].prevData = loan.current[0].prevData;
                            cashCollection[index].mcbuCol = loan.current[0].mcbuCol;
                            cashCollection[index].mcbuColStr = loan.current[0].mcbuCol > 0 ? formatPricePhp(loan.current[0].mcbuCol) : '-';
                            cashCollection[index].mcbuInterest = loan.current[0].mcbuInterest;
                            cashCollection[index].mcbuInterestStr = loan.current[0].mcbuInterest > 0 ? formatPricePhp(loan.current[0].mcbuInterest) : '-';
                            cashCollection[index].targetCollection = loan.current[0].history?.activeLoan ? loan.current[0].history.activeLoan : 0;
                            cashCollection[index].targetCollectionStr = loan.current[0].history?.activeLoan ? formatPricePhp(loan.current[0].history.activeLoan) : '-';
                            cashCollection[index].excess = loan.current[0].history?.excess ? loan.current[0].history?.excess : 0;
                            cashCollection[index].excessStr = loan.current[0].history?.excess ? formatPricePhp(loan.current[0].history?.excess) : '-';
                            cashCollection[index].paymentCollection = loan.current[0].history?.collection ? loan.current[0].history?.collection : 0;
                            cashCollection[index].paymentCollectionStr = loan.current[0].history?.collection ? formatPricePhp(loan.current[0].history?.collection) : '-';
                            cashCollection[index].remarks = loan.current[0].history?.remarks;
                            cashCollection[index].csfCollection = loan.current[0].csfCollection;
                            cashCollection[index].csfCollectionStr = loan.current[0].csfCollection > 0 ? formatPricePhp(loan.current[0].csfCollection) : '-';
                            cashCollection[index].csfIn = loan.current[0].csfIn;
                            cashCollection[index].csfInStr = loan.current[0].csfIn > 0 ? formatPricePhp(loan.current[0].csfIn) : '-';
                        }
                    } else if (currentLoan.status === 'closed' && (currentLoan?.advance && loan.advanceTransaction && (loan?.loanFor == 'today' || (loan?.loanFor == 'tomorrow' && currentDate == loan.dateOfRelease)))) {
                        cashCollection[index] = {
                            ...cashCollection[index],
                            client: currentLoan.client,
                            coMaker: normalizeCoMaker(loan.coMaker),
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            prevLoanId: loan.prevLoanId,
                            groupId: loan.groupId,
                            loId: loan.loId,
                            branchId: loan.branchId,
                            clientId: loan.clientId,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayment: false,
                            mispaymentStr: '-',
                            noMispaymentStr: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : '-',
                            noOfPayments: currentLoan.noOfPayments,
                            noOfPayments: currentLoan.noOfPaymentStr,
                            mcbu: loan.mcbu,
                            mcbuStr: loan.mcbu > 0 ? formatPricePhp(loan.mcbu) : '-',
                            mcbuCol: loan.mcbuCol,
                            mcbuColStr: loan.mcbuCol > 0 ? formatPricePhp(loan.mcbuCol) : '-',
                            mcbuWithdrawal: currentLoan.mcbuWithdrawal,
                            mcbuWithdrawalStr: formatPricePhp(currentLoan.mcbuWithdrawal),
                            mcbuReturnAmt: loan.mcbuReturnAmt,
                            mcbuReturnAmtStr: loan.mcbuReturnAmt > 0 ? formatPricePhp(loan.mcbuReturnAmt) : '-',
                            mcbuInterest: loan.mcbuInterest,
                            mcbuInterestStr: loan.mcbuInterest > 0 ? formatPricePhp(loan.mcbuInterest) : '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: currentLoan.remarks,
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            loanTerms: loan.loanTerms,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false,
                            reverted: currentLoan.reverted,
                            history: currentLoan.history,
                            selected: false,
                            advanceTransaction: currentLoan?.advanceTransaction ? currentLoan.advanceTransaction : false,
                            dateOfRelease: dateOfRelease,
                            admissionCollection: loan.admissionCollection,
                            lrfCollection: loan.lrfCollection,
                            cbhbCollection: loan.cbhbCollection,
                            addHospitalization: loan.addHospitalization,
                            otherPassbookCollection: loan.otherPassbookCollection,
                            otherPictureCollection: loan.otherPictureCollection,
                            otherIncome: loan.otherPassbookCollection + loan.otherPictureCollection,
                            csf: loan.csf,
                            csfStr: loan.csf > 0 ? formatPricePhp(loan.csf) : '-',
                            csfCollection: safeNumber(currentLoan.csfCollection),
                            csfCollectionStr: safeNumber(currentLoan.csfCollection) > 0 ? formatPricePhp(safeNumber(currentLoan.csfCollection)) : '-',
                            csfWithdrawal: safeNumber(currentLoan.csfWithdrawal),
                            csfWithdrawalStr: safeNumber(currentLoan.csfWithdrawal) > 0 ? formatPricePhp(safeNumber(currentLoan.csfWithdrawal)) : '-',
                            csfReturnAmt: safeNumber(currentLoan.csfReturnAmt),
                            csfReturnAmtStr: safeNumber(currentLoan.csfReturnAmt) > 0 ? formatPricePhp(safeNumber(currentLoan.csfReturnAmt)) : '-',
                            csfIn: safeNumber(currentLoan.csfIn),
                            csfInStr: safeNumber(currentLoan.csfIn) > 0 ? formatPricePhp(safeNumber(currentLoan.csfIn)) : '-',
                            editHistory: loan.editHistory ? loan.editHistory : [],
                        };

                        if (currentLoan.current.length > 0 && currentLoan.current[0] !== null) {
                            cashCollection[index]._id = currentLoan.current[0]._id;
                            cashCollection[index].prevData = currentLoan.current[0].prevData;
                        } else if (loan.current.length > 0 && loan.current[0] !== null) {
                            cashCollection[index]._id = loan.current[0]._id;
                            cashCollection[index].prevData = loan.current[0].prevData;
                        }
                    }

                    cashCollection[index] = {...cashCollection[index], loanFor: loan?.loanFor, dateOfRelease: loan?.dateOfRelease};
                } else if (loan && (currentLoan == null || currentLoan?.status !== 'active')) {
                    const prevLoan = loan.prevLoans.length > 0 ? loan.prevLoans[loan.prevLoans.length - 1] : null;
                    const clientObj = loan.client ? loan.client : null;
                    if (clientObj) {
                        let pendingTomorrow = {
                            _id: loan._id,
                            client: loan.client,
                            coMaker: normalizeCoMaker(loan.coMaker),
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            group: prevLoan ? prevLoan.group : loan.group,
                            groupId: loan.groupId,
                            branchId: loan.branchId,
                            clientId: loan.clientId,
                            loId: loan.loId,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayment: false,
                            mispaymentStr: '-',
                            noMispaymentStr: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : '-',
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            mcbu: loan.mcbu,
                            mcbuStr: loan.mcbu > 0 ? formatPricePhp(loan.mcbu) : '-',
                            mcbuCol: loan.mcbuCollection,
                            mcbuColStr: loan.mcbuCollection > 0 ? formatPricePhp(loan.mcbuCollection) : '-',
                            mcbuWithdrawal: loan?.mcbuWithdrawal ? loan.mcbuWithdrawal : 0,
                            mcbuWithdrawalStr: loan?.mcbuWithdrawal > 0 ? formatPricePhp(loan.mcbuWithdrawal) : '-',
                            mcbuReturnAmt: prevLoan?.mcbuReturnAmt ? prevLoan?.mcbuReturnAmt : 0,
                            mcbuReturnAmtStr: prevLoan?.mcbuReturnAmt > 0 ? formatPricePhp(prevLoan?.mcbuReturnAmt) : '-',
                            mcbuInterest: loan.mcbuInterest,
                            mcbuInterestStr: loan.mcbuInterest > 0 ? formatPricePhp(loan.mcbuInterest) : '-',
                            hasMcbuInterest: (prevLoan && safeNumber(prevLoan?.mcbuInterest) > 0) ? true : false,
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: prevLoan ? prevLoan?.history?.remarks : '-',
                            pastDueStr: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            loanTerms: loan.loanTerms,
                            selected: false,
                            loanFor: loan.loanFor ? loan.loanFor : 'today',
                            dateOfRelease: loan.dateOfRelease ? loan.dateOfRelease : null,
                            advanceTransaction: currentLoan?.advanceTransaction ? currentLoan.advanceTransaction : false,
                            prevLoanId: loan?.prevLoanId,
                            admissionCollection: loan.admissionCollection,
                            lrfCollection: loan.lrfCollection,
                            cbhbCollection: loan.cbhbCollection,
                            addHospitalization: loan.addHospitalization,
                            otherPassbookCollection: loan.otherPassbookCollection,
                            otherPictureCollection: loan.otherPictureCollection,
                            otherIncome: loan.otherPassbookCollection + loan.otherPictureCollection,
                            csf: loan.csf,
                            csfStr: loan.csf > 0 ? formatPricePhp(loan.csf) : '-',
                            csfCollection: 0,
                            csfCollectionStr: '-',
                            csfWithdrawal: 0,
                            csfWithdrawalStr: '-',
                            csfReturnAmt: 0,
                            csfReturnAmtStr: '-',
                            maturedPD: loan.maturedPD,
                            maturedPDPrevTransaction: loan.maturedPD,
                            editHistory: loan.editHistory ? loan.editHistory : [],
                        };

                        const current = loan.current.length > 0 ? loan.current[0] : null;
                        if (current) {
                            pendingTomorrow.loanId = loan._id;
                            pendingTomorrow._id = current?._id ? current?._id : loan._id;
                        }

                        if (prevLoan) {
                            if (loan?.transferred) {
                                pendingTomorrow.transferred = true;
                                pendingTomorrow.transferStr = 'TCG';
                            } else if (loan?.transfer) {
                                pendingTomorrow.transfer = true;
                                pendingTomorrow.transferStr = 'TCR';
                            } else {
                                // pendingTomorrow.prevLoanId = prevLoan._id;
                                pendingTomorrow.loanId = loan._id;
                            }
                        }

                        cashCollection.push(pendingTomorrow);
                    }
                }
            });
            
            const hasGroupLeader = hasValidGroupLeader(cashCollection);
            setHasGroupLeader(hasGroupLeader);

            // totals
            cashCollection = [...cashCollection].map(cc => {
                let updateOtherIncome = safeNumber(cc.otherIncome);
                let csfIn = safeNumber(cc.csfIn);

                if (!hasGroupLeader && cc.status === 'active' && (!cc.remarks || (cc.remarks && !LOR_NO_CSF_IN_REMARKS.includes(cc.remarks.value)))) {
                    csfIn = cc.csfIn > 0 ? cc.csfIn : transactionSettings.minCsfCollection;
                }

                const totalCollection = (
                    safeNumber(cc.mcbuCol) + 
                    safeNumber(cc.csfCollection) + 
                    safeNumber(cc.paymentCollection) + 
                    safeNumber(cc.admissionCollection) + 
                    safeNumber(cc.lrfCollection) + 
                    safeNumber(cc.cbhbCollection) + 
                    safeNumber(cc.addHospitalization) + 
                    safeNumber(updateOtherIncome) + 
                    safeNumber(csfIn) 
                ) - (
                    safeNumber(cc.mcbuWithdrawal) + 
                    safeNumber(cc.csfWithdrawal) + 
                    safeNumber(cc.mcbuReturnAmt)
                );
                
                return {
                    ...cc,
                    mcbuCol: safeNumber(cc.mcbuCol),
                    csfIn: csfIn,
                    csfInStr: csfIn > 0 ? formatPricePhp(csfIn) : '-',
                    otherIncome: updateOtherIncome,
                    otherIncomeStr: updateOtherIncome > 0 ? formatPricePhp(updateOtherIncome) : '-',
                    totalCollection: totalCollection
                };
            });

            const hasDraft = cashCollection.filter(cc => cc.draft);
            if (hasDraft.length > 0) {
                setEditMode(true);
                setHasDraft(true);
                setDraftsCollection(hasDraft);
                console.log('Drafts Collection found: ', hasDraft)
            }

            const hasPrevDraft = cashCollection.filter(cc => cc.previousDraft);
            if (hasPrevDraft.length > 0) {
                setPrevDraft(true);

                if (type !== 'filter') {
                    cashCollection.filter(cc => cc.status == 'completed').map(cc => {
                        let origCCIdx = cashCollection.findIndex(oc => oc.slotNo == cc.slotNo);
                        if (origCCIdx > -1) {
                            let origCC = {...cashCollection[origCCIdx]};
                            origCC.remarks = origCC.history.remarks;
                            cashCollection[origCCIdx] = origCC;
                        }
                    });
                }
            } else {
                setPrevDraft(false);
            }

            const haveReverted = cashCollection.filter(cc => cc.reverted);
            if (haveReverted.length > 0) {
                setEditMode(true);
                setRevertMode(true);
                console.log('Reverted Collection found: ', haveReverted)
            }
            cashCollection.sort((a, b) => a.slotNo - b.slotNo);
            dispatch(setCashCollectionGroup(cashCollection));
            // RESET
            setTimeout(() => {
                if (currentTime) {
                    const time24h = moment(currentTime, 'h:mm:ss A').format('HH:mm');
                    const timeArr = time24h.split(':');
                    const hour = parseInt(timeArr[0]);
                    if (hour < 8 && !isStaging) {
                        setEditMode(false);
                        setGroupSummaryIsClose(true);
                    }
                }
                setLoading(false);
            }, 1000);
        } else if (response.error){
            toast.error('Error retrieving cash collection list.');
            setTimeout(() => {
                dispatch(setCashCollectionGroup([]));
                setLoading(false);
            }, 200);
        }
    }

    const calculateTotals = (dataArr) => {
        let totalLoanRelease = 0;
        let totalLoanBalance = 0;
        let totalReleaseAmount = 0;
        let totalTargetLoanCollection = 0;
        let totalExcess = 0;
        let totalLoanCollection = 0;
        let totalFullPayment = 0;
        let totalMispayment = 0;
        let totalPastDue = 0;
        let totalMcbu = 0;
        let totalMcbuCol = 0;
        let totalMcbuWithdraw = 0;
        let totalMcbuReturn = 0;
        let totalMcbuInterest = 0;
        let totalCsf = 0;
        let totalCsfCollection = 0;
        let totalAdmissionFee = 0;
        let totalLrf = 0;
        let totalCbhb = 0;
        let totalAddHospitalization = 0;
        let totalOtherIncome = 0;
        let totalCsfWithdrawal = 0;
        let totalCollection = 0;
        let totalCsfReturnAmt = 0;
        let totalCsfIn = 0;

        dataArr.map(collection => {
            if (collection.status !== 'open' && collection.status !== 'totals') {
                if (collection.status === 'active' || collection?.transferred || (collection?.transfer && collection.status == 'tomorrow')) {
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease !== '-' ? collection.amountRelease : 0 : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance !== '-' ? collection.loanBalance : 0 : 0;
                }

                if (collection.status === 'tomorrow' || collection.tomorrow) {
                    totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount !== '-' ? collection.currentReleaseAmount : 0 : 0;
                }

                if ((collection.status === 'tomorrow' || collection.tomorrow || collection?.transferred)) {
                    totalTargetLoanCollection += collection.history ? collection.history.activeLoan : 0;
                } else if (!collection.remarks || (collection.remarks && collection.remarks?.value !== 'delinquent' && !collection.remarks.value?.startsWith("excused-")) || collection?.transferred) {
                    totalTargetLoanCollection += collection.targetCollection  ? collection.targetCollection !== '-' ? collection.targetCollection : 0 : 0;
                }

                totalExcess += collection.excess ? collection.excess !== '-' ? collection.excess : 0 : 0;
                totalLoanCollection += collection.paymentCollection ? collection.paymentCollection !== '-' ? collection.paymentCollection : 0 : 0;
                totalFullPayment += collection.fullPayment ? collection.fullPayment !== '-' ? collection.fullPayment : 0 : 0;
                totalMispayment += collection.mispaymentStr === 'Yes' ? 1 : 0;
                totalPastDue += (collection.pastDue && collection.pastDue !== '-') ? collection.pastDue : 0;
                totalMcbu += collection.mcbu ? collection.mcbu : 0;
                totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdraw += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;

                totalMcbuReturn += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;

                if (!['pending', 'rejected'].includes(collection.status)) {
                    totalCsf += safeNumber(collection.csf);
                    totalCsfIn += safeNumber(collection.csfIn);
                    totalCsfCollection += safeNumber(collection.csfCollection);
                    totalAdmissionFee += safeNumber(collection.admissionCollection);
                    totalLrf += safeNumber(collection.lrfCollection);
                    totalCbhb += safeNumber(collection.cbhbCollection);
                    totalAddHospitalization += safeNumber(collection.addHospitalization);
                    totalOtherIncome += safeNumber(collection.otherIncome);
                    totalCsfWithdrawal += safeNumber(collection.csfWithdrawal);
                    totalCollection += safeNumber(collection.totalCollection);
                    totalCsfReturnAmt += safeNumber(collection.csfReturnAmt);
                }
            }
        });

        const totals = {
            slotNo: 100,
            fullName: 'TOTALS',
            loanCycle: '',
            amountRelease: totalLoanRelease,
            amountReleaseStr: totalLoanRelease ? formatPricePhp(totalLoanRelease) : 0,
            mispaymentStr: totalMispayment,
            loanBalance: totalLoanBalance,
            loanBalanceStr: totalLoanBalance ? formatPricePhp(totalLoanBalance) : 0,
            currentReleaseAmount: totalReleaseAmount,
            currentReleaseAmountStr: totalReleaseAmount ? formatPricePhp(totalReleaseAmount) : 0,
            noOfPayments: '-',
            csf: totalCsf,
            csfStr: totalCsf > 0 ? formatPricePhp(totalCsf) : '-',
            mcbuStr: totalMcbu > 0 ? formatPricePhp(totalMcbu) : '-',
            mcbuColStr: totalMcbuCol > 0 ? formatPricePhp(totalMcbuCol) : '-',
            mcbuWithdrawalStr: totalMcbuWithdraw > 0 ? formatPricePhp(totalMcbuWithdraw) : '-',
            mcbuReturnAmtStr: totalMcbuReturn > 0 ? formatPricePhp(totalMcbuReturn) : '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest > 0 ? formatPricePhp(totalMcbuInterest) : '-',
            csfIn: totalCsfIn,
            csfInStr: totalCsfIn > 0 ? formatPricePhp(totalCsfIn) : '-',
            csfCollection: totalCsfCollection,
            csfCollectionStr: totalCsfCollection > 0 ? formatPricePhp(totalCsfCollection) : '-',
            admissionCollection: totalAdmissionFee,
            lrfCollection: totalLrf,
            cbhbCollection: totalCbhb,
            addHospitalization: totalAddHospitalization,
            otherIncome: totalOtherIncome,
            csfWithdrawal: totalCsfWithdrawal,
            csfWithdrawalStr: totalCsfWithdrawal > 0 ? formatPricePhp(totalCsfWithdrawal) : '-',
            csfReturnAmt: totalCsfReturnAmt,
            csfReturnAmtStr: totalCsfReturnAmt > 0 ? formatPricePhp(totalCsfReturnAmt) : '-',
            totalCollection: totalCollection,
            targetCollection: totalTargetLoanCollection,
            targetCollectionStr: totalTargetLoanCollection ? formatPricePhp(totalTargetLoanCollection) : 0,
            excess: totalExcess,
            excessStr: totalExcess ? formatPricePhp(totalExcess) : 0,
            paymentCollection: totalLoanCollection,
            paymentCollectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
            remarks: '-',
            fullPayment: totalFullPayment,
            fullPaymentStr: totalFullPayment ? formatPricePhp(totalFullPayment) : 0,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
            noMispaymentStr: '',
            clientStatus: '-',
            status: 'totals'
        };

        return totals;
    }

    const validation = (draft) => {
        let errorMsg = new Set();

        data && data.map(cc => {
            if (cc.status !== 'totals' && cc.status == 'active' && cc?.loanBalance > 0 && !draft && !cc?.maturedPD && (cc?.transferStr == null || cc?.transferStr == '-')) {
                if (cc.group.day === dayName) {
                    if (cc.error) {
                        errorMsg.add('Error occured. Please double check the Actual Collection column.');
                    } else if (parseFloat(cc.paymentCollection) === 0 && !cc.remarks) {
                        errorMsg.add('Error occured. Please select a remarks for 0 or no payment Actual Collection.');
                    } else if ((parseFloat(cc.paymentCollection) === 0 || (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < parseFloat(cc.activeLoan))) 
                            && (!cc.remarks || (cc.remarks && (!cc.remarks.value?.startsWith('delinquent') && cc.remarks.value !== "past due" && !cc.remarks.value?.startsWith('excused')
                            && !cc.remarks.value.startsWith('offset-') && cc.remarks.value !== 'offset-unclaimed' && cc.remarks.value !== 'matured-past due' 
                            && !cc.remarks.value?.startsWith('collection-')))) ) {
                        errorMsg.add("Error occured. 0 payment should be mark either PAST DUE, DELINQUENT OR EXCUSED in remarks.");
                    } else if ((cc.remarks && cc.remarks.value === "past due") && parseFloat(cc.pastDue) < parseFloat(cc.targetCollection)) {
                        errorMsg.add("Error occured. Past due is less than the target collection.");
                    } else if (cc.remarks && (cc.remarks.value === "past due" || cc.remarks.value?.startsWith('excused') || cc.remarks.value?.startsWith('delinquent')) ) {
                        if (cc.paymentCollection > 0 && cc.paymentCollection % 10 !== 0) {
                            errorMsg.add("Error occured. Amount collection is not divisible by 10");
                        }
                    } else if (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < cc.activeLoan 
                            && (!cc.remarks?.value.startsWith('collection-')) && cc.remarks?.value !== 'offset-unclaimed'
                            && !cc.remarks?.value.startsWith('offset-')) {
                        errorMsg.add("Actual collection is below the target collection.");
                    } else if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) !== 0 && cc.loanBalance !== 0) {
                        if (cc.remarks && (cc.remarks.value !== "past due" && !cc.remarks.value?.startsWith('excused') && !cc.remarks.value?.startsWith('delinquent') 
                            && !cc.remarks.value?.startsWith('collection-') && cc.remarks.value !== 'matured-past due') && cc.remarks.value !== 'offset-matured-pd' ) {
                            errorMsg.add(`Actual collection should be divisible by ${cc.activeLoan}.`);
                        }
                    } else if (cc.loanBalance > 0 && parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan) && (parseFloat(cc.paymentCollection) === (cc.activeLoan * 2) || parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan * 2)) && cc.loanBalance !== 0) {
                        if (parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan * 2) && parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) === 0 && (!cc.remarks || cc.remarks && cc.remarks.value !== "advance payment" && cc.remarks.value !== "past due collection")) {
                            errorMsg.add(`Error occured. Actual collection is a advance payment please set remarks as Advance Payment.`);
                        } else if (parseFloat(cc.paymentCollection) === (cc.activeLoan * 2) && parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) === 0 && (!cc.remarks || cc.remarks && cc.remarks.value !== "double payment" && cc.remarks.value !== "advance payment" && cc.remarks.value !== "past due collection")) {
                            errorMsg.add('Error occured. Actual collection is a double payment please set remarks as Double Payment or Advance Payment.');
                        }
                    } else if (cc.status === "active" && cc.loanBalance === 0 && !cc.remarks ) {
                        errorMsg.add('Error occured. Please select PENDING, RELOANER or OFFSET remarks for full payment transaction.');
                    }
    
                    if (parseFloat(cc.loanBalance) && (cc.remarks && cc.remarks.value && cc.remarks.value?.startsWith('offset')) && !cc?.maturedPDPrevTransaction) {
                        errorMsg.add('Error occured. Please input the full balance amount before closing the loan account.');
                    }
                }

                if (cc.mcbuError) {
                    errorMsg.add('Error occured. Please double check the MCBU Collection/Withdrawal column.');
                } 
                
                if (cc.groupDay === dayName || cc.offsetTransFlag) {
                    if (!cc.mcbuCol || parseFloat(cc.mcbuCol) < transactionSettings.minWeeklyMcbuCollection) {
                        const remarksValue = cc.remarks?.value;
                        const isExemptFromMcbu = remarksValue === 'past due'
                            || remarksValue === 'past due collection'
                            || remarksValue?.startsWith('excused-')
                            || remarksValue?.startsWith('delinquent');

                        if (!cc.remarks || !isExemptFromMcbu) {
                            errorMsg.add('Error occured. Invalid MCBU Collection.');
                        }
                    } else if (parseFloat(cc.mcbuCol) > 50 && parseFloat(cc.mcbuCol) % 10 !== 0 && parseFloat(cc.mcbuInterest) === 0) {
                        errorMsg.add('Error occured. MCBU collection should be divisible by 10.');
                    }
                }

                if (cc.mcbuWithdrawFlag) {
                    if (!cc.mcbuWithdrawal) {
                        errorMsg.add('Error occured. Invalid MCBU Withdraw amount.');
                    } else if (parseFloat(cc.mcbuWithdrawal) < 10) {
                        errorMsg.add('Error occured. MCBU withdrawal amount is less than ₱10.');
                    }
                }

                if (cc.offsetTransFlag) {
                    if (!cc.remarks || (cc.remarks && !cc.remarks.value?.startsWith('offset-'))) {
                        errorMsg.add('Error occured. Only offset transaction allowed.');
                    }
                }

                if (cc.dcmc && cc.remarks?.value == 'delinquent-mcbu' && cc.mcbuCol <= 0) {
                    errorMsg.add('Error occured. Please add MCBU amount.');
                }

                
                if ((cc.remarks == '' && cc.paymentCollection > 0) && (cc.remarks && ['reloaner', 'double payment', 'advance payment'].includes(cc.remarks?.value))) {
                    const noPaymentsToday = cc.paymentCollection / cc.activeLoan;
                    const expectedMcbu = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                    
                    if (!cc.mcbuCol) {
                        errorMsg.add(`Error occured. No MCBU Collection detected.`);
                    } else if (cc.mcbuCol < expectedMcbu) {
                        errorMsg.add(`Error occured. MCBU Collection is below the expected amount of ${expectedMcbu}.`);
                    }
                }

                if (cc.csfError || (cc?.groupLeader && safeNumber(cc.csfCollection) <= 0) 
                        && (cc.remarks && (!cc.remarks.value?.startsWith('delinquent') && cc.remarks.value !== "past due" && !cc.remarks.value?.startsWith('excused')))) {
                    errorMsg.add('Error occured. Please double check the CSF Collection column.');
                }
            } else if (cc.status !== 'totals' && (cc?.transferStr == null || cc?.transferStr == '-') && (cc.status === 'completed' || (cc?.status !== 'closed' && cc?.loanBalance <= 0)) && (!cc.remarks || (cc.remarks && (cc.remarks.value !== 'pending' && !cc.remarks.value?.startsWith('reloaner') && !cc.remarks.value?.startsWith('offset'))))) {
                errorMsg.add("Invalid remarks. Fullpayment transaction has no remarks. Please set the remarks to RELOANER OR OFFSET.");
            } else if (cc.status == 'completed' && cc.paymentCollection > 0 && (cc.remarks && ['reloaner', 'double payment', 'advance payment'].includes(cc.remarks?.value))) {
                const activeLoan = cc.activeLoan > 0 ? cc.activeLoan : cc.history?.activeLoan;
                const noPaymentsToday = cc.paymentCollection / activeLoan;
                const expectedMcbu = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;

                if (!cc.mcbuCol) {
                    errorMsg.add(`Error occured. No MCBU Collection detected.`);
                } else if (cc.mcbuCol < expectedMcbu) {
                    errorMsg.add(`Error occured. MCBU Collection is below the expected amount of ${expectedMcbu}.`);
                }
            }
        });

        return errorMsg;
    }

    const handleSaveUpdate = async (draft) => {
        if (!isV2TransactionApiEnabled) {
            setLoading(true);
        }

        // Check if page is stale (date changed)
        if (isV2TransactionApiEnabled && pageStale) {
            setLoading(false);
            toast.error('The date has changed since you loaded this page. Please refresh before saving.');
            return;
        }
        
        // Warn if near midnight
        if (isV2TransactionApiEnabled && isNearMidnight()) {
            const proceed = window.confirm(
                'Warning: It is almost midnight. Submitting now may cause issues. Do you want to continue?'
            );
            if (!proceed) {
                setLoading(false);
                return;
            }
        }
        
        let save = false;

        const transactionStatus = data.filter(cc => cc.groupStatus === 'closed');
        if (transactionStatus.length > 0) {
            toast.error('Updating this record is not allowed since the Group Summary is already closed by the Branch Manager.');
        } else {
            const errorMsgArr = Array.from(validation(draft));
            if (errorMsgArr.length > 0) {
                let errorMsg;
                errorMsgArr.map(msg => {
                    errorMsg = errorMsg ? errorMsg + '\n \n' + msg  : msg;
                });
                toast.error(errorMsg, { autoClose: 5000 });
                setLoading(false);
            } else {
                let prevDraftDate =  null;
                let dataArr = data.filter(cc => cc.status !== 'open').filter(cc => !!cc._dirty).map(cc => {
                    let temp = JSON.parse(JSON.stringify(cc));
                    if (cc.status !== 'totals') {
                        temp.groupDay = temp.group.day;
                    }

                    temp.mcbuCol = temp.mcbuCol ? temp.mcbuCol : 0;
                    if (temp.reverted) {
                        delete temp.reverted;
                        temp.revertedDate = currentDate;
                        temp.fromReverted = true;
                    }
    
                    delete temp.targetCollectionStr;
                    delete temp.amountReleaseStr;
                    delete temp.loanBalanceStr;
                    delete temp.excessStr;
                    delete temp.totalStr;
                    delete temp.currentReleaseAmountStr;
                    delete temp.fullPaymentStr;
                    delete temp.paymentCollectionStr;
                    delete temp.noOfPaymentStr;
                    if (!draft) {
                        delete temp.error;
                        delete temp.dcmc;
                        delete temp.mpdc;
                    }
                    delete temp.dirty;
                    delete temp.group;
                    delete temp.pastDueStr;
                    delete temp.groupCashCollections;
                    delete temp.loanOfficer;
                    delete temp.noMispaymentStr;
                    delete temp.mcbuStr;
                    delete temp.mcbuColStr;
                    delete temp.mcbuWithdrawalStr;
                    delete temp.mcbuReturnAmtStr;
                    delete temp.mcbuError;
                    delete temp.client;
                    delete temp.mcbuInterestStr;
                    delete temp.otherDay;
                    delete temp.transferStr;
                    delete temp.selected;

                    if (cc?._id) {
                        temp.modifiedBy = currentUser._id;
                        temp.dateModified = moment(currentDate).format('YYYY-MM-DD');
                    } else {
                        temp.insertedBy = currentUser._id;
                        temp.dateAdded = prevDraft ? temp.dateAdded : currentDate;
                    }

                    if (temp.previousDraft && !prevDraftDate) {
                        prevDraftDate = temp.dateAdded;
                    }

                    save = true;
                    
                    if (cc.status === 'active') {
                        if (currentUser.role.rep === 4) {
                            temp.loId = currentUser._id;
                        } else {
                            temp.loId = currentGroup && currentGroup.loanOfficerId;
                        }
    
                        temp.paymentCollection = parseFloat(temp.paymentCollection);
                        temp.loanBalance = parseFloat(temp.loanBalance);
                        temp.amountRelease = parseFloat(temp.amountRelease);

                        if (!temp.paymentCollection || temp.paymentCollection <= 0) {
                            temp.mispayment = true;
                            temp.mispaymentStr = 'Yes';
                        }

                        if (temp.remarks && temp.remarks.value === 'excused advance payment') {
                            temp.activeLoan = 0;
                            temp.targetCollection = 0;
                            temp.mispayment = false;
                        }

                        if (temp.remarks && temp.remarks.value === 'delinquent-mcbu') {
                            temp.activeLoan = 0;
                            temp.targetCollection = 0;
                            temp.mispayment = true;
                        }
    
                        if (temp.loanBalance <= 0 && temp.remarks?.value !== 'offset-matured-pd') {
                            temp.status = temp?.advance ? 'pending' : 'completed';
                            temp.fullPaymentDate = currentDate;
                        }
    
                        if (temp.status === 'completed' || ((temp.maturedPD || temp.maturedPDPrevTransaction) && temp.remarks?.value == 'offset-matured-pd')) {
                            temp.fullPaymentDate = temp.fullPaymentDate ? temp.fullPaymentDate : currentDate;
                            if (temp.previousDraft) {
                                temp.fullPaymentDate = temp.dateAdded;
                            }
                        }
                        
                        if (typeof temp.remarks === 'object') {
                            if (temp.remarks.value && temp.remarks.value?.startsWith('offset')) {
                                temp.status = 'closed';
                                temp.clientStatus = 'offset';
                                temp.closedDate = temp.previousDraft ? temp.dateAdded : currentDate;
                            }
                        }
                    } else if (cc.status == 'completed') {
                        if (temp.loanBalance <= 0 && temp.remarks?.value !== 'offset-matured-pd') {
                            temp.status = temp?.advance ? 'pending' : 'completed';
                        }

                        if (temp.paymentCollection > 0) {
                            temp.fullPaymentDate = currentDate;
                        }
                    }

                    if (temp?.advance && temp?.status == 'pending' && temp?.loanFor == 'tomorrow' && temp?.dateOfRelease != currentDate) {
                        const dateOfRelease = temp?.dateOfRelease ? temp?.dateOfRelease : null;
                        let diff = 0;
                        if (dateOfRelease) {
                            diff = moment(currentDate).diff(dateOfRelease);
                        }

                        if (diff < 0) {
                            temp.status = 'completed';
                        }
                    }

                    if (safeNumber(temp.paymentCollection) <= 0 || temp.status == "closed") {
                        temp.csfIn = 0;
                    }

                    // if admin it should not override what it is currently saved
                    temp.groupStatus = 'pending';
                    temp.draft = temp.loanBalance <= 0 ? false : draft;

                    if (prevDraft && !draft) {
                        temp.groupStatus = "closed";
                    }

                    if (!temp.dateAdded) {
                        temp.dateAdded = currentDate;
                    }
                
                    return temp;   
                }).filter(cc => cc.status !== "totals");

                const overallTotalNetCollection = data.find(cc => cc.status === 'totals')?.totalCollection || 0;

                const selectedGroup = data.length > 0 ? data[0].group : {};
                if (selectedGroup && selectedGroup.day !== dayName) {
                    dataArr = dataArr.filter(cc => cc.mcbuWithdrawFlag || cc.offsetTransFlag);
                }

                const revertedItems = dataArr.filter(cc => cc.reverted || cc.fromReverted);
                if (revertedItems.length > 0) {
                    dataArr = revertedItems;
                }

                if (!draft && draftsCollection.length > 0) {
                    const draftIds = new Set(draftsCollection.map(d => d.client._id));
                    const matchingItems = dataArr.filter(item => draftIds.has(item.clientId));
                    if (matchingItems.length > 0) {
                        dataArr = matchingItems;
                    }
                }

                // const pendings = dataArr.filter(cc => {
                //     return cc?.advance && cc.status == 'pending';
                // });
                // console.log(dataArr)
                if (save) {
                    let cashCollection;
                    if (editMode) {
                        if (prevDraft) {
                            const draftArr = dataArr.filter(cc => cc.previousDraft);
                            cashCollection = {
                                dateModified: currentDate,
                                modifiedBy: currentUser._id,
                                collection: JSON.stringify(draftArr),
                                currentDate: prevDraftDate,
                                currentTime: currentTime,
                                overallTotalNetCollection: overallTotalNetCollection
                            };
                        } else {
                            cashCollection = {
                                dateModified: currentDate,
                                modifiedBy: currentUser._id,
                                collection: JSON.stringify(dataArr),
                                currentDate: currentDate,
                                currentTime: currentTime,
                                overallTotalNetCollection: overallTotalNetCollection
                            };
                        }
                    } else {
                        cashCollection = {
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr),
                            mode: 'weekly',
                            currentDate: currentDate,
                            currentTime: currentTime,
                            overallTotalNetCollection: overallTotalNetCollection
                        };
                    }
            
                    if (isV2TransactionApiEnabled) {
                        // Start tracking this transaction
                        const groupId = dataArr[0]?.groupId;
                        const transactionId = transactionStateManager.startTransaction(groupId, cashCollection);
                        
                        // Show the progress modal with steps variant
                        saveProgress.showProgress({
                            variant: 'steps',
                            title: 'Saving Transaction',
                            message: 'Processing payment collections...',
                            currentStep: 1,
                            steps: [
                                'Validating Data',
                                'Processing Collections',
                                'Updating Loans',
                                'Finalizing'
                            ]
                        });
                        
                        try {
                            // Use the new robust save function
                            const response = await saveCashCollectionWithRetry(cashCollection, {
                                maxRetries: 3,
                                onRetry: (attempt, error) => {
                                    saveProgress.setRetry(attempt);
                                    saveProgress.updateProgress({
                                        subMessage: `Retrying... (attempt ${attempt}/3)`
                                    });
                                    console.warn(`Save retry ${attempt}:`, error.message);
                                },
                                onDateMismatch: (error) => {
                                    setPageStale(true);
                                    saveProgress.setError('Date mismatch detected. Please refresh the page.');
                                },
                                onProgress: ({ step, message }) => {
                                    // Map step names to step numbers
                                    const stepMap = {
                                        'validating': 1,
                                        'processing': 2,
                                        'updating': 3,
                                        'finalizing': 4
                                    };
                                    
                                    saveProgress.updateProgress({
                                        currentStep: stepMap[step] || 2,
                                        message: message
                                    });
                                }
                            });
                            
                            // Mark transaction as complete
                            transactionStateManager.completeTransaction(transactionId);
                            
                            // Show success state
                            saveProgress.setSuccess('Payment collection saved successfully!');
                            
                            // Success - show summary if available
                            if (response.summary) {
                                console.log('Transaction summary:', response.summary);
                            }
                            
                            // Reload after showing success
                            setTimeout(() => {
                                window.location.reload();
                            }, 1500);
                            
                        } catch (error) {
                            // Mark transaction as failed
                            transactionStateManager.failTransaction(transactionId, error);
                            
                            setLoading(false);
                            
                            // Handle specific error types
                            if (error.code === ERROR_CODES.DATE_MISMATCH) {
                                setPageStale(true);
                                saveProgress.setError('The date has changed. Please refresh the page and try again.');
                            } else if (error.code === ERROR_CODES.NETWORK_ERROR) {
                                saveProgress.setError('Network error. Please check your connection and try again.');
                            } else {
                                saveProgress.setError(`Failed to save: ${error.message}`);
                            }
                            
                            // Hide the error modal after 5 seconds
                            setTimeout(() => {
                                saveProgress.hideProgress();
                            }, 5000);
                            
                            console.error('Save failed:', error);
                        }
                    } else {
                        const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/save', cashCollection);
                        if (response.success) {
                            reloadAfterSave();
                        }
                    }
                } else {
                    toast.warning('No active data to be saved.');
                    setLoading(false);
                }
            }
        }
    }

    const reloadAfterSave = () => {
        setLoading(false);
        saveProgress.setSuccess('Payment collection successfully submitted. Reloading page please wait.');
        setTimeout(async () => {
            window.location.reload();
        }, 2000);
    }

    const handlePaymentCollectionChange = (e, index, type) => {
        const totalObj = data.find(o => o.status === 'totals');
        const totalIdx = data.indexOf(totalObj);

        if (type === 'amount') {
            const value = e.target.value;
            let payment = value ? value : 0;

            let list = data.map((cc, idx) => {
                let temp = {...cc};
                if (temp.status !== 'open') {
                    if (idx === index) {
                        temp.error = false;
                        temp.dcmc = false;
                        temp.mpdc = false;
                        if (temp.prevData) {
                            temp.loanBalance = temp.prevData.loanBalance;
                            temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                            temp.total = temp.prevData.total;
                            temp.noOfPayments = temp.prevData.noOfPayments;
                            temp.noOfPaymentStr = temp.noOfPayments + " / " + maxDays;
                            temp.amountRelease = temp.prevData.amountRelease;
                            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
                            temp.excess = temp.prevData.excess;
                            temp.excessStr = (temp.excess > 0 || temp.excess !== '-') ? formatPricePhp(temp.excess) : '-';
                            temp.fullPayment = 0;
                            temp.fullPaymentStr = '-';
                            temp.activeLoan = temp.prevData.activeLoan;
                            temp.targetCollection = temp.activeLoan;
                            temp.targetCollectionStr = formatPricePhp(temp.activeLoan);
                            temp.remarks = '';
                            temp.pastDue = temp.prevData.pastDue;
                            temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
                            temp.status = 'active';
                            temp.advanceDays = temp.prevData.advanceDays;
                            // temp.mcbu = temp.prevData.mcbu;
                            // temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                            // temp.mcbuCol = 0;
                            // temp.mcbuColStr = '-';
                            if (!temp.hasMcbuWithdrawal) {
                                temp.mcbuWithdrawal = 0;
                                temp.mcbuWithdrawalStr = '-';
                            }
                            
                            temp.mcbuReturnAmt = 0;
                            temp.mcbuReturnAmtStr = '-';
                            delete temp.excused;
                            delete temp.delinquent;
                        } else {
                            temp.prevData = {
                                amountRelease: temp.amountRelease,
                                paymentCollection: temp.paymentCollection,
                                excess: temp.excess !== '-' ? temp.excess : 0,
                                loanBalance: temp.loanBalance,
                                activeLoan: temp.activeLoan,
                                noOfPayments: temp.noOfPayments,
                                total: temp.total,
                                pastDue: temp.pastDue,
                                mcbu: temp.mcbu,
                                csf: temp.csf,
                                advanceDays: temp.advanceDays
                            };
                        }

                        if (value && parseInt(value) != 0) {
                            if (containsAnyLetters(value)) {
                                toast.error("Invalid amount in actual collection. Please input numeric only.");
                                temp.error = true;
                                temp.paymentCollection = 0;
                            } else if (parseFloat(payment) > temp.loanBalance) {
                                toast.error("Actual collection is greater than the loan balance.");
                                temp.error = true;
                                temp.paymentCollection = 0;
                            } else if (parseFloat(payment) === 0 || parseFloat(payment) === temp.activeLoan 
                                || (parseFloat(payment) > temp.activeLoan && parseFloat(payment) % parseFloat(temp.activeLoan) === 0)
                                || parseFloat(payment) === parseFloat(temp.loanBalance)
                                || (parseFloat(payment) > 0 && parseFloat(payment) < parseFloat(temp.activeLoan))) {
                                temp.dirty = true;
                                temp.error = false;
    
                                temp.paymentCollection = parseFloat(payment);
                                temp.paymentCollectionStr = formatPricePhp(payment);
                                const prevLoanBalance = temp.loanBalance;
                                temp.loanBalance = parseFloat(temp.loanBalance) - parseFloat(payment);
                                temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : 0;
                                temp.total = parseFloat(temp.total) + parseFloat(payment);
                                temp.totalStr = formatPricePhp(temp.total);
        
                                temp.excess =  0;
                                temp.excessStr = '-';
                                if (parseFloat(payment) == 0) {
                                    temp.noOfPayments = temp.noOfPayments <= 0 ? 0 : temp.noOfPayments - 1;
                                    temp.mispayment = true;
                                    temp.mispaymentStr = 'Yes';
                                } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                                    temp.mcbu = safeNumber(temp.prevData.mcbu);
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                                    temp.excessStr = formatPricePhp(temp.excess);
                                    temp.mispayment = false;
                                    temp.mispaymentStr = "No";
    
                                    const noPayments = parseInt(payment) / parseInt(temp.activeLoan);
                                    temp.noOfPayments = temp.noOfPayments + noPayments;
                                    const finalMcbu = noPayments * transactionSettings.minWeeklyMcbuCollection;
                                    temp.mcbuCol = finalMcbu;
                                    temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                    temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    temp.mcbuError = false;
                                } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                                    temp.excess =  0;
                                    temp.mispayment = true;
                                    temp.mispaymentStr = 'Yes';
                                    temp.error = true;
                                } else {
                                    temp.mcbu = safeNumber(temp.prevData.mcbu);
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    temp.mcbuCol = transactionSettings.minWeeklyMcbuCollection;
                                    temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                    temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    temp.mcbuError = false;
                                    temp.mispayment = false;
                                    temp.mispaymentStr = 'No';
                                    temp.noOfPayments = temp.noOfPayments + 1;
                                }
        
                                temp.noOfPaymentStr = temp.noOfPayments + ' / ' + maxDays;
    
                                temp = setHistory(temp, prevLoanBalance);
        
                                if (temp.loanBalance <= 0) {
                                    temp.fullPayment = temp.amountRelease;
                                    temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                    temp.loanBalanceStr = 0;
                                    temp.amountRelease = 0;
                                    temp.amountReleaseStr = 0;
                                }

                                const noPaymentsToday = value / temp.activeLoan;
                                const minMcbuCol = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                                if (!temp.mcbuCol || temp.mcbuCol < minMcbuCol) {
                                    temp.mcbuError = true;
                                }
                            } 
                            // else if (parseFloat(payment) > 0 && parseFloat(payment) < targetCollection) {
                            //     // toast.error("Actual collection is below the target collection.");
                            //     temp.error = true;
                            //     temp.paymentCollection = parseFloat(payment);
                            // } 
                            else if (parseFloat(payment) % parseFloat(temp.activeLoan) !== 0) {
                                // toast.error("Actual collection should be divisible by 100.");
                                temp.paymentCollection = parseFloat(payment);
                                temp.error = true;
                                if (temp.remarks && (temp.remarks.value === "past due" || temp.remarks.value?.startsWith('excused-') || temp.remarks.value?.startsWith('delinquent') || temp.remarks.value?.startsWith('collection-')) ) {
                                    temp.paymentCollection = parseFloat(payment);
                                    temp.paymentCollectionStr = formatPricePhp(temp.paymentCollection);
                                    temp.error = false;
                                }
                            }
                        } else {
                            temp.paymentCollection = 0;
                            temp.mcbuCol = 0;
                            temp.mcbuColStr = '-';
                            temp.mispayment = false;
                            temp.mispaymentStr = 'No';
                            temp.remarks = "";
                        }
                    } 

                    temp._dirty = true;
                } 
                return temp;
            });

            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;

            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'mcbuCol') {
            const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
                    
            const mcbuCol = value;
            let list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));
        
                if (idx === index) {
                    if (temp.prevData == null) {
                        temp.prevData = {
                            amountRelease: temp.amountRelease,
                            paymentCollection: temp.paymentCollection,
                            excess: temp.excess !== '-' ? temp.excess : 0,
                            loanBalance: temp.loanBalance,
                            activeLoan: temp.activeLoan,
                            noOfPayments: temp.noOfPayments,
                            total: temp.total,
                            pastDue: temp.pastDue,
                            mcbu: temp.mcbu,
                            advanceDays: temp.advanceDays,
                            mcbuCol: temp.mcbuCol,
                            csf: temp.csf,
                            csfCollection: temp.csfCollection
                        };
                    }

                    temp.mcbu = temp.prevData.mcbu;
        
                    if (mcbuCol >= 0) {
                        if (temp.dcmc || temp.mpdc) {
                            if (temp?.prevData?.activeLoan > 0 && temp?.prevData?.activeLoan == mcbuCol) {
                                toast.error('Error occured. MCBU Collection should not be equal to the target collection. You can use the normal transaction');
                                temp.mcbuError = true;
                                temp.mcbuCol = mcbuCol;
                                temp.mcbuColStr = '-';
                            } else {
                                temp.mcbuCol = mcbuCol;
                                temp.mcbuColStr = formatPricePhp(mcbuCol);
                                temp.mcbu += mcbuCol;
                                temp.mcbuStr = formatPricePhp(temp.mcbu);
                                temp.prevData = {
                                    ...temp.prevData,
                                    mcbuCol: mcbuCol,
                                    csfCollection: 0
                                };
                            }
                        } else {
                            const noPaymentsToday = temp.paymentCollection / temp.activeLoan;
                            const minMcbuCol = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                            if (mcbuCol > 0 && mcbuCol < minMcbuCol) {
                                temp.mcbuError = true;
                                temp.mcbuCol = mcbuCol;
                                temp.mcbuColStr = formatPricePhp(mcbuCol);
                            } else {
                                temp.mcbuError = false;
                                temp.mcbuCol = mcbuCol;
                                temp.mcbuColStr = formatPricePhp(mcbuCol);
                                temp.mcbu += mcbuCol;
                                temp.mcbuStr = formatPricePhp(temp.mcbu);
                                temp.prevData = {
                                    ...temp.prevData,
                                    mcbuCol: mcbuCol
                                };
                            }
                        }

                        temp._dirty = true;
                    } else {
                        temp.mcbuCol = 0;
                        temp.mcbuColStr = '-';
                    }
                }
        
                return temp;
            });
        
            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;
        
            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'csfCol') {
            const value = e.target.value === '' ? 0 : parseFloat(e.target.value) || 0;
            
            const csfCol = value;
            let list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));
        
                if (idx === index) {
                    if (temp.prevData == null) {
                        temp.prevData = {
                            amountRelease: temp.amountRelease,
                            paymentCollection: temp.paymentCollection,
                            excess: temp.excess !== '-' ? temp.excess : 0,
                            loanBalance: temp.loanBalance,
                            activeLoan: temp.activeLoan,
                            noOfPayments: temp.noOfPayments,
                            total: temp.total,
                            pastDue: temp.pastDue,
                            mcbu: temp.mcbu,
                            csf: temp.csf,
                            advanceDays: temp.advanceDays,
                            csfCollection: temp.csfCollection,
                            mcbuCol: temp.mcbuCol
                        };
                    }

                    temp.csf = safeNumber(temp.prevData.csf);
        
                    if (csfCol >= 0) {
                        if (csfCol > 0 && csfCol < transactionSettings.minCsfCollection) {
                            temp.csfError = true;
                            temp.csfCollection = csfCol;
                        } else {
                            temp.csfError = false;
                            temp.csfCollection = csfCol;
                            temp.csfCollectionStr = csfCol > 0 ? formatPricePhp(csfCol) : '-';
                            temp.csf += csfCol;
                            temp.csfStr = temp.csf > 0 ? formatPricePhp(temp.csf) : '-';
                            temp.prevData = {
                                ...temp.prevData,
                                csfCollection: csfCol
                            };
                        }
                        temp._dirty = true;
                    } else {
                        temp.csfCollection = 0;
                    }
                }
        
                return temp;
            });
        
            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;
        
            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'mcbuWithdrawal') {
            const value = e.target.value ? parseFloat(e.target.value) : 0;
            
            const mcbuWithdrawal = value;

            let list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));

                if (idx === index) {
                    if (temp?.prevData != null) {
                        temp.mcbu = temp.prevData.mcbu;
                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                    } else {
                        temp.prevData = {
                            amountRelease: temp.amountRelease,
                            paymentCollection: temp.paymentCollection,
                            excess: temp.excess !== '-' ? temp.excess : 0,
                            loanBalance: temp.loanBalance,
                            activeLoan: temp.activeLoan,
                            noOfPayments: temp.noOfPayments,
                            total: temp.total,
                            pastDue: temp.pastDue,
                            mcbu: temp.mcbu
                        };
                    }

                    if (mcbuWithdrawal < 50) {
                        temp.mcbuError = true;
                    } else if (mcbuWithdrawal > temp.mcbu) {
                        temp.mcbuError = true;
                    } else {
                        temp.mcbuError = false;
                        temp.mcbuWithdrawal = mcbuWithdrawal;
                        temp.mcbuWithdrawalStr = formatPricePhp(mcbuWithdrawal);
                        temp.mcbu += temp.mcbuCol;
                        if (temp.mcbu > 0) {
                            temp.mcbu = parseFloat(temp.mcbu) - mcbuWithdrawal;
                            temp.mcbuStr = formatPricePhp(temp.mcbu);   
                        }
                        
                        temp._dirty = true;
                    }
                }

                return temp;
            });

            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;

            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'mcbuInterest') {
            const value = e.target.value ? parseFloat(e.target.value) : 0;
            if (value > 0) {
                const mcbuInterest = value;
                let list = data.map((cc, idx) => {
                    let temp = JSON.parse(JSON.stringify(cc));

                    if (idx === index) {
                        if (temp.prevData != null) {
                            temp.mcbu = temp.prevData.mcbu;
                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                        } else {
                            temp.prevData = {
                                amountRelease: temp.amountRelease,
                                paymentCollection: temp.paymentCollection,
                                excess: temp.excess !== '-' ? temp.excess : 0,
                                loanBalance: temp.loanBalance,
                                activeLoan: temp.activeLoan,
                                noOfPayments: temp.noOfPayments,
                                total: temp.total,
                                pastDue: temp.pastDue,
                                mcbu: temp.mcbu
                            };
                        }

                        if (temp.mcbuCol > 0) {
                            temp.mcbu += temp.mcbuCol;
                        }

                        temp.mcbuInterest = mcbuInterest;
                        temp.mcbuInterestStr = formatPricePhp(mcbuInterest);
                        temp.mcbu = temp.mcbu + mcbuInterest;
                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                        
                        temp._dirty = true;
                    }

                    return temp;
                });

                const totalsObj = calculateTotals(list);
                list[totalIdx] = totalsObj;

                list.sort((a, b) => { return a.slotNo - b.slotNo; });
                dispatch(setCashCollectionGroup(list));
            }
        } else if (type === 'remarks') {
            const remarks = e;
            let list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));
                
                if (idx === index) {
                    if (temp.status === 'completed' && prevDraft) {
                        toast.error('Changing of completed remarks while there are previous draft transactions is not allowed.');
                    // } else if (temp.advanceDays > 0 && (!temp.remarks || temp.remarks == '-') && remarks.value != 'excused advance payment' && temp.loanBalance > 0) {
                    //     toast.error('Error occured. Please set remarks as Excused Advance Payment.');
                    } else {
                        if (temp.status === 'completed' && (remarks?.value && remarks?.value.startsWith('collection-') || (remarks.value?.startsWith('offset') || remarks.value?.startsWith('reloaner')))) {
                            setEditMode(true);
                            setChangeRemarks(true);
                        }

                        let mcbuErrorData = false;
                        
                        if ((temp.status == 'active' || (temp.status == 'completed' && temp.paymentCollection > 0)) && (remarks.value && ['reloaner', 'double payment', 'advance payment'].includes(remarks.value))) {
                            const activeLoan = temp.activeLoan > 0 ? temp.activeLoan : temp.history?.activeLoan;
                            const noPaymentsToday = temp.paymentCollection / activeLoan;
                            const expectedMcbu = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                            
                            if (!temp.mcbuCol) {
                                temp.mcbuError = true;
                                toast.error(`Error occured. No MCBU Collection detected.`);
                                mcbuErrorData = true;
                            } else if (temp.mcbuCol < expectedMcbu) {
                                temp.mcbuError = true;
                                toast.error(`Error occured. MCBU Collection is below the expected amount of ${expectedMcbu}.`);
                                mcbuErrorData = true;
                            } else {
                                temp.mcbuError = false;
                                mcbuErrorData = false;
                            }
                        }
    
                        if (temp.status === "completed" && (remarks.value && !(remarks.value?.startsWith('offset') || remarks.value?.startsWith('reloaner')))) {
                            toast.error("Error occured. Invalid remarks. Should only choose a reloaner/offset remarks.");
                        } else if (temp.status == 'completed' && temp?.advance && remarks.value?.startsWith('offset')) {
                            toast.error(`Error occured. Slot No ${temp.slotNo} has a pending loan release.`);
                        } else if (temp.status === "completed" && (temp.hasMcbuWithdrawal || temp.hasCsfWithdrawal) && (remarks?.value && !remarks.value.startsWith('reloaner'))) {
                            toast.error(`Error occured. Invalid remarks. Slot No ${temp.slotNo} has ${temp.hasMcbuWithdrawal ? 'MCBU' : 'CSF'} withdrawal transaction. Should only choose a reloaner remarks.`);
                        } else if (!temp.maturedPD && remarks.value == 'offset-matured-pd' ) {
                            temp.error = true;
                            toast.error("Invalid remarks. Client was not mark as matured past due.");
                        } else if (temp.loanBalance > 0 && (temp.remarks && temp.remarks?.value != "matured-past due") && (remarks.value && (remarks.value?.startsWith('offset') || remarks.value?.startsWith('reloaner'))) && temp.mcbu < temp.loanBalance) {
                            toast.error("Error occured. Invalid remarks. Should only choose a reloaner/offset remarks.");
                        } else if (temp.hasMcbuWithdrawal &&(remarks.value && remarks.value?.startsWith('offset'))) {
                            toast.error("Error occured. Invalid remarks. Slot No " + temp.slotNo + " has MCBU withdrawal transaction. Should only choose a reloaner remarks.");
                        } else if (!mcbuErrorData) {
                            // always reset these fields
                            temp.error = false;
                            temp.dcmc = false;
                            temp.mpdc = false;
                            if (temp.prevData != null) {
                                temp.targetCollection = temp.prevData.activeLoan;
                                temp.activeLoan = temp.prevData.activeLoan;
                                temp.pastDue = temp.prevData.pastDue;
                                temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
                                temp.advanceDays = temp.prevData.advanceDays;
                            } else {
                                temp.prevData = {
                                    amountRelease: temp.amountRelease,
                                    paymentCollection: temp.paymentCollection,
                                    excess: temp.excess && temp.excess !== '-' ? temp.excess : 0,
                                    loanBalance: temp.loanBalance,
                                    activeLoan: temp.activeLoan,
                                    noOfPayments: temp.noOfPayments,
                                    total: temp.total,
                                    pastDue: temp.pastDue,
                                    mcbu: temp.mcbu,
                                    advanceDays: temp.advanceDays
                                };
                            }
    
                            temp.mcbuReturnAmt = 0;
                            temp.mcbuReturnAmtStr = '-';
                            temp.csfReturnAmt = 0;
                            temp.csfReturnAmtStr = '-';
                            temp.maturedPD = false;
                            temp.maturedPastDue = 0;

                            temp.csfIn = calculateCsfIn(temp, 1);
                            temp.csfInStr = temp.csfIn > 0 ? formatPricePhp(temp.csfIn) : '-';
                            
                            if (!temp?.hasMcbuWithdrawal) {
                                temp.mcbuWithdrawal = 0;
                                temp.mcbuWithdrawalStr = '-';
                            }

                            if (!temp?.hasCsfWithdrawal) {
                                temp.csfWithdrawal = 0;
                                temp.csfWithdrawalStr = '-';
                            }

                            temp.targetCollection = temp.activeLoan;
                            temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                            temp.excused = false;
                            temp.delinquent = false;
    
                            if (remarks.value && remarks.value?.startsWith('offset')) {
                                if (parseFloat(temp.loanBalance) !== 0 && !temp?.maturedPD && temp.mcbu < temp.loanBalance && (temp.remarks && temp.remarks?.value != "matured-past due")) {
                                    toast.error("Please enter the full balance before closing the loan account.");
                                    temp.error = true;
                                } else {
                                    if (temp?.maturedPD && remarks.value !== 'offset-matured-pd') {
                                        temp.error = true;
                                        toast.error("Invalid remarks. Please use For Close/Offset - Matured PD Client remarks.");
                                    } else {
                                        setShowRemarksModal(true);
                                        temp.error = false;
                                        setEditMode(true);
        
                                        if (temp.history && (temp.history?.remarks?.value?.startsWith('offset') || temp.history?.remarks?.value?.startsWith('reloaner'))) {
                                            temp.mcbu = temp.prevData.mcbu;
                                            temp.csf = temp.prevData.csf;
                                        }
                                        
                                        if (temp.mcbu !== temp.prevData.mcbu && temp.mcbuCol && temp.mcbuCol > 0) {
                                            temp.mcbu = temp.mcbu - temp.mcbuCol;
                                        }

                                        if (temp.csf !== temp.prevData.csf && temp.csfCollection && temp.csfCollection > 0) {
                                            temp.csf = temp.csf - temp.csfCollection;
                                        }
        
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                        temp.csfCollection = 0;
                                        temp.csfCollectionStr = '-';
                                        
                                        let history = {...temp.history};
                                        let prevData = {...temp.prevData};
                                        
                                        if (temp?.maturedPD || temp?.maturedPDPrevTransaction) {
                                            temp.paymentCollection = temp.loanBalance;
                                            temp.paymentCollectionStr = formatPricePhp(temp.paymentCollection);
                                            prevData.paymentCollection = temp.loanBalance;
                                            history.paymentCollection = temp.loanBalance;
                                            history.mcbu = temp.mcbu;
                                            temp.maturedPastDue = temp.loanBalance - temp.mcbu;
                                            temp.pastDue = 0;
                                            temp.pastDueStr = '-';
                                            temp.fullPayment = temp.loanRelease;
                                            temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                            temp.noOfPayments = 24;
                                            temp.noOfPaymentStr = `24 / ${temp.loanTerms}`;
                                            temp.noMispayment = 0;
                                            temp.noMispaymentStr = '-';
                                            temp.amountRelease = 0;
                                            temp.amountReleaseStr = '-';
                                            temp.loanBalance = 0;
                                        } else {
                                            temp.pastDue = 0;
                                            temp.pastDueStr = '-';
                                        }
                                        temp.mcbuReturnAmt = parseFloat(temp.mcbu);
                                        temp.csfReturnAmt = temp.csf;
                                        temp.csfReturnAmtStr = formatPricePhp(temp.csf);

                                        // add mcbu and csf values
                                        temp.mcbuReturnAmt += temp.csf;
                                        temp.mcbuReturnAmtStr = formatPricePhp(temp.mcbuReturnAmt);
                                        
                                        temp.mcbu = 0;
                                        temp.mcbuStr = '-';
                                        temp.mcbuError = false;
                                        temp.csf = 0;
                                        temp.csfStr = '-';
                                        temp.csfError = false;

                                        if (temp?.maturedPD && remarks.value == 'offset-matured-pd') {
                                            prevData.loanBalance = temp.loanBalance;
                                            temp.loanBalance = 0;
                                            temp.loanBalanceStr = '-';
                                        }

                                        if (temp.loanBalance === 0 && temp.paymentCollection === 0) {
                                            temp.fullPayment = temp?.history?.amountRelease;
                                        }

                                        temp.history = history;
                                        temp.prevData = prevData;

                                        temp = removeCsfIn(temp);
                                    }
                                }
    
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                                setCloseLoan(temp);
                            } else if (remarks.value === "past due") {
                                temp.pastDue = temp.pastDue !== '-' ? temp.pastDue + temp.activeLoan : temp.activeLoan;
                                temp.pastDueStr = formatPricePhp(temp.pastDue);
                                temp.mispayment = false;
                                temp.error = false;
                                temp.excused = true;
                                temp.mcbuError = false;
    
                                if (temp.mcbuCol && temp.mcbuCol > 0) {
                                    temp.mcbu = temp.mcbu - temp.mcbuCol;
                                    temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                }
    
                                if (safeNumber(temp.csfCollection) > 0) {
                                    temp.csf = temp.csf - temp.csfCollection;
                                    temp.csfStr = temp.csf > 0 ? formatPricePhp(temp.csf) : '-';
                                }
    
                                temp.mcbuCol = 0;
                                temp.mcbuColStr = '-';
                                temp.csfCollection = 0;
                                temp.csfCollectionStr = '-';
                                temp = removeCsfIn(temp);
                            } else if (remarks.value?.startsWith('delinquent') || remarks.value?.startsWith('excused-')) {
                                // add no of mispayments / maximum of payments per cycle // change to #of mispay
                                temp.error = false;
                                temp.mcbuError = false;
    
                                if (temp.mcbuCol && temp.mcbuCol > 0) {
                                    temp.mcbu = temp.mcbu - temp.mcbuCol;
                                    temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                }
                                
                                temp.mcbuCol = 0;
                                temp.mcbuColStr = '-';
    
                                if (remarks.value?.startsWith('delinquent')) {
                                    if (temp.mcbu >= temp.loanBalance) {
                                        toast.error("Invalid remarks. MCBU is greater than the loan balance. Please contact admin for assistance.");
                                        temp.error = true;
                                    } else {
                                        temp.delinquent = true;
                                    }
                                }
    
                                if (remarks.value?.startsWith('excused-')) {
                                    temp.excused = true;
                                }
    
                                if (remarks?.value === "delinquent-offset") {
                                    if (temp.paymentCollection > 0 && temp.paymentCollection == temp.activeLoan) {
                                        // temp.loanBalance -= temp.paymentCollection;
                                        // temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                        // temp.noOfPayments += 1;
                                        // temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
                                        temp = removeCsfIn(temp);
                                    } else {
                                        temp.error = true;
                                        toast.error("Invalid remarks. Delinquent for Offset must be equal to the target collection.");
                                    }
                                }
    
                                if (remarks.value === 'delinquent-mcbu') {
                                    if (temp.mcbu >= temp.loanBalance) {
                                        toast.error("Invalid remarks. MCBU is greater than the loan balance. Please contact admin for assistance.");
                                        temp.error = true;
                                    } else {
                                        temp.dcmc = true;
                                        if (temp.paymentCollection > 0) {
                                            temp.loanBalance += temp.paymentCollection;
                                            temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                        }
                                        temp.mispayment = true;
                                        temp.mispaymentStr = 'Yes';
                                        temp.activeLoan = 0;
                                        temp.targetCollection = 0;
                                        temp.targetCollectionStr = '-';
                                        if (temp.mcbuCol > 0) {
                                            temp.mcbu = temp.mcbu > 0 ? temp.mcbu - temp.mcbuCol : 0;
                                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                                            temp.mcbuCol = 0;
                                            temp.mcbuColStr = '-';
                                            temp.noOfPayments = temp.noOfPayments - 1;
                                            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
                                        }
                                        temp.paymentCollection = 0;
                                        temp.paymentCollectionStr = '-';
                                        toast.warning("Please don't forget to add the collection in MCBU Collection field.");
                                        temp = removeCsfIn(temp);
                                    }
                                } else {
                                    if (remarks.value === 'delinquent-offset') {
                                        temp.mispayment = false;
                                        temp.mispaymentStr = 'No';
                                    } else {
                                        if (temp.paymentCollection > temp.activeLoan) {
                                            temp.error = true;
                                            toast.error("Error occured. Remarks is not valid due to the amount in Actual Collection.");
                                        } else {
                                            if (temp.remarks?.value == 'delinquent') {
                                                if (temp.paymentCollection > 0) {
                                                    temp.loanBalance += temp.paymentCollection;
                                                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                                    temp.noOfPayments = temp.prevData?.noOfPayments;
                                                    temp.noOfPaymentStr = temp.noOfPayments + "/" + temp.loanTerms;
                                                }
                                                temp.paymentCollection = 0;
                                                temp.paymentCollectionStr = '-';
                                            }
                                            temp.targetCollection = 0;
                                            temp.activeLoan = 0;
                                            temp.targetCollectionStr = '-';
                                            temp.mispayment = true;
                                            temp.mispaymentStr = 'Yes';
                                        }
                                    }

                                    if (!temp.error) {
                                        if (temp.mcbuCol && temp.mcbuCol > 0) {
                                            temp.mcbu = temp.mcbu - temp.mcbuCol;
                                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                        }

                                        if (safeNumber(temp.csfCollection) > 0) {
                                            temp.csf = temp.csf - temp.csfCollection;
                                            temp.csfStr = temp.csf > 0 ? formatPricePhp(temp.csf) : '-';
                                        }
        
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                        temp.csfCollection = 0;
                                        temp.csfCollectionStr = '-';
                                        temp = removeCsfIn(temp);
                                    }
                                }
                            } else if (remarks.value === "past due collection") {
                                // if payment > targetCollection, then put subtract it on the past due amount not on excess
                                if (temp.pastDue > 0 && temp.paymentCollection > temp.activeLoan && !temp?.maturedPD && (parseFloat(temp.paymentCollection) > temp.activeLoan && parseFloat(temp.paymentCollection) % parseFloat(temp.activeLoan) === 0)) {
                                    const pastDueCol = temp.paymentCollection - temp.activeLoan;
                                    if (pastDueCol > temp.pastDue) {
                                        const excessPD = pastDueCol - temp.pastDue;
                                        temp.excess = excessPD;
                                        temp.excessStr = formatPricePhp(temp.excess);
                                        temp.pastDue = 0; 
                                        temp.pastDueStr = '-';
                                    } else {
                                        temp.pastDue = temp.pastDue > 0 ? temp.pastDue - pastDueCol : 0;
                                        temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
                                        temp.excess = 0;
                                        temp.excessStr = '-';
                                    }
    
                                    temp.error = false;
                                    temp.mcbuError = false;
                                    temp = removeCsfIn(temp);
                                } else {
                                    temp.error = true;
                                    toast.error("Error occured. Invalid remarks.");
                                }
                            } else if (remarks.value === 'double payment') {
                                if (temp.activeLoan * 2 != temp.paymentCollection || temp.paymentCollection == 0) {
                                    temp.error = true;
                                    toast.error("Invalid remarks. Payment is not double to be considered as double payment.");
                                }
        
                                if (temp.loanBalance <= 0) {
                                    temp.error = true;
                                    toast.error('Invalid remarks. Please mark it as Reloaner or Offset');
                                }

                                temp.csfIn = calculateCsfIn(temp, 2);
                                temp.csfInStr = formatPricePhp(temp.csfIn);
                                if (temp.totalCollection > 0 && temp.csfIn > 0) {
                                    temp.totalCollection = (temp.totalCollection - transactionSettings.minCsfCollection) + temp.csfIn;
                                    temp.totalCollectionStr = formatPricePhp(temp.totalCollection);
                                }
                            } else if (remarks.value === 'advance payment') {
                                if (temp.excess > 0) {
                                    // TODO: Check if collection is divisible by activeLoan
                                    const advanceDays = parseFloat(temp.paymentCollection) / parseFloat(temp.activeLoan);
                                    temp.advanceDays = temp.advanceDays ? temp.advanceDays + (advanceDays - 1) : advanceDays - 1;
                                    temp.error = false;

                                    temp.csfIn = calculateCsfIn(temp, advanceDays);
                                    temp.csfInStr = formatPricePhp(temp.csfIn);
                                    if (temp.totalCollection > 0 && temp.csfIn > 0) {
                                        temp.totalCollection = (temp.totalCollection - transactionSettings.minCsfCollection) + temp.csfIn;
                                        temp.totalCollectionStr = formatPricePhp(temp.totalCollection);
                                    }
                                } else {
                                    temp.error = true;
                                    toast.error("Invalid remarks. There's no excess amount to be considered as advance payment.");
                                }
    
                                if (temp.loanBalance <= 0) {
                                    temp.error = true;
                                    toast.error('Invalid remarks. Please mark it as Reloaner or Offset');
                                }
                            } else if (remarks.value === "excused advance payment") {
                                if (temp.prevData != null) {
                                    temp.targetCollection = temp.prevData.activeLoan;
                                    temp.targetCollectionStr = formatPricePhp(temp.activeLoan);
                                    temp.advanceDays = temp.prevData.advanceDays;
                                } else {
                                    temp.prevData = {
                                        amountRelease: temp.amountRelease,
                                        paymentCollection: temp.paymentCollection,
                                        excess: temp.excess !== '-' ? temp.excess : 0,
                                        loanBalance: temp.loanBalance,
                                        activeLoan: temp.activeLoan,
                                        noOfPayments: temp.noOfPayments,
                                        total: temp.total,
                                        pastDue: temp.pastDue,
                                        advanceDays: temp.advanceDays
                                    };
                                }
    
                                if (temp.advanceDays > 0) {
                                    temp.history = {
                                        ...temp.history,
                                        advanceDays: temp.advanceDays
                                    }
    
                                    if (temp.paymentCollection > 0) {
                                        temp.loanBalance += temp.paymentCollection;
                                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                        temp.paymentCollection = 0;
                                        temp.paymentCollectionStr = '-';
    
                                        if (temp.mcbuCol > 0) {
                                            temp.mcbu -= temp.mcbuCol;
                                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                                            temp.noOfPayments -= 1;
                                            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
                                            temp.mcbuCol = 0;
                                            temp.mcbuColStr = '-';
                                        }
                                    }
                                    temp.disableMcbuCol = true;
                                    temp.disableCsfCol = true;
                                    temp.advanceDays = temp.advanceDays - 1;
                                    temp.targetCollection = 0;
                                    temp.targetCollectionStr = '-';
                                    temp.activeLoan = 0;
                                    temp.paymentCollection = 0;
                                    temp.mispayment = false;
                                    temp.mispaymentStr = 'No';
                                    temp.error = false;
                                    temp.mcbuError = false;
                                    temp.csfError = false;

                                    temp = removeCsfIn(temp);
                                } else {
                                    temp.error = true;
                                    toast.error('Error occured. Yesterday transaction is not an Advanced payment');
                                }
                            } else if (remarks.value.startsWith('collection-')) {
                                temp.error = false;
    
                                const payment = temp.paymentCollection;
                                const loanBalance = temp.mispayment ? temp.history.loanBalance : temp.loanBalance;
                                const overUnder = loanBalance % temp.activeLoan;
    
                                if (overUnder > 0 && payment > 0) {
                                    const paymentOverUnder = payment % temp.activeLoan;
                                    
                                    if (overUnder === paymentOverUnder || overUnder === payment) {
                                        const newPayment = payment - overUnder;
                                        const noOfPayments = newPayment / temp.activeLoan;
                                        
                                        if (parseFloat(newPayment) > parseFloat(temp.activeLoan)) {
                                            temp.excess = parseFloat(newPayment) - parseFloat(temp.activeLoan);
                                            temp.excessStr = formatPricePhp(temp.excess);
                                            temp.noOfPayments = parseInt(temp.noOfPayments) + noOfPayments;
                                            const excessMcbu = temp.excess / temp.activeLoan;
                                            const finalMcbu = (excessMcbu * transactionSettings.minWeeklyMcbuCollection) + transactionSettings.minWeeklyMcbuCollection;
                                            temp.mcbuCol = finalMcbu;
                                            temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                            temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                                        } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                                            temp.excess =  0;
                                            temp.excessStr = '-';
                                            temp.mcbuCol = 0;
                                            temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                                            temp.noOfPayments = parseInt(temp.noOfPayments);
                                        } else {
                                            temp.noOfPayments = parseInt(temp.noOfPayments) + 1;
                                            temp.mcbuCol = transactionSettings.minWeeklyMcbuCollection;
                                            temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                            temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                                        }
    
                                        temp.mispayment = false;
                                        temp.mispaymentStr = "No";
                                        if (overUnder !== payment) {
                                            temp.loanBalance -= payment;
                                            temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                        }
                                        temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
            
                                        temp = setHistory(temp);
            
                                        if (temp.loanBalance <= 0) {
                                            temp.fullPayment = temp.amountRelease;
                                            temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                            temp.loanBalanceStr = 0;
                                            temp.amountRelease = 0;
                                            temp.amountReleaseStr = 0;
                                        }
                                    } else if (overUnder > paymentOverUnder) {
                                        temp.error = true;
                                        toast.error("Invalid remarks. Wrong Overstated/Understated amount added in payment collection.");
                                    } else {
                                        temp.error = true;
                                        toast.error("Invalid remarks. No Overstated/Understated added in payment collection.");
                                    }
                                } else {
                                    temp.error = true;
                                    toast.error("Invalid remarks. No Overstated / Understated in loan balance.");
                                }
                            } else if (remarks.value === 'matured-past due') {
                                if (temp.pastDue && temp.pastDue > 0) {
                                    const today = moment(currentDate);
                                    const endDate = moment(temp.endDate);
        
                                    // if (today.diff(endDate, 'days') > 0) {
                                        const paymentCollection = parseFloat(temp.paymentCollection);
                                        let loanBalance = parseFloat(temp.loanBalance);
        
                                        if (paymentCollection > 0 && temp.prevData.loanBalance != loanBalance) {
                                            loanBalance += paymentCollection;
                                            temp.paymentCollection = 0;
                                            temp.paymentCollectionStr = '-';
                                        }
        
                                        temp.mispayment = false;
                                        temp.mispaymentStr = 'No';
                                        temp.targetCollection = 0;
                                        temp.targetCollectionStr = '-';
                                        temp.activeLoan = 0;
                                        temp.loanBalance = loanBalance;
                                        temp.loanBalanceStr = loanBalance > 0 ? formatPricePhp(loanBalance) : '-';
                                        temp.pastDue = loanBalance;
                                        temp.pastDueStr = formatPricePhp(temp.pastDue);
                                        temp.maturedPD = true;
                                        temp.maturedPastDue = loanBalance;
        
                                        temp.excused = true;
                                        temp.mcbuError = false;
                                        if (temp.mcbuCol && temp.mcbuCol > 0) {
                                            temp.mcbu = temp.mcbu - temp.mcbuCol;
                                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                        }
        
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                        
                                        temp.csfError = false;
                                        if (safeNumber(temp.csfCollection) > 0) {
                                            temp.csf = temp.csf - temp.csfCollection;
                                        }
        
                                        temp.csfCollection = 0;
                                    // } else {
                                    //     temp.error = true;
                                    //     toast.error(`Invalid remarks. Loan is not yet past ${temp.loanTerms} days.`);
                                    // }
                                } else {
                                    temp.error = true;
                                    toast.error('Invalid remarks. No past due balance.');
                                }
                            } else if (remarks.value === 'matured_past_due_collection') {
                                if (temp?.maturedPD) {
                                    temp.mpdc = true;
                                    temp.mispayment = false;
                                    temp.mispaymentStr = 'No';
                                    temp.activeLoan = 0;
                                    temp.targetCollection = 0;
                                    temp.targetCollectionStr = '-';
                                    if (temp.mcbuCol > 0) {
                                        temp.mcbu = temp.mcbu > 0 ? temp.mcbu - temp.mcbuCol : 0;
                                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                    }

                                    if (safeNumber(temp.csfCollection) > 0) {
                                        temp.csf = temp.csf - temp.csfCollection;
                                        temp.csfCollection = 0;
                                    }

                                    temp.paymentCollection = 0;
                                    temp.paymentCollectionStr = '-';
                                } else {
                                    temp.error = true;
                                    toast.error('Invalid remarks. Loan not declared as Matured Past Due.');
                                }
                            } else {
                                if (remarks.value === 'reloaner') {
                                    // Reset mcbu to previous value if there were previous offset/reloaner remarks
                                    if (temp.remarks && (temp?.remarks?.value.startsWith("reloaner") || temp?.remarks?.value?.startsWith('offset'))) {
                                        if (!temp?.hasMcbuWithdrawal && !temp?.hasCsfWithdrawal) {
                                            const prevMcbu = temp?.prevData?.mcbu ? temp.prevData.mcbu : 0;
                                            temp.mcbu = prevMcbu;
                                        }
                                    }

                                    temp.mcbu = temp.mcbu - safeNumber(temp.mcbuCol);

                                    // Calculate mcbuCol based on payment collection and loan status
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = '-';
                                    
                                    // Determine the active loan amount for calculation
                                    const activeLoan = temp.activeLoan > 0 ? temp.activeLoan : (temp?.history?.activeLoan || 0);
                                    if (temp.paymentCollection > 0 && activeLoan > 0) {
                                        // Calculate number of payments made today
                                        const noPaymentsToday = temp.paymentCollection / activeLoan;
                                        // Calculate base MCBU collection
                                        let calculatedMcbuCol = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                                        temp.mcbuCol = calculatedMcbuCol;
                                        temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                    }

                                    if (temp.status === 'completed' && temp.noOfPayments === temp.loanTerms && temp?.prevData?.noOfPayments === temp.loanTerms) {
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                    }

                                    // Add mcbuCol to total MCBU (only if mcbuCol > 0)
                                    if (temp.mcbuCol > 0) {
                                        const currentMcbu = temp.mcbu ? parseFloat(temp.mcbu) : 0;
                                        temp.mcbu = currentMcbu + temp.mcbuCol;
                                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    }

                                    // Update prevData to include the new mcbuCol
                                    if (temp.prevData) {
                                        temp.prevData = {
                                            ...temp.prevData,
                                            mcbuCol: temp.mcbuCol
                                        };
                                    }
                                }

                                temp.closeRemarks = '';
                                setCloseLoan();
                                temp.error = false;
                                temp.mcbuError = false;
                                temp.csfError = false;
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                            }

                            if (!temp.error) {
                                temp.remarks = remarks;
                                temp._dirty = true;
                                
                                // update the mcbuHistory
                                temp.mcbuHistory = {
                                    mcbu: temp.mcbu,
                                    mcbuCol: temp.mcbuCol
                                }
        
                                if (temp.history != null) {
                                    temp.history = {
                                        ...temp.history,
                                        remarks: remarks
                                    }
                                } else {
                                    temp = setHistory(temp);
                                }
                            }
                        }
                    }
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        }
    }

    const setHistory = (selected, prevLoanBalance) => {
        let temp = JSON.parse(JSON.stringify(selected));

        temp.history = {
            amountRelease: temp.amountRelease,
            loanBalance: prevLoanBalance ? prevLoanBalance : temp.loanBalance,
            activeLoan: temp.activeLoan,
            excess: temp.excess,
            collection: temp.paymentCollection,
            loanCycle: temp.loanCycle,
            remarks: temp.remarks,
            advanceDays: temp.advanceDays
        };

        if (temp.remarks.value?.startsWith('offset')) {
            temp.history.loanCycle = temp.loanCycle;
        }

        return temp;
    }

    const calculateCsfIn = (selected, noOfPayments) => {
        return !hasGroupLeader ? transactionSettings.minCsfCollection * noOfPayments : 0;
    }

    const removeCsfIn = (selected) => {
        let temp = JSON.parse(JSON.stringify(selected));
        if (!hasGroupLeader) {
            temp.totalCollection = temp.totalCollection - temp.csfIn;
            temp.totalCollectionStr = formatPricePhp(temp.totalCollection);
            temp.csfIn = 0;
            temp.csfInStr = '-';
        }
        return temp;
    }

    const handlePaymentValidation = (e, selected, index, col) => {
        const value = e.target.value ? parseFloat(e.target.value) : 0;
        let temp = {...selected};
        switch (col) {
            case 'mcbuCol':
                const noPaymentsToday = temp.paymentCollection / temp.activeLoan;
                const minMcbuCol = transactionSettings.minWeeklyMcbuCollection * noPaymentsToday;
                if (!value || (value < minMcbuCol && Number.isInteger(minMcbuCol))) {
                    toast.error(`Error occured. Minimum MCBU collection is ${minMcbuCol}.`);
                    temp.mcbuError = true;
                } else if (value > 5 && value % 5 !== 0) {
                    toast.error('Error occured. MCBU collection must be divisible by 5.');
                    temp.mcbuError = true;
                } else {
                    temp.mcbuError = false;
                }
                break;
            case 'csfCol':
                if (!value || value < transactionSettings.minCsfCollection) {
                    toast.error(`Error occured. Minimum CSF collection is ${transactionSettings.minCsfCollection}.`);
                    temp.csfError = true;
                } else if (value > 5 && value % 5 !== 0) {
                    toast.error('Error occured. CSF collection must be divisible by 5.');
                    temp.csfError = true;
                } else {
                    temp.csfError = false;
                }
                break;
            default: break;
        }

        let tempList = [...data];
        tempList[index] = temp;

        tempList.sort((a, b) => { return a.slotNo - b.slotNo; });
        dispatch(setCashCollectionGroup(tempList));
    };

    const handleNewRevert = async () => {
        setShowWarningDialog(false);
        const selectedRows = data.filter(d => d.selected);
        if (selectedRows.length > 0) {
            setLoading(true);
            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/rollback-transaction', selectedRows);
            if (response.success) {
                setTimeout(() => {
                    setLoading(false);
                    toast.success(`Selected ${selectedRows.length > 1 ? 'rows were' : 'row was'} successfuly reverted! Please wait reloading data.`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }, 1000);
            } else {
                setLoading(false);
                toast.error(response.message || 'Revert failed.');
            }
        } else {
            toast.error('No row(s) selected!');
        }
    }

    const handleReloan = (selected) => {
        if (changeRemarks) {
            toast.error('You have unsaved changes. Please click Submit button before using this function.');
        } else if ((selected.remarks && (selected.remarks.value === "pending" || selected.remarks.value === "reloaner")) || (selected.status === 'completed' && !selected.remarks)) {
            setShowAddDrawer(true);
            setLoan(selected);
        } else {
            toast.error("This client can't reloan because it is not tagged as reloaner or pending in remarks.");
        }
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        // setQueryMain(true);
        getCashCollections();
    }

    const handleSetCloseAccountRemarks = () => {
        const list = data.map(cc => {
            let temp = JSON.parse(JSON.stringify(cc));
            
            if (cc.loanId === closeLoan.loanId) {
                temp.closeRemarks = closeAccountRemarks;
                temp.disableMcbuCol = true;
                temp.disableCsfCol = true;
            }
            
            return temp;
        });

        dispatch(setCashCollectionGroup(list));
        setShowRemarksModal(false);
    }

    const handleExitCloseAccountRemarks = () => {
        const list = data.map(cc => {
            let temp = JSON.parse(JSON.stringify(cc));
            
            if (cc.loanId === closeLoan.loanId) {
                temp.remarks = "";
                temp.closeRemarks = "";
            }
            
            return temp;
        });

        dispatch(setCashCollectionGroup(list));
        setCloseAccountRemarks('');
        setShowRemarksModal(false);
    }

    const handleOffsetUseMCBU = (data, name, checked) => {
        if (checked && data) {
            if (data.mcbuReturnAmt < data.paymentCollection) {
                toast.error('Client has not enough MCBU collected.');
            } else if (data.mcbuReturnAmt == 0 && data.mcbu < data.loanBalance) {
                toast.error('Client MCBU Return Amount is zero.');
            } else if (data.loanBalance <= 0 && data.mcbuReturnAmt == 0) {
                toast.error("Client don't have any loan balance to offset with MCBU.");
            } else if (data.loanBalance > 0) {
                toast.error('Client still has loan balance. Please add collection in Actual Collection field.');
            } else {
                setOffsetUseMCBU(checked);
                setCloseAccountRemarks("Used MCBU to offset loan balance");
            }
        } else {
            setOffsetUseMCBU(checked);
        }
    }

    const handleMcbuWithdrawal = (selected, index) => {
        const isGL = selected.client?.groupLeader || false;
        const minRetain = isGL
            ? (transactionSettings.minWeeklyMcbuWithdrawalGL ?? 3000)
            : (transactionSettings.minWeeklyMcbuWithdrawal  ?? 0);

        if (minRetain > 0 && parseFloat(selected.mcbu) <= minRetain) {
            toast.error(`MCBU Withdrawal not allowed. Client must have more than ₱${minRetain.toLocaleString()} MCBU balance.`);
            return;
        }

        if (parseFloat(selected.mcbu) > 0) {
            const list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));

                if (selected.slotNo === cc.slotNo) {
                    temp.mcbuWithdrawFlag = !temp.mcbuWithdrawFlag;
            
                    if (temp.mcbuWithdrawFlag) {
                        setLoan(selected);
                        setShowMcbuWithdrawalDrawer(true);
                    } else {
                        setAllowMcbuWithdrawal(false);
                    }
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        } else {
            toast.error('Client has no MCBU collected.');
        }
    }

    const handleOffset = (selected, index) => {
        const list = data.map((cc, idx) => {
            let temp = JSON.parse(JSON.stringify(cc));

            if (selected.slotNo === cc.slotNo) {
                temp.offsetTransFlag = !temp.offsetTransFlag;
        
                if (temp.offsetTransFlag) {
                    setAllowOffsetTransaction(true);
                    setRemarksArr(LOR_ONLY_OFFSET_REMARKS);
                } else {
                    setAllowOffsetTransaction(false);
                    setRemarksArr(LOR_WEEKLY_REMARKS);
                }
            }

            return temp;
        });

        dispatch(setCashCollectionGroup(list));
    }

    // const handleMCBUInterest = (selected, index) => {
    //     if (parseFloat(selected.mcbu) > 1000) {
    //         const list = data.map((cc, idx) => {
    //             let temp = JSON.parse(JSON.stringify(cc));

    //             if (selected.slotNo === cc.slotNo) {
    //                 setEditMode(true);
    //                 setAllowMcbuInterest(true);

    //                 temp.mcbuInterestFlag = true;
    //             }

    //             return temp;
    //         });

    //         dispatch(setCashCollectionGroup(list));
    //     } else {
    //         toast.error('Client has not reached the minimum of 1000 MCBU to accumulate interest.');
    //     }
    // }

    const handleMCBUInterest = async (selected, index) => {
        // Validate minimum MCBU requirement
        if (parseFloat(selected.mcbu) <= 500) {
            toast.error('Client has not reached the minimum of 500 MCBU to accumulate interest.');
            return;
        }

        if (selected.hasMcbuInterest) {
            toast.info('MCBU Interest has already been applied for this client.');
            return;
        }

        try {
            setMcbuInterestLoading(true);
            
            // Call the API to calculate MCBU interest
            const result = await mcbuInterestService.calculateInterest(selected.clientId, transactionSettings.mcbuInterestRate);
            
            const calculatedInterest = result.success ? (result.mcbuInterest || 0) : 0;
            const lackingAmount = result.success ? (result.mcbuInterestLacking || 0) : 0;

            // Store breakdown data for modal (even if interest is 0)
            if (result.success) {
                setMcbuBreakdownData({
                    breakdown: result.monthlyBreakdown || [],
                    totalInterest: calculatedInterest,
                    year: result.year,
                    clientName: selected.fullName || '',
                    offsetDate: result.offsetDate || null
                });
            }

            // Update the data - show the field for editing with pre-populated value
            const list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));

                if (selected.slotNo === cc.slotNo) {
                    temp.mcbuInterestFlag = true;
                    
                    // Only set the calculated value if it's greater than 0
                    // Otherwise, keep existing value or set to 0 for manual entry
                    if (calculatedInterest > 0) {
                        temp.mcbuInterest = calculatedInterest;
                        temp.mcbuInterestStr = formatPricePhp(calculatedInterest);

                        const currentMcbu = parseFloat(temp.mcbu) || 0;
                        temp.mcbu = currentMcbu + calculatedInterest;
                        
                        // Add lacking amount to mcbuCol to round up to nearest 10
                        // e.g., if mcbuInterest = 34, lacking = 6, so mcbuCol += 6 to make total 40
                        if (lackingAmount > 0) {
                            const currentMcbuCol = parseFloat(temp.mcbuCol) || 0;
                            temp.mcbuCol = currentMcbuCol + lackingAmount;
                            temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                            
                            // Also update mcbu total
                            temp.mcbu = temp.mcbu + lackingAmount;
                        }

                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                    } else if (!temp.mcbuInterest) {
                        temp.mcbuInterest = 0;
                        temp.mcbuInterestStr = '-';
                    }
                    
                    // Store the breakdown and lacking for reference
                    temp.mcbuInterestBreakdown = result.monthlyBreakdown || [];
                    temp.mcbuInterestYear = result.year;
                    temp.mcbuInterestLacking = lackingAmount;
                    temp.mcbuInterestOffsetDate = result.offsetDate || null;
                    temp._dirty = true;
                }

                return temp;
            });

            // Update totals
            const totalsIdx = list.findIndex(item => item.status === 'totals');
            if (totalsIdx !== -1) {
                const totalsObj = calculateTotals(list);
                list[totalsIdx] = totalsObj;
            }

            list.sort((a, b) => a.slotNo - b.slotNo);
            dispatch(setCashCollectionGroup(list));

            setEditMode(true);
            setAllowMcbuInterest(true);

            if (calculatedInterest > 0) {
                let successMsg = `MCBU Interest: ${formatPricePhp(calculatedInterest)} (${result.totalMonths} month${result.totalMonths > 1 ? 's' : ''})`;
                if (lackingAmount > 0) {
                    successMsg += ` | Added ${formatPricePhp(lackingAmount)} to MCBU Collection`;
                }
                if (result.offsetDate) {
                    successMsg += ` | Calculated from after offset on ${result.offsetDate}`;
                }
                toast.success(successMsg);
            } else {
                toast.info('No MCBU Interest calculated. You can enter a value manually.');
            }

        } catch (error) {
            console.error('Error calculating MCBU Interest:', error);
            
            // Even if the API fails, still show the input field for manual entry
            const list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));

                if (selected.slotNo === cc.slotNo) {
                    temp.mcbuInterestFlag = true;
                    if (!temp.mcbuInterest) {
                        temp.mcbuInterest = 0;
                    }
                    temp._dirty = true;
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
            setEditMode(true);
            setAllowMcbuInterest(true);
            
            toast.warning('Could not auto-calculate MCBU Interest. Please enter manually.');
        } finally {
            setMcbuInterestLoading(false);
        }
    };

    const handleMarkLate = (selected) => {
        if (selected?.status == 'active') {
            const list = data.map((cc, idx) => {
                let temp = JSON.parse(JSON.stringify(cc));

                if (selected.slotNo === cc.slotNo) {
                    temp.latePayment = !temp.latePayment;
                    temp._dirty = true;
                    setEditMode(true);
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        } else {
            toast.error('Loan should be active.')
        }
    }

    const handleMarkDelinquent = (selected) => {
        if (selected?.status == 'active') {
            const list = data.map((cc, idx) => {
                let temp = {...cc};

                if (selected.slotNo === cc.slotNo) {
                    temp.delinquent = !temp.delinquent;
                    temp._dirty = true;
                    setEditMode(true);
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        } else {
            toast.error('Loan should be active.')
        }
    }

    const addBlankAndTotal = (isFiltering, dataArr) => {
        let cashCollection = JSON.parse(JSON.stringify(dataArr));
        const groupCapacity = currentGroup && currentGroup.capacity;
        const totalIdx = cashCollection.findIndex(cc => cc.status === 'totals');

        if (isFiltering) {
            for (let i = 1; i <= groupCapacity; i++) {
                const existData = cashCollection.find(cc => cc.slotNo === i && cc.status !== 'open');

                if (!existData) {
                    cashCollection.push({
                        slotNo: i,
                        fullName: '-',
                        loanCycle: '-',
                        amountReleaseStr: '-',
                        mispayment: false,
                        mispaymentStr: '-',
                        loanBalanceStr: '-',
                        mcbuStr: '-',
                        mcbuColStr: '-',
                        mcbuWithdrawalStr: '-',
                        mcbuReturnAmtStr: '-',
                        currentReleaseAmountStr: '-',
                        noOfPayments: '-',
                        targetCollectionStr: '-',
                        excessStr: '-',
                        paymentCollectionStr: '-',
                        remarks: '-',
                        fullPaymentStr: '-',
                        clientStatus: '-',
                        csfStr: '-',
                        csfCollectionStr: '-',
                        csfWithdrawalStr: '-',
                        csfReturnAmtStr: '-',
                        status: 'open',
                    });
                } else if (!existData.group) {
                    const index = cashCollection.indexOf(existData);
                    cashCollection[index] = {
                        ...existData,
                        group: currentGroup
                    }
                }
            }
            cashCollection.sort((a, b) => { return a.slotNo - b.slotNo; });

            if (totalIdx > -1) {
                cashCollection[totalIdx] = calculateTotals(cashCollection);
            } else {
                cashCollection.push(calculateTotals(cashCollection));
            }

            // setTimeout(() => {
            //     dispatch(setCashCollectionGroup(cashCollection));
            //     setLoading(false);
            // }, 500);
            return cashCollection;
        } else {
            for (let i = 1; i <= groupCapacity; i++) {
                const existData = cashCollection.find(cc => cc.slotNo === i);
                if (!existData) {
                    cashCollection.push({
                        slotNo: i,
                        fullName: '-',
                        loanCycle: '-',
                        amountReleaseStr: '-',
                        mispayment: false,
                        mispaymentStr: '-',
                        loanBalanceStr: '-',
                        currentReleaseAmountStr: '-',
                        noOfPayments: '-',
                        mcbuStr: '-',
                        mcbuColStr: '-',
                        mcbuWithdrawalStr: '-',
                        mcbuReturnAmtStr: '-',
                        targetCollectionStr: '-',
                        excessStr: '-',
                        paymentCollectionStr: '-',
                        remarks: '-',
                        fullPaymentStr: '-',
                        clientStatus: '-',
                        status: 'open'
                    });
                } else if (!existData.group) {
                    const index = cashCollection.indexOf(existData);
                    cashCollection[index] = {
                        ...existData,
                        group: currentGroup
                    }
                }
            }

            cashCollection.sort((a, b) => { return a.slotNo - b.slotNo; });

            if (totalIdx > -1) {
                cashCollection[totalIdx] = calculateTotals(cashCollection);
            } else {
                cashCollection.push(calculateTotals(cashCollection));
            }
            // setTimeout(() => {
            //     dispatch(setCashCollectionGroup(cashCollection));
            //     setLoading(false);
            // }, 500);
            return cashCollection;
        }
    }

    const handleSelectAll = () => {
        setSelectAll(!selectAll);
        const dataList = data.map(cc => {
            let temp = {...cc};
            if (temp.clientId && (temp?.transferStr == null || temp?.transferStr == '-')) {
                temp.selected = !selectAll;
            }
            return temp;
        });

        setData(dataList);
        dispatch(setCashCollectionGroup(dataList));
    }

    const handleSelectRow = (index) => {
        const dataList = data.map((cc, idx) => {
            let temp = {...cc};

            if (idx == index) {
                temp.selected = !temp.selected;
            }

            return temp;
        });

        setData(dataList);
        dispatch(setCashCollectionGroup(dataList));
    }

    useEffect(() => {
        let mounted = true;

        const getListBranch = async () => {
            let url = getApiBaseUrl() + 'branches/list';

            if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
                url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
            }
            
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];
                response.branches && response.branches.map(branch => {
                    branches.push(
                        {
                            ...branch
                        }
                    );
                });

                if (currentUser.role.rep < 3 && (selectedBranchSubject.value || router?.query?.sourceParentId)) {
                    const currentBranchId = selectedBranchSubject.value ? selectedBranchSubject.value : router?.query?.sourceParentId;
                    branches = [branches.find(b => b._id === currentBranchId)];
                    if (branches.length > 0) {
                        dispatch(setBranch(branches[0]));
                    }
                } else if (currentUser.role.rep >= 3 && branches.length > 0) {
                    dispatch(setBranch(branches[0]));
                }
                
                dispatch(setBranchList(branches));
            } else {
                toast.error('Error retrieving branches list.');
            }
    
        }

        const getCurrentGroup = async () => {
            if (uuid) {
                const apiUrl = `${getApiBaseUrl()}groups?`;
                const params = { _id: uuid };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    dispatch(setGroup(response.group));
                    setCurrentGroup(response.group);
                    setGroupFilter(uuid);
                } else {
                    toast.error('Error while loading data');
                }
            }
        }

        mounted && uuid && getCurrentGroup();
        mounted && currentDate && getCashCollections();
        mounted && getListBranch();

        if (dateFilter === null) {
            setDateFilter(currentDate);
        }

        return () => {
            mounted = false;
        };
    }, [currentDate, transactionSettings, router]);

    useEffect(() => {
        const getListGroup = async (selectedLO) => {
            let url = getApiBaseUrl() + 'groups/list-by-group-occurence?' + new URLSearchParams({ mode: "filter", branchId: branchList[0]?._id, occurence: 'weekly', loId: selectedLO });

            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groups = [];
                await response.groups && response.groups.map(group => {
                    groups.push({
                        ...group,
                        day: UppercaseFirstLetter(group.day),
                        value: group._id,
                        label: group.name
                    });
                });
                dispatch(setGroupList(groups));
            } else if (response.error) {
                toast.error(response.message);
            }
            setLoading(false);
        }

        if (branchList.length > 0 && (selectedLOSubject.value && selectedLOSubject.value.length > 0)) {
            getListGroup(selectedLOSubject.value);
        } else if (branchList.length > 0 && currentUser.role.rep === 4) {
            getListGroup(currentUser._id);
        }
    }, [branchList.length]);

    useEffect(() => {
        let cashCollections = [];
        const dateF = moment(dateFilter).format("YYYY-MM-DD");

        if (dateF !== currentDate) {
            cashCollections = addBlankAndTotal(true, JSON.parse(JSON.stringify(groupClients)));
        } else {
            cashCollections = addBlankAndTotal(false, JSON.parse(JSON.stringify(groupClients)));
        }

        setData(cashCollections);
        setAllData(cashCollections);
    }, [groupClients, dateFilter]);

    useEffect(() => {
        if (dateFilterSubject.value && currentGroup) {
            const date = moment(new Date(dateFilterSubject.value)).format('YYYY-MM-DD');
            if (date !== currentDate) {
                getCashCollections(date);
                setDateFilter(date);
            }
        }
    }, [currentGroup]);

    const [dropDownActions, setDropDownActions] = useState();

    useEffect(() => {
        setDropDownActions(
            [
                {
                    label: 'Mark as Late',
                    action: handleMarkLate,
                    icon: <ClockIcon className="w-5 h-5" title="Mark as Late" />,
                    hidden: true
                },
                // {
                //     label: 'Mark as Delinquent',
                //     action: handleMarkDelinquent,
                //     icon: <ExclamationTriangleIcon className="w-5 h-5" title="Mark as Delinquent" />,
                //     hidden: true
                // },
                // {
                //     label: 'Reloan',
                //     action: handleReloan,
                //     icon: <ArrowPathIcon className="w-5 h-5" title="Reloan" />,
                //     hidden: true
                // },
                {
                    label: 'MCBU Withdrawal',
                    action: handleMcbuWithdrawal,
                    icon: <CurrencyDollarIcon className="w-5 h-5" title="MCBU Withdrawal" />,
                    hidden: true
                },
                {
                    label: 'Offset',
                    action: handleOffset,
                    icon: <StopCircleIcon className="w-5 h-5" title="Offset" />,
                    hidden: true
                },
                {
                    label: mcbuInterestLoading ? 'Calculating...' : 'Calculate MCBU Interest',
                    action: (selected, index) => {
                        setSelectedSlot(selected); // Track which row is loading
                        handleMCBUInterest(selected, index);
                    },
                    icon: mcbuInterestLoading ? (
                        <svg className="animate-spin w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    ) : (
                        <ReceiptPercentIcon className="w-5 h-5" title="Calculate MCBU Interest" />
                    ),
                    hidden: true,
                    disabled: mcbuInterestLoading
                },
            ]
        );
    }, [data]);

    return (
        <Layout header={false} noPad={true} hScroll={false}>
            {(isV2TransactionApiEnabled && pageStale) && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4" role="alert">
                    <div className="flex items-center">
                        <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" 
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                            <p className="font-bold">Page Outdated</p>
                            <p className="text-sm">The date has changed. Please refresh the page before submitting.</p>
                        </div>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="ml-auto bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded"
                        >
                            Refresh Now
                        </button>
                    </div>
                </div>
            )}
            {loading ? (
                <Spinner />
            ) : (
                <div className="overflow-x-auto">
                    {/* {console.log("Edit mode: ", editMode)} */}
                    {data && <DetailsHeader page={'transaction'} showSaveButton={currentUser.role.rep > 2 ? (isWeekend || isHoliday || (currentBranch.lockTransaction && !isStaging)) ? false : editMode : false}  hasDraft={hasDraft}
                        handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} allowMcbuWithdrawal={allowMcbuWithdrawal} allowOffsetTransaction={allowOffsetTransaction}
                        dateFilter={dateFilter} setDateFilter={setDateFilter} handleDateFilter={handleDateFilter} currentGroup={uuid} revertMode={revertMode}
                        groupFilter={groupFilter} handleGroupFilter={handleGroupFilter} groupTransactionStatus={groupSummaryIsClose ? 'close' : 'open'} 
                        changeRemarks={changeRemarks} allowMcbuInterest={allowMcbuInterest} handleShowWarningDialog={handleShowWarningDialog} loading={loading} branchLock={currentBranch.lockTransaction && !isStaging} 
                        exportComponent={
                                            <CashCollectionDetailsExcelExport
                                                data={groupClients}
                                                groupInfo={currentGroup}
                                                dateFilter={dateFilter}
                                                occurence="weekly"
                                                currentUser={currentUser}
                                            />
                                        }
                        />}
                    <div className="px-4 mt-[12rem] mb-[4rem] overflow-y-auto min-h-[55rem]">
                        <div className="bg-white flex flex-col rounded-md pt-0 pb-2 px-6 overflow-auto min-h-[46rem]">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="sticky top-0 column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider bg-white z-20">
                                        {(currentUser.role.rep == 3 || data.some(cc => (cc.bmRevertCount || 0) >= 1)) && (
                                            <th className="p-2 text-center">
                                                <CheckBox size={"md"} value={selectAll} onChange={handleSelectAll} />
                                            </th>
                                        )}
                                        <th className="p-2 text-center">Slot #</th>
                                        <th className="p-2 text-center">Client Name</th>
                                        <th className="p-2 text-center">Advance Credit</th>
                                        <th className="p-2 text-center">Co-Maker</th>
                                        <th className="p-2 text-center">Cycle #</th>
                                        <th className="p-2 text-center">MCBU</th>
                                        <th className="p-2 text-center">CSF</th>
                                        <th className="p-2 text-center">Total Loan Release w/ SC</th>
                                        <th className="p-2 text-center">Total Loan Balance</th>
                                        <th className="p-2 text-center">Current Releases</th>
                                        <th className="p-2 text-center"># of Payments</th>
                                        <th className="p-2 text-center">MCBU Collection</th>
                                        <th className="p-2 text-center">CSF Collection</th>
                                        <th className="p-2 text-center">Target Collection</th>
                                        <th className="p-2 text-center">Excess</th>
                                        <th className="p-2 text-center">Actual Collection</th>
                                        <th className="p-2 text-center">Admission Fee</th>
                                        <th className="p-2 text-center">LRF</th>
                                        <th className="p-2 text-center">C.B.H.B Collection</th>
                                        <th className="p-2 text-center">Add. Hosp.</th>
                                        {!hasGroupLeader && <th className="p-2 text-center">CSF In</th> }
                                        <th className="p-2 text-center">Other Income Passbook/Picture</th>
                                        <th className="p-2 text-center">MCBU Withdrawal</th>
                                        <th className="p-2 text-center">CSF Withdrawal</th>
                                        {dateFilterMonth === 11 && (<th className="p-2 text-center">MCBU Interest</th>)}
                                        <th className="p-2 text-center">MCBU/CSF Return Amt</th>
                                        <th className="p-2 text-center">Full Payment</th>
                                        <th className="p-2 text-center">Total Net Collection</th>
                                        <th className="p-2 text-center">Mispay</th>
                                        <th className="p-2 text-center"># of Mispay</th>
                                        <th className="p-2 text-center">Past Due</th>
                                        <th className="p-2 text-center">Remarks</th>
                                        <th className="p-2 text-center">TOC</th>
                                        <th className="p-2 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data && data.map((cc, index) => {
                                        let rowBg = 'even:bg-gray-100';
                                        if (cc.status === 'pending') {
                                            rowBg = 'bg-yellow-100';
                                        } else if (cc.status === 'completed') {
                                            rowBg = 'bg-green-100';
                                        } else if (cc.status === 'tomorrow') {
                                            rowBg = 'bg-lime-100';
                                        } else if (cc.status === "closed") {
                                            rowBg = 'bg-zinc-200';
                                        } else if (cc.excused || cc.delinquent) {
                                            rowBg = 'bg-orange-100';
                                        } else if (cc.latePayment) {
                                            rowBg = 'bg-pink-100';
                                        }

                                        if (cc?.transferred) {
                                            rowBg = 'bg-violet-100';
                                        } else if (cc.transferStr === 'TCR') {
                                            rowBg = 'bg-blue-100';
                                        }

                                        if (cc.error || cc.mcbuError || cc?.csfError) {
                                            rowBg = 'bg-red-100';
                                        }

                                        const isHighlighted = highlightedSlotNo === cc.slotNo;
                                        const highlightClass = isHighlighted ? 'highlighted-comaker' : '';

                                        const allowCSFCollection = cc.groupLeader && 
                                            ((cc.mcbu >= transactionSettings.minWeeklyMcbuWithdrawalGL && cc.loanCycle == 1) 
                                                || (cc.mcbu >= 2000 && cc.loanCycle > 1));
                                        
                                        return (
                                            <tr key={index} className={`w-full hover:bg-slate-200 border-b border-b-gray-300 font-proxima 
                                                                ${rowBg} ${highlightClass}
                                                                ${rowBg} ${cc.status === 'totals' ? 'font-bold font-proxima-bold text-red-400' : 'text-gray-600'}`} >
                                                {(currentUser.role.rep == 3 || data.some(r => (r.bmRevertCount || 0) >= 1)) && (
                                                    <th className="p-2 text-center">
                                                        {cc.status !== 'totals' && cc.clientId && (cc?.transferStr == null || cc?.transferStr == '-') && (
                                                            currentUser.role.rep == 3 ? (
                                                                // BM: checkbox if not yet reverted, lock icon if used up
                                                                (cc.bmRevertCount || 0) >= 1 ? (
                                                                    <div className="flex items-center justify-center">
                                                                        <span
                                                                            title="BM revert already used. Only a higher-level manager can revert this."
                                                                            className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 border border-amber-400 cursor-not-allowed"
                                                                        >
                                                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
                                                                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                                            </svg>
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <CheckBox size={"md"} value={cc.selected} onChange={() => handleSelectRow(index)} />
                                                                )
                                                            ) : (
                                                                // rep < 3: checkbox ONLY on rows the BM already reverted
                                                                (cc.bmRevertCount || 0) >= 1 ? (
                                                                    <CheckBox size={"md"} value={cc.selected} onChange={() => handleSelectRow(index)} />
                                                                ) : null
                                                            )
                                                        )}
                                                    </th>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                    { cc.status !== 'totals' ? cc.slotNo : '' }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer" onClick={() => handleShowClientInfoModal(cc)}>{ cc.fullName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.advanceDays }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom text-center">
                                                    {isCoMakerSlotValid(cc.coMaker, data) ? (
                                                        <button
                                                            onClick={() => handleHighlightCoMaker(cc.coMaker)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors duration-150"
                                                            title={`Click to highlight Slot #${displayCoMaker(cc.coMaker)}`}
                                                        >
                                                            <svg 
                                                                className="w-4 h-4" 
                                                                fill="none" 
                                                                stroke="currentColor" 
                                                                viewBox="0 0 24 24"
                                                            >
                                                                <path 
                                                                    strokeLinecap="round" 
                                                                    strokeLinejoin="round" 
                                                                    strokeWidth={2} 
                                                                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" 
                                                                />
                                                                <path 
                                                                    strokeLinecap="round" 
                                                                    strokeLinejoin="round" 
                                                                    strokeWidth={2} 
                                                                    d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" 
                                                                />
                                                            </svg>
                                                            {displayCoMaker(cc.coMaker)}
                                                        </button>
                                                    ) : isValidCoMaker(cc.coMaker) ? (
                                                        <span className="text-gray-500">{displayCoMaker(cc.coMaker)}</span>
                                                    ) : (
                                                        <span className="text-gray-400">-</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.loanCycle }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mcbuStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.csfStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <span>{ cc.currentReleaseAmountStr }</span>
                                                        {canEditCurrentRelease(cc, currentUser) && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditCurrentRelease(cc);
                                                                }}
                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                                title="Edit Current Release (Regional Manager)"
                                                            >
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noOfPaymentStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    {/* { cc.mcbuColStr } */}
                                                    { (!isWeekend && !isHoliday && (!currentBranch.lockTransaction || isStaging) && currentUser.role.rep > 2 && cc.status === 'active' && editMode 
                                                            && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || cc.reverted || cc.draft) 
                                                            || (cc.offsetTransFlag && cc.otherDay)
                                                      ) ? (
                                                        <React.Fragment>
                                                           <input type="number" name={`${cc.clientId}-mcbuCol`} min={0} step={5} 
                                                                onChange={(e) => handlePaymentCollectionChange(e, index, 'mcbuCol')} 
                                                                disabled={cc.disableMcbuCol}
                                                                onClick={(e) => e.stopPropagation()} 
                                                                onBlur={(e) => handlePaymentValidation(e, cc, index, 'mcbuCol')} 
                                                                value={cc.mcbuCol ?? ''} 
                                                                tabIndex={index + 1} onWheel={(e) => e.target.blur()}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" 
                                                                style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !cc.reverted || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.mcbuColStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                 <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && (!currentBranch.lockTransaction || isStaging) && currentUser.role.rep > 2 && cc.status === 'active' && editMode && allowCSFCollection
                                                            && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || cc.reverted || cc.draft) 
                                                            || (cc.offsetTransFlag && cc.otherDay)
                                                      ) ? (
                                                            <React.Fragment>
                                                                <input type="number" name={`${cc.clientId}-csfCol`} min={0} step={5} 
                                                                    onChange={(e) => handlePaymentCollectionChange(e, index, 'csfCol')} 
                                                                    disabled={cc.disableCsfCol}
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    onBlur={(e) => handlePaymentValidation(e, cc, index, 'csfCol')} 
                                                                    value={cc.csfCollection ?? ''} 
                                                                    tabIndex={index + 1} onWheel={(e) => e.target.blur()}
                                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                                focus:ring-main focus:border-main block p-2.5" 
                                                                    style={{ width: '100px' }}/>
                                                            </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {((!editMode || filter || !cc.reverted || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed')) && cc.csfCollectionStr}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && (!currentBranch.lockTransaction || isStaging) && currentUser.role.rep > 2 && cc.status === 'active' 
                                                        && editMode && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || cc?.reverted || cc.draft)
                                                        || (cc.offsetTransFlag && cc.otherDay) && !cc?.dcmc && !cc?.mpdc && !cc?.maturedPD && (cc?.transferStr == null || cc?.transferStr == '-')) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'amount')}
                                                                onClick={(e) => e.stopPropagation()} value={cc.paymentCollection} tabIndex={index + 2} onWheel={(e) => e.target.blur()}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !cc.reverted || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.paymentCollectionStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.admissionCollection > 0 ? formatPricePhp(cc.admissionCollection) : '-' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.lrfCollection > 0 ? formatPricePhp(cc.lrfCollection) : '-' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.cbhbCollection > 0 ? formatPricePhp(cc.cbhbCollection) : '-' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.addHospitalization > 0 ? formatPricePhp(cc.addHospitalization) : '-' }</td>
                                                { !hasGroupLeader && <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.csfInStr }</td> }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.otherIncomeStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center`}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        { (cc.hasMcbuWithdrawal && cc.mcbuWithdrawalIsPending) ? (
                                                            <WarningIconWithTooltip amount={cc.mcbuWithdrawalStr} message="MCBU Withdrawal is pending." />
                                                        ) : cc.mcbuWithdrawalStr}
                                                        {canEditWithdrawal(cc, currentUser, 'mcbu') && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditWithdrawal(cc, 'mcbu');
                                                                }}
                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                                title="Edit MCBU Withdrawal (Regional Manager)"
                                                            >
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center`}>
                                                    <div className="flex items-center justify-center gap-1">
                                                        { (cc.hasCsfWithdrawal && cc.csfWithdrawalIsPending) ? (
                                                            <WarningIconWithTooltip amount={cc.csfWithdrawalStr} message="CSF Withdrawal is pending." />
                                                        ) : cc.csfWithdrawalStr}
                                                        {canEditWithdrawal(cc, currentUser, 'csf') && (
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditWithdrawal(cc, 'csf');
                                                                }}
                                                                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                                                                title="Edit CSF Withdrawal (Regional Manager)"
                                                            >
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                {dateFilterMonth === 11 && (
                                                    <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">
                                                        {mcbuInterestLoading && cc.slotNo === selectedSlot?.slotNo ? (
                                                            <div className="flex items-center justify-end">
                                                                <svg className="animate-spin h-5 w-5 text-main" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                </svg>
                                                                <span className="ml-2 text-sm text-gray-500">Calculating...</span>
                                                            </div>
                                                        ) : cc.mcbuInterestFlag ? (
                                                            <div className="flex items-center justify-end gap-2">
                                                                <input 
                                                                    type="number" 
                                                                    name={`${cc.clientId}-mcbuInterest`} 
                                                                    min={0} 
                                                                    step={10} 
                                                                    onChange={(e) => handlePaymentCollectionChange(e, index, 'mcbuInterest')}
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    value={cc.mcbuInterest ? cc.mcbuInterest : 0} 
                                                                    tabIndex={index + 1} 
                                                                    onWheel={(e) => e.target.blur()}
                                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                                focus:ring-main focus:border-main block p-2.5" 
                                                                    style={{ width: '100px' }}
                                                                    disabled={true}
                                                                />
                                                                {cc.mcbuInterestBreakdown && cc.mcbuInterestBreakdown.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleShowMcbuBreakdown(cc);
                                                                        }}
                                                                        className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded"
                                                                        title="View Breakdown"
                                                                    >
                                                                        <Info className="w-5 h-5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <React.Fragment>{cc.mcbuInterestStr}</React.Fragment>
                                                        )}
                                                    </td>
                                                )}
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuReturnAmtStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.totalCollection > 0 ? formatPricePhp(cc.totalCollection) : '-' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noMispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.pastDueStr }</td>
                                                { ( !isWeekend && !isHoliday && (!currentBranch.lockTransaction || isStaging) && !filter && currentUser.role.rep > 2 && (cc.status === 'active' || cc.status === 'completed') && !groupSummaryIsClose
                                                    && (cc.draft || editMode
                                                        || ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || cc?.reverted) 
                                                        || (cc.status !== "tomorrow" && cc.status == 'completed' && cc.remarks && (cc.remarks.value.startsWith('reloaner')))
                                                        || (cc.remarks && (cc.remarks.value?.startsWith('collection-') || cc.remarks.value?.startsWith('offset-')))
                                                        || (cc.status == 'completed' && cc.remarks == '')
                                                        || (cc.offsetTransFlag && cc.otherDay)  
                                                       )
                                                    && (cc?.transferStr == null || cc?.transferStr == '-')
                                                  ) ? (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                            { cc.remarks !== '-' ? (
                                                                <Select 
                                                                    options={remarksArr}
                                                                    value={cc.remarks}
                                                                    styles={borderStyles}
                                                                    components={{ DropdownIndicator }}
                                                                    onChange={(val) => handlePaymentCollectionChange(val, index, 'remarks') }
                                                                    isSearchable={false}
                                                                    closeMenuOnSelect={true}
                                                                    tabIndex={-1}
                                                                    placeholder={'Remarks'}/>
                                                            ) : ('-') }
                                                        </td>
                                                    ) : (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                            { cc.status !== 'closed' ? (
                                                                <React.Fragment>
                                                                    { cc.remarks ? cc.remarks.label === 'Remarks' ? 'No Remarks' : cc.remarks.label : '-'}
                                                                </React.Fragment>
                                                            ) : (
                                                                <React.Fragment>
                                                                    { cc.remarks?.label ? cc.remarks.label : '-' }
                                                                </React.Fragment>
                                                            ) }
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.transferStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <React.Fragment>
                                                        {(!isWeekend && !isHoliday && (!currentBranch.lockTransaction || isStaging) && currentUser.role.rep > 2 && !groupSummaryIsClose) && (
                                                            <div className='flex flex-row p-2'>
                                                                {(data && data.length > 0) && <ActionDropDown origin="cash-collection" data={cc} index={index} options={dropDownActions} dataOptions={{ filter: filter, prevDraft: prevDraft, editMode: editMode, currentDate: currentDate, currentMonth: currentMonth, last5DaysOfTheMonth: last5DaysOfTheMonth, mcbuInterestLoading: mcbuInterestLoading }} />}
                                                            </div>
                                                        )}
                                                    </React.Fragment>
                                                </td>
                                            </tr>    
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {(loan && showAddDrawer) && <AddUpdateLoan mode={'reloan'} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />}
                    {(loan && showMcbuWithdrawalDrawer) && <AddUpdateMcbuWithdrawalDrawer origin={'collection'} mode={'add'} loan={loan} showSidebar={showMcbuWithdrawalDrawer} setShowSidebar={setShowMcbuWithdrawalDrawer} onClose={handleCloseMcbuWithdrawalDrawer} />}
                    <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="70rem">
                        <ClientDetailPage />
                    </Modal>
                    <Dialog show={showRemarksModal}>
                        <h2>Close Account Remarks</h2>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        {closeLoan && closeLoan.remarks && closeLoan.remarks.value !== 'offset-unclaimed' && (
                                            <CheckBox size={"md"} name="used-mcbu" value={offsetUseMCBU} label="Use MCBU as Payment" onChange={(name, value) => handleOffsetUseMCBU(closeLoan, name, value)} />
                                        )}
                                        <textarea rows="4" value={closeAccountRemarks} onChange={(e) => setCloseAccountRemarks(e.target.value)}
                                            className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                        border-gray-300 focus:ring-blue-500 focus:border-main mt-2" 
                                            placeholder="Enter remarks..."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                            <div className='flex flex-row'>
                                <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={handleExitCloseAccountRemarks} />
                                <ButtonSolid label="Submit" type="button" className="p-2 mr-3" onClick={handleSetCloseAccountRemarks} />
                            </div>
                        </div>
                    </Dialog>
                    <Dialog show={showWaningDialog}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        <p className="text-2xl font-normal text-dark-color">Are you sure you want to revert the selected today's transaction(s)?</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowWarningDialog(false)} />
                            <ButtonSolid label="Yes, revert" type="button" className="p-2" onClick={handleNewRevert} />
                        </div>
                    </Dialog>
                    <McbuInterestBreakdownModal
                        show={showMcbuBreakdownModal}
                        onClose={() => setShowMcbuBreakdownModal(false)}
                        breakdown={mcbuBreakdownData.breakdown}
                        totalInterest={mcbuBreakdownData.totalInterest}
                        year={mcbuBreakdownData.year}
                        clientName={mcbuBreakdownData.clientName}
                        offsetDate={mcbuBreakdownData.offsetDate}
                        lackingAmount={mcbuBreakdownData.lackingAmount}
                        mcbuInterestRate={transactionSettings.mcbuInterestRate}
                    />
                    {/* Save Progress Modal */}
                    <SaveProgressModal {...saveProgress.modalProps} />
                    
                    {/* Edit Principal Loan Modal */}
                    {showEditLoanModal && editLoanCashCollection && (
                        <EditAmountReleaseModal
                            show={showEditLoanModal}
                            onClose={handleEditLoanModalClose}
                            onSuccess={handleEditLoanModalClose}
                            cashCollection={editLoanCashCollection}
                            currentUser={currentUser}
                        />
                    )}
                    
                    {/* Edit Withdrawal Modal */}
                    {showEditWithdrawalModal && editWithdrawalData && (
                        <EditMcbuCsfWithdrawalModal
                            show={showEditWithdrawalModal}
                            onClose={handleEditWithdrawalModalClose}
                            onSuccess={handleEditWithdrawalModalClose}
                            cashCollection={editWithdrawalData.cashCollection}
                            loan={editWithdrawalData.loan}
                            mcbuWithdrawalRecord={editWithdrawalData.mcbuWithdrawalRecord}
                            currentUser={currentUser}
                            withdrawalType={editWithdrawalType}
                        />
                    )}
                </div>
            )}
        </Layout>
    );
}

export default CashCollectionDetailsPage;