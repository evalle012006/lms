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
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';
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
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const dateFilterSubject = new BehaviorSubject(process.browser && localStorage.getItem('cashCollectionDateFilter'));
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupClients = useSelector(state => state.cashCollection.group);
    const [dataType, setDataType] = useState();
    const [groupSummary, setGroupSummary] = useState();
    const [editMode, setEditMode] = useState(true);
    const [revertMode, setRevertMode] = useState(false);
    const [groupSummaryIsClose, setGroupSummaryIsClose] = useState(false);
    const [queryMain, setQueryMain] = useState(true);
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
        { label: 'Pending', value: 'pending'},
        { label: 'Excused', value: 'excused'},
        { label: 'Double Payment', value: 'double payment'},
        { label: 'Advance Payment', value: 'advance payment'},
        { label: 'Delinquent', value: 'delinquent'},
        { label: 'Hospitalization', value: 'hospitalization'},
        { label: 'Death of Clients/Family Member', value: 'death of clients/family member'},
        { label: 'Reloaner', value: 'reloaner'},
        { label: 'For Close/Offset - Good Client', value: 'offset'},
        { label: 'For Close/Offset - Delinquent Client', value: 'offset'}
    ];
    const [filter, setFilter] = useState(false);
    const maxDays = 60;
    const [groupFilter, setGroupFilter] = useState();

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
        } else {
            setLoading(true);
            setFilter(true);
            setCurrentDate(filteredDate);

            getCashCollections(filteredDate);
        }
    }

    const getCashCollections = async (date) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-loan-by-group-cash-collection?' + new URLSearchParams({ date: date ? date : currentDate, mode: 'daily', groupId: uuid });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let cashCollection = [];

            const groupSummary = response.data.groupSummary;
            setHeaderData(groupSummary);

            if (groupSummary.status === 'pending') {
                setEditMode(currentDate === date ? true : false);
                setGroupSummaryIsClose(false);
            } else {
                setEditMode(false);
                setGroupSummaryIsClose(true);
            }

            setDataType(response.data.flag);
            
            if (response.data.flag === 'existing') {
                response.data.collection.map(cc => {
                    let temp = {...cc};
                    if (temp.status === 'active' || temp.status === 'completed' || temp.status === 'closed') {
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollectionStr);
                        temp.amountReleaseStr = formatPricePhp(temp.amountRelease);
                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                        temp.excessStr = formatPricePhp(temp.excess);
                        temp.totalStr = formatPricePhp(temp.total);
                        temp.currentReleaseAmountStr = temp.currentReleaseAmount ? formatPricePhp(temp.currentReleaseAmount) : '-';
                        temp.fullPaymentStr = temp.fullPayment ? formatPricePhp(temp.fullPayment) : '-';
                        temp.paymentCollectionStr = formatPricePhp(temp.paymentCollection);
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                        temp.noOfPaymentStr = (temp.noOfPayments !== '-' && temp.status !== 'totals') ? temp.noOfPayments + ' / ' + maxDays : '-';
                        temp.mispaymentStr = temp.mispayment ? 'Yes' : 'No';
                        temp.fullName = UppercaseFirstLetter(`${cc.client.lastName}, ${cc.client.firstName} ${cc.client.middleName ? cc.client.middleName : ''}`);
                        // temp.status = temp.loan.status;
                    }

                    cashCollection.push(temp);
                });

                if (date && date !== currentDate) {
                    cashCollection = addBlankAndTotal(true, cashCollection);
                }
            } else {
                response.data.collection.map(cc => {
                    let collection = {
                        group: cc.group,
                        loanId: cc._id,
                        branchId: cc.branchId,
                        groupId: cc.groupId,
                        groupName: cc.groupName,
                        clientId: cc.clientId,
                        slotNo: cc.slotNo,
                        fullName: cc.client.lastName + ', ' + cc.client.firstName,
                        loanCycle: cc.loanCycle,
                        mispayment: false,
                        mispaymentStr: '-',
                        collection: 0,
                        excess: 0,
                        excessStr: '-',
                        total: 0,
                        totalStr: '-',
                        noOfPayments: cc.noOfPayments,
                        noOfPaymentStr: (cc.noOfPayments !== '-' && cc.status !== 'totals') ? cc.noOfPayments + ' / ' + maxDays : '-',
                        activeLoan: cc.activeLoan,
                        targetCollection: cc.activeLoan,
                        targetCollectionStr: cc.activeLoan > 0 ? formatPricePhp(cc.activeLoan) : 0,
                        amountRelease: cc.amountRelease,
                        amountReleaseStr: cc.amountRelease > 0 ? formatPricePhp(cc.amountRelease) : 0,
                        loanBalance: cc.loanBalance,
                        loanBalanceStr: cc.loanBalance > 0 ? formatPricePhp(cc.loanBalance) : 0,
                        paymentCollection: 0,
                        paymentCollectionStr: '-',
                        occurence: cc.group.occurence,
                        currentReleaseAmount: 0,
                        currentReleaseAmountStr: '-',
                        fullPayment: 0,
                        fullPaymentStr: '-',
                        remarks: '',
                        clientStatus: cc.client.status ? cc.client.status : '-',
                        fullPaymentDate: cc.fullPaymentDate ? cc.fullPaymentDate : null
                    }
    
                    delete cc._id;
    
                    // if (cc.current.length > 0) {
                    //     collection.excess = cc.current[0].excess;
                    //     collection.excessStr = formatPricePhp(cc.current[0].excess);
                    //     collection.paymentCollection = cc.current[0].paymentCollection;
                    //     collection.paymentCollectionStr = formatPricePhp(cc.current[0].paymentCollection);
                    //     collection._id = cc.current[0]._id;
                    // }
    
                    // if (cc.history.length > 0) {
                    //     // collection.collection = formatPricePhp(cc.history[0].collection);
                    //     // collection.excess = cc.history[0].excess;
                    //     // collection.excessStr = formatPricePhp(cc.history[0].excess);
                    //     collection.total = cc.history[0].total;
                    //     collection.totalStr = formatPricePhp(cc.history[0].total);
                    //     collection.history = cc.history[0];
                    // }
    
                    if (cc.currentRelease.length > 0) {
                        collection.currentReleaseAmount = cc.currentRelease[0].currentReleaseAmount;
                        collection.currentReleaseAmountStr = cc.currentRelease[0].currentReleaseAmount ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : '-';
                    }
    
                    if (cc.fullPayment.length > 0) {
                        collection.fullPayment = cc.fullPayment[0].fullPaymentAmount;
                        collection.fullPaymentStr = cc.fullPayment[0].fullPaymentAmount ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : '-';
                    }
    
                    // if (cc.fullPaymentTotal.length > 0) {
                    //     cc.totalFullPayment += cc.fullPaymentTotal[0].fullPaymentAmount;
                    // }
    
                    if (cc.loanBalance <= 0) {
                        if (cc.fullPaymentDate === currentDate) {
                            collection.paymentCollection = cc.history ? cc.history.collection : 0;
                            collection.paymentCollectionStr = formatPricePhp(collection.paymentCollection);
                        }
                        collection.status = 'completed';
                        collection.notCalculate = true;
                        collection.remarks = cc.history ? cc.history.remarks : '-';
                    } else {
                        collection.status = 'active';
                    }
    
                    cashCollection.push(collection);
                });
            }

            setQueryMain(false);
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

    const getTomorrowPendingLoans = async (groupId) => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list-tomorrow-pending?';

        if (filter) {
            url = url + new URLSearchParams({ groupId: groupId, type: 'filter' });
        } else {
            url = url + new URLSearchParams({ groupId: groupId });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let currentData = [...data];
            await response.loans && response.loans.map(loan => {
                const currentLoan = currentData.find(l => l.clientId === loan.clientId);
                if (currentLoan && currentLoan.status !== 'pending') {
                    const index = currentData.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) { // fullpayment with pending/tomorrow
                        currentData[index] = {
                            slotNo: loan.slotNo,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountRelease: 0, // loan.amountRelease + currentLoan.loanBalance,
                            amountReleaseStr: 0, // formatPricePhp(currentLoan.amountRelease),
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
                            remarks: currentLoan.remarks,
                            fullPayment: currentLoan.fullPayment,
                            fullPaymentStr: currentLoan.fullPayment ? currentLoan.fullPaymentStr : 0,
                            status: loan.status,
                            pending: loan.status === 'pending' ? true : false,
                            tomorrow: loan.status === 'active' ? true : false
                        };
                    } else if (currentLoan.status !== 'active') {
                        currentData[index] = {
                            slotNo: loan.slotNo,
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
                    }
                } else {
                    const slot = currentData.find(c => c.slotNo === loan.slotNo);
                    if (slot) {
                        const index = currentData.indexOf(slot);
                        currentData[index] = {
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            groupId: loan.groupId,
                            branchId: loan.branchId,
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
                            status: loan.status === 'active' ? 'tomorrow' : 'pending'
                        };
                    } else { // tomorrow && pending
                        currentData.push({
                            slotNo: loan.slotNo,
                            loanId: loan._id,
                            groupId: loan.groupId,
                            branchId: loan.branchId,
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
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending'
                        });
                    }
                }
            });

            const totalIdx = currentData.findIndex(cc => cc.status === 'totals');
            const groupCapacity = currentGroup && currentGroup.capacity;

            if (dataType === 'existing' && !groupSummaryIsClose) {
                for (let i = 1; i <= groupCapacity; i++) {
                    const existData = currentData.find(cc => cc.slotNo === i);

                    if (!existData) {
                        currentData.push({
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
                    } else {
                        const index = currentData.indexOf(existData);
                        currentData[index] = {
                            ...existData,
                            group: currentGroup
                        }
                    }
                }

                if (totalIdx > -1) {
                    currentData[totalIdx] = calculateTotals(currentData);
                } else {
                    currentData.push(calculateTotals(currentData));
                }
                
            } else {
                if (totalIdx > -1) {
                    currentData[totalIdx] = calculateTotals(currentData);
                } else {
                    currentData.push(calculateTotals(currentData));
                }

                if (currentData.length < groupCapacity) {
                    currentGroup && currentGroup.availableSlots.map(g => {
                        if (g <= groupCapacity) {
                            currentData.push({
                                slotNo: g,
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
                        }
                    });
                }
            }

            currentData.sort((a, b) => { return a.slotNo - b.slotNo; });

            setTimeout(() => {
                dispatch(setCashCollectionGroup(currentData));
                setLoading(false);
            }, 200);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
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

        dataArr.map(collection => {
            if (collection.status !== 'open' && collection.status !== 'totals') {
                if (collection.status === 'active') {
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance : 0;
                }

                if (collection.status === 'tomorrow' || (collection.hasOwnProperty('tomorrow') && collection.tomorrow)) {
                    totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount : 0;
                }

                // totalPayments += collection.noOfPayments;
                totalTargetLoanCollection += collection.targetCollection ? collection.targetCollection : 0;
                totalExcess += collection.excess ? collection.excess : 0;
                totalLoanCollection += collection.paymentCollection ? collection.paymentCollection : 0;
                totalFullPayment += collection.fullPayment ? collection.fullPayment : 0;
                totalMispayment += collection.mispaymentStr === 'Yes' ? 1 : 0;
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
                }

                if (parseFloat(cc.paymentCollection) === 0 && !cc.remarks) {
                    errorMsg.add('Error occured. Please select a remarks for 0 or no payment Actual Collection.');
                }
            }
        });

        return errorMsg;
    }


    const handleSaveUpdate = async () => {
        setLoading(true);
        
        let save = false;

        if (groupSummary && groupSummary.status === 'close') {
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
                    delete temp.clientStatus;

                    if (cc.hasOwnProperty('_id')) {
                        temp.modifiedBy = currentUser._id;
                        temp.dateModified = moment(new Date()).format('YYYY-MM-DD');
                    } else {
                        temp.insertedBy = currentUser._id;
                        temp.dateAdded = moment(new Date()).format('YYYY-MM-DD');
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
                        }
                    }
                
                    return temp;   
                }).filter(cc => cc.status !== 'totals');

                if (save) {
                    let cashCollection;
                    if (editMode && dataType === 'existing') {
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
                        window.location.reload();
            
                        // setTimeout(() => {
                        //     getCashCollections();
                        // }, 500);
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
            let payment = e.target.value ? e.target.value : 0;

            const totalObj = data.find(o => o.status === 'totals');
            const totalIdx = data.indexOf(totalObj);

            let list = data.map((cc, idx) => {
                let temp = {...cc};
                if (temp.status !== 'open') {
                    if (idx === index) {
                        if (parseFloat(payment) > temp.loanBalance) {
                            toast.error("Actual collection is greater than the loan balance.");
                            temp.error = true;
                            temp.paymentCollection = 0;
                        } else if (parseFloat(payment) === 0 || parseFloat(payment) === temp.activeLoan 
                            || (parseFloat(payment) > temp.activeLoan && parseFloat(payment) % parseFloat(temp.activeLoan) === 0)
                            || parseFloat(payment) === parseFloat(temp.loanBalance)) {
                            temp.dirty = true;
                            temp.error = false;
                            if (temp.hasOwnProperty('prevData')) {
                                temp.loanBalance = temp.prevData.loanBalance;
                                temp.total = temp.prevData.total;
                                temp.noOfPayments = temp.prevData.noOfPayments;
                                temp.amountRelease = temp.prevData.amountRelease;
                                temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
                                temp.fullPayment = 0;
                                temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                temp.remarks = '';
                                temp.status = 'active';
                            } else {
                                temp.prevData = {
                                    amountRelease: temp.amountRelease,
                                    paymentCollection: payment,
                                    excess: temp.excess,
                                    loanBalance: temp.loanBalance,
                                    activeLoan: temp.activeLoan,
                                    noOfPayments: temp.noOfPayments,
                                    total: temp.total
                                };
                            }
    
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
                            // } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                            //     temp.excess =  0;
                            //     temp.mispayment = true;
                            //     temp.mispaymentStr = 'Yes';
                            //     temp.noOfPayments = temp.noOfPayments + 1;
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
                                    remarks: temp.remarks
                                };
                                temp.fullPayment = temp.amountRelease;
                                temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                                temp.loanBalanceStr = 0;
                                temp.amountRelease = 0;
                                temp.amountReleaseStr = 0;
                            }
                        } else if (parseFloat(payment) < targetCollection) {
                            toast.error("Actual collection is below the target collection.");
                            temp.error = true;
                            temp.paymentCollection = 0;
                        } else if (parseFloat(payment) % parseFloat(temp.activeLoan) !== 0) {
                            toast.error("Actual collection should be divisible by 100.");
                            temp.error = true;
                            temp.paymentCollection = 0;
                        }
                    } 
                } 
                return temp;
            });

            const totalsObj = calculateTotals(list);
            list[totalIdx] = totalsObj;

            list.sort((a, b) => { return a.slotNo - b.slotNo; });
            dispatch(setCashCollectionGroup(list));
        } else if (type === 'remarks') {
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

                    if (remarks.value === 'offset') {
                        setShowRemarksModal(true);
                        setCloseLoan(cc);
                    } else {
                        temp.closeRemarks = '';
                        setCloseLoan();
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
            console.log('open')
        }
    }

    const handleRevert = (e, selected, index) => {
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
            temp.error = true;
        }

        if (allow && temp.hasOwnProperty('prevData')) {
            temp.amountRelease = temp.prevData.amountRelease;
            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
            temp.paymentCollection = parseFloat(temp.prevData.paymentCollection);
            temp.excess = temp.prevData.excess;
            temp.excessStr = formatPricePhp(temp.prevData.excess);
            temp.mispayment = false;
            temp.mispaymentStr = 'No';
            temp.loanBalance = temp.prevData.loanBalance;
            temp.loanBalanceStr = formatPricePhp(temp.prevData.loanBalance);
            temp.noOfPayments = temp.paymentCollection !== 0 ? temp.noOfPayments - 1 : temp.noOfPayments;
            temp.noOfPaymentStr = temp.noOfPayments + ' / ' + maxDays;
            temp.total = temp.prevData.total;
            temp.totalStr = formatPricePhp(temp.prevData.total);
            temp.fullPayment = 0;
            temp.fullPaymentStr = 0;
            temp.remarks = '';

            if (temp.status === 'completed' || temp.status === 'closed') {
                temp.status = 'active';
                temp.clientStatus = 'active';
                delete temp.history;
                delete temp.fullPaymentDate;
            }
            console.log(temp);
            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
            setRevertMode(true);
        } else {
            toast.error("Data can't be reverted!");
        }
    }

    const handleReloan = (e, selected) => {
        e.stopPropagation();
        setShowAddDrawer(true);
        selected.group = currentGroup;
        setLoan(selected);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setQueryMain(true);
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

    // const handleCloseAccount = (e, selected) => {
    //     e.stopPropagation();
    //     setLoan(selected);
    //     setShowRemarksModal(true);
    // }

    // const closeAccount = () => {
    //     setLoading(true);
    //     fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'clients/close-account', {...loan, remarks: closeAccountRemarks})
    //         .then(response => {
    //             setLoading(false);
    //             toast.success('Loan successfully closed.');
    //             getCashCollections();
    //             setShowRemarksModal(false);
    //             setCloseAccountRemarks('');
    //         }).catch(error => {
    //             console.log(error);
    //         });
    // }

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
                        status: 'open'
                    });
                } else {
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
                } else {
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

            setTimeout(() => {
                dispatch(setCashCollectionGroup(cashCollection));
                setLoading(false);
            }, 200);
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
        setData(groupClients);
        setAllData(groupClients);
    }, [groupClients]);

    useEffect(() => {
        if (currentGroup && !queryMain && !groupSummaryIsClose) {
            getTomorrowPendingLoans(currentGroup._id);
        }

        if (groupSummaryIsClose && currentGroup) {
            setEditMode(false);
            addBlankAndTotal(false, data);
        } else {
            setEditMode(true);
        }
    }, [currentGroup, queryMain, groupSummaryIsClose]);

    useEffect(() => {
        // issue in date filter wherein the data is not consistent
        // in live: group pcx, dec 03 then dec 02 then dec 01 then back to dec 03
        // bug is the data is not valid
        if (dateFilterSubject.value && currentGroup) {
            const date = moment(new Date(dateFilterSubject.value)).format('YYYY-MM-DD');
            getCashCollections(date);
            setDateFilter(date);
        }
    }, [currentGroup]);

    useEffect(() => {
        if (!editMode && dataType === 'existing' && revertMode) {
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
                    {data && <DetailsHeader page={'transaction'} showSaveButton={dataType === 'new' ? true : revertMode ? true : false}
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
                                        }

                                        if (cc.error) {
                                            rowBg = 'bg-red-100';
                                        }

                                        return (
                                            <tr key={index} onClick={() => handleRowClick(cc)}
                                                    className={`w-full hover:bg-slate-200 border-b border-b-gray-300 text-gray-600 font-proxima ${rowBg} ${cc.status === 'totals' && 'font-bold font-proxima-bold'}`} >
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
                                                    { cc.status === 'active' && editMode && (!cc.hasOwnProperty('_id') || revertMode) ? (
                                                        <React.Fragment>
                                                            <input type="number" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'amount', cc.activeLoan)}
                                                                onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection} tabIndex={index + 1}
                                                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                            focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        </React.Fragment>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || filter || (dataType === 'existing' && !revertMode) || cc.status === 'completed' || cc.status === 'pending' || cc.status === 'totals' || cc.status === 'closed') ? cc.paymentCollectionStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispaymentStr }</td>
                                                { (cc.status === 'active' || (cc.status === 'completed' && cc.fullPaymentDate === currentDate)) && (editMode || !groupSummaryIsClose) && !filter ? (
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
                                                            { cc.remarks || (filter && cc.remarks) ? cc.remarks.label === 'Remarks' ? 'No Remarks' : cc.remarks.label : '-'}
                                                        </td>
                                                    )
                                                }
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                    <React.Fragment>
                                                        {(cc.status === 'active' || cc.status === 'completed') && (
                                                            <div className='flex flex-row p-4'>
                                                                {/* {console.log(cc.status)} */}
                                                                {(!groupSummaryIsClose && dataType === 'existing' && !filter) && <ArrowUturnLeftIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleRevert(e, cc, index)} />}
                                                                {(cc.status === 'completed' && !cc.tomorrow) && <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />}
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