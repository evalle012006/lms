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
import { containsAnyLetters, formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';
import { ArrowPathIcon, ArrowUturnLeftIcon, CurrencyDollarIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import AddUpdateLoan from '@/components/transactions/AddUpdateLoanDrawer';
import Dialog from '@/lib/ui/Dialog';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { setBranchList } from '@/redux/actions/branchActions';
import { BehaviorSubject } from 'rxjs';
import Modal from '@/lib/ui/Modal';
import ClientDetailPage from '@/components/clients/ClientDetailPage';
import { setClient } from '@/redux/actions/clientActions';
import { LOR_DAILY_REMARKS } from '@/lib/constants';

const CashCollectionDetailsPage = () => {
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const transactionSettings = useSelector(state => state.transactionsSettings.data);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
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
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const currentMonth = moment(currentDate).month();
    const [dateFilter, setDateFilter] = useState(currentDate);
    const [loan, setLoan] = useState();
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();
    const [closeLoan, setCloseLoan] = useState();
    const [remarksArr, setRemarksArr] = useState(LOR_DAILY_REMARKS);
    const [filter, setFilter] = useState(false);
    const [groupFilter, setGroupFilter] = useState();
    const [allowMcbuWithdrawal, setAllowMcbuWithdrawal] = useState(false);

    const [selectedSlot, setSelectedSlot] = useState();

    const [showClientInfoModal, setShowClientInfoModal] = useState(false);
    const [showWaningDialog, setShowWarningDialog] = useState(false);

    const [mcbuRate, setMcbuRate] = useState(transactionSettings.mcbu || 8);
    const [hasDraft, setHasDraft] = useState(false);
    const [changeRemarks, setChangeRemarks] = useState(false);
    const [prevDraft, setPrevDraft] = useState(false);

    const handleShowWarningDialog = (e, selected) => {
        e.stopPropagation();

        if (selected.status !== 'totals') {
            let temp = {...selected};
            delete temp.targetCollectionStr;
            delete temp.amountReleaseStr;
            delete temp.loanBalanceStr;
            delete temp.excessStr;
            delete temp.totalStr;
            delete temp.currentReleaseAmountStr;
            delete temp.fullPaymentStr;
            delete temp.paymentCollectionStr;
            delete temp.noOfPaymentStr;
            delete temp.error;
            delete temp.dirty;
            delete temp.pastDueStr;
            delete temp.groupCashCollections;
            delete temp.loanOfficer;
            delete temp.noMispaymentStr;
            delete temp.mcbuStr;
            delete temp.mcbuColStr;
            delete temp.mcbuWithdrawalStr;
            delete temp.mcbuReturnAmtStr;
            delete temp.mcbuInterestStr;
            delete temp.mcbuError;
            delete temp.transferStr;
            setSelectedSlot(temp);
            setShowWarningDialog(true);
        }
    }

    const handleShowClientInfoModal = (selected) => {
        if (selected.status !== 'totals') {
            const selectedClient = selected.client;
            dispatch(setClient(selectedClient));
            setShowClientInfoModal(true);
        }
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
    }

    const handleGroupFilter = (selected) => {
        setGroupFilter(selected._id);
        setCurrentGroup(selected);
        router.push('/transactions/daily-cash-collection/client/' + selected._id);
    }
    
    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
        if (filteredDate === currentDate) {
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
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' 
            + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily', groupId: uuid, type: type });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];

            let dataCollection = response.data.collection;
            let transactionStatus;
            if (type === 'filter') {
                dataCollection = dataCollection.filter(cc => cc.hasOwnProperty('loanId') && cc.loanId !== null );
                transactionStatus = dataCollection.filter(cc => cc.status !== 'pending').filter(cc => cc.groupStatus === 'closed');
            } else {
                transactionStatus = dataCollection.filter(cc => cc.status !== 'pending').filter(cc => cc?.draftCollection[0]?.groupStatus === 'closed');
                if (transactionStatus.length === 0) {
                    transactionStatus = dataCollection.filter(cc => cc.status !== 'pending').filter(cc => cc?.current[0]?.groupStatus === 'closed');
                }
            }

            if (transactionStatus.length === 0 && (!date || currentDate === date)) {
                setEditMode(true);
                setGroupSummaryIsClose(false);
            } else {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }

            dataCollection.map(cc => {
                let collection;
                let transferStr = '-';
                if (cc?.transferred || (cc?.transfer && !cc.hasOwnProperty('current'))) {
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
                    if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                        const current = cc.current[0];
                        if (cc?.transfer) {
                            transferStr = 'TCR';
                            mcbu = current.mcbu;
                            amountRelease = current.amountRelease;
                            loanBalance = current.loanBalance;
                            mispayment = current.mispayment;
                            numMispayment = '';
                        }

                        if (cc?.transferred) {
                            transferStr = 'TCG';
                            mcbuCol = current.mcbuCol;
                            mcbuWithdrawal = current.mcbuWithdrawal;
                            mcbuReturnAmt = current.mcbuReturnAmt;
                            activeLoan = cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan;
                            excess = cc?.history?.excess > 0 ? cc.history.excess : cc.excess;
                            paymentCollection = cc?.history?.collection ? cc.history.collection : 0;
                        }
                    } else {
                        if (cc?.transfer) {
                            transferStr = 'TCR';
                            mcbu = cc.mcbu;
                            amountRelease = cc.amountRelease;
                            loanBalance = cc.loanBalance;
                            numMispayment = '';
                        }

                        if (cc?.transferred) {
                            transferStr = 'TCG';
                            mcbuCol = cc.mcbuCol;
                            mcbuWithdrawal = cc.mcbuWithdrawal;
                            mcbuReturnAmt = cc.mcbuReturnAmt;
                            activeLoan = cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan;
                            excess = cc?.history?.excess > 0 ? cc.history.excess : cc.excess;
                            paymentCollection = cc?.history?.collection ? cc.history.collection : 0;
                        }
                    }

                    collection = {
                        ...cc,
                        group: cc.group,
                        coMaker: (cc.coMaker && typeof cc.coMaker == 'number') ? cc.coMaker : '-',
                        loId: cc.loId,
                        loanId: cc.loanId,
                        branchId: cc.branchId,
                        groupId: cc.groupId,
                        groupName: cc.groupName,
                        clientId: cc.clientId,
                        slotNo: cc.slotNo,
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
                        noOfPayments: cc.noOfPayments,
                        noOfPaymentStr: cc.noOfPayments + ' / ' + cc.loanTerms,
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
                        amountRelease: cc.transferred ? 0 : amountRelease,
                        amountReleaseStr: (cc.transfer && amountRelease > 0) ? formatPricePhp(amountRelease) : '-',
                        loanBalance: cc.transferred ? 0 : loanBalance,
                        loanBalanceStr: (cc.transfer && loanBalance > 0) ? formatPricePhp(loanBalance) : '-',
                        paymentCollection: paymentCollection,
                        paymentCollectionStr: paymentCollection > 0 ? formatPricePhp(paymentCollection) : '-',
                        occurence: cc.group.occurence,
                        currentReleaseAmount: 0,
                        currentReleaseAmountStr: '-',
                        fullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                        fullPaymentStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-',
                        remarks: cc.remarks ? cc.remarks : '',
                        pastDue: cc.pastDue ? cc.pastDue : 0,
                        pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                        clientStatus: cc.client.status ? cc.client.status : '-',
                        delinquent: cc.client.delinquent,
                        fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                        history: cc.hasOwnProperty('history') ? cc.history : null,
                        prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null,
                        loanTerms: cc.loanTerms,
                        transferStr: transferStr
                    }

                    if (cc?.transferred && loanBalance > 0) {
                        collection.transferred = true;
                    }

                    setEditMode(false);
                } else {
                    if (cc.status === "tomorrow" || cc.status === "pending") {
                        let numMispayment = 0;
                        if (date) {
                            numMispayment = cc.noMispayment && cc.noMispayment !== '-' ? cc.noMispayment : 0;
                        } else {
                            numMispayment = cc.mispayment ? cc.mispayment : 0;
                        }
                        collection = {
                            ...cc,
                            group: cc.group,
                            coMaker: (cc.coMaker && typeof cc.coMaker == 'number') ? cc.coMaker : '-',
                            loanId: cc.loanId,
                            branchId: cc.branchId,
                            loId: cc.loId,
                            groupId: cc.groupId,
                            groupName: cc.groupName,
                            clientId: cc.clientId,
                            slotNo: cc.slotNo,
                            fullName: cc.client.lastName + ', ' + cc.client.firstName,
                            loanCycle: cc.loanCycle,
                            mispayment: '-',
                            mispaymentStr: '-',
                            noMispayment: numMispayment,
                            noMispaymentStr: numMispayment > 0 ? numMispayment + ' / ' + cc.loanTerms : '-',
                            collection: 0,
                            excess: cc.excess > 0 ? cc.excess : 0,
                            excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                            total: 0,
                            totalStr: '-',
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            activeLoan: '-',
                            targetCollection: cc.hasOwnProperty('prevData') ? cc.prevData.activeLoan : 0,
                            targetCollectionStr: cc.hasOwnProperty('prevData') ? formatPricePhp(cc.prevData.activeLoan) : 0,
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
                            amountRelease: '-',
                            amountReleaseStr: '-',
                            loanBalance: '-',
                            loanBalanceStr: '-',
                            paymentCollection: cc.paymentCollection,
                            paymentCollectionStr: cc.paymentCollection > 0 ? formatPricePhp(cc.paymentCollection) : '-',
                            occurence: cc.group.occurence,
                            currentReleaseAmount: cc.currentReleaseAmount,
                            currentReleaseAmountStr: formatPricePhp(cc.currentReleaseAmount),
                            fullPayment: (cc.hasOwnProperty('prevData') && cc.fullPayment.length > 0) ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentStr: (cc.hasOwnProperty('prevData') && cc.fullPayment.length > 0) ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-',
                            remarks: cc.remarks ? cc.remarks : '',
                            pastDue: cc.pastDue ? cc.pastDue : 0,
                            pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                            clientStatus: cc.client.status ? cc.client.status : '-',
                            delinquent: cc.client.delinquent,
                            fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                            history: cc.hasOwnProperty('history') ? cc.history : null,
                            prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null,
                            loanTerms: cc.loanTerms
                        }
    
                        setEditMode(false);
                    } else if (cc.status === "closed" && !cc.transfer) {
                        let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + cc.loanTerms : '-';
                        if (date) {
                            numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + cc.loanTerms : '-';
                        }
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
                        if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                            const current = cc.current.find(cur => !cur.hasOwnProperty('transfer'));
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
                            }
                        }
                        collection = {
                            ...cc,
                            group: cc.group,
                            coMaker: (cc.coMaker && typeof cc.coMaker == 'number') ? cc.coMaker : '-',
                            loId: cc.loId,
                            loanId: cc?.current?.length > 0 ? cc.current[0].loanId : cc.loanId,
                            branchId: cc.branchId,
                            groupId: cc.groupId,
                            groupName: cc.groupName,
                            clientId: cc.clientId,
                            slotNo: cc.slotNo,
                            fullName: cc.client.lastName + ', ' + cc.client.firstName,
                            loanCycle: cc?.history?.loanCycle ? cc?.history?.loanCycle : cc.loanCycle,
                            mispayment: mispayment,
                            mispaymentStr: mispayment ? "Yes" : "No",
                            noMispayment: date ? cc.noMispayment : cc.mispayment,
                            noMispaymentStr: numMispayment,
                            collection: 0,
                            excess: cc?.history?.excess > 0 ? cc.history.excess : cc.excess,
                            excessStr: cc?.history?.excess > 0 ? formatPricePhp(cc.history.excess) : '-',
                            total: 0,
                            totalStr: '-',
                            noOfPayments: cc.noOfPayments,
                            noOfPaymentStr: cc.noOfPayments + ' / ' + cc.loanTerms,
                            activeLoan: cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan,
                            targetCollection: cc?.history?.activeLoan ? cc.history.activeLoan : cc.activeLoan,
                            targetCollectionStr: cc?.history?.activeLoan > 0 ? formatPricePhp(cc.history.activeLoan) : '-',
                            mcbu: mcbu,
                            mcbuStr: mcbu > 0 ? formatPricePhp(mcbu) : '-',
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
                            paymentCollection: cc?.history?.collection ? cc.history.collection : 0,
                            paymentCollectionStr: cc?.history?.collection > 0 ? formatPricePhp(cc.history.collection) : '-',
                            occurence: cc.group.occurence,
                            currentReleaseAmount: 0,
                            currentReleaseAmountStr: '-',
                            fullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-',
                            remarks: cc.remarks ? cc.remarks : '',
                            pastDue: cc.pastDue ? cc.pastDue : 0,
                            pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                            clientStatus: cc.client.status ? cc.client.status : '-',
                            delinquent: cc.client.delinquent,
                            fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                            history: cc.hasOwnProperty('history') ? cc.history : null,
                            prevData: prevData,
                            loanTerms: cc.loanTerms,
                            transferred: cc.transferred,
                            draft: draft,
                            reverted: reverted
                        }
    
                        if (loanBalance > 0) {
                            collection.transferred = true;
                        }
    
                        setEditMode(false);
                    } else if (cc.status !== "closed" || (type !== 'filter' && cc?.current?.length < 2)) {
                        let noPaymentsStr = (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments + ' / ' + cc.loanTerms : '-';
                        let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + cc.loanTerms : '-';
                        let noMispayment = date ? cc.noMispayment ? cc.noMispayment : 0 : cc.mispayment;
                        if (date) {
                            numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + cc.loanTerms : '-';
                        }
    
                        let mispaymentStr = '-';
                        if (cc.mispayment !== undefined) {
                            mispaymentStr = cc.mispayment ? 'Yes' : 'No';
                        } else {
                            if (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) {
                                mispaymentStr = 'No';
                            }
                        }

                        let activeLoan = cc.activeLoan;
                        if (cc?.transfer && cc?.transferDate === currentDate) {
                            numMispayment = '';
                            noMispayment = 0;
                            mispaymentStr = '-';
                            noPaymentsStr = '-';
                            activeLoan = 0;
                        }

                        let history = cc.hasOwnProperty('history') ? cc.history : null;
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
                                remarks = cc.history.remarks;
                            }
                        }
                        
                        collection = {
                            client: cc.client,
                            coMaker: (cc.coMaker && typeof cc.coMaker == 'number') ? cc.coMaker : '-',
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
                            mispayment: cc.mispayment ? cc.mispayment : false,
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
                            originalMcbu: cc.mcub,
                            mcbu: cc.mcbu,
                            mcbuStr: cc.mcbu > 0 ? formatPricePhp(cc.mcbu) : '-',
                            mcbuCol: cc.mcbuCol,
                            mcbuColStr: cc.mcbuCol > 0 ? formatPricePhp(cc.mcbuCol) : '-',
                            mcbuWithdrawal: 0,
                            mcbuWithdrawalStr: '-',
                            mcbuReturnAmt: 0,
                            mcbuReturnAmtStr: '-',
                            mcbuInterest: cc.mcbuInterest ? cc.mcbuInterest : 0,
                            mcbuInterestStr: cc.mcbuInterest > 0 ? formatPricePhp(cc.mcbuInterest) : '-',
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
                            advanceDays: cc.advanceDays,
                            history: history,
                            status: cc.status,
                            loanTerms: cc.loanTerms,
                            transferred: cc.transferred,
                            startDate: cc.startDate,
                            endDate: cc.endDate,
                            reverted: cc.hasOwnProperty('reverted') ? cc.reverted : false,
                            pnNumber: cc.pnNumber,
                            guarantorFirstName: cc.guarantorFirstName,
                            guarantorMiddleName: cc.guarantorMiddleName,
                            guarantorLastName: cc.guarantorLastName,
                            loanRelease: cc.loanRelease
                        }
    
                        delete cc._id;

                        if (type !== 'filter' && cc?.draftCollection?.length > 0) {
                            const draftCC = cc.draftCollection[cc.draftCollection.length - 1];
                            setEditMode(true);

                            collection.targetCollection = draftCC.targetCollection;
                            collection.targetCollectionStr = draftCC.targetCollection > 0 ? formatPricePhp(draftCC.targetCollection) : '-';
                            collection.excess = draftCC.excess;
                            collection.excessStr = collection.excess > 0 ? formatPricePhp(collection.excess) : '-';
                            collection.paymentCollection = draftCC.paymentCollection;
                            collection.paymentCollectionStr = collection.paymentCollection > 0 ? formatPricePhp(collection.paymentCollection) : '-';
                            collection.mispayment = draftCC.mispayment;
                            collection.mispaymentStr = draftCC.mispaymentStr;
                            collection.remarks = draftCC.remarks;
                            collection.delinquent = draftCC.hasOwnProperty('delinquent') ? draftCC.delinquent : false;
                            collection._id = draftCC._id;
                            collection.prevData = draftCC.prevData;
                            collection.pastDue = draftCC.pastDue ? draftCC.pastDue : 0;
                            collection.pastDueStr = draftCC.pastDue ? formatPricePhp(draftCC.pastDue) : '-';
                            collection.mcbuCol = draftCC.mcbuCol;
                            collection.mcbuColStr = draftCC.mcbuCol > 0 ? formatPricePhp(draftCC.mcbuCol) : '-';
                            collection.mcbuWithdrawal = draftCC.mcbuWithdrawal;
                            collection.mcbuWithdrawalStr = draftCC.mcbuWithdrawal > 0 ? formatPricePhp(draftCC.mcbuWithdrawal) : '-';
                            collection.mcbuReturnAmt = (draftCC.hasOwnProperty('mcbuReturnAmt') && draftCC.mcbuReturnAmt) ? draftCC.mcbuReturnAmt : 0;
                            collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                            collection.mcbuInterest = draftCC.mcbuInterest ? cc.mcbuInterest : 0,
                            collection.mcbuInterestStr = draftCC.mcbuInterest > 0 ? formatPricePhp(draftCC.mcbuInterest) : '-',
                            collection.advanceDays = draftCC.advanceDays;
                            collection.draft = draftCC.draft;
                            collection.dcmc = (draftCC.hasOwnProperty('dcmc') && draftCC.dcmc) ? draftCC.dcmc : false;
                            collection.excused = (draftCC.hasOwnProperty('excused') && draftCC.excused) ? draftCC.excused : false;
                            collection.latePayment = (draftCC.hasOwnProperty('latePayment') && draftCC.latePayment) ? draftCC.latePayment : false;

                            collection.error = draftCC.error;
                            collection.mcbu = draftCC.mcbu;
                            collection.mcbuStr = draftCC.mcbu > 0 ? formatPricePhp(draftCC.mcbu) : '-',
                            collection.loanBalance = draftCC.loanBalance;
                            collection.loanBalanceStr = formatPricePhp(draftCC.loanBalance);
                            collection.noOfPayments = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? draftCC.noOfPayments : 0;
                            collection.noOfPaymentStr = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? draftCC.noOfPayments + ' / ' + collection.loanTerms : '-';
                            collection.total = draftCC.total;
                            collection.fullPayment = draftCC.fullPayment;
                            collection.fullPaymentStr = formatPricePhp(draftCC.fullPayment);
                            collection.fullPaymentDate = draftCC.fullPaymentDate;
                            collection.history = draftCC.history;
                            collection.amountRelease = draftCC.amountRelease;
                            collection.amountReleaseStr = formatPricePhp(draftCC.amountRelease);
                            collection.previousDraft = true;
                            collection.dateAdded = draftCC.dateAdded;
                        } else if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                            const current = cc.current.find(cur => !cur.hasOwnProperty('transferId'));
                            if (current) {
                                setEditMode(false);
                                collection.targetCollection = current.targetCollection;
                                collection.targetCollectionStr = collection.targetCollection > 0 ? formatPricePhp(collection.targetCollection) : '-';
                                collection.excess = current.excess;
                                collection.excessStr = collection.excess > 0 ? formatPricePhp(collection.excess) : '-';
                                collection.paymentCollection = current.paymentCollection;
                                collection.paymentCollectionStr = collection.paymentCollection > 0 ? formatPricePhp(collection.paymentCollection) : '-';
                                collection.mispayment = current.mispayment;
                                collection.mispaymentStr = current.mispaymentStr;
                                collection.remarks = current.remarks;
                                collection.delinquent = current.hasOwnProperty('delinquent') ? current.delinquent : false;
                                collection._id = current._id;
                                collection.prevData = current.prevData;
                                collection.pastDue = current.pastDue ? current.pastDue : 0;
                                collection.pastDueStr = current.pastDue ? formatPricePhp(current.pastDue) : '-';
                                collection.mcbuCol = current.mcbuCol;
                                collection.mcbuColStr = current.mcbuCol > 0 ? formatPricePhp(current.mcbuCol) : '-';
                                collection.mcbuWithdrawal = current.mcbuWithdrawal;
                                collection.mcbuWithdrawalStr = current.mcbuWithdrawal > 0 ? formatPricePhp(current.mcbuWithdrawal) : '-';
                                collection.mcbuReturnAmt = (current.hasOwnProperty('mcbuReturnAmt') && current.mcbuReturnAmt) ? current.mcbuReturnAmt : 0;
                                collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                                collection.mcbuInterest = current.mcbuInterest ? cc.mcbuInterest : 0,
                                collection.mcbuInterestStr = current.mcbuInterest > 0 ? formatPricePhp(current.mcbuInterest) : '-',
                                collection.advanceDays = current.advanceDays;
                                collection.draft = current.draft;
                                collection.dcmc = (current.hasOwnProperty('dcmc') && current.dcmc) ? current.dcmc : false;
                                collection.excused = (current.hasOwnProperty('excused') && current.excused) ? current.excused : false;
                                collection.latePayment = (current.hasOwnProperty('latePayment') && current.latePayment) ? current.latePayment : false;

                                if (current.draft) {
                                    collection.error = current.error;
                                    collection.mcbu = current.mcbu;
                                    collection.mcbuStr = current.mcbu > 0 ? formatPricePhp(current.mcbu) : '-',
                                    collection.loanBalance = current.loanBalance;
                                    collection.loanBalanceStr = formatPricePhp(current.loanBalance);
                                    collection.noOfPayments = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? current.noOfPayments : 0;
                                    collection.noOfPaymentStr = (collection.status === "active" || (collection.status === "completed" && collection.fullPaymentDate === currentDate)) ? current.noOfPayments + ' / ' + collection.loanTerms : '-';
                                    collection.total = current.total;
                                    collection.fullPayment = current.fullPayment;
                                    collection.fullPaymentStr = formatPricePhp(current.fullPayment);
                                    collection.fullPaymentDate = current.fullPaymentDate;
                                    collection.history = current.history;
                                    collection.amountRelease = current.amountRelease;
                                    collection.amountReleaseStr = formatPricePhp(current.amountRelease);
                                    setEditMode(true);
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
        
                        if (cc.loanBalance <= 0 && cc.status !== 'completed') {
                            if (cc.fullPaymentDate === currentDate) {
                                collection.paymentCollection = cc.history ? cc.history.collection : 0;
                                collection.paymentCollectionStr = formatPricePhp(collection.paymentCollection);
                            }
    
                            collection.notCalculate = true;
                            collection.remarks = cc.history ? cc.history.remarks : '-';
                        }

                        if (cc?.transfer && cc?.transferDate === currentDate) {
                            collection.transfer = true;
                            transferStr = 'TCR';
                        }
                    } else {
                        return;
                    }

                    collection.transferStr = transferStr;
                }

                if (!date && cc.hasOwnProperty('pastDue')) {
                    if (collection.pastDue === collection.loanBalance && collection.loanBalance > 0) {
                        collection.targetCollection = 0;
                        collection.activeLoan = 0;
                    }
                }

                collection.mcbuWithdrawFlag = false;

                if (collection.status === 'completed') {
                    collection.noOfPayments = 60;
                    collection.noOfPaymentStr = '60 / 60';
                    if (collection.fullPaymentDate == currentDate) {
                        collection.fullPayment = collection?.loanRelease;
                        collection.fullPaymentStr = collection.fullPayment > 0 ? formatPricePhp(collection.fullPayment) : '-';
                    }
                }

                cashCollection.push(collection);   
            });

            response.data.tomorrowPending.map(loan => {
                const currentLoan = cashCollection.find(l => l.slotNo === loan.slotNo);
                if (currentLoan && currentLoan.status !== 'pending') {
                    const index = cashCollection.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) { // fullpayment with pending/tomorrow
                        cashCollection[index] = {
                            client: currentLoan.client,
                            coMaker: (loan.coMaker && typeof loan.coMaker == 'number') ? loan.coMaker : '-',
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            prevLoanId: currentLoan.loanId ? currentLoan.loanId : currentLoan._id,
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
                            targetCollection: currentLoan.history.activeLoan,
                            targetCollectionStr: formatPricePhp(currentLoan.history.activeLoan),
                            mispayment: currentLoan.mispayment,
                            mispaymentStr: currentLoan.mispayment ? 'Yes' : 'No',
                            noMispayment: currentLoan.noMispayment,
                            noMispaymentStr: currentLoan.noMispayment > 0 ? currentLoan.noMispayment + ' / ' + currentLoan.loanTerms : '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : 0,
                            noOfPayments: '-',
                            noOfPaymentStr: (currentLoan.noOfPayments !== '-' && currentLoan.status !== 'totals') ? currentLoan.noOfPayments + ' / ' + currentLoan?.loanTerms : '-',
                            excess: currentLoan.history.excess,
                            excessStr: formatPricePhp(currentLoan.history.excess),
                            paymentCollection: currentLoan.history.collection,
                            paymentCollectionStr: formatPricePhp(currentLoan.history.collection),
                            remarks: currentLoan.history.remarks,
                            fullPayment: currentLoan.fullPayment,
                            fullPaymentStr: currentLoan.fullPayment ? currentLoan.fullPaymentStr : 0,
                            pastDue: currentLoan.pastDue ? currentLoan.pastDue : 0,
                            pastDueStr: currentLoan.pastDue ? formatPricePhp(currentLoan.pastDue) : '-',
                            clientStatus: currentLoan.clientStatus,
                            delinquent: currentLoan.delinquent,
                            advanceDays: currentLoan.advanceDays,
                            status: loan.status === "active" ? "tomorrow" : loan.status,
                            loanTerms: loan.loanTerms,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false,
                            reverted: currentLoan.reverted,
                            history: currentLoan.history
                        };

                        if (currentLoan?.current?.length > 0) {
                            cashCollection[index]._id = currentLoan.current[0]._id;
                            cashCollection[index].prevData = currentLoan.current[0].prevData;
                        } else if (loan?.current?.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                            cashCollection[index].prevData = loan.current[0].prevData;
                        }
                    } else if (currentLoan.status !== 'active') {
                        cashCollection[index] = {
                            client: currentLoan.client,
                            coMaker: (loan.coMaker && typeof loan.coMaker == 'number') ? loan.coMaker : '-',
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            prevLoanId: currentLoan.loanId ? currentLoan.loanId : currentLoan._id,
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
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: currentLoan.prevData ? formatPricePhp(currentLoan.prevData.paymentCollection) : '-',
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
                            remarks: currentLoan?.status === 'completed' ? currentLoan.remarks : '-',
                            fullPaymentStr: '-',
                            loanTerms: loan.loanTerms,
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false,
                            reverted: currentLoan.reverted,
                            history: currentLoan.history
                        };
                        if (currentLoan?.current?.length > 0) {
                            cashCollection[index]._id = currentLoan.current[0]._id;
                            cashCollection[index].prevData = currentLoan.current[0].prevData;
                        } else if (loan?.current?.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                            cashCollection[index].prevData = loan.current[0].prevData;
                        }
                    }
                } else {
                    const prevLoan = loan.prevLoans.length > 0 ? loan.prevLoans[loan.prevLoans.length - 1] : null;
                    let pendingTomorrow = {
                        _id: loan._id,
                        client: loan.client,
                        coMaker: (loan.coMaker && typeof loan.coMaker == 'number') ? loan.coMaker : '-',
                        slotNo: loan.slotNo,
                        loanId: loan._id,
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
                        targetCollectionStr: '-',
                        excessStr: '-',
                        paymentCollectionStr: '-',
                        mcbu: loan.mcbu,
                        mcbuStr: loan.mcbu > 0 ? formatPricePhp(loan.mcbu) : '-',
                        mcbuCol: loan.mcbuCol, // get the prevLoan cashCollections
                        mcbuColStr: loan.mcbuCol > 0 ? formatPricePhp(loan.mcbuCol) : '-',
                        mcbuWithdrawal: prevLoan?.mcbuWithdrawal ? prevLoan.mcbuWithdrawal : 0,
                        mcbuWithdrawalStr: prevLoan?.mcbuWithdrawal > 0 ? formatPricePhp(prevLoan.mcbuWithdrawal) : '-',
                        mcbuReturnAmt: prevLoan?.mcbuReturnAmt ? prevLoan?.mcbuReturnAmt : 0,
                        mcbuReturnAmtStr: prevLoan?.mcbuReturnAmt > 0 ? formatPricePhp(prevLoan.mcbuReturnAmt) : '-',
                        mcbuInterest: loan.mcbuInterest,
                        mcbuInterestStr: loan.mcbuInterest > 0 ? formatPricePhp(loan.mcbuInterest) : '-',
                        remarks: prevLoan ? prevLoan.history.remarks : '-',
                        pastDueStr: '-',
                        fullPaymentStr: '-',
                        loanTerms: loan.loanTerms,
                        status: loan.status === 'active' ? 'tomorrow' : 'pending'
                    };

                    cashCollection.push(pendingTomorrow);
                }
            });

            const hasDraft = cashCollection.filter(cc => cc.draft);
            if (hasDraft.length > 0) {
                setEditMode(true);
                setHasDraft(true);
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
            }

            dispatch(setCashCollectionGroup(cashCollection));
            setTimeout(() => {
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

        dataArr.map(collection => {
            if (collection.status !== 'open' && collection.status !== 'totals') {
                if (collection.status === 'active' || collection?.transferred) {
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease !== '-' ? collection.amountRelease : 0 : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance !== '-' ? collection.loanBalance : 0 : 0;
                }

                if ((collection.status === 'tomorrow' || (collection.hasOwnProperty('tomorrow') && collection.tomorrow) || collection?.transferred)) {
                    totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount !== '-' ? collection.currentReleaseAmount : 0 : 0;
                }

                if (collection.fullPaymentDate === currentDate && collection.status === "completed") {
                    totalTargetLoanCollection += collection.history ? collection.history.activeLoan : 0;
                }

                if (!collection.remarks || (collection.remarks && collection.remarks?.value !== 'delinquent' && !collection.remarks.value?.startsWith('excused-')) || collection?.transferred) {
                    totalTargetLoanCollection += collection.targetCollection  ? collection.targetCollection !== '-' ? collection.targetCollection : 0 : 0;
                }

                totalExcess += collection.excess ? collection.excess !== '-' ? collection.excess : 0 : 0;
                totalLoanCollection += collection.paymentCollection ? collection.paymentCollection !== '-' ? parseFloat(collection.paymentCollection) : 0 : 0;
                totalFullPayment += collection.fullPayment ? collection.fullPayment !== '-' ? collection.fullPayment : 0 : 0;
                totalMispayment += collection.mispaymentStr === 'Yes' ? 1 : 0;
                totalPastDue += (collection.pastDue && collection.pastDue !== '-') ? collection.pastDue : 0;
                totalMcbu += collection.mcbu ? collection.mcbu : 0;
                totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                totalMcbuWithdraw += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                totalMcbuReturn += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
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
            targetCollection: totalTargetLoanCollection,
            targetCollectionStr: totalTargetLoanCollection ? formatPricePhp(totalTargetLoanCollection) : 0,
            excess: totalExcess,
            excessStr: totalExcess ? formatPricePhp(totalExcess) : 0,
            paymentCollection: totalLoanCollection,
            paymentCollectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
            mcbuStr: totalMcbu > 0 ? formatPricePhp(totalMcbu) : '-',
            mcbuColStr: totalMcbuCol > 0 ? formatPricePhp(totalMcbuCol) : '-',
            mcbuWithdrawalStr: totalMcbuWithdraw > 0 ? formatPricePhp(totalMcbuWithdraw) : '-',
            mcbuReturnAmtStr: totalMcbuReturn > 0 ? formatPricePhp(totalMcbuReturn) : '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest > 0 ? formatPricePhp(totalMcbuInterest) : '-',
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
            if (cc.status !== 'totals' && cc.status == 'active' && cc?.loanBalance > 0 && !draft) {
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
                        && !cc.remarks.value?.startsWith('collection-') && cc.remarks.value !== 'matured-past due') ) {
                        errorMsg.add(`Actual collection should be divisible by ${cc.activeLoan}.`);
                    }
                } else if (cc.loanBalance > 0 && parseFloat(cc.paymentCollection) === (cc.activeLoan * 2) && (!cc.remarks || cc.remarks && cc.remarks.value !== "advance payment" && cc.remarks.value !== "past due collection")) {
                    errorMsg.add('Error occured. Actual collection is a double payment please set remarks as Advance Payment.');
                } else if (cc.loanBalance > 0 && parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan) && parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan * 2) && cc.loanBalance !== 0) {
                    if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) === 0 && (!cc.remarks || cc.remarks && cc.remarks.value !== "advance payment" && cc.remarks.value !== "past due collection")) {
                        errorMsg.add('Error occured. Actual collection is a advance payment please set remarks as Advance Payment.');
                    }
                } else if (cc.status === "active" && cc.loanBalance === 0 && !cc.remarks ) {
                    errorMsg.add('Error occured. Please select PENDING, RELOANER or OFFSET remarks for full payment transaction.');
                }

                if (parseFloat(cc.loanBalance) && (cc.remarks && cc.remarks.value && cc.remarks.value?.startsWith('offset'))) {
                    errorMsg.add('Error occured. Please input the full balance amount before closing the loan account.');
                }

                if (cc.mcbuError) {
                    errorMsg.add('Error occured. Please double check the MCBU Collection/Withdrawal column.');
                }

                if (cc.mcbuWithdrawFlag) {
                    if (!cc.mcbuWithdrawal || parseFloat(cc.mcbuWithdrawal) > parseFloat(cc.mcbu)) {
                        errorMsg.add('Error occured. Invalid MCBU Withdraw amount.');
                    } else if (parseFloat(cc.mcbuWithdrawal) < 10) {
                        errorMsg.add('Error occured. MCBU withdrawal amount is less than ₱10.');
                    }
                }
            } else if (cc.status !== 'totals' && (cc.status === 'completed' || (cc?.status !== 'closed' && cc?.loanBalance <= 0)) && (!cc.remarks || (cc.remarks && (cc.remarks.value !== 'pending' && !cc.remarks.value?.startsWith('reloaner') && !cc.remarks.value?.startsWith('offset'))))) {
                console.log(cc)
                errorMsg.add("Invalid remarks. Fullpayment transaction has no remarks. Please set the remarks to RELOANER OR OFFSET.");
            }
        });

        return errorMsg;
    }

    const handleSaveUpdate = async (draft) => {
        setLoading(true);
        
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
                const dataArr = data.filter(cc => cc.status !== 'open').map(cc => {
                    let temp = {...cc};

                    if (temp.reverted) {
                        delete temp.reverted;
                        temp.revertedDate = currentDate;
                    }
    
                    delete temp.reverted;
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
                    delete temp.mcbuInterestStr;
                    delete temp.mcbuError;
                    delete temp.client;
                    delete temp.transferStr;

                    if (cc.hasOwnProperty('_id')) {
                        temp.modifiedBy = currentUser._id;
                        temp.dateModified = currentDate;
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

                        delete temp.originalMcbu;
    
                        temp.paymentCollection = parseFloat(temp.paymentCollection);
                        temp.loanBalance = parseFloat(temp.loanBalance);
                        temp.amountRelease = parseFloat(temp.amountRelease);

                        if (!temp.paymentCollection || temp.paymentCollection <= 0) {
                            temp.mispayment = true;
                            temp.mispaymentStr = 'Yes';
                        }

                        if (temp.remarks && (temp.remarks.value === 'excused advance payment' || temp.remarks.value === 'delinquent-mcbu')) {
                            temp.activeLoan = 0;
                            temp.targetCollection = 0;
                            temp.targetCollectionStr = '-';
                            temp.mispayment = false;
                            temp.mispaymentStr = 'No';
                        }
    
                        if (temp.loanBalance <= 0) {
                            temp.status = 'completed';
                        }
    
                        if (temp.status === 'completed') {
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
                    }

                    // if admin it should not override what it is currently saved
                    temp.groupStatus = 'pending';
                    temp.draft = temp.status === 'completed' ? false : draft;

                    if (prevDraft && !draft) {
                        temp.groupStatus = "closed";
                    }
                
                    return temp;   
                }).filter(cc => cc.status !== "totals");
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
                                currentTime: currentTime
                            };
                        } else {
                            cashCollection = {
                                dateModified: currentDate,
                                modifiedBy: currentUser._id,
                                collection: JSON.stringify(dataArr),
                                currentDate: currentDate,
                                currentTime: currentTime
                            };
                        }
                    } else {
                        cashCollection = {
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr),
                            mode: 'daily',
                            currentDate: currentDate,
                            currentTime: currentTime
                        };
                    }
            
                    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', cashCollection);
                    if (response.success) {
                        setLoading(false);
                        toast.success('Payment collection successfully submitted. Reloading page please wait.');
                        setTimeout(async () => {
                            // getCashCollections();
                            window.location.reload();
                        }, 2000);
                    }
                } else {
                    toast.error('No active data to be saved.');
                    setLoading(false);
                }
            }
        }
    }

    const handlePaymentCollectionChange = (e, index, type, targetCollection) => {
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
                        if (temp.prevData) {
                            temp.loanBalance = temp.prevData.loanBalance;
                            temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                            temp.total = temp.prevData.total;
                            temp.noOfPayments = temp.prevData.noOfPayments;
                            temp.noOfPaymentStr = temp.noOfPayments + " / " + temp.loanTerms;
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
                            temp.mcbu = temp.prevData.mcbu;
                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                            temp.mcbuCol = 0;
                            temp.mcbuColStr = '-';
                            temp.mcbuWithdrawal = 0;
                            temp.mcbuWithdrawalStr = '-';
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
                                advanceDays: temp.advanceDays
                            };
                        }

                        // Reset MCBU
                        // if (temp.hasOwnProperty('mcbuHistory')) {
                        //     temp.mcbu = temp.mcbuHistory.mcbu;
                        //     temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        //     temp.prevData.mcbu = temp.mcbuHistory.mcbu;
                        // }

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
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                                } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                                    temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                                    temp.excessStr = formatPricePhp(temp.excess);
                                    temp.mispayment = false;
                                    temp.mispaymentStr = "No";
                                    const noPayments = parseInt(payment) / parseInt(temp.activeLoan);
                                    temp.noOfPayments = temp.noOfPayments + noPayments;
    
                                    // compute excess mcbu collection here...
                                    const excessMcbu = temp.excess / temp.activeLoan;
                                    const finalMcbu = (excessMcbu * 10) + 10;
                                    temp.mcbuCol = finalMcbu;
                                    temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                    temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                                    temp.excess =  0;
                                    temp.mispayment = true;
                                    temp.mispaymentStr = 'Yes';
                                    // temp.noOfPayments = temp.noOfPayments + 1;
                                    temp.error = true;
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                                    // temp.remarks = { label: 'Excused', value: 'excused'};
                                } else {
                                    temp.mispayment = false;
                                    temp.mispaymentStr = 'No';
                                    temp.noOfPayments = temp.noOfPayments + 1;
                                    temp.mcbuCol = 10;
                                    temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                    temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                }
        
                                temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
        
                                temp = setHistory(temp, prevLoanBalance);
    
                                if (temp.loanBalance <= 0) {
                                    temp.fullPayment = temp.amountRelease;
                                    temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                    temp.loanBalanceStr = 0;
                                    temp.amountRelease = 0;
                                    temp.amountReleaseStr = 0;
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
                            temp.mispayment = false;
                            temp.mispaymentStr = 'No';
                            temp.remarks = "";
                        }
                    } 
                } 
                return temp;
            });

            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;

            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'mcbuCol') {
            const value = e.target.value ? parseFloat(e.target.value) : 0;

            if (value > 0) {
                const mcbuCol = value;
                let list = data.map((cc, idx) => {
                    let temp = {...cc};

                    if (idx === index) {
                        if (temp.hasOwnProperty('prevData') && temp.prevData) {
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

                        temp.mcbuCol = mcbuCol;
                        temp.mcbuColStr = formatPricePhp(mcbuCol);
                        temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + mcbuCol : 0 + mcbuCol;
                        temp.mcbuStr = formatPricePhp(temp.mcbu);
                        temp.prevData.mcbuCol = mcbuCol;
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
                let temp = {...cc};
                
                if (idx === index) {
                    if (temp.status === 'completed' && prevDraft) {
                        toast.error('Changing of completed remarks while there are previous draft transactions is not allowed.');
                    } else {
                        if (temp.status === 'completed' && (remarks?.value && (remarks.value?.startsWith('offset') || remarks.value?.startsWith('reloaner') || remarks?.value.startsWith('collection-')))) {
                            setEditMode(true);
                            setChangeRemarks(true);
                        }
    
                        if (temp.status === "completed" && !(remarks.value && (remarks.value?.startsWith('offset') || remarks.value?.startsWith('reloaner')))) {
                            toast.error("Error occured. Invalid remarks. Should only choose a reloaner/offset remarks.");
                        } else {
                            // always reset these fields
                            temp.error = false;
                            temp.dcmc = false;
                            if (temp.hasOwnProperty('prevData') && temp.prevData) {
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
                            temp.mcbuWithdrawal = 0;
                            temp.mcbuWithdrawalStr = '-';
        
                            temp.targetCollection = temp.activeLoan;
                            temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                            temp.excused = false;
                            temp.delinquent = false;
                            
                            // for pending remarks - this slot no should still be able to change by the following day to change the remarks
                            // by tomorrow only reloaner and offsets...
                            if (remarks.value && remarks.value?.startsWith('offset')) {
                                if (parseFloat(temp.loanBalance) !== 0) {
                                    toast.error("Please enter the full balance before closing the loan account.");
                                    temp.error = true;
                                } else {
                                    setShowRemarksModal(true);
                                    setCloseLoan(cc);
                                    temp.error = false;
                                    setEditMode(true);
    
                                    if (temp.history && (temp.history?.remarks?.value?.startsWith('offset') || temp.history?.remarks?.value?.startsWith('reloaner'))) {
                                        temp.mcbu = temp.prevData.mcbu;
                                    }
                                    
                                    if (temp.mcbu !== temp.prevData.mcbu && temp.mcbuCol && temp.mcbuCol > 0) {
                                        temp.mcbu = temp.mcbu - temp.mcbuCol;
                                    }
    
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = '-';    
                                    temp.mcbuReturnAmt = parseFloat(temp.mcbu);
                                    temp.mcbuReturnAmtStr = formatPricePhp(temp.mcbuReturnAmt);
                                    temp.mcbu = 0;
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                    temp.mcbuError = false;
                                    temp.pastDue = 0;
                                    temp.pastDueStr = '-';
    
                                    if (temp.loanBalance === 0 && temp.paymentCollection === 0) {
                                        temp.fullPayment = temp?.history?.amountRelease;
                                    }
                                }
        
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                            } else if (remarks.value === "past due") {
                                temp.pastDue = temp.pastDue !== '-' ? temp.pastDue + temp.activeLoan : temp.activeLoan;
                                temp.pastDueStr = formatPricePhp(temp.pastDue);
                                temp.mispayment = true;
                                temp.mispaymentStr = 'Yes';
                                temp.error = false;
                                temp.excused = true;
                                temp.mcbuError = false;
                                if (temp.mcbuCol && temp.mcbuCol > 0) {
                                    temp.mcbu = temp.mcbu - temp.mcbuCol;
                                    temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                }
    
                                temp.mcbuCol = 0;
                                temp.mcbuColStr = '-';
                            } else if (remarks.value?.startsWith('delinquent') || remarks.value?.startsWith('excused-')) {
                                // add no of mispayments / maximum of payments per cycle // change to #of mispay
                                temp.error = false;
                                temp.mcbuError = false;
        
                                if (remarks.value?.startsWith('delinquent')) {
                                    temp.delinquent = true;
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
                                    } else {
                                        temp.error = true;
                                        toast.error("Invalid remarks. Delinquent for Offset must be equal to the target collection.");
                                    }
                                }
    
                                if (remarks.value === 'delinquent-mcbu') {
                                    temp.dcmc = true;
                                    if (temp.paymentCollection > 0) {
                                        temp.loanBalance += temp.paymentCollection;
                                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                                    }
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
                                    temp.paymentCollection = 0;
                                    temp.paymentCollectionStr = '-';
                                } else {
                                    if (remarks.value == 'delinquent-offset') {
                                        temp.mispayment = false;
                                        temp.mispaymentStr = 'No';
                                    } else {
                                        if (temp.paymentCollection > temp.activeLoan) {
                                            temp.error = true;
                                            toast.error("Error occured. Remarks is not valid due to the amount in Actual Collection.");
                                        } else {
                                            if (remarks.value == 'delinquent') {
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
        
                                        temp.mcbuCol = 0;
                                        temp.mcbuColStr = '-';
                                    }
                                }
                            } else if (remarks.value === "past due collection") {
                                if (temp.pastDue > 0 && temp.paymentCollection > temp.activeLoan) {
                                    const pastDueCol = temp.paymentCollection - temp.activeLoan;
                                    if (pastDueCol > temp.pastDue) {
                                        const excessPD = pastDueCol - temp.pastDue;
                                        temp.excess = excessPD;
                                        temp.excessStr = formatPricePhp(temp.excess);
                                        temp.pastDue = 0;
                                        temp.pastDueStr = '-';
                                    } else {
                                        temp.pastDue = temp.pastDue > 0 ? temp.pastDue - pastDueCol : 0;
                                        temp.pastDueStr = formatPricePhp(temp.pastDue);
                                        temp.excess = 0;
                                        temp.excessStr = '-';
                                    }
        
                                    temp.error = false;
                                    temp.mcbuError = false;
                                } else {
                                    temp.error = true;
                                    toast.error("Error occured. Invalid remarks.");
                                }
                            } else if (remarks.value === 'advance payment') {
                                if (temp.excess > 0) {
                                    const advanceDays = parseFloat(temp.paymentCollection) / parseFloat(temp.activeLoan);
                                    temp.advanceDays = temp.advanceDays ? temp.advanceDays + (advanceDays - 1) : advanceDays - 1;
                                    temp.error = false;
                                } else {
                                    temp.error = true;
                                    toast.error('Invalid remarks. You already hit 0 advance days.');
                                }
        
                                if (temp.loanBalance <= 0) {
                                    temp.error = true;
                                    toast.error('Invalid remarks. Please mark it as Reloaner or Offset');
                                }
                            } else if (remarks.value === "excused advance payment") {
                                if (temp.hasOwnProperty('prevData')) {
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
                                            temp.mcbuColStr = formatPricePhp(temp.mcbu);
                                            temp.noOfPayments -= 1;
                                            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
                                            temp.mcbuCol = 0;
                                            temp.mcbuColStr = '-';
                                        }
                                    }
        
                                    temp.advanceDays = temp.advanceDays - 1;
                                    temp.targetCollection = 0;
                                    temp.targetCollectionStr = '-';
                                    temp.activeLoan = 0;
                                    temp.paymentCollection = 0;
                                    temp.mispayment = false;
                                    temp.mispaymentStr = 'No';
                                    temp.error = false;
                                } else {
                                    temp.error = true;
                                    toast.error('Error occured. Yesterday transaction is not an Advanced payment');
                                }
                            } else if (remarks.value === 'reloaner-wd') {
                                if (temp.remarks && (temp.remarks?.value?.startsWith('offset') || temp.remarks?.value?.startsWith('reloaner-'))) {
                                    temp.mcbu = temp.prevData.mcbu;
                                }
                                
                                if (temp.mcbu !== temp.prevData.mcbu && temp.mcbuCol && temp.mcbuCol > 0) {
                                    temp.mcbu = temp.mcbu - temp.mcbuCol;
                                }
    
                                temp.mcbuCol = 0;
                                temp.mcbuColStr = '-';
                                temp.mcbuWithdrawal = temp.mcbu;
                                temp.mcbu = 0;
                                temp.mcbuStr = '-';
                                temp.mcbuWithdrawalStr = temp.mcbuWithdrawal > 0 ? formatPricePhp(temp.mcbuWithdrawal) : '-';
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
                                            const finalMcbu = (excessMcbu * 10) + 10;
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
                                            temp.mcbuCol = 10;
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
                                const today = moment(currentDate);
                                const endDate = moment(temp.endDate);
    
                                // if (today.diff(endDate, 'days') > 0) {
                                    const paymentCollection = parseFloat(temp.paymentCollection);
                                    let loanBalance = parseFloat(temp.loanBalance);
    
                                    if (paymentCollection > 0) {
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
    
                                    temp.excused = true;
                                    temp.mcbuError = false;
                                    if (temp.mcbuCol && temp.mcbuCol > 0) {
                                        temp.mcbu = temp.mcbu - temp.mcbuCol;
                                        temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                                    }
    
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = '-';
                                // } else {
                                //     temp.error = true;
                                //     toast.error(`Invalid remarks. Loan is not yet past ${temp.loanTerms} days.`);
                                // }
                            } else {
                                if (remarks.value === 'reloaner-cont' && (temp.remarks && (temp?.remarks?.value.startsWith("reloaner-") || temp?.remarks?.value?.startsWith('offset')))) {
                                    temp.mcbu = temp.prevData.mcbu;
                                    temp.mcbuCol = 0;
                                    temp.mcbuColStr = '-';
                                    if (temp.excess && temp.excess > 0) {
                                        const excessMcbu = temp.excess / temp.activeLoan;
                                        const finalMcbu = (excessMcbu * 10) + 10;
                                        temp.mcbuCol = finalMcbu;
                                        temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
                                        temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
                                    }
                                    temp.mcbuStr = formatPricePhp(temp.mcbu);
                                }
    
                                temp.closeRemarks = '';
                                setCloseLoan();
                                temp.error = false;
                                temp.mcbuError = false;
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                            }
    
                            // update the mcbuHistory
                            temp.mcbuHistory = {
                                mcbu: temp.mcbu,
                                mcbuCol: temp.mcbuCol
                            }
    
                            if (temp.hasOwnProperty('history')) {
                                temp.history = {
                                    ...temp.history,
                                    remarks: remarks
                                }
                            } else {
                                temp = setHistory(temp);
                            }
    
                            temp.remarks = remarks;
                        }   
                    }
                }

                return temp;
            });

            dispatch(setCashCollectionGroup(list));
        }
    }

    const setHistory = (selected, prevLoanBalance) => {
        let temp = {...selected};

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

    const handleRevert = (e, selected, index) => {
        // remove next loans (approved or pending)
        // target collection turn 0 (because of reloan)
        e.stopPropagation();
        let origList = [...data];
        let temp = {...selected};
        temp.mcbuWithdrawFlag = false;
        temp.dcmc = false;
        let allow = true;
        if (temp.status === 'completed') {
            allow = temp.fullPaymentDate === currentDate;
        }

        if (allow && temp.hasOwnProperty('prevData') && temp.prevData) {
            temp.amountRelease = temp.prevData.amountRelease;
            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
            temp.paymentCollection = parseFloat(temp.prevData.paymentCollection);
            temp.excess = temp.prevData.excess;
            temp.excessStr = temp.prevData.excess > 0 ? formatPricePhp(temp.prevData.excess) : '-';
            temp.mispayment = false;
            temp.mispaymentStr = 'No';
            temp.activeLoan = temp.prevData.activeLoan;
            temp.loanBalance = temp.prevData.loanBalance;
            temp.loanBalanceStr = formatPricePhp(temp.prevData.loanBalance);
            temp.noOfPayments = temp.noOfPayments !== 0 ? temp.noOfPayments - 1 : temp.noOfPayments;
            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + temp.loanTerms;
            temp.total = temp.prevData.total;
            temp.totalStr = formatPricePhp(temp.prevData.total);
            temp.targetCollection = temp.activeLoan === 0 ? temp.prevData.activeLoan : temp.activeLoan;
            temp.targetCollectionStr = formatPricePhp(temp.targetCollection);   
            temp.fullPayment = 0;
            temp.fullPaymentStr = '-';
            temp.fullPaymentDate = null;
            temp.pastDue = 0;
            temp.pastDueStr = '-'
            temp.remarks = '';
            temp.advanceDays = temp.prevData.advanceDays;
            temp.mcbu = temp.prevData.mcbu;
            temp.mcbuStr = formatPricePhp(temp.mcbu);
            temp.mcbuCol = 0;
            temp.mcbuColStr = formatPricePhp(temp.mcbuCol);
            temp.mcbuWithdrawal = 0;
            temp.mcbuWithdrawalStr = formatPricePhp(temp.mcbuWithdrawal);
            temp.mcbuWithdrawFlag = false;
            temp.clientStatus = "active";
            temp.delinquent = false;
            temp.status = 'active';
            temp.reverted = true;
            delete temp.history;
            delete temp.fullPaymentDate;

            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
            setRevertMode(true);
        } else {
            toast.error("Data can't be reverted!");
        }
    }

    const handleNewRevert = async () => {
        setShowWarningDialog(false);
        if (selectedSlot) {
            setLoading(true);
            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/revert-transaction', selectedSlot);
            if (response.success) {
                setTimeout(() => {
                    setLoading(false);
                    toast.success(`Slot No ${selectedSlot.slotNo} was successfuly reverted! Please wait reloading data.`);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                }, 1000);
            }
        } else {
            toast.error('No slot selected!');
        }
    }

    const handleReloan = (e, selected) => {
        e.stopPropagation();

        if (changeRemarks) {
            toast.error('You have unsaved changes. Please click Submit button before using this function.');
        } else if ((selected.remarks && (selected.remarks.value === "pending" || selected.remarks.value?.startsWith('reloaner'))) || (selected.status === 'completed' && !selected.remarks)) {
            setShowAddDrawer(true);
            selected.group = currentGroup;
            setLoan(selected);
        } else {
            toast.error("This client can't reloan because it is not tagged as reloaner or pending in remarks.");
        }
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        getCashCollections();
    }

    const handleSetCloseAccountRemarks = () => {
        const list = data.map(cc => {
            let temp = {...cc};
            
            if (cc.loanId === closeLoan.loanId) {
                temp.closeRemarks = closeAccountRemarks;
            }
            
            return temp;
        });

        dispatch(setCashCollectionGroup(list));
        setShowRemarksModal(false);
    }

    const calculateInterest = (e, selected, index) => {
        e.stopPropagation();
        if (parseFloat(selected.mcbu) > 499) {
            let origList = [...data];
            let temp = {...selected};

            const mcbuRateDecimal = mcbuRate / 100;

            temp.mcbuInterest = selected.mcbu * mcbuRateDecimal;

            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
        } else {
            toast.error('Client has not reached the minimum of 500 MCBU to accumulate interest.');
        }
    }

    const addBlankAndTotal = (dataArr) => {
        let cashCollection = [...dataArr];
        const groupCapacity = currentGroup && currentGroup.capacity;
        const totalIdx = cashCollection.findIndex(cc => cc.status === 'totals');
       
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
                    targetCollectionStr: '-',
                    excessStr: '-',
                    paymentCollectionStr: '-',
                    mcbuStr: '-',
                    mcbuColStr: '-',
                    mcbuWithdrawalStr: '-',
                    mcbuReturnAmtStr: '-',
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

        return cashCollection;
    }

    useEffect(() => {
        const getListBranch = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';

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
    
                if (currentUser.role.rep < 3 && selectedBranchSubject.value) {
                    branches = [branches.find(b => b._id === selectedBranchSubject.value)];
                }
                
                dispatch(setBranchList(branches));
            } else {
                toast.error('Error retrieving branches list.');
            }
        }

        if (branchList && branchList.length == 0) {
            getListBranch();
        }
    }, [branchList]);

    useEffect(() => {
        let mounted = true;

        const getCurrentGroup = async () => {
            if (uuid) {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
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

        if (dateFilter === null) {
            setDateFilter(currentDate);
        }

        return () => {
            mounted = false;
        };
    }, [uuid, currentDate]);

    useEffect(() => {
        const getListGroup = async (selectedLO) => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ mode: "filter", occurence: 'daily', loId: selectedLO });

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
        }

        if (groupList && groupList.length == 0) {
            if (selectedLOSubject.value && selectedLOSubject.value.length > 0) {
                getListGroup(selectedLOSubject.value);
            } else if (currentUser.role.rep === 4) {
                getListGroup(currentUser._id);
            }
        }
    }, [groupList]);

    useEffect(() => {
        let cashCollections = addBlankAndTotal(groupClients)

        setData(cashCollections);
        setAllData(cashCollections);
    }, [groupClients]);

    useEffect(() => {
        if (dateFilterSubject.value && currentGroup) {
            const date = moment(new Date(dateFilterSubject.value)).format('YYYY-MM-DD');
            if (date !== currentDate) {
                getCashCollections(date);
                setDateFilter(date);
            }
        }
    }, [currentGroup]);

    return (
        <Layout header={false} noPad={true} hScroll={false}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} showSaveButton={currentUser.role.rep > 2 ? (isWeekend || isHoliday) ? false : editMode : false}
                        handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} allowMcbuWithdrawal={allowMcbuWithdrawal} hasDraft={hasDraft}
                        dateFilter={dateFilter} setDateFilter={setDateFilter} handleDateFilter={handleDateFilter} currentGroup={uuid} revertMode={revertMode}
                        groupFilter={groupFilter} handleGroupFilter={handleGroupFilter} groupTransactionStatus={groupSummaryIsClose ? 'close' : 'open'}
                        changeRemarks={changeRemarks} />}
                    <div className="px-4 mt-[12rem] mb-[4rem] overflow-y-auto min-h-[55rem]">
                        <div className="bg-white flex flex-col rounded-md pt-0 pb-2 px-6 overflow-auto h-[46rem]">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="sticky top-0 column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider bg-white z-20">
                                        <th className="p-2 text-center">Slot #</th>
                                        <th className="p-2 text-center">Client Name</th>
                                        <th className="p-2 text-center">Co-Maker</th>
                                        <th className="p-2 text-center">Cycle #</th>
                                        <th className="p-2 text-center">MCBU</th>
                                        <th className="p-2 text-center">Total Loan Release w/ SC</th>
                                        <th className="p-2 text-center">Total Loan Balance</th>
                                        <th className="p-2 text-center">Current Releases</th>
                                        <th className="p-2 text-center"># of Payments</th>
                                        <th className="p-2 text-center">MCBU Collection</th>
                                        <th className="p-2 text-center">Target Collection</th>
                                        <th className="p-2 text-center">Excess</th>
                                        <th className="p-2 text-center">Actual Collection</th>
                                        <th className="p-2 text-center">MCBU Refund</th>
                                        <th className="p-2 text-center">MCBU Interest</th>
                                        <th className="p-2 text-center">MCBU Return Amt</th>
                                        <th className="p-2 text-center">Full Payment</th>
                                        <th className="p-2 text-center">Mispay</th>
                                        <th className="p-2 text-center"># of Mispay</th>
                                        <th className="p-2 text-center">Past Due</th>
                                        <th className="p-2 text-center">Remarks</th>
                                        <th className="p-2 text-center">TFR</th>
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
                                        } else if (cc.excused) {
                                            rowBg = 'bg-orange-100';
                                        } else if (cc.latePayment) {
                                            rowBg = 'bg-pink-100';
                                        }

                                        if (cc?.transferred) {
                                            rowBg = 'bg-violet-100';
                                        } else if (cc.transferStr === 'TCR') {
                                            rowBg = 'bg-blue-100';
                                        }

                                        if (cc.error || cc.mcbuError) {
                                            rowBg = 'bg-red-100';
                                        }

                                        return (
                                            <tr key={index} className={`w-full hover:bg-slate-200 border-b border-b-gray-300 font-proxima
                                                                ${rowBg} ${cc.status === 'totals' ? 'font-bold font-proxima-bold text-red-400' : 'text-gray-600'}`} >
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.status !== 'totals' ? cc.slotNo : '' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer" onClick={() => handleShowClientInfoModal(cc)}>{ cc.fullName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.coMaker }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.loanCycle }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mcbuStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.currentReleaseAmountStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noOfPaymentStr }</td>{/** after submitting please update the no of payments **/}
                                                {/* <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { cc.mcbuColStr }
                                                </td> */}
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && currentUser.role.rep > 2 && cc.status === 'active' && editMode
                                                            && (cc.dcmc || (cc.draft && cc.dcmc)) ) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={`${cc.clientId}-mcbuCol`} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'mcbuCol')}
                                                                onClick={(e) => e.stopPropagation()} value={cc.mcbuCol ? cc.mcbuCol : 0} tabIndex={index + 1} onWheel={(e) => e.target.blur()}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !cc.reverted || cc.reverted || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.mcbuColStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && currentUser.role.rep > 2 && cc.status === 'active' && editMode && (!cc.hasOwnProperty('_id') 
                                                        || (cc?.origin && cc?.origin === 'automation-trf') || cc?.reverted || cc.draft) && !cc?.dcmc) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'amount', cc.activeLoan)}
                                                                onClick={(e) => e.stopPropagation()} value={cc.paymentCollection} tabIndex={index + 1} onWheel={(e) => e.target.blur()}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !cc.reverted  || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.paymentCollectionStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { cc.mcbuWithdrawalStr }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuInterestStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuReturnAmtStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noMispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                    { cc.pastDueStr }
                                                </td>
                                                { (!isWeekend && !isHoliday && !filter && ((currentUser.role.rep > 2 && (cc.status === 'active' || cc.status === 'completed') && (editMode && !groupSummaryIsClose) 
                                                    && (!cc.hasOwnProperty('_id') || (cc?.origin && cc?.origin === 'automation-trf') || cc?.reverted)) || 
                                                    (((cc.remarks && cc.remarks.value?.startsWith('reloaner') && cc.status !== "tomorrow") || (cc.status === 'completed') && !cc.remarks) && !groupSummaryIsClose)
                                                    && (cc.remarks && cc.remarks.value?.startsWith('reloaner') && cc.fullPaymentDate !== currentDate) && cc.status !== 'pending' || cc.draft
                                                    || (cc.remarks && (cc.remarks.value?.startsWith('collection-') || cc.remarks.value?.startsWith('offset-'))
                                                    || (cc.status == 'completed' && cc.remarks == '')))) ? (
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
                                                                    { cc?.history?.remarks?.label ? cc?.history?.remarks?.label : cc.remarks?.label ? cc.remarks.label : '-' }
                                                                </React.Fragment>
                                                            ) }
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.transferStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <React.Fragment>
                                                        {(!isWeekend && !isHoliday && currentUser.role.rep > 2 && !groupSummaryIsClose) && (
                                                            <div className='flex flex-row p-2'>
                                                                {(currentUser.role.rep === 3 && cc.hasOwnProperty('_id') && !filter && !cc.draft && !cc.reverted && cc?.prevData) && <ArrowUturnLeftIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleShowWarningDialog(e, cc)} />}
                                                                {(cc.status === 'completed' && !prevDraft && ((cc.remarks && cc.remarks.value?.startsWith('reloaner')) || (cc.status === 'completed' && !cc.remarks))) && <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />}
                                                                {(!filter && !editMode && cc.status !== 'closed' && currentMonth === 11 && !cc.draft) && <CalculatorIcon className="w-5 h-5 mr-6" title="Calculate MCBU Interest" onClick={(e) => calculateInterest(e, cc, index)} />}
                                                                {/* add new */}
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
                    {loan && <AddUpdateLoan mode={'reloan'} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />}
                    <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="60rem">
                        <ClientDetailPage />
                    </Modal>
                    <Dialog show={showRemarksModal}>
                        <h2>Close Account Remarks</h2>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        <textarea rows="4" value={closeAccountRemarks} onChange={(e) => setCloseAccountRemarks(e.target.value)}
                                            className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                        border-gray-300 focus:ring-blue-500 focus:border-main" 
                                            placeholder="Enter remarks..."></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                            <div className='flex flex-row'>
                                <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowRemarksModal(false)} />
                                <ButtonSolid label="Submit" type="button" className="p-2 mr-3" onClick={handleSetCloseAccountRemarks} />
                            </div>
                        </div>
                    </Dialog>
                    <Dialog show={showWaningDialog}>
                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                            <div className="sm:flex sm:items-start justify-center">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                    <div className="mt-2">
                                        <p className="text-2xl font-normal text-dark-color">Are you sure you want to revert today's transaction?</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowWarningDialog(false)} />
                            <ButtonSolid label="Yes, revert" type="button" className="p-2" onClick={handleNewRevert} />
                        </div>
                    </Dialog>
                </div>
            )}
        </Layout>
    );
}


export default CashCollectionDetailsPage;