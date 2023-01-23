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
import { XCircleIcon, ArrowPathIcon, ArrowUturnLeftIcon } from '@heroicons/react/24/outline';
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import AddUpdateLoan from '@/components/transactions/AddUpdateLoanDrawer';
import Dialog from '@/lib/ui/Dialog';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import { setBranchList } from '@/redux/actions/branchActions';
import { BehaviorSubject } from 'rxjs';

const CashCollectionDetailsPage = () => {
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
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [dateFilter, setDateFilter] = useState(new Date());
    const [loan, setLoan] = useState();
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();
    const [closeLoan, setCloseLoan] = useState();
    const remarksArr = [
        { label: 'Remarks', value: ''},
        { label: 'Double Payment', value: 'double payment'},
        { label: 'Advance Payment', value: 'advance payment'},
        { label: 'Reloaner', value: 'reloaner'},
        { label: 'Pending', value: 'pending'},
        { label: 'For Close/Offset - Good Client', value: 'offset'},
        { label: 'For Close/Offset - Delinquent Client', value: 'offset'},
        { label: 'Past Due', value: 'past due'},
        { label: 'Delinquent', value: 'delinquent'},
        // { label: 'Excused', value: 'excused'},
        { label: 'Excused Due to Calamity', value: 'excused'},
        { label: 'Excused - Hospitalization', value: 'excused'},
        { label: 'Excused - Death of Clients/Family Member', value: 'excused'}
    ];
    const [filter, setFilter] = useState(false);
    const maxDays = 60;
    const [groupFilter, setGroupFilter] = useState();
    const [weekend, setWeekend] = useState(false);

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
                        collection: 0,
                        excess: cc.excess > 0 ? cc.excess : 0,
                        excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: '-',
                        noOfPaymentStr: '-',
                        activeLoan: '-',
                        targetCollection: 0,
                        targetCollectionStr: '-',
                        amountRelease: '-',
                        amountReleaseStr: '-',
                        loanBalance: '-',
                        loanBalanceStr: '-',
                        paymentCollection: 0,
                        paymentCollectionStr: cc.paymentCollection > 0 ? formatPricePhp(cc.paymentCollection) : '-',
                        occurence: cc.group.occurence,
                        currentReleaseAmount: cc.currentReleaseAmount,
                        currentReleaseAmountStr: formatPricePhp(cc.currentReleaseAmount),
                        fullPayment: 0,
                        fullPaymentStr: '-',
                        remarks: cc.remarks ? cc.remarks : '',
                        pastDue: cc.pastDue ? cc.pastDue : 0,
                        pastDueStr: cc.pastDue ? formatPricePhp(cc.pastDue) : '-',
                        clientStatus: cc.client.status ? cc.client.status : '-',
                        delinquent: cc.client.delinquent,
                        fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null,
                        history: cc.hasOwnProperty('history') ? cc.history : null,
                        prevData: cc.hasOwnProperty('prevData') ? cc.prevData : null
                    }
                } else if (cc.status === "closed" && cc.fullPaymentDate === currentDate) {
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
                        mispayment: cc.mispayment === 0 ? false : true,
                        mispaymentStr: cc.mispayment === 0 ? 'No' : 'Yes',
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
                    collection = {
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
                        collection: 0,
                        excess: cc.excess,
                        excessStr: cc.excess > 0 ? formatPricePhp(cc.excess) : '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments : 0,
                        noOfPaymentStr: (cc.status === "active" || (cc.status === "completed" && cc.fullPaymentDate === currentDate)) ? cc.noOfPayments + ' / ' + maxDays : '-',
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
                        status: cc.status
                    }

                    delete cc._id;
                    if (cc.hasOwnProperty('current') && cc.current.length > 0) {
                        // collection.activeLoan = cc.current[0].activeLoan;
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
                        collection.pastDueStr = cc.current[0].pastDue ? formatPricePhp(cc.current[0].pastDue) : '-',
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

                cashCollection.push(collection);
            });

            response.data.tomorrowPending.map(loan => {
                const currentLoan = cashCollection.find(l => l.clientId === loan.clientId);
                if (currentLoan && currentLoan.status !== 'pending') {
                    const index = cashCollection.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) { // fullpayment with pending/tomorrow
                        cashCollection[index] = {
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
                            status: loan.status === "active" ? "tomorrow" : loan.status,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false
                        };
                        if (loan.current.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                        }
                    } else if (currentLoan.status !== 'active') {
                        cashCollection[index] = {
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
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : '-',
                            noOfPayments: '-',
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
                    const slot = cashCollection.find(c => c.slotNo === loan.slotNo);
                    if (slot) {
                        const index = cashCollection.indexOf(slot);
                        cashCollection[index] = {
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
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            pastDueStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending'
                        };

                        if (loan.current.length > 0) {
                            cashCollection[index]._id = loan.current[0]._id;
                        }
                    } else { // tomorrow && pending
                        let pendingTomorrow = {
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
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: loan.amountRelease ? formatPricePhp(loan.amountRelease) : '-',
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: '-',
                            pastDueStr: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending'
                        };

                        if (loan.current.length > 0) {
                            pendingTomorrow._id = loan.current[0]._id;
                        }

                        cashCollection.push(pendingTomorrow);
                    }
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
        // let totalPayments = 0;
        let totalTargetLoanCollection = 0;
        let totalExcess = 0;
        let totalLoanCollection = 0;
        let totalFullPayment = 0;
        let totalMispayment = 0;
        let totalActiveClients = 0;
        let totalActiveBorrowers = 0;
        let totalNoOfFullPayments = 0;
        let totalNoNewCurrentRelease = 0;
        let totalNoReCurrentRelease = 0;
        let totalPastDue = 0;

        dataArr.map(collection => {
            if (collection.status !== 'open' && collection.status !== 'totals') {
                if (collection.status === 'active') {
                    // totalActiveBorrowers += 1;
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease !== '-' ? collection.amountRelease : 0 : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance !== '-' ? collection.loanBalance : 0 : 0;
                }

                if (collection.status === 'tomorrow' || (collection.hasOwnProperty('tomorrow') && collection.tomorrow)) {
                    totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount !== '-' ? collection.currentReleaseAmount : 0 : 0;
                }

                if (!collection.remarks || (collection.remarks && collection.remarks.value !== "delinquent" && collection.remarks.value !== "past due" && collection.remarks.value !== "excused")) {
                    totalTargetLoanCollection += collection.targetCollection  ? collection.targetCollection !== '-' ? collection.targetCollection : 0 : 0;
                }

                totalExcess += collection.excess ? collection.excess !== '-' ? collection.excess : 0 : 0;
                totalLoanCollection += collection.paymentCollection ? collection.paymentCollection !== '-' ? collection.paymentCollection : 0 : 0;
                totalFullPayment += collection.fullPayment ? collection.fullPayment !== '-' ? collection.fullPayment : 0 : 0;
                totalMispayment += collection.mispaymentStr === 'Yes' ? 1 : 0;
                totalPastDue += collection.pastDue !== '-' ? collection.pastDue : 0;
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
            remarks: '-',
            fullPayment: totalFullPayment,
            fullPaymentStr: totalFullPayment ? formatPricePhp(totalFullPayment) : 0,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
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
                        && (!cc.remarks || (cc.remarks && (cc.remarks.value !== "delinquent" && cc.remarks.value !== "past due" && cc.remarks.value !== "excused"))) ) {
                    errorMsg.add("Error occured. 0 payment should be mark either PAST DUE, DELINQUENT OR EXCUSED in remarks.");
                } else if ((cc.remarks && cc.remarks.value === "past due") && parseFloat(cc.pastDue) < parseFloat(cc.activeLoan)) {
                    errorMsg.add("Error occured. Past due is less than the target collection.");
                } else if (cc.remarks && (cc.remarks.value === "past due" || cc.remarks.value === "excused" || cc.remarks.value === "delinquent") ) { 
                    if (cc.paymentCollection > 0 && cc.paymentCollection % 10 !== 0) {
                        errorMsg.add("Error occured. Amount collection is not divisible by 10");
                    }
                } else if (parseFloat(cc.paymentCollection) > 0 && parseFloat(cc.paymentCollection) < cc.activeLoan) {
                    errorMsg.add("Actual collection is below the target collection.");
                } else if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) !== 0) {
                    if (cc.remarks && (cc.remarks.value !== "past due" && cc.remarks.value !== "excused" && cc.remarks.value !== "delinquent") ) {
                        errorMsg.add(`Actual collection should be divisible by ${cc.activeLoan}.`);
                    }
                } else if (parseFloat(cc.paymentCollection) === (cc.activeLoan * 2) && (!cc.remarks || cc.remarks && cc.remarks.value !== "double payment")) {
                    errorMsg.add('Error occured. Actual collection is a double payment please set remarks as Double Payment.');
                } else if (parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan) && parseFloat(cc.paymentCollection) > parseFloat(cc.activeLoan * 2)) {
                    if (parseFloat(cc.paymentCollection) % parseFloat(cc.activeLoan) === 0 && (!cc.remarks || cc.remarks && cc.remarks.value !== "advance payment")) {
                        errorMsg.add('Error occured. Actual collection is a advance payment please set remarks as Advance Payment.');
                    }
                } else if (cc.status === "active" && cc.loanBalance === 0 && !cc.remarks ) {
                    errorMsg.add('Error occured. Please select PENDING, RELOANER or OFFSET remarks for full payment transaction.');
                }

                if (parseFloat(cc.loanBalance) && (cc.remarks && cc.remarks.value === 'offset')) {
                    errorMsg.add('Error occured. Please input the full balance amount before closing the loan account.');
                }
            } else if (cc.status === 'completed' && (cc.remarks && !(cc.remarks.value === 'pending' || cc.remarks.value === 'reloaner' || cc.remarks.value === 'offset'))) {
                errorMsg.add("Invalid remarks. Please set it to PENDING, RELOANER OR OFFSET.");
            }
        });

        return errorMsg;
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
                    // delete temp.clientStatus;

                    if (cc.hasOwnProperty('_id')) {
                        temp.modifiedBy = currentUser._id;
                        temp.dateModified = moment(new Date()).format('YYYY-MM-DD');
                    } else {
                        temp.insertedBy = currentUser._id;
                        temp.dateAdded = moment(new Date()).format('YYYY-MM-DD');

                        // if day is weekend add it to friday
                        // question is are we going to used the groupsummary header on friday? what if it's closed already?
                        // const dayName = moment(temp.dateAdded).format('dddd');
                        // if (dayName === 'Saturday') {
                        //     temp.dateAdded = moment(new Date()).subtract(1, 'days').format('YYYY-MM-DD');
                        //     temp.insertedDate = moment(new Date()).format('YYYY-MM-DD');
                        // } else if (dayName === 'Sunday') {
                        //     temp.dateAdded = moment(new Date()).subtract(2, 'days').format('YYYY-MM-DD');
                        //     temp.insertedDate = moment(new Date()).format('YYYY-MM-DD');
                        // }
                    }
    
                    if (cc.status === 'active') {
                        save = true;
                        if (currentUser.role.rep === 4) {
                            temp.loId = currentUser._id;
                        } else {
                            temp.loId = currentGroup && currentGroup.loanOfficerId;
                        }
    
                        temp.loanBalance = parseFloat(temp.loanBalance);
                        temp.amountRelease = parseFloat(temp.amountRelease);

                        if (!temp.paymentCollection || temp.paymentCollection <= 0) {
                            temp.paymentCollection = 0;
                            temp.mispayment = true;
                            temp.mispaymentStr = 'Yes';
                        }
    
                        if (temp.loanBalance <= 0) {
                            temp.status = 'completed';
                        }
    
                        if (temp.status === 'completed') {
                            temp.fullPaymentDate = temp.fullPaymentDate ? temp.fullPaymentDate : moment(new Date()).format('YYYY-MM-DD');
                        }
                        
                        if (typeof temp.remarks === 'object') {
                            if (temp.remarks.value === 'offset') {
                                temp.status = 'closed';
                                temp.clientStatus = 'offset';
                            } 
                            // else if (temp.remarks.value === 'delinquent') {
                            //     temp.clientStatus = "offset";
                            // }
                        }
                    }
                
                    return temp;   
                }).filter(cc => cc.status !== "totals");

                if (save) {
                    let cashCollection;
                    if (editMode) {
                        cashCollection = {
                            ...headerData,
                            dateModified: moment(new Date()).format('YYYY-MM-DD'),
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

                        // setTimeout(() => {})
                        // window.location.reload();
            
                        setTimeout(() => {
                            getCashCollections();
                        }, 500);
                    }
                } else {
                    toast.warning('No active data to be saved.');
                    setLoading(false);
                }
            }
        }
    }

    const handlePaymentCollectionChange = (e, index, type, targetCollection) => {
        if (type === 'amount') {
            const value = e.target.value;
            let payment = value ? value : 0;

            const totalObj = data.find(o => o.status === 'totals');
            const totalIdx = data.indexOf(totalObj);    

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
                            temp.pastDue = 0;
                            temp.pastDueStr = '-';
                            temp.status = 'active';
                            delete temp.delinquent;
                        } else {
                            temp.prevData = {
                                amountRelease: temp.amountRelease,
                                paymentCollection: payment,
                                excess: temp.excess !== '-' ? temp.excess : 0,
                                loanBalance: temp.loanBalance,
                                activeLoan: temp.activeLoan,
                                noOfPayments: temp.noOfPayments,
                                total: temp.total
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
    
                            if (temp.loanBalance <= 0) {
                                temp.history = {
                                    amountRelease: temp.amountRelease,
                                    loanBalance: prevLoanBalance,
                                    activeLoan: temp.activeLoan,
                                    excess: temp.excess,
                                    collection: temp.paymentCollection,
                                    loanCycle: temp.loanCycle,
                                    remarks: temp.remarks
                                };

                                if (temp.remarks === "offset") {
                                    temp.history.loanCycle = temp.loanCycle;
                                }

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
        } 
        // else if (type === 'pastDue') {
        //     const value = e.target.value;
        //     let pastDue = value ? value : 0;

        //     let list = data.map((cc, idx) => {
        //         let temp = {...cc};
        //         if (temp.status !== 'open') {
        //             if (idx === index) {
        //                 if (temp.hasOwnProperty('prevData')) {
        //                     temp.pastDue = 0;
        //                 }
                        
        //                 if (containsAnyLetters(value)) {
        //                     toast.error("Invalid amount in past due. Please input numeric only.");
        //                     temp.error = true;
        //                     temp.pastDue = 0;
        //                 } else if (parseFloat(pastDue) < targetCollection) {
        //                     // toast.error("Past due not equal to target collection.");
        //                     temp.error = true;
        //                     temp.pastDue = 0;
        //                 } else {
        //                     temp.dirty = true;
        //                     temp.error = false;
    
        //                     temp.pastDue = parseFloat(pastDue);
        //                     temp.pastDueStr = formatPricePhp(pastDue);
        //                 }
        //             } 
        //         } 
        //         return temp;
        //     });

        //     dispatch(setCashCollectionGroup(list));
        // } 
        else if (type === 'remarks') {
            const remarks = e;

            let list = data.map((cc, idx) => {
                let temp = {...cc};
                
                if (idx === index) {
                    temp.remarks = remarks;

                    if (temp.hasOwnProperty('history')) {
                        temp.history = {
                            ...temp.history,
                            remarks: remarks
                        }
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
                        }

                        temp.mispayment = false;
                        temp.mispaymentStr = 'No';
                    } else if (remarks.value === "delinquent" || remarks.value === "past due" || remarks.value === "excused") {
                        temp.targetCollection = 0;
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                        temp.mispayment = true;
                        temp.mispaymentStr = 'Yes';
                        temp.error = false;
                        temp.excused = true;

                        if (temp.remarks.value === "past due") {
                            temp.pastDue = temp.loanBalance;
                            temp.pastDueStr = formatPricePhp(temp.pastDue);
                        } else if (temp.remarks.value === "delinquent") {
                            temp.delinquent = true;
                        }

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
        let allow = true;
        if (temp.status === 'completed') {
            allow = temp.fullPaymentDate === currentDate;
        }

        if (temp.paymentCollection === 0) {
            temp.prevData = {
                amountRelease: temp.amountRelease,
                paymentCollection: 0,
                excess: 0,
                mispayment: false,
                loanBalance: temp.loanBalance,
                noOfPayments: temp.noOfPayments,
                total: temp.total
            };
            // temp.error = true;
        }

        if (allow && temp.hasOwnProperty('prevData')) {
            temp.amountRelease = temp.prevData.amountRelease;
            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
            temp.paymentCollection = parseFloat(temp.prevData.paymentCollection);
            temp.excess = temp.prevData.excess;
            temp.excessStr = temp.prevData.excess > 0 ? formatPricePhp(temp.prevData.excess) : '-';
            temp.mispayment = false;
            temp.mispaymentStr = 'No';
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
            temp.clientStatus = "active";
            temp.delinquent = false;

            if (temp.status === 'completed' || temp.status === 'closed') {
                temp.status = 'active';
                temp.clientStatus = 'active';
                delete temp.history;
                delete temp.fullPaymentDate;
            }

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

        mounted && uuid && getCurrentGroup() && getCashCollections();
        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, [uuid]);

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

    useEffect(() => {
        const dayName = moment().format('dddd');

        if (dayName === 'Saturday' || dayName === 'Sunday') {
            setWeekend(true);
        } else {
            setWeekend(false);
        }
    }, []);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} showSaveButton={currentUser.role.rep > 2 ? weekend ? false : editMode : false}
                        handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} 
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
                                        <th className="p-2 text-center">Total Loan Release w/ SC</th>
                                        <th className="p-2 text-center">Total Loan Balance</th>
                                        <th className="p-2 text-center">Current Releases</th>
                                        <th className="p-2 text-center"># of Payments</th>
                                        <th className="p-2 text-center">Target Collection</th>
                                        <th className="p-2 text-center">Excess</th>
                                        <th className="p-2 text-center">Actual Collection</th>
                                        <th className="p-2 text-center">Full Payment</th>
                                        <th className="p-2 text-center">Mispay</th>
                                        <th className="p-2 text-center">Past Due</th>
                                        <th className="p-2 text-center">Remarks</th>
                                        {/* <th className="p-2 text-center">Client Status</th> */}
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

                                        if (cc.error) {
                                            rowBg = 'bg-red-100';
                                        }

                                        return (
                                            <tr key={index} onClick={() => handleRowClick(cc)}
                                                    className={`w-full hover:bg-slate-200 border-b border-b-gray-300 font-proxima 
                                                                ${rowBg} ${cc.status === 'totals' ? 'font-bold font-proxima-bold text-red-400' : 'text-gray-600'}`} >
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.status !== 'totals' ? cc.slotNo : '' }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.fullName }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.loanCycle }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.amountReleaseStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.loanBalanceStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.currentReleaseAmountStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.noOfPaymentStr }</td>{/** after submitting please update the no of payments **/}
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.targetCollectionStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.excessStr }</td>
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right`}>
                                                    { (!weekend && currentUser.role.rep > 2 && cc.status === 'active' && editMode && (!cc.hasOwnProperty('_id') || revertMode)) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} onChange={(e) => handlePaymentCollectionChange(e, index, 'amount', cc.activeLoan)}
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
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">
                                                    { cc.pastDueStr }
                                                    {/* { (cc.remarks && cc.remarks.value === 'past due') ? (
                                                        <React.Fragment>
                                                            {editMode || revertMode ? (
                                                                <React.Fragment>
                                                                    <input type="number" name={cc.clientId} onChange={(e) => handlePaymentCollectionChange(e, index, 'pastDue', cc.activeLoan)}
                                                                        onClick={(e) => e.stopPropagation()} defaultValue={cc.pastDue} tabIndex={index + 1}
                                                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                                    focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                                </React.Fragment>
                                                            ) : (
                                                                <React.Fragment>{ cc.pastDueStr }</React.Fragment>        
                                                            )}
                                                        </React.Fragment>
                                                    ) : (
                                                        <React.Fragment>{ cc.pastDueStr }</React.Fragment>
                                                    ) } */}
                                                </td>
                                                { (!weekend && (currentUser.role.rep > 2 && (cc.status === 'active' || cc.status === 'completed') && (editMode || !groupSummaryIsClose) 
                                                    && (!cc.hasOwnProperty('_id') || revertMode) && !filter) || ((cc.remarks && cc.remarks.value === "pending") && !groupSummaryIsClose)) ? (
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
                                                        {(!weekend && currentUser.role.rep > 2 &&  (cc.status === 'active' || cc.status === 'completed') && !groupSummaryIsClose) && (
                                                            <div className='flex flex-row p-4'>
                                                                {(cc.hasOwnProperty('_id') && !filter) && <ArrowUturnLeftIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleRevert(e, cc, index)} />}
                                                                {(cc.status === 'completed' || (cc.hasOwnProperty('tomorrow') && !cc.tomorrow)) && <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />}
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