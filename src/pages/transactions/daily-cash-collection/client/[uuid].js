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
    const [headerData, setHeaderData] = useState({});
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
    const remarksArr = [
        { label: 'Remarks', value: ''},
        { label: 'Advance Payment', value: 'advance payment'},
        // { label: 'Pending', value: 'pending'},
        // { label: 'Reloaner', value: 'reloaner'},
        { label: 'Reloaner Cont/MCBU', value: 'reloaner'},
        { label: 'Reloaner WD/MCBU', value: 'reloaner'},
        { label: 'For Close/Offset - Good Client', value: 'offset'},
        { label: 'For Close/Offset - Delinquent Client', value: 'offset'},
        { label: 'Past Due', value: 'past due'},
        { label: 'Past Due Collection', value: 'past due collection'},
        { label: 'Delinquent', value: 'delinquent'},
        { label: 'Delinquent Client for Offset', value: 'delinquent'},
        { label: 'Good Excused due to Advance Payment', value: 'excused advance payment'},
        { label: 'Excused Due to Calamity', value: 'excused'},
        { label: 'Excused - Hospitalization', value: 'excused'},
        { label: 'Excused - Death of Clients/Family Member', value: 'excused'}
    ];
    const [filter, setFilter] = useState(false);
    const maxDays = 60;
    const [groupFilter, setGroupFilter] = useState();
    const [allowMcbuWithdrawal, setAllowMcbuWithdrawal] = useState(false);
    // const [weekend, setWeekend] = useState(false);
    // const [holiday, setHoliday] = useState(false);
    const [hasErrors, setHasErrors] = useState(false);

    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

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

    const getErrors = () => {
        // check for the ff:  [double slot number] and [double client id ] [same client id on different gorup]
            // not closed
            // don't forget to fixed the group availableSlots and noOfClients
        const uniqueClient = new Set();
        const duplicateClient = [];
        const uniqueSlotNo = new Set();
        const duplicateSlotNo = [];
        data.map((cc, index) => {
            if (cc.status !== 'totals' && cc.status !== 'open') {
                if (uniqueClient.has(cc.clientId)) {
                    duplicateClient.push({ index: index, clientId: cc.clientId });
                } else {
                    uniqueClient.add(cc.clientId);
                }

                if (uniqueSlotNo.has(cc.slotNo)) {
                    duplicateSlotNo.push({ index: index, slotNo: cc.slotNo });
                } else {
                    uniqueSlotNo.add(cc.slotNo);
                }
            }
        });

        
    }

    const getCashCollections = async (date) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' 
            + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily', groupId: uuid, type: date ? 'filter' : 'current' });
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];

            const groupSummary = response.data.groupSummary;
            setHeaderData(groupSummary);

            if (groupSummary.status === 'pending' && (!date || currentDate === date)) {
                setEditMode(true);
                setGroupSummaryIsClose(false);
            } else {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }

            response.data.collection.map(cc => {
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
                        prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null
                    }
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
                        mcbu = cc.current[0].mcbu;
                        mcbuCol = cc.current[0].mcbuCol;
                        mcbuWithdrawal = cc.current[0].mcbuWithdrawal;
                        mcbuReturnAmt = cc.current[0].mcbuReturnAmt;
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
                        loanCycle: cc.history.loanCycle,
                        mispayment: cc.mispayment,
                        mispaymentStr: cc.mispaymentStr,
                        noMispayment: date ? cc.noMispayment : cc.mispayment,
                        noMispaymentStr: numMispayment,
                        collection: 0,
                        excess: cc.history.excess > 0 ? cc.history.excess : 0,
                        excessStr: cc.history.excess > 0 ? formatPricePhp(cc.history.excess) : '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: cc.noOfPayments,
                        noOfPaymentStr: cc.noOfPayments + ' / ' + maxDays,
                        activeLoan: cc.history.activeLoan,
                        targetCollection: cc.history.activeLoan,
                        targetCollectionStr: cc.history.activeLoan > 0 ? formatPricePhp(cc.history.activeLoan) : '-',
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
                        amountRelease: '-',
                        amountReleaseStr: '-',
                        loanBalance: '-',
                        loanBalanceStr: '-',
                        paymentCollection: cc.history.collection ? cc.history.collection : 0,
                        paymentCollectionStr: cc.history.collection > 0 ? formatPricePhp(cc.history.collection) : '-',
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
                } else if (cc.status !== "closed") {
                    let numMispayment = cc.mispayment > 0 ? cc.mispayment + ' / ' + maxDays : '-';
                    if (date) {
                        numMispayment = cc.noMispayment > 0 ? cc.noMispayment + ' / ' + maxDays : '-';
                    }

                    let mispaymentStr = '-';
                    if (cc.mispayment !== undefined) {
                        mispaymentStr = cc.mispayment ? 'Yes' : 'No';
                    } else {
                        if (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) {
                            mispaymentStr = 'No';
                        }
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
                        mispayment: cc.mispayment ? cc.mispayment : false,
                        mispaymentStr: mispaymentStr,
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
                        advanceDays: cc.advanceDays,
                        history: cc.hasOwnProperty('history') ? cc.history : null,
                        status: cc.status
                    }

                    delete cc._id;
                    if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                        collection.targetCollection = cc.current[0].targetCollection;
                        collection.targetCollectionStr = formatPricePhp(cc.current[0].targetCollection);
                        collection.excess = cc.current[0].excess;
                        collection.excessStr = formatPricePhp(cc.current[0].excess);
                        collection.paymentCollection = cc.current[0].paymentCollection;
                        collection.paymentCollectionStr = formatPricePhp(cc.current[0].paymentCollection);
                        collection.mispayment = cc.current[0].mispayment;
                        collection.mispaymentStr = cc.current[0].mispaymentStr;
                        collection.remarks = cc.current[0].remarks;
                        collection.delinquent = cc.current[0].hasOwnProperty('delinquent') ? cc.current[0].delinquent : false;
                        collection._id = cc.current[0]._id;
                        collection.prevData = cc.current[0].prevData;
                        collection.pastDue = cc.current[0].pastDue ? cc.current[0].pastDue : 0;
                        collection.pastDueStr = cc.current[0].pastDue ? formatPricePhp(cc.current[0].pastDue) : '-';
                        collection.mcbuCol = cc.current[0].mcbuCol;
                        collection.mcbuColStr = cc.current[0].mcbuCol > 0 ? formatPricePhp(cc.current[0].mcbuCol) : '-';
                        collection.mcbuWithdrawal = cc.current[0].mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = cc.current[0].mcbuWithdrawal > 0 ? formatPricePhp(cc.current[0].mcbuWithdrawal) : '-';
                        collection.mcbuReturnAmt = (cc.current[0].hasOwnProperty('mcbuReturnAmt') && cc.current[0].mcbuReturnAmt) ? cc.current[0].mcbuReturnAmt : 0;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.mcbuInterest = cc.current[0].mcbuInterest ? cc.mcbuInterest : 0,
                        collection.mcbuInterestStr = cc.current[0].mcbuInterest > 0 ? formatPricePhp(cc.current[0].mcbuInterest) : '-',
                        collection.advanceDays = cc.current[0].advanceDays;
                        setEditMode(false);
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
                            collection.paymentCollection = cc.history ? cc.history.collection : 0;
                            collection.paymentCollectionStr = formatPricePhp(collection.paymentCollection);
                        }

                        collection.notCalculate = true;
                        collection.remarks = cc.history ? cc.history.remarks : '-';
                    }
                } else {
                    return;
                }

                if (!date && cc.hasOwnProperty('pastDue')) {
                    if (collection.pastDue === collection.loanBalance) {
                        collection.targetCollection = 0;
                        collection.activeLoan = 0;
                    }
                }

                collection.mcbuWithdrawFlag = false;

                cashCollection.push(collection);
            });

            response.data.tomorrowPending.map(loan => {
                // to do:
                // if same slot and same client merged
                // if same slot but diff client it should be different row
                // if diff slot but same client it should be different row
                const currentLoan = cashCollection.find(l => l.slotNo === loan.slotNo); // should show different client with the same slot no
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
                            noMispaymentStr: currentLoan.noMispayment > 0 ? currentLoan.noMispayment + ' / ' + maxDays : '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : 0,
                            noOfPayments: '-',
                            noOfPaymentStr: (currentLoan.noOfPayments !== '-' && currentLoan.status !== 'totals') ? currentLoan.noOfPayments + ' / ' + maxDays : '-',
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
                        targetCollectionStr: '-',
                        excessStr: '-',
                        paymentCollectionStr: '-',
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

                if (!collection.remarks || (collection.remarks && collection.remarks.label !== "Delinquent" && collection.remarks.value !== "excused")) {
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

    const validation = () => {
        let errorMsg = new Set();

        groupClients && groupClients.map(cc => {
            if (cc.status === 'active') {
                if (cc.error) {
                    errorMsg.add('Error occured. Please double check the Actual Collection column.');
                } else if (parseFloat(cc.paymentCollection) === 0 && !cc.remarks) {
                    errorMsg.add('Error occured. Please select a remarks for 0 or no payment Actual Collection.');
                } else if ((parseFloat(cc.paymentCollection) === 0 || (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < parseFloat(cc.activeLoan))) 
                        && (!cc.remarks || (cc.remarks && (cc.remarks.value !== "delinquent" && cc.remarks.value !== "past due" && cc.remarks.value !== "excused" && cc.remarks.value !== 'excused advance payment'))) ) {
                    errorMsg.add("Error occured. 0 payment should be mark either PAST DUE, DELINQUENT OR EXCUSED in remarks.");
                } else if ((cc.remarks && cc.remarks.value === "past due") && parseFloat(cc.pastDue) < parseFloat(cc.targetCollection)) {
                    errorMsg.add("Error occured. Past due is less than the target collection.");
                } else if (cc.remarks && (cc.remarks.value === "past due" || cc.remarks.value === "excused" || cc.remarks.value === "delinquent") ) { 
                    if (cc.paymentCollection > 0 && cc.paymentCollection % 10 !== 0) {
                        errorMsg.add("Error occured. Amount collection is not divisible by 10");
                    }
                } else if (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < cc.activeLoan) {
                    errorMsg.add("Actual collection is below the target collection.");
                } else if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) !== 0 && cc.loanBalance !== 0) {
                    if (cc.remarks && (cc.remarks.value !== "past due" && cc.remarks.value !== "excused" && cc.remarks.value !== "delinquent") ) {
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

                if (parseFloat(cc.loanBalance) && (cc.remarks && cc.remarks.value === 'offset')) {
                    errorMsg.add('Error occured. Please input the full balance amount before closing the loan account.');
                }

                if (cc.mcbuError) {
                    errorMsg.add('Error occured. Please double check the MCBU Collection/Withdrawal column.');
                } 
                
                // if (!cc.mcbuCol || parseFloat(cc.mcbuCol) < 10) {
                //     if (!cc.remarks || (cc.remarks 
                //             && (cc.remarks.value !== 'past due' && cc.remarks.value !== 'excused' 
                //             && cc.remarks.value !== 'delinquent' && cc.remarks.value !== 'offset' && cc.remarks.value !== 'past due collection'))) {
                //         errorMsg.add('Error occured. Invalid MCBU Collection.');
                //     }
                // } else if (!cc.mcbuCol || parseFloat(cc.mcbuCol) > 10) {
                //     if (cc.remarks && (cc.remarks.value === 'advance payment' || cc.remarks.label === 'Reloaner Cont/MCBU')) {
                //         const excessMcbu = cc.excess / cc.activeLoan;
                //         const finalMcbu = (excessMcbu * 10) + 10;
                //         if (parseFloat(cc.mcbuCol) > finalMcbu) {
                //             errorMsg.add('Error occured. MCBU collection is more than the required collection which is ' + finalMcbu + '.');
                //         }
                //     } else if (cc.remarks && cc.remarks.value !== 'advance payment' && cc.remarks.label !== 'Reloaner Cont/MCBU') {
                //         errorMsg.add('Error occured. MCBU collection is more than 10.');
                //     }
                // }

                if (cc.mcbuWithdrawFlag) {
                    if (!cc.mcbuWithdrawal || parseFloat(cc.mcbuWithdrawal) > parseFloat(cc.mcbu)) {
                        errorMsg.add('Error occured. Invalid MCBU Withdraw amount.');
                    } else if (parseFloat(cc.mcbuWithdrawal) < 10) {
                        errorMsg.add('Error occured. MCBU withdrawal amount is less than ₱10.');
                    }
                }
            } else if (cc.status === 'completed' && (cc.remarks && !(cc.remarks.value === 'pending' || cc.remarks.value === 'reloaner' || cc.remarks.value === 'offset'))) {
                errorMsg.add("Invalid remarks. Please set it to PENDING, RELOANER OR OFFSET.");
            }
        });

        return errorMsg;
    }

    const handlePaymentValidation = (e, selected, index, col) => {
        const value = e.target.value ? parseFloat(e.target.value) : 0;
        let temp = {...selected};
        switch (col) {
            // case 'mcbuCol':
            //     if (!value || value < 10) {
            //         toast.error('Error occured. MCBU collection is less than 10.');
            //         temp.mcbuError = true;
            //     } else if (!value || value > 10) {
            //         if (temp.remarks && temp.remarks.value !== 'advance payment') {
            //             toast.error('Error occured. MCBU collection is more than 10.');
            //             temp.mcbuError = true; 
            //         } else if (temp.remarks && temp.remarks.value === 'advance payment') {
            //             const excessMcbu = temp.excess / temp.activeLoan;
            //             const finalMcbu = (excessMcbu * 10) + 10;
            //             if (finalMcbu !== value) {
            //                 toast.error('Error occured. MCBU collection is more than the required collection which is ' + finalMcbu + '.');
            //                 temp.mcbuError = true; 
            //             }
            //         }
            //     } else {
            //         temp.mcbuError = false;
            //     }
            //     break;
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

        if (headerData && headerData.status === 'close') {
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
                const dataArr = data.filter(cc => cc.status !== 'open').map(cc => {
                    let temp = {...cc};
    
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
                    delete temp.mcbuInterestStr;
                    delete temp.mcbuError;
                    delete temp.client;
                    // delete temp.clientStatus;

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
                            if (temp.remarks.value === 'offset') {
                                temp.status = 'closed';
                                temp.clientStatus = 'offset';
                            } 
                        }
                    }
                
                    return temp;   
                }).filter(cc => cc.status !== "totals");
                // console.log(dataArr)
                if (save) {
                    let cashCollection;
                    if (editMode) {
                        cashCollection = {
                            ...headerData,
                            dateModified: moment(currentDate).format('YYYY-MM-DD'),
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr)
                        };
                    } else {
                        cashCollection = {
                            ...headerData,
                            modifiedBy: currentUser._id,
                            collection: JSON.stringify(dataArr),
                            mode: 'daily'
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
                        if (temp.hasOwnProperty('prevData')) {
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
                                temp.mcbuCol = 0;
                                temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                            } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                                temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                                temp.excessStr = formatPricePhp(temp.excess);
                                temp.mispayment = false;
                                temp.mispaymentStr = "No";
                                temp.noOfPayments = temp.noOfPayments + 1;

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
                            if (temp.remarks && (temp.remarks.value !== "past due" && temp.remarks.value !== "excused" && temp.remarks.value !== "delinquent") ) {
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
        // } else if (type === 'mcbuCol') {
        //     const value = e.target.value ? parseFloat(e.target.value) : 0;
            
        //     if (value > 0) {
        //         const mcbuCol = value;

        //         let list = data.map((cc, idx) => {
        //             let temp = {...cc};

        //             if (idx === index) {
        //                 if (temp.hasOwnProperty('prevData')) {
        //                     temp.mcbu = temp.prevData.mcbu;
        //                     temp.mcbuStr = formatPricePhp(temp.mcbu);
        //                 } else {
        //                     temp.prevData = {
        //                         amountRelease: temp.amountRelease,
        //                         paymentCollection: temp.paymentCollection,
        //                         excess: temp.excess !== '-' ? temp.excess : 0,
        //                         loanBalance: temp.loanBalance,
        //                         activeLoan: temp.activeLoan,
        //                         noOfPayments: temp.noOfPayments,
        //                         total: temp.total,
        //                         pastDue: temp.pastDue,
        //                         mcbu: temp.mcbu
        //                     };
        //                 }

        //                 if (mcbuCol < 10) {
        //                     temp.mcbuError = true;
        //                 } else {
        //                     temp.mcbuError = false;
        //                     temp.mcbuCol = mcbuCol;
        //                     temp.mcbuColStr = formatPricePhp(mcbuCol);
                            // temp.mcbu = temp.mcbu ? parseFloat(temp.mcbu) + mcbuCol : 0 + mcbuCol;
                            // temp.mcbuStr = formatPricePhp(temp.mcbu);
        //                 }
        //             }

        //             return temp;
        //         });

        //         const totalsObj = calculateTotals(list);
        //         list[totalIdx] = totalsObj;

        //         list.sort((a, b) => { return a.slotNo - b.slotNo; });
        //         dispatch(setCashCollectionGroup(list));
        //     }
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

                        if (mcbuWithdrawal < 10) {
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
        } else if (type === 'remarks') {
            const remarks = e;
            // TODO: Reset temp data every change
            let list = data.map((cc, idx) => {
                let temp = {...cc};
                
                if (idx === index) {
                    // // this will have a history if payment is made first
                    // let prevRemarks = null;
                    // if (temp.hasOwnProperty('history')) {
                    //     prevRemarks = temp.history.remarks;

                    //     if (temp.history.hasOwnProperty('prevRemarks')) {
                    //         prevRemarks = temp.history.prevRemarks;
                    //     }
                    // }
                    if (temp.hasOwnProperty('mcbuHistory')) {
                        temp.mcbu = temp.mcbuHistory.mcbu;
                        temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        temp.mcbuCol = temp.mcbuHistory.mcbuCol;
                        temp.mcbuColStr = temp.mcbuCol > 0 ? formatPricePhp(temp.mcbuCol) : '-';
                        temp.mcbuReturnAmt = 0;
                        temp.mcbuReturnAmtStr = '-';
                        temp.mcbuWithdrawal = 0;
                        temp.mcbuWithdrawalStr = '-';
                    } else {
                        temp.mcbuHistory = {
                            mcbu: temp.mcbu,
                            mcbuCol: temp.mcbuCol
                        }
                    }

                    temp.pastDue = 0;
                    temp.pastDueStr = '-';
                    temp.targetCollection = temp.activeLoan;
                    temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                    temp.excused = false;
                    temp.delinquent = false;

                    // if (temp.paymentCollection > 0 && (remarks && (remarks.value !== "delinquent" && remarks.value !== "past due" && remarks.value === "excused")) &&
                    //     (temp.remarks && (temp.remarks.value === "delinquent" || temp.remarks.value === "past due" || temp.remarks.value === "excused"))) {
                    //     temp.noOfPayments = temp.noOfPayments > 0 ? temp.noOfPayments - 1 : 0;
                    // }

                    temp.remarks = remarks;
                    
                    if (temp.hasOwnProperty('history')) {
                        temp.history = {
                            ...temp.history,
                            remarks: remarks
                        }
                    } else {
                        temp = setHistory(temp);
                    }
                    // for pending remarks - this slot no should still be able to change by the following day to change the remarks
                    // by tomorrow only reloaner and offsets...
                    if (remarks.value === 'offset') {
                        if (parseFloat(temp.loanBalance) !== 0) {
                            toast.error("Please enter the full balance before closing the loan account.");
                            temp.error = true;
                        } else {
                            setShowRemarksModal(true);
                            setCloseLoan(cc);
                            temp.error = false;
                            setEditMode(true);
                            temp.mcbu = temp.mcbu - temp.mcbuCol;
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
                    } else if (remarks.value === "delinquent" || remarks.value === "excused") {
                        // add no of mispayments / maximum of payments per cycle // change to #of mispay
                        temp.error = false;
                        temp.mcbuError = false;
                        temp.mcbu = temp.mcbu - temp.mcbuCol;
                        temp.mcbuStr = temp.mcbu > 0 ? formatPricePhp(temp.mcbu) : '-';
                        temp.mcbuCol = 0;
                        temp.mcbuColStr = '-';

                        if (temp.remarks.value === "delinquent") {
                            temp.delinquent = true;
                        }

                        if (remarks.value === "excused") {
                            temp.excused = true;
                        }

                        if (temp.remarks.label === 'Delinquent Client for Offset') {
                            temp.mispayment = false;
                            temp.mispaymentStr = 'No';
                        } else {
                            if (temp.paymentCollection > temp.activeLoan) {
                                temp.error = true;
                                toast.error("Error occured. Remarks is not valid due to the amount in Actual Collection.");
                            } else {
                                temp.targetCollection = 0;
                                temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
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
                                temp.pastDueStr = formatPricePhp(temp.pastDue);
                            } else {
                                temp.pastDue = temp.pastDue > 0 ? temp.pastDue - pastDueCol : 0;
                                temp.pastDueStr = formatPricePhp(temp.pastDue);
                                temp.excess = 0;
                                temp.excessStr = formatPricePhp(temp.excess);
                            }

                            temp.mcbuError = false;
                        }
                    } else if (remarks.value === 'advance payment') {
                        if (temp.excess > 0) {
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
                    } else if (remarks.label === 'Reloaner WD/MCBU') {
                        temp.mcbu = temp.mcbu - temp.mcbuCol;
                        temp.mcbuCol = 0;
                        temp.mcbuColStr = '-';
                        temp.mcbuWithdrawal = temp.mcbu;
                        temp.mcbu = 0;

                        temp.mcbuWithdrawalStr = temp.mcbuWithdrawal > 0 ? formatPricePhp(temp.mcbuWithdrawal) : '-';
                        temp.mcbuStr = '-';
                    } else {
                        temp.closeRemarks = '';
                        setCloseLoan();
                        temp.error = false;
                        temp.mispayment = false;
                        temp.mispaymentStr = 'No';
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

        if (temp.remarks === "offset") {
            temp.history.loanCycle = temp.loanCycle;
        }

        return temp;
    }

    // const handleRowClick = (selected) => {
    //     // console.log(selected);
    //     if (selected.status === 'open') {
    //         // console.log('open')
    //     }
    // }

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

    // const handleMcbuWithdrawal = (e, selected, index) => {
    //     e.stopPropagation();

    //     if (parseFloat(selected.mcbu) > 0) {
    //         let origList = [...data];
    //         let temp = {...selected};

    //         temp.mcbuWithdrawFlag = !temp.mcbuWithdrawFlag;
            
    //         if (temp.mcbuWithdrawFlag) {
    //             setAllowMcbuWithdrawal(true);
    //         } else {
    //             setAllowMcbuWithdrawal(false);
    //         }

    //         origList[index] = temp;
    //         dispatch(setCashCollectionGroup(origList));
    //     } else {
    //         toast.error('Client has no MCBU collected.');
    //     }
    // }

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

        // if (isFiltering) {
        //     for (let i = 1; i <= groupCapacity; i++) {
        //         const existData = cashCollection.find(cc => cc.slotNo === i && cc.status !== 'open');

        //         if (!existData) {
        //             cashCollection.push({
        //                 slotNo: i,
        //                 fullName: '-',
        //                 loanCycle: '-',
        //                 amountReleaseStr: '-',
        //                 mispayment: false,
        //                 mispaymentStr: '-',
        //                 loanBalanceStr: '-',
        //                 currentReleaseAmountStr: '-',
        //                 noOfPayments: '-',
        //                 targetCollectionStr: '-',
        //                 excessStr: '-',
        //                 paymentCollectionStr: '-',
        //                 mcbuStr: '-',
        //                 mcbuColStr: '-',
        //                 mcbuWithdrawalStr: '-',
        //                 mcbuReturnAmtStr: '-',
        //                 remarks: '-',
        //                 fullPaymentStr: '-',
        //                 clientStatus: '-',
        //                 status: 'open',
        //             });
        //         } else if (!existData.group) {
        //             const index = cashCollection.indexOf(existData);
        //             cashCollection[index] = {
        //                 ...existData,
        //                 group: currentGroup
        //             }
        //         }
        //     }
        //     cashCollection.sort((a, b) => { return a.slotNo - b.slotNo; });

        //     if (totalIdx > -1) {
        //         cashCollection[totalIdx] = calculateTotals(cashCollection);
        //     } else {
        //         cashCollection.push(calculateTotals(cashCollection));
        //     }

        //     return cashCollection;
        // } else {
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
        // }
    }

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const getListBranch = async () => {
            const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'branches/list');
            if (response.success) {
                let branches = [];
                response.branches && response.branches.map(branch => {
                    branches.push(
                        {
                            ...branch
                        }
                    );
                });
    
                if (currentUser.root !== true && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                    branches = [branches.find(b => b.code === currentUser.designatedBranch)];
                } else if (selectedBranchSubject.value) {
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

        return () => {
            mounted = false;
        };
    }, [uuid, currentDate]);

    useEffect(() => {
        const getListGroup = async (selectedLO) => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ branchId: branchList[0]._id, occurence: 'daily', loId: selectedLO });

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
        let cashCollections = addBlankAndTotal(groupClients)
        // const dateF = moment(dateFilter).format("YYYY-MM-DD");

        // if (dateF !== currentDate) {
        //     cashCollections = addBlankAndTotal(true, groupClients);
        // } else {
        //     cashCollections = addBlankAndTotal(false, groupClients);
        // }

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

    useEffect(() => {
        if (!editMode && revertMode) {
            setEditMode(true);
        }
    }, [revertMode]);

    // useEffect(() => {
    //     const dayName = moment().format('dddd');

    //     if (dayName === 'Saturday' || dayName === 'Sunday') {
    //         setWeekend(true);
    //     } else {
    //         setWeekend(false);
    //     }
    // }, []);

    // useEffect(() => {
    //     if (holidays) {
    //         let holidayToday = false;
    //         const currentYear = moment().year();
    //         holidays.map(item => {
    //             const holidayDate = currentYear + '-' + item.date;

    //             if (holidayDate === currentDate) {
    //                 holidayToday = true;
    //             }
    //         });

    //         setHoliday(holidayToday);
    //     }
    // }, [holidays]);

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
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noOfPaymentStr }</td>{/** after submitting please update the no of payments **/}
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { cc.mcbuColStr }
                                                    {/* { (!weekend && !holiday && currentUser.role.rep > 2 && cc.status === 'active' && editMode && (!cc.hasOwnProperty('_id') || revertMode)) ? (
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
                                                    } */}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!isWeekend && !isHoliday && currentUser.role.rep > 2 && cc.status === 'active' && editMode && (!cc.hasOwnProperty('_id') || revertMode)) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} min={0} step={10} onChange={(e) => handlePaymentCollectionChange(e, index, 'amount', cc.activeLoan)}
                                                                onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection} tabIndex={index + 1}
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
                                                    { cc.mcbuWithdrawalStr }
                                                    {/* { cc.mcbuWithdrawFlag ? (
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
                                                    } */}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuInterestStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.mcbuReturnAmtStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noMispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                    { cc.pastDueStr }
                                                </td>
                                                { (!isWeekend && !isHoliday && (currentUser.role.rep > 2 && (cc.status === 'active' || cc.status === 'completed') && (editMode && !groupSummaryIsClose) 
                                                    && (!cc.hasOwnProperty('_id') || revertMode) && !filter) || ((cc.remarks && cc.remarks.value === "reloaner" && cc.status !== "tomorrow") && !groupSummaryIsClose)) ? (
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
                                                                    { cc.history.remarks.label }
                                                                </React.Fragment>
                                                            ) }
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <React.Fragment>
                                                        {(!isWeekend && !isHoliday && currentUser.role.rep > 2 &&  (cc.status === 'active' || cc.status === 'completed') && !groupSummaryIsClose) && (
                                                            <div className='flex flex-row p-4'>
                                                                {(cc.hasOwnProperty('_id') && !filter) && <ArrowUturnLeftIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleRevert(e, cc, index)} />}
                                                                {(cc.status === 'completed' && cc.remarks.value === 'reloaner') && <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />}
                                                                {/* {(!filter && cc.status === 'active') && <CurrencyDollarIcon className="w-5 h-5 mr-6" title="MCBU Withdrawal" onClick={(e) => handleMcbuWithdrawal(e, cc, index)} />} */}
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