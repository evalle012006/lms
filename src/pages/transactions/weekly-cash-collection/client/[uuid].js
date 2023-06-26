import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from 'react-hot-toast';
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
import { LOR_WEEKLY_REMARKS } from '@/lib/constants';

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
    const [dateFilter, setDateFilter] = useState(currentDate);
    const [loan, setLoan] = useState();
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();
    const [closeLoan, setCloseLoan] = useState();
    const remarksArr = LOR_WEEKLY_REMARKS;
    const [filter, setFilter] = useState(false);
    const maxDays = 24;
    const [groupFilter, setGroupFilter] = useState();
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);
    const [allowMcbuWithdrawal, setAllowMcbuWithdrawal] = useState(false);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const [mcbuRate, setMcbuRate] = useState(transactionSettings.mcbu || 8);

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
        router.push('/transactions/weekly-cash-collection/client/' + selected._id);
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
        const type = date ? 'filter' : 'current';
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' 
            + new URLSearchParams({ date: date ? date : currentDate, mode: 'weekly', groupId: uuid, type: type });
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];

            let dataCollection = response.data.collection;
            let transactionStatus;
            if (type === 'filter') {
                dataCollection = dataCollection.filter(cc => cc.hasOwnProperty('loanId') && cc.loanId !== null );
                transactionStatus = dataCollection.filter(cc => cc.groupStatus === 'closed');
            } else {
                transactionStatus = dataCollection.filter(cc => cc?.current[0]?.groupStatus === 'closed');   
            }

            if (transactionStatus.length === 0 && (!date || currentDate === date)) {
                setEditMode(true);
                setGroupSummaryIsClose(false);

                const selectedGroup = response.data.collection.length > 0 ? response.data.collection[0].group : {};
                if (selectedGroup && selectedGroup.day !== dayName) {
                    setEditMode(false);
                }
            } else {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }
            
            dataCollection.map(cc => {
                let collection;
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
                        targetCollection: cc.hasOwnProperty('prevData') ? cc.prevData.activeLoan : 0,
                        targetCollectionStr: cc.hasOwnProperty('prevData') ? formatPricePhp(cc.prevData.activeLoan) : 0,
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
                        prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null
                    }

                    setEditMode(false);
                } else if (cc.status === "closed") {
                    let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + maxDays : '-';
                    if (date) {
                        numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + maxDays : '-';
                    }
                    let mcbuCol = 0;
                    let mcbu = cc.mcbu;
                    let mcbuWithdrawal = cc.mcbuWithdrawal;
                    let mcbuReturnAmt = cc.mcbuReturnAmt;
                    if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                        const current = cc.current.find(cur => cur?.origin !== 'automation-trf');
                        if (current) {
                            mcbu = current.mcbu;
                            mcbuCol = current.mcbuCol;
                            mcbuWithdrawal = current.mcbuWithdrawal;
                            mcbuReturnAmt = current.mcbuReturnAmt;   
                        }
                    }
                    collection = {
                        ...cc,
                        group: cc.group,
                        loId: cc.loId,
                        loanId: cc.loanId,
                        branchId: cc.branchId,
                        groupId: cc.groupId,
                        groupName: cc.groupName,
                        clientId: cc.clientId,
                        slotNo: cc.slotNo,
                        fullName: cc.client.lastName + ', ' + cc.client.firstName,
                        loanCycle: cc.history?.loanCycle,
                        mispayment: cc.mispayment,
                        mispaymentStr: cc.mispaymentStr,
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
                        activeLoan: cc.history?.activeLoan,
                        targetCollection: cc.history?.activeLoan,
                        targetCollectionStr: cc.history?.activeLoan > 0 ? formatPricePhp(cc.history?.activeLoan) : '-',
                        amountRelease: '-',
                        amountReleaseStr: '-',
                        loanBalance: '-',
                        loanBalanceStr: '-',
                        paymentCollection: cc.history?.collection ? cc.history?.collection : 0,
                        paymentCollectionStr: cc.history?.collection > 0 ? formatPricePhp(cc.history?.collection) : '-',
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
                        prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null
                    }

                    setEditMode(false);
                } else if (cc.status !== "closed") {
                    let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + maxDays : '-';
                    if (date) {
                        numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + maxDays : '-';
                    }
                    collection = {
                        client: cc.client,
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
                        mispaymentStr: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? 'No' : '-',
                        noMispayment: date ? cc.noMispayment ? cc.noMispayment : 0 : cc.mispayment,
                        noMispaymentStr: numMispayment,
                        collection: 0,
                        excess: cc.excess,
                        excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments : 0,
                        noOfPaymentStr: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments + ' / ' + maxDays : '-',
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
                        activeLoan: cc.activeLoan,
                        targetCollection: cc.activeLoan,
                        targetCollectionStr: cc.activeLoan > 0 ? formatPricePhp(cc.activeLoan) : '-',
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
                        remarks: cc.remarks ? cc.remarks : '',
                        pastDue: cc.pastDue ? cc.pastDue : 0,
                        pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                        clientStatus: cc.client.status ? cc.client.status : '-',
                        delinquent: cc.client.delinquent,
                        fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                        history: cc.hasOwnProperty('history') ? cc.history : null,
                        advanceDays: cc.advanceDays,
                        status: cc.status
                    }

                    delete cc._id;
                    if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                        const current = cc.current.find(cur => cur?.origin !== 'automation-trf');
                        if (current) {
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
                            collection.pastDue = current.pastDue ? current.pastDue : 0;
                            collection.pastDueStr = current.pastDue ? formatPricePhp(current.pastDue) : '-';
                            collection.mcbuCol = current.mcbuCol;
                            collection.mcbuColStr = current.mcbuCol > 0 ? formatPricePhp(current.mcbuCol) : '-';
                            collection.mcbuWithdrawal = current.mcbuWithdrawal;
                            collection.mcbuWithdrawalStr = current.mcbuWithdrawal > 0 ? formatPricePhp(current.mcbuWithdrawal) : '-';
                            collection.mcbuReturnAmt = current.mcbuReturnAmt;
                            collection.mcbuReturnAmtStr = current.mcbuReturnAmt > 0 ? formatPricePhp(current.mcbuReturnAmt) : '-';
                            collection.mcbuInterest = current.mcbuInterest ? cc.mcbuInterest : 0,
                            collection.mcbuInterestStr = current.mcbuInterest > 0 ? formatPricePhp(current.mcbuInterest) : '-',
                            collection.advanceDays = current.advanceDays;

                            if (current?.origin) {
                                collection.origin = current.origin;
                                if (collection.origin !== 'pre-save') {
                                    setEditMode(false);
                                }
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
    
                    if (cc.loanBalance <= 0) {
                        if (cc.fullPaymentDate === currentDate) {
                            collection.paymentCollection = cc.history ? cc.history?.collection : 0;
                            collection.paymentCollectionStr = formatPricePhp(collection.paymentCollection);
                        }

                        collection.notCalculate = true;
                        collection.remarks = cc.history ? cc.history?.remarks : '-';
                    }
                } else {
                    return;
                }

                if (!date && cc?.pastDue) {
                    // if pastDue === loanBalance then make target collection 0
                    if (collection.pastDue === collection.loanBalance) {
                        collection.targetCollection = 0;
                        collection.activeLoan = 0;
                    }
                }

                collection.groupDay = collection.group.day;
                collection.mcbuWithdrawFlag = false;

                cashCollection.push(collection);
            });

            response.data.tomorrowPending.map(loan => {
                const currentLoan = cashCollection.find(l => l.slotNo === loan.slotNo && l.clientId === loan.clientId);
                if (currentLoan && currentLoan.status !== 'pending') {
                    const index = cashCollection.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) { // fullpayment with pending/tomorrow
                        cashCollection[index] = {
                            client: currentLoan.client,
                            slotNo: loan.slotNo,
                            loanId: loan._id,
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
                            targetCollection: currentLoan.history.activeLoan,
                            targetCollectionStr: formatPricePhp(currentLoan.history.activeLoan),
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
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false
                        };
                        if (loan.current.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                        }
                    } else if (currentLoan.status !== 'active') {
                        cashCollection[index] = {
                            client: currentLoan.client,
                            slotNo: loan.slotNo,
                            loanId: loan._id,
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
                            status: loan.status === 'active' ? 'tomorrow' : 'pending'
                        };

                        if (loan.current.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                        }
                    }
                } else {
                    let pendingTomorrow = {
                        _id: loan._id,
                        client: loan.client,
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
                        paymentCollectionStr: '-',
                        remarks: '-',
                        pastDueStr: '-',
                        fullPaymentStr: '-',
                        status: loan.status === 'active' ? 'tomorrow' : 'pending'
                    };

                    cashCollection.push(pendingTomorrow);
                }
            });

            dispatch(setCashCollectionGroup(cashCollection));
            setLoading(false);
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
                if (collection.status === 'active') {
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease !== '-' ? collection.amountRelease : 0 : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance !== '-' ? collection.loanBalance : 0 : 0;
                }

                if (collection.status === 'tomorrow' || (collection.hasOwnProperty('tomorrow') && collection.tomorrow)) {
                    totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount !== '-' ? collection.currentReleaseAmount : 0 : 0;
                }

                if (collection.fullPaymentDate === currentDate && collection.status === "completed") {
                    totalTargetLoanCollection += collection.history ? collection.history.activeLoan : 0;
                }

                if (!collection.remarks || (collection.remarks && collection.remarks?.value !== 'delinquent' && !collection.remarks.value?.startsWith("excused-"))) {
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
            mcbuStr: totalMcbu > 0 ? formatPricePhp(totalMcbu) : '-',
            mcbuColStr: totalMcbuCol > 0 ? formatPricePhp(totalMcbuCol) : '-',
            mcbuWithdrawalStr: totalMcbuWithdraw > 0 ? formatPricePhp(totalMcbuWithdraw) : '-',
            mcbuReturnAmtStr: totalMcbuReturn > 0 ? formatPricePhp(totalMcbuReturn) : '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest > 0 ? formatPricePhp(totalMcbuInterest) : '-',
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

    const validation = () => {
        let errorMsg = new Set();

        groupClients && groupClients.map(cc => {
            if (cc.status === 'active') {
                if (cc.group.day === dayName) {
                    if (cc.error) {
                        errorMsg.add('Error occured. Please double check the Actual Collection column.');
                    } else if (parseFloat(cc.paymentCollection) === 0 && !cc.remarks) {
                        errorMsg.add('Error occured. Please select a remarks for 0 or no payment Actual Collection.');
                    } else if ((parseFloat(cc.paymentCollection) === 0 || (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < parseFloat(cc.activeLoan))) 
                        && (!cc.remarks || (cc.remarks && (!cc.remarks.value?.startsWith('delinquent') && cc.remarks.value !== "past due" && !cc.remarks.value?.startsWith('excused')))) ) {
                        errorMsg.add("Error occured. 0 payment should be mark either PAST DUE, DELINQUENT OR EXCUSED in remarks.");
                    } else if ((cc.remarks && cc.remarks.value === "past due") && parseFloat(cc.pastDue) < parseFloat(cc.targetCollection)) {
                        errorMsg.add("Error occured. Past due is less than the target collection.");
                    } else if (cc.remarks && (cc.remarks.value === "past due" || cc.remarks.value?.startsWith('excused-') || cc.remarks.value?.startsWith('delinquent')) ) {
                        if (cc.paymentCollection > 0 && cc.paymentCollection % 10 !== 0) {
                            errorMsg.add("Error occured. Amount collection is not divisible by 10");
                        }
                    } else if (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < cc.activeLoan) {
                        errorMsg.add("Actual collection is below the target collection.");
                    } else if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) !== 0 && cc.loanBalance !== 0) {
                        if (cc.remarks && (cc.remarks.value !== "past due" && !cc.remarks.value?.startsWith('excused-') && !cc.remarks.value?.startsWith('delinquent')) ) {
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
    
                    if (parseFloat(cc.loanBalance) && (cc.remarks && cc.remarks.value?.startsWith('offset'))) {
                        errorMsg.add('Error occured. Please input the full balance amount before closing the loan account.');
                    }
                }

                if (cc.mcbuError) {
                    errorMsg.add('Error occured. Please double check the MCBU Collection/Withdrawal column.');
                } 
                
                if (!cc.mcbuCol || parseFloat(cc.mcbuCol) < 50) {
                    if (!cc.remarks || (cc.remarks 
                        && (cc.remarks.value !== 'past due' && cc.remarks.value?.startsWith('excused-')
                        && cc.remarks.value?.startsWith('delinquent') && cc.remarks.value?.startsWith('offset') && cc.remarks.value !== 'past due collection'))) {
                            console.log(cc)
                        errorMsg.add('Error occured. Invalid MCBU Collection.');
                    }
                } else if (parseFloat(cc.mcbuCol) > 50 && parseFloat(cc.mcbuCol) % 10 !== 0) {
                    errorMsg.add('Error occured. MCBU collection should be divisible by 10.');
                }

                if (cc.mcbuWithdrawFlag) {
                    if (!cc.mcbuWithdrawal || parseFloat(cc.mcbuWithdrawal) > parseFloat(cc.mcbu)) {
                        errorMsg.add('Error occured. Invalid MCBU Withdraw amount.');
                    } else if (parseFloat(cc.mcbuWithdrawal) < 10) {
                        errorMsg.add('Error occured. MCBU withdrawal amount is less than ₱10.');
                    }
                }
            } else if (cc.status === 'completed' && (cc.remarks && !(cc.remarks.value && (cc.remarks.value === 'pending' || cc.remarks.value === 'reloaner' || cc.remarks.value?.startsWith('offset'))))) {
                errorMsg.add("Invalid remarks. Please set it to PENDING, RELOANER OR OFFSET.");
            }
        });

        return errorMsg;
    }

    const handlePaymentValidation = (e, selected, index, col) => {
        const value = e.target.value ? parseFloat(e.target.value) : 0;
        let temp = {...selected};
        switch (col) {
            case 'mcbuCol':
                if (!value || value < 50) {
                    toast.error('Error occured. Minimum MCBU collection is 50.');
                    temp.mcbuError = true;
                } else if (value > 50 && value % 10 !== 0) {
                    toast.error('Error occured. MCBU collection must be divisible by 10.');
                    temp.mcbuError = true;
                } else {
                    temp.mcbuError = false;
                }
                break;
            case 'mcbuWithdrawal':
                if (!value || value > parseFloat(temp.mcbu)) {
                    toast.error('Error occured. Invalid MCBU withdrawal amount.');
                    temp.mcbuError = true;
                } else if (value > parseFloat(temp.mcbu)) {
                    toast.error('Error occured. MCBU withdrawal amount is greater than the MCBU amount.');
                    temp.mcbuError = true;
                } else if (value < 10) {
                    toast.error('Error occured. MCBU withdrawal amount is less than ₱10.');
                    temp.mcbuError = true;
                }
                break;
            default: break;
        }

        let tempList = [...data];
        tempList[index] = temp;

        tempList.sort((a, b) => { return a.slotNo - b.slotNo; });
        dispatch(setCashCollectionGroup(tempList));
    }

    const handleSaveUpdate = async () => {
        setLoading(true);
        
        let save = false;

        const transactionStatus = data.filter(cc => cc.groupStatus === 'closed');
        if (transactionStatus.length > 0) {
            toast.error('Updating this record is not allowed since the Group Summary is already closed by the Branch Manager.');
        } else {
            const errorMsgArr = Array.from(validation());
            if (errorMsgArr.length > 0) {
                let errorMsg;
                errorMsgArr.map(msg => {
                    errorMsg = errorMsg ? errorMsg + '\n \n' + msg  : msg;
                });
                toast.error(errorMsg, { autoClose: 5000 });
                setLoading(false);
            } else {
                let dataArr = data.filter(cc => cc.status !== 'open').map(cc => {
                    let temp = {...cc};
                    if (cc.status !== 'totals') {
                        temp.groupDay = temp.group.day;
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
                    delete temp.error;
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

                    if (cc.hasOwnProperty('_id')) {
                        temp.modifiedBy = currentUser._id;
                        temp.dateModified = moment(currentDate).format('YYYY-MM-DD');
                    } else {
                        temp.insertedBy = currentUser._id;
                        temp.dateAdded = moment(currentDate).format('YYYY-MM-DD');
                    }

                    save = true;
                    
                    if (cc.status === 'active') {
                        if (currentUser.role.rep === 4) {
                            temp.loId = currentUser._id;
                        } else {
                            temp.loId = currentGroup && currentGroup.loanOfficerId;
                        }
    
                        temp.loanBalance = parseFloat(temp.loanBalance);
                        temp.amountRelease = parseFloat(temp.amountRelease);

                        if (!temp.paymentCollection || temp.paymentCollection <= 0) {
                            if (temp.remarks && temp.remarks.value !== "excused advance payment") {
                                temp.paymentCollection = 0;
                                temp.mispayment = true;
                                temp.mispaymentStr = 'Yes';
                            }
                        }
    
                        if (temp.loanBalance <= 0) {
                            temp.status = 'completed';
                        }
    
                        if (temp.status === 'completed') {
                            temp.fullPaymentDate = temp.fullPaymentDate ? temp.fullPaymentDate : moment(currentDate).format('YYYY-MM-DD');
                        }
                        
                        if (typeof temp.remarks === 'object') {
                            if (temp.remarks.value && temp.remarks.value?.startsWith('offset')) {
                                temp.status = 'closed';
                                temp.clientStatus = 'offset';
                            }
                        }
                    }

                    // if admin it should not override what it is currently saved
                    temp.groupStatus = 'pending';
                
                    return temp;   
                }).filter(cc => cc.status !== "totals");

                const selectedGroup = data.length > 0 ? data[0].group : {};
                if (selectedGroup && selectedGroup.day !== dayName) {
                    dataArr = dataArr.filter(cc => cc.mcbuWithdrawFlag);
                }

                // console.log(dataArr)

                if (save) {
                    let cashCollection;
                    if (editMode) {
                        cashCollection = {
                            dateModified: currentDate,
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr),
                            currentDate: currentDate
                        };
                    } else {
                        cashCollection = {
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr),
                            mode: 'weekly',
                            currentDate: currentDate
                        };
                    }
            
                    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', cashCollection);
                    if (response.success) {
                        setLoading(false);
                        toast.success('Payment collection successfully submitted.');
            
                        setTimeout(() => {
                            setLoading(true);
                            getCashCollections();
                        }, 1000);
                    }
                } else {
                    toast.warning('No active data to be saved.');
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
                        if (temp.hasOwnProperty('prevData') && temp.prevData) {
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
                            temp.targetCollection = temp.activeLoan;
                            temp.targetCollectionStr = formatPricePhp(temp.activeLoan);
                            temp.remarks = '';
                            temp.pastDue = temp.prevData.pastDue;
                            temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
                            temp.status = 'active';
                            temp.advanceDays = temp.prevData.advanceDays;
                            temp.mcbu = temp.prevData.mcbu;
                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                            // temp.mcbuCol = 0;
                            // temp.mcbuColStr = '-';
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

                        if (temp.mcbuCol > 0) {
                            temp.mcbu = temp.mcbu + temp.mcbuCol;
                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        }

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
                            if (parseFloat(payment) === 0) {
                                temp.noOfPayments = temp.noOfPayments <= 0 ? 0 : temp.noOfPayments - 1;
                                temp.mispayment = true;
                                temp.mispaymentStr = 'Yes';
                            } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                                temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                                temp.excessStr = formatPricePhp(temp.excess);
                                temp.mispayment = false;
                                temp.mispaymentStr = "No";
                                temp.noOfPayments = temp.noOfPayments + 1;
                                // temp.remarks = { label: 'Advance Payment', value: 'advance payment'};
                            } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                                temp.excess =  0;
                                temp.mispayment = true;
                                temp.mispaymentStr = 'Yes';
                                // temp.noOfPayments = temp.noOfPayments + 1;
                                temp.error = true;
                                // temp.remarks = { label: 'Excused', value: 'excused'};
                            } else {
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
                        } 
                        // else if (parseFloat(payment) > 0 && parseFloat(payment) < targetCollection) {
                        //     // toast.error("Actual collection is below the target collection.");
                        //     temp.error = true;
                        //     temp.paymentCollection = parseFloat(payment);
                        // } 
                        else if (parseFloat(payment) % parseFloat(temp.activeLoan) !== 0) {
                            // toast.error("Actual collection should be divisible by 100.");
                            temp.paymentCollection = payment;
                            if (temp.remarks && (temp.remarks.value !== "past due" && !temp.remarks.value?.startsWith('excused') && !temp.remarks.value?.startsWith('delinquent')) ) {
                                temp.error = true;
                            }
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

                        if (mcbuCol < 50) {
                            temp.mcbuError = true;
                        // } else if (parseFloat(mcbuCol) > 50 && (cc.remarks && (cc.remarks.value === 'advance payment' || cc.remarks.value === 'reloaner'))) {
                        //     const excessMcbu = cc.excess / cc.activeLoan;
                        //     const finalMcbu = (excessMcbu * 50) + 50;
                        //     temp.mcbuCol = finalMcbu;
                        //     temp.mcbuError = false;
                        //     temp.mcbuColStr = formatPricePhp(finalMcbu);
                        //     temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + finalMcbu : 0 + finalMcbu;
                        //     temp.mcbuStr = formatPricePhp(temp.mcbu);
                        //     temp.prevData.mcbuCol = finalMcbu;
                        } else {
                            temp.mcbuError = false;
                            temp.mcbuCol = mcbuCol;
                            temp.mcbuColStr = formatPricePhp(mcbuCol);
                            temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + mcbuCol : 0 + mcbuCol;
                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                            temp.prevData.mcbuCol = mcbuCol;
                        }
                    }

                    return temp;
                });

                const totalsObj = calculateTotals(list);
                list[totalIdx] = totalsObj;

                list.sort((a, b) => { return a.slotNo - b.slotNo; });
                dispatch(setCashCollectionGroup(list));
            } else {
                let list = data.map((cc, idx) => {
                    let temp = {...cc};

                    if (idx === index) {
                        if (temp?.prevData) {
                            temp.mcbu = temp.prevData.mcbu;
                            temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        }
                    }
                    return temp;
                });

                const totalsObj = calculateTotals(list);
                list[totalIdx] = totalsObj;

                list.sort((a, b) => { return a.slotNo - b.slotNo; });
                dispatch(setCashCollectionGroup(list));
            }
        } else if (type === 'mcbuWithdrawal') {
            const value = e.target.value ? parseFloat(e.target.value) : 0;
            
            if (value > 0) {
                const mcbuWithdrawal = value;

                let list = data.map((cc, idx) => {
                    let temp = {...cc};

                    if (idx === index) {
                        if (temp.hasOwnProperty('prevData')) {
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
                            temp.mcbu = temp.mcbu > 0 ? parseFloat(temp.mcbu) - mcbuWithdrawal : 0;
                            temp.mcbuStr = formatPricePhp(temp.mcbu);
                        }
                    }

                    return temp;
                });

                const totalsObj = calculateTotals(list);
                list[totalIdx] = totalsObj;

                list.sort((a, b) => { return a.slotNo - b.slotNo; });
                dispatch(setCashCollectionGroup(list));
            }
        }  else if (type === 'remarks') {
            const remarks = e;
            let list = data.map((cc, idx) => {
                let temp = {...cc};
                
                if (idx === index) {
                    if (temp.status === "completed" && !(remarks.value && remarks.value?.startsWith('offset'))) {
                        toast.error("Error occured. Invalid remarks. Should only choose a offset remarks.");
                    } else {
                        // always reset these fields
                        if (temp.hasOwnProperty('prevData') && temp.prevData) {
                            temp.targetCollection = temp.prevData.activeLoan;
                            temp.activeLoan = temp.prevData.activeLoan;
                            temp.pastDue = temp.prevData.pastDue;
                            temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
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

                        // if (temp.hasOwnProperty('mcbuHistory') && temp.mcbuHistory) {
                        //     temp.mcbu = temp.mcbuHistory.mcbu;
                        //     temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        //     temp.mcbuCol = temp.mcbuHistory.mcbuCol;
                        //     temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                        // } else {
                        //     temp.mcbuHistory = {
                        //         mcbu: temp.mcbu,
                        //         mcbuCol: temp.mcbuCol
                        //     }
                        // }

                        temp.targetCollection = temp.activeLoan;
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                        temp.excused = false;
                        temp.delinquent = false;

                        temp.remarks = remarks;

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
                                    temp.mcbuCol = temp.prevData.mcbuCol;
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
                            }

                            temp.mispayment = false;
                            temp.mispaymentStr = 'No';
                        } else if (temp.remarks.value === "past due") {
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

                            if (temp.mcbuCol && temp.mcbuCol > 0) {
                                temp.mcbu = temp.mcbu - temp.mcbuCol;
                                temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                            }
                            
                            temp.mcbuCol = 0;
                            temp.mcbuColStr = '-';

                            if (temp.remarks.value?.startsWith('delinquent')) {
                                temp.delinquent = true;
                            }

                            if (remarks.value?.startsWith('excused-')) {
                                temp.excused = true;
                            }

                            if (temp.remarks.value === 'delinquent-offset') {
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                            } else {
                                if (temp.paymentCollection > temp.activeLoan) {
                                    temp.error = true;
                                    toast.error("Error occured. Remarks is not valid due to the amount in Actual Collection.");
                                } else {
                                    temp.targetCollection = 0;
                                    temp.activeLoan = 0;
                                    temp.targetCollectionStr = '-';
                                    temp.mispayment = true;
                                    temp.mispaymentStr = 'Yes';
                                }
                            }

                        } else if (remarks.value === "past due collection") {
                            // if payment > targetCollection, then put subtract it on the past due amount not on excess
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
                                    temp.pastDueStr = temp.pastDue > 0 ? formatPricePhp(temp.pastDue) : '-';
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
                                // TODO: Check if collection is divisible by activeLoan
                                const advanceDays = parseFloat(temp.paymentCollection) / parseFloat(temp.activeLoan);
                                temp.advanceDays = temp.advanceDays ? temp.advanceDays + (advanceDays - 1) : advanceDays - 1;
                                temp.error = false;
                            } else {
                                temp.error = true;
                                toast.error('Invalid remarks');
                            }

                            if (temp.loanBalance <= 0) {
                                temp.error = true;
                                toast.error('Invalid remarks. Please mark it as Reloaner or Offset');
                            }
                        } else if (remarks.value === "excused advance payment") {
                            if (temp.hasOwnProperty('prevData')) {
                                temp.targetCollection = temp.activeLoan;
                                temp.targetCollectionStr = formatPricePhp(temp.activeLoan);
                                temp.advanceDays = temp.advanceDays;
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

                                temp.advanceDays = temp.advanceDays - 1;
                                temp.targetCollection = 0;
                                temp.targetCollectionStr = '-';
                                temp.paymentCollection = 0;
                                temp.mispayment = false;
                                temp.mispaymentStr = 'No';
                                temp.error = false;
                            } else {
                                temp.error = true;
                                toast.error('Error occured. Yesterday transaction is not an Advanced payment');
                            }
                        } else {
                            if (remarks.value === 'reloaner' && (temp.history && (temp?.history?.remarks?.value === "reloaner" || temp?.history?.remarks?.value?.startsWith('offset')))) {
                                temp.mcbu = temp.prevData.mcbu;
                                temp.mcbuCol = temp.prevData.mcbuCol;
                                temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + temp.mcbuCol : 0 + temp.mcbuCol;
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

    const handleRowClick = (selected) => {
        // console.log(selected);
        if (selected.status === 'open') {
            // console.log('open')
        }
    }

    const handleRevert = (e, selected, index) => {
        // remove next loans (approved or pending)
        // target collection turn 0 (because of reloan)
        e.stopPropagation();
        let origList = [...data];
        let temp = {...selected};
        temp.mcbuWithdrawFlag = false;
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
            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + maxDays;
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
            delete temp.history;
            delete temp.fullPaymentDate;

            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
            setRevertMode(true);
        } else {
            toast.error("Data can't be reverted!");
        }
    }

    const handleReloan = (e, selected) => {
        e.stopPropagation();
        
        if (selected.remarks && (selected.remarks.value === "pending" || selected.remarks.value === "reloaner")) {
            setShowAddDrawer(true);
            selected.group = currentGroup;
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
            let temp = {...cc};
            
            if (cc.loanId === closeLoan.loanId) {
                temp.closeRemarks = closeAccountRemarks;
            }
            
            return temp;
        });

        dispatch(setCashCollectionGroup(list));
        setShowRemarksModal(false);
    }

    const handleMcbuWithdrawal = (e, selected, index) => {
        e.stopPropagation();

        if (parseFloat(selected.mcbu) > 0) {
            let origList = [...data];
            let temp = {...selected};

            temp.mcbuWithdrawFlag = !temp.mcbuWithdrawFlag;
            
            if (temp.mcbuWithdrawFlag) {
                setAllowMcbuWithdrawal(true);
            } else {
                setAllowMcbuWithdrawal(false);
            }

            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
        } else {
            toast.error('Client has no MCBU collected.');
        }
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

    const addBlankAndTotal = (isFiltering, dataArr) => {
        let cashCollection = [...dataArr];
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

    useEffect(() => {
        let mounted = true;
        setLoading(true);

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
    
                if (selectedBranchSubject.value) {
                    branches = [branches.find(b => b._id === selectedBranchSubject.value)];
                }
                
                dispatch(setBranchList(branches));
            } else {
                toast.error('Error retrieving branches list.');
            }
    
            setLoading(false);
        }

        const getCurrentGroup = async () => {
            if (uuid) {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
                const params = { _id: uuid };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    dispatch(setGroup(response.group));
                    setCurrentGroup(response.group);
                    setGroupFilter(uuid);
                    setLoading(false);
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
    }, [uuid, currentDate]);

    useEffect(() => {
        const getListGroup = async (selectedLO) => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ branchId: branchList[0]._id, occurence: 'weekly', loId: selectedLO });

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
    }, [branchList]);

    useEffect(() => {
        let cashCollections = [];
        const dateF = moment(dateFilter).format("YYYY-MM-DD");

        if (dateF !== currentDate) {
            cashCollections = addBlankAndTotal(true, groupClients);
        } else {
            cashCollections = addBlankAndTotal(false, groupClients);
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

    useEffect(() => {
        if (!editMode && revertMode) {
            setEditMode(true);
        }
    }, [revertMode]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} showSaveButton={currentUser.role.rep > 2 ? (isWeekend || isHoliday) ? false : editMode : false}
                        handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} allowMcbuWithdrawal={allowMcbuWithdrawal}
                        dateFilter={dateFilter} setDateFilter={setDateFilter} handleDateFilter={handleDateFilter} currentGroup={uuid} 
                        groupFilter={groupFilter} handleGroupFilter={handleGroupFilter} groupTransactionStatus={groupSummaryIsClose ? 'close' : 'open'} />}
                    <div className="p-4 mt-[12rem] mb-[4rem]">
                        <div className="bg-white flex flex-col rounded-md p-6 overflow-auto">
                            <table className="table-auto border-collapse text-sm">
                                <thead className="border-b border-b-gray-300">
                                    <tr className="column py-0 pr-0 pl-4 text-left text-gray-500 uppercase tracking-wider m-1">
                                        <th className="p-2 text-center">Slot #</th>
                                        <th className="p-2 text-center">Client Name</th>
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
                                        <th className="p-2 text-center">MCBU Withdrawals</th>
                                        <th className="p-2 text-center">MCBU Interest</th>
                                        <th className="p-2 text-center">MCBU Return Amt</th>
                                        <th className="p-2 text-center">Full Payment</th>
                                        <th className="p-2 text-center">Mispay</th>
                                        <th className="p-2 text-center"># of Mispay</th>
                                        <th className="p-2 text-center">Past Due</th>
                                        <th className="p-2 text-center">Remarks</th>
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
                                        }

                                        if (cc.error || cc.mcbuError) {
                                            rowBg = 'bg-red-100';
                                        }

                                        return (
                                            <tr key={index} className={`w-full hover:bg-slate-200 border-b border-b-gray-300 font-proxima 
                                                                ${rowBg} ${cc.status === 'totals' ? 'font-bold font-proxima-bold text-red-400' : 'text-gray-600'}`} >
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.status !== 'totals' ? cc.slotNo : '' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer" onClick={() => handleShowClientInfoModal(cc)}>{ cc.fullName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.loanCycle }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mcbuStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.currentReleaseAmountStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noOfPaymentStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && currentUser.role.rep > 2 && cc.status === 'active' && editMode && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || revertMode)) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={`${cc.clientId}-mcbuCol`} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'mcbuCol')}
                                                                onClick={(e) => e.stopPropagation()} onBlur={(e) => handlePaymentValidation(e, cc, index, 'mcbuCol')} defaultValue={cc.mcbuCol ? cc.mcbuCol : 0} tabIndex={index + 1}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !revertMode || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.mcbuColStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && currentUser.role.rep > 2 && cc.status === 'active' && editMode && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || revertMode)) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'amount', cc.activeLoan)}
                                                                onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection} tabIndex={index + 2}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !revertMode || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.paymentCollectionStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { cc.mcbuWithdrawFlag ? (
                                                        <React.Fragment>
                                                            <input type="number" name={`${cc.clientId}-mcbuWithdrawal`} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'mcbuWithdrawal')}
                                                                onClick={(e) => e.stopPropagation()} onBlur={(e) => handlePaymentValidation(e, cc, index, 'mcbuWithdrawal')} defaultValue={cc.mcbuWithdrawal ? cc.mcbuWithdrawal : 0} tabIndex={index + 3}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || !revertMode || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.mcbuWithdrawalStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuInterestStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuReturnAmtStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noMispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.pastDueStr }</td>
                                                { (!isWeekend && !isHoliday && (currentUser.role.rep > 2 && (cc.status === 'active' || cc.status === 'completed') && (editMode && !groupSummaryIsClose) 
                                                    && ((cc?.origin && (cc?.origin === 'pre-save' || cc?.origin === 'automation-trf')) || revertMode) && !filter) || ((cc.remarks && cc.remarks.value === "reloaner" && cc.status !== "tomorrow") && !groupSummaryIsClose)
                                                    && (cc.remarks && cc.remarks.value === "reloaner" && cc.fullPaymentDate !== currentDate) && cc.status !== 'pending') ? (
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
                                                                    { cc.history?.remarks.label }
                                                                </React.Fragment>
                                                            ) }
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <React.Fragment>
                                                        {(!isWeekend && !isHoliday && currentUser.role.rep > 2 &&  (cc.status === 'active' || cc.status === 'completed') && !groupSummaryIsClose) && (
                                                            <div className='flex flex-row p-4'>
                                                                {(cc.hasOwnProperty('_id')  && cc.status === 'active' && !filter) && <ArrowUturnLeftIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleRevert(e, cc, index)} />}
                                                                {(cc.status === 'completed' && cc.remarks.value === 'reloaner') && <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />}
                                                                {(!filter && cc.status === 'active') && <CurrencyDollarIcon className="w-5 h-5 mr-6" title="MCBU Withdrawal" onClick={(e) => handleMcbuWithdrawal(e, cc, index)} />}
                                                                {(!filter && !editMode && cc.status !== 'closed' && currentMonth === 11) && <CalculatorIcon className="w-5 h-5 mr-6" title="Calculate MCBU Interest" onClick={(e) => calculateInterest(e, cc, index)} />}
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
                </div>
            )}
        </Layout>
    );
}

export default CashCollectionDetailsPage;