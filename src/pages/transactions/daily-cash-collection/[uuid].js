import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from 'react-hot-toast';
import React from 'react';
import { setCashCollection, setCashCollectionGroup } from '@/redux/actions/cashCollectionActions';
import { setGroup } from '@/redux/actions/groupActions';
import DetailsHeader from '@/components/groups/DetailsHeader';
import moment from 'moment';
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';
import { XCircleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import AddUpdateLoan from '@/components/transactions/AddUpdateLoanDrawer';
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";

const CashCollectionDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const groupClients = useSelector(state => state.cashCollection.group);
    const [editMode, setEditMode] = useState(true);
    const [queryMain, setQueryMain] = useState(true);
    const [headerData, setHeaderData] = useState({});
    const [data, setData] = useState([]);
    const [allData, setAllData] = useState([]);
    const [filteredData, setFilteredData] = useState([]);
    const [currentGroup, setCurrentGroup] = useState();
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [currentDate, setCurrentDate] = useState(moment(currentDate).format('YYYY-MM-DD'));
    const [dateFilter, setDateFilter] = useState(new Date());
    // const [overallTotals, setOverallTotals] = useState([]);
    // const [overallTotalsTitles, setOverallTotalsTitles] = useState([
    //     'Loan Release',
    //     'Loan Balance',
    //     'Current Release Amount',
    //     // '# of Payments',
    //     'Target Loan Collection',
    //     'Excess',
    //     'Full Payment Amount',
    //     'Total Loan Collection'
    // ]);
    const [loan, setLoan] = useState();
    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [closeAccountRemarks, setCloseAccountRemarks] = useState();
    const remarksArr = [
        { label: 'Remarks', value: ''},
        { label: 'Excused', value: 'excused'},
        { label: 'Delinquent', value: 'delinquent'},
        { label: 'Advance Payment', value: 'advance payment'},
        { label: 'Hospitalization', value: 'hospitalization'},
        { label: 'Death of Clients/Family Member', value: 'death of clients/family member'},
        { label: 'For Close/Offset', value: 'offset'}
    ];
    const [filter, setFilter] = useState(false);
    const maxDays = 60;
    
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

            if (response.data.hasOwnProperty('collection')) {
                const collections = response.data;
                
                collections.collection.map(cc => {
                    let temp = {...cc};
                    if (temp.status !== 'open') {
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollectionStr);
                        temp.amountReleaseStr = formatPricePhp(temp.amountRelease);
                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                        temp.excessStr = formatPricePhp(temp.excess);
                        temp.totalStr = formatPricePhp(temp.total);
                        temp.currentReleaseAmountStr = formatPricePhp(temp.currentReleaseAmount);
                        temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                        temp.paymentCollectionStr = formatPricePhp(temp.paymentCollection);
                        temp.targetCollectionStr = formatPricePhp(temp.targetCollection);
                        temp.noOfPaymentStr = (temp.noOfPayments !== '-' && temp.status !== 'totals') ? temp.noOfPayments + ' / ' + maxDays : '-';
                    }
                    
                    cashCollection.push(temp);
                });

                if (collections.status === 'pending') {
                    setEditMode(true);
                    setHeaderData(collections);
                } else {
                    setEditMode(false);
                }
                setQueryMain(false);
            } else {
                response.data && response.data.map(cc => {
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
                        mispayments: cc.mispayments,
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
    
                    if (cc.current.length > 0) {
                        collection.excess = cc.current[0].excess;
                        collection.excessStr = formatPricePhp(cc.current[0].excess);
                        collection.paymentCollection = cc.current[0].paymentCollection;
                        collection.paymentCollectionStr = formatPricePhp(cc.current[0].paymentCollection);
                        collection._id = cc.current[0]._id;
                    }
    
                    if (cc.history.length > 0) {
                        // collection.collection = formatPricePhp(cc.history[0].collection);
                        // collection.excess = cc.history[0].excess;
                        // collection.excessStr = formatPricePhp(cc.history[0].excess);
                        collection.total = cc.history[0].total;
                        collection.totalStr = formatPricePhp(cc.history[0].total);
                        collection.history = cc.history[0];
                    }
    
                    if (cc.currentRelease.length > 0) {
                        collection.currentReleaseAmount = cc.currentRelease[0].currentReleaseAmount;
                        collection.currentReleaseAmountStr = formatPricePhp(cc.currentRelease[0].currentReleaseAmount);
                    }
    
                    if (cc.fullPayment.length > 0) {
                        collection.fullPayment = cc.fullPayment[0].fullPaymentAmount;
                        collection.fullPaymentStr = formatPricePhp(cc.fullPayment[0].fullPaymentAmount);
                    }
    
                    // if (cc.fullPaymentTotal.length > 0) {
                    //     cc.totalFullPayment += cc.fullPaymentTotal[0].fullPaymentAmount;
                    // }
    
                    if (cc.loanBalance <= 0) {
                        collection.status = 'completed';
                    } else {
                        collection.status = 'active';
                    }
    
                    cashCollection.push(collection);
                });
                setQueryMain(false);

                if (response.data && response.data.length > 0) {
                    setEditMode(true);
                } else {
                    setEditMode(false);
                }
            }

            dispatch(setCashCollectionGroup(cashCollection));
        } else {
            toast.error('Error retrieving cash collection list.');
        }
        setLoading(false);
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
                if (currentLoan) {
                    const index = currentData.indexOf(currentLoan);
                    if ((currentLoan.fullPaymentDate === currentDate)) {
                        currentData[index] = {
                            slotNo: loan.slotNo,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountRelease: 0,
                            amountReleaseStr: 0,
                            loanBalance: 0,
                            loanBalanceStr: 0,
                            targetCollection: currentLoan.history.activeLoan,
                            targetCollectionStr: formatPricePhp(currentLoan.history.activeLoan),
                            mispayments: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                            noOfPayments: '-',
                            noOfPaymentStr: (currentLoan.noOfPayments !== '-' && currentLoan.status !== 'totals') ? currentLoan.noOfPayments + ' / ' + maxDays : '-',
                            excess: currentLoan.history.excess,
                            excessStr: formatPricePhp(currentLoan.history.excess),
                            paymentCollection: currentLoan.history.collection,
                            paymentCollectionStr: formatPricePhp(currentLoan.history.collection),
                            remarks: '-',
                            fullPayment: currentLoan.history.total,
                            fullPaymentStr: formatPricePhp(currentLoan.history.total),
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            clientStatus: loan.client.status
                        };
                    } else if (currentLoan.status !== 'active') {
                        currentData[index] = {
                            slotNo: loan.slotNo,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayments: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                            noOfPayments: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            clientStatus: loan.client.status
                        };
                    }
                } else {
                    const slot = currentData.find(c => c.slotNo === loan.slotNo);
                    
                    if (slot) {
                        const index = currentData.indexOf(slot);
                        currentData[index] = {
                            slotNo: loan.slotNo,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayments: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            clientStatus: loan.client.status
                        };
                    } else {
                        currentData.push({
                            slotNo: loan.slotNo,
                            fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                            loanCycle: loan.loanCycle,
                            amountReleaseStr: '-',
                            loanBalanceStr: '-',
                            targetCollectionStr: '-',
                            mispayments: '-',
                            currentReleaseAmount: loan.amountRelease,
                            currentReleaseAmountStr: formatPricePhp(loan.amountRelease),
                            noOfPayments: '-',
                            noOfPaymentStr: '-',
                            targetCollectionStr: '-',
                            excessStr: '-',
                            paymentCollectionStr: '-',
                            remarks: '-',
                            fullPaymentStr: '-',
                            status: loan.status === 'active' ? 'tomorrow' : 'pending',
                            clientStatus: loan.client.status
                        });
                    }
                }
            });

            if (Object.keys(headerData).length > 0) {
                const totalRow = currentData.find(c => c.status === 'totals');
                const totalIndex = currentData.indexOf(totalRow);
                currentData[totalIndex] = currentData.push(calculateTotals(currentData));
            } else {
                currentData.push(calculateTotals(currentData));

                const groupCapacity = currentGroup && currentGroup.capacity;
                if (currentData.length < groupCapacity) {
                    currentGroup && currentGroup.availableSlots.map(g => {
                        if (g <= groupCapacity) {
                            currentData.push({
                                slotNo: g,
                                fullName: '-',
                                loanCycle: '-',
                                amountReleaseStr: '-',
                                mispayments: '-',
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
            setData(currentData);
            setAllData(currentData);
        } else if (response.error) {
            toast.error(response.message);
        }
        setLoading(false);
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

        dataArr.map(collection => {
            if (collection.status !== 'open' && collection.status !== 'totals') {
                if (collection.status !== 'pending') {
                    totalLoanRelease += collection.amountRelease ? collection.amountRelease : 0;
                    totalLoanBalance += collection.loanBalance ? collection.loanBalance : 0;
                }

                totalReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount : 0;
                // totalPayments += collection.noOfPayments;
                totalTargetLoanCollection += collection.targetCollection ? collection.targetCollection : 0;
                totalExcess += collection.excess ? collection.excess : 0;
                totalLoanCollection += collection.paymentCollection ? collection.paymentCollection : 0;
                totalFullPayment += collection.fullPayment ? collection.fullPayment : 0;
            }
        });

        const totals = {
            slotNo: 100,
            fullName: 'TOTALS',
            loanCycle: '',
            amountRelease: totalLoanRelease,
            amountReleaseStr: totalLoanRelease ? formatPricePhp(totalLoanRelease) : 0,
            mispayments: '-',
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


    const handleSaveUpdate = async () => {
        setLoading(true);
        // save the whole clients in an object
        const dataArr = groupClients && groupClients.map(cc => {
            // if (cc.status === 'active') { // check if status !== 'open'
                let temp = {...cc};
                delete temp.group;
                // delete temp.history;
                delete temp.targetCollectionStr;
                delete temp.amountReleaseStr;
                delete temp.loanBalanceStr;
                delete temp.excessStr;
                delete temp.totalStr;
                delete temp.currentReleaseAmountStr;
                delete temp.fullPaymentStr;
                delete temp.paymentCollectionStr;
                delete temp.noOfPaymentStr;

                if (currentUser.role.rep === 4) {
                    temp.loId = currentUser._id;
                } else {
                    temp.loId = currentGroup && currentGroup.loanOfficerId;
                }

                // temp.insertBy = currentUser._id;

                temp.loanBalance = parseFloat(temp.loanBalance);
                temp.amountRelease = parseFloat(temp.amountRelease);

                if (temp.status === 'completed') {
                    temp.fullPaymentDate = moment(new Date()).format('YYYY-MM-DD');
                }
               
                return temp;   
            // }
        }).filter(cc => typeof cc !== 'undefined');

        let cashCollection;
        
        if (editMode && Object.keys(headerData).length > 0) {
            cashCollection = {
                ...headerData,
                dateModified: moment(new Date()).format('YYYY-MM-DD'),
                status: 'pending',
                modifiedBy: currentUser._id,
                collection: JSON.stringify(dataArr)
            };
        } else {
            cashCollection = {
                branchId: currentGroup && currentGroup.branchId,
                groupId: currentGroup && currentGroup._id,
                loId: currentGroup && currentGroup.loanOfficerId,
                dateAdded: moment(new Date()).format('YYYY-MM-DD'),
                status: 'pending',
                insertBy: currentUser._id,
                collection: JSON.stringify(dataArr),
                mode: 'daily'
            };
        }

        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/save', cashCollection);
        if (response.success) {
            setLoading(false);
            toast.success('Payment collection successfully submitted.');

            setTimeout(() => {
                getCashCollections();
            }, 500);
        }
    }

    const handlePaymentCollectionChange = (e, index, type) => {
        if (type === 'amount') {
            let payment = e.target.value ? e.target.value : 0;
            if (payment) {
                if (payment % 10 !== 0) {
                    toast.error('Entered amount should be divisible by 10.');
                }

                const totalObj = data.find(o => o.status === 'totals');
                const totalIdx = data.indexOf(totalObj);

                let list = data.map((cc, idx) => {
                    let temp = {...cc};
                    if (idx === index) {
                        if (temp.hasOwnProperty('prevData')) {
                            temp.loanBalance = temp.prevData.loanBalance;
                            temp.total = temp.prevData.total;
                            temp.noOfPayments = temp.prevData.noOfPayments;
                            temp.amountRelease = temp.prevData.amountRelease;
                            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
                            temp.status = 'active';
                        } else {
                            temp.prevData = {
                                amountRelease: temp.amountRelease,
                                paymentCollection: temp.paymentCollection,
                                excess: temp.excess,
                                loanBalance: temp.loanBalance,
                                noOfPayments: temp.noOfPayments,
                                total: temp.total
                            };
                        }

                        payment = payment - payment % 10; // not yet working...i think its best to check before saving???
                        temp.paymentCollection = parseFloat(payment);
                        temp.paymentCollectionStr = formatPricePhp(payment);
                        temp.loanBalance = parseFloat(temp.loanBalance) - parseFloat(payment);
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : 0;
                        temp.total = parseFloat(temp.total) + parseFloat(payment);
                        temp.totalStr = formatPricePhp(temp.total);

                        temp.excess =  0;
                        temp.excessStr = '-';
                        if (parseFloat(payment) === 0) {
                            temp.noOfPayments = temp.noOfPayments - 1;
                            temp.mispayment = true;
                        } else if (parseFloat(payment) > parseFloat(temp.activeLoan)) {
                            temp.excess = parseFloat(payment) - parseFloat(temp.activeLoan);
                            temp.excessStr = formatPricePhp(temp.excess);
                            temp.mispayment = false;
                            temp.noOfPayments = temp.noOfPayments + 1;
                        } else if (parseFloat(payment) < parseFloat(temp.activeLoan)) {
                            temp.excess =  0;
                            temp.mispayment = true;
                            temp.noOfPayments = temp.noOfPayments + 1;
                        } else {
                            temp.mispayment = false;
                            temp.noOfPayments = temp.noOfPayments + 1;
                        }

                        temp.noOfPaymentStr = temp.noOfPayments + ' / ' + maxDays;

                        if (temp.loanBalance <= 0) {
                            temp.fullPayment = temp.amountRelease;
                            temp.fullPaymentStr = formatPricePhp(temp.fullPayment);
                            temp.loanBalanceStr = 0;
                            temp.amountRelease = 0;
                            temp.amountReleaseStr = 0;
                            temp.status = "completed";
                        }
                    } else {
                        temp.excess =  0;
                        temp.paymentCollectionStr = formatPricePhp(temp.paymentCollection);
                        temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                        temp.totalStr = formatPricePhp(temp.total);

                        if (parseFloat(temp.paymentCollection) === 0) {
                            temp.mispayment = true;
                        } else if (parseFloat(temp.paymentCollection) > parseFloat(temp.activeLoan)) {
                            temp.excess = parseFloat(temp.paymentCollection) - parseFloat(temp.activeLoan);
                            temp.excessStr = formatPricePhp(temp.excess);
                            temp.mispayment = false;
                        } else if (parseFloat(temp.paymentCollection) < parseFloat(temp.activeLoan)) {
                            temp.excess =  0;
                            temp.mispayment = true;
                        } else {
                            temp.mispayment = false;
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
            let list = groupClients.map((cc, idx) => {
                let temp = {...cc};
                
                if (idx === index) {
                    temp.remarks = remarks;

                    if (remarks === 'offset') {
                        setShowRemarksModal(true);
                        temp.closeRemarks = closeAccountRemarks;
                    } else {
                        temp.closeRemarks = '';
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
        if (temp.hasOwnProperty('prevData')) {
            temp.amountRelease = temp.prevData.amountRelease;
            temp.amountReleaseStr = formatPricePhp(temp.prevData.amountRelease);
            temp.paymentCollection = temp.prevData.paymentCollection;
            temp.excess = temp.prevData.excess;
            temp.excessStr = formatPricePhp(temp.prevData.excess);
            temp.loanBalance = temp.prevData.loanBalance;
            temp.loanBalanceStr = formatPricePhp(temp.prevData.loanBalance);
            temp.noOfPayments = temp.noOfPayments - 1;
            temp.total = temp.prevData.total;
            temp.totalStr = formatPricePhp(temp.prevData.total);
            temp.status = 'active';

            origList[index] = temp;
            dispatch(setCashCollectionGroup(origList));
        }
    }

    // const handleReloan = (e, selected) => {
    //     e.stopPropagation();
    //     setShowAddDrawer(true);
    //     setLoan(selected);
    // }

    // const handleCloseAddDrawer = () => {
    //     setLoading(true);
    //     window.location.reload();
    // }

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

    useEffect(() => {
        let mounted = true;
        setLoading(true);

        const getCurrentGroup = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                dispatch(setGroup(response.group));
                setCurrentGroup(response.group);
                setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentGroup(uuid) && getCashCollections();

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        setData(groupClients);
    }, [groupClients]);

    useEffect(() => {
        if (currentGroup, !queryMain) {
            getTomorrowPendingLoans(currentGroup._id);
        }
    }, [currentGroup, queryMain]);

    useEffect(() => {
        if (filteredData.length > 0) {
            setAllData(data);
            setData(filteredData);
        } else {
            setData(allData);
        }
    }, [filteredData]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {data && <DetailsHeader page={'transaction'} editMode={editMode}
                        handleSaveUpdate={handleSaveUpdate} data={allData} setData={setFilteredData} 
                        dateFilter={dateFilter} setDateFilter={setDateFilter} handleDateFilter={handleDateFilter} />}
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
                                        {editMode && headerData.hasOwnProperty('_id') && (
                                            <th className="p-2 text-center">Actions</th>
                                        )}
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
                                                <td className={`px-4 py-3 whitespace-nowrap-custom cursor-pointer ${cc.status !== 'active' && 'text-center'} ${cc.hasOwnProperty('_id') && 'text-right'}`}>
                                                    { cc.status === 'active' && editMode ? (
                                                        <input type="number" name={cc.clientId} onBlur={(e) => handlePaymentCollectionChange(e, index, 'amount')}
                                                            onClick={(e) => e.stopPropagation()} defaultValue={cc.paymentCollection} tabIndex={index + 1}
                                                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg 
                                                                        focus:ring-main focus:border-main block p-2.5" style={{ width: '100px' }}/>
                                                        ): 
                                                            <React.Fragment>
                                                                {(!editMode || cc.status === 'pending' || cc.status === 'totals') ? cc.paymentCollectionStr : '-'}
                                                            </React.Fragment>
                                                    }
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-right">{ cc.fullPaymentStr }</td>
                                                <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer text-center">{ cc.mispayments }</td>
                                                { cc.status === 'active' && editMode ? (
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
                                                            { cc.status === 'completed' ? cc.remarks.label : '-'}
                                                        </td>
                                                    )
                                                }
                                                {/* <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">{ cc.clientStatus }</td> */}
                                                {/* { cc.status === 'completed' ? (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                            <div className='flex flex-row p-4'>
                                                                <ArrowPathIcon className="w-5 h-5 mr-6" title="Reloan" onClick={(e) => handleReloan(e, cc)} />
                                                                {(cc.fullPaymentDate && cc.fullPaymentDate !== currentDate) && <XCircleIcon className="w-5 h-5" title="Close" onClick={(e) => handleCloseAccount(e, cc)} />}
                                                            </div>
                                                        </td>
                                                    ) : (
                                                        <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer"></td>
                                                    )
                                                } */}
                                                {editMode && headerData.hasOwnProperty('_id') && (
                                                    <React.Fragment>
                                                        {cc.status === 'active' || cc.status === 'completed' ? (
                                                            <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer">
                                                                <div className='flex flex-row p-4'>
                                                                    <ArrowPathIcon className="w-5 h-5 mr-6" title="Revert" onClick={(e) => handleRevert(e, cc, index)} />
                                                                </div>
                                                            </td>
                                                        ) : (
                                                            <td className="px-4 py-3 whitespace-nowrap-custom cursor-pointer"></td>
                                                        )}
                                                    </React.Fragment>
                                                )}
                                            </tr>    
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    {/* <div className="w-full h-16 bg-white border-t-2 border-gray-300 fixed bottom-0 flex pl-8">
                        <table className="table-auto border-collapse text-sm font-proxima ml-10">
                            <thead className="text-gray-400">
                                <tr className="">
                                    {overallTotalsTitles.map((o, i) => {
                                        return (
                                            <th key={i} className="px-4">
                                                { o }
                                            </th>
                                        )
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="text-lg">
                                    {overallTotals.map((o, i) => {
                                        return (
                                            <td key={i} className="px-4"><center>{ o !== 0  ? formatPricePhp(o) : o }</center></td>
                                        )
                                    })}
                                </tr>
                            </tbody>
                        </table>
                    </div> */}
                    {/* {loan && <AddUpdateLoan mode={'reloan'} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />} */}
                    {/* <Dialog show={showRemarksModal}>
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
                        <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                            <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowRemarksModal(false)} />
                            <ButtonSolid label="Close Account" type="button" className="p-2" onClick={closeAccount} />
                        </div>
                    </Dialog> */}
                </div>
            )}
        </Layout>
    );
}

export default CashCollectionDetailsPage;