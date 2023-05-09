import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { formatPricePhp } from "@/lib/utils";
import { toast } from 'react-hot-toast';
import { BehaviorSubject } from 'rxjs';
import { setBmSummary, setCashCollectionLo } from "@/redux/actions/cashCollectionActions";

const ViewByLoanOfficerPage = ({ pageNo, dateFilter, type }) => {
    const dispatch = useDispatch();
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [userLOList, setUserLOList] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
   
    const router = useRouter();

    const handleRowClick = (selected) => {
        if (selected && selected.hasOwnProperty('_id')) {
            localStorage.setItem('selectedLO', selected._id);
            router.push(`/transactions/${selected.transactionType}-cash-collection/group/${selected._id}`);
        }
    };

    const getGroupCashCollections = async (selectedBranch, date) => {
        setLoading(true);
        const filter = date ? true : false;
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-group?' + new URLSearchParams({ date: date ? date : currentDate, branchCode: selectedBranch, dayName: dayName });
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];
            let noOfClients = 0;
            let noOfBorrowers = 0;
            let totalsLoanRelease = 0;
            let totalsLoanBalance = 0;
            let noOfNewCurrentRelease = 0;
            let noOfReCurrentRelease = 0;
            let currentReleaseAmount = 0;
            let targetLoanCollection = 0;
            let excess = 0;
            let totalLoanCollection = 0;
            let noOfFullPayment = 0;
            let fullPaymentAmount = 0;
            let mispayment = 0;
            let totalPastDue = 0;
            let totalNoPastDue = 0;
            let offsetPerson = 0;
            let totalMcbu = 0;
            let totalMcbuCol = 0;
            let totalMcbuWithdrawal = 0;
            let totalMcbuReturnNo = 0;
            let totalMcbuReturnAmt = 0;
            let totalMcbuInterest = 0;
            let totalTransfer = 0;

            let selectedBranch;
            response.data && response.data.map(lo => {
                selectedBranch = lo.designatedBranchId;
                const nameArr = lo.firstName.split(' ');
                let collection = {
                    _id: lo._id,
                    name: `${lo.firstName} ${lo.lastName}`,
                    transactionType: lo.transactionType,
                    order: nameArr[1],
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    totalReleasesStr: '-',
                    totalLoanBalanceStr: '-',
                    loanTargetStr: '-',
                    mcbuStr: '-',
                    mcbuColStr: '-',
                    mcbuWithdrawalStr: '-',
                    noMcbuReturn: '-',
                    mcbuReturnAmtStr: '-',
                    mcbuInterestStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    groupSummaryIds: [],
                    pastDueStr: '-',
                    noPastDue: '-',
                    offsetPerson: '-',
                    transfer: '-',
                    page: 'loan-officer-summary',
                    status: '-'
                };

                let groupStatus = 'open';
                if (lo.cashCollections.length > 0) {
                    const transactionStatus = lo.cashCollections[0].groupStatusArr.filter(status => status === "closed");
                    if (transactionStatus.length > 0) {
                        groupStatus = 'close';
                    }
                }

                if (!filter) {
                    if (lo.activeLoans.length > 0) {
                        collection.activeClients = lo.activeLoans[0].activeClients; 
                        collection.activeBorrowers = lo.activeLoans[0].activeBorrowers;
                        noOfClients += lo.activeLoans[0].activeClients;
                        noOfBorrowers += lo.activeLoans[0].activeBorrowers;
                    }
    
                    if (lo.loans.length > 0) {
                        collection.totalLoanRelease = lo.loans[0].totalRelease;
                        collection.totalReleasesStr = lo.loans[0].totalRelease > 0 ? formatPricePhp(lo.loans[0].totalRelease) : '-';
                        collection.totalLoanBalance = lo.loans[0].totalLoanBalance;
                        collection.totalLoanBalanceStr = lo.loans[0].totalLoanBalance > 0 ? formatPricePhp(lo.loans[0].totalLoanBalance) : '-';
                        collection.loanTarget = lo.loans[0].loanTarget;
                        collection.loanTargetStr = lo.loans[0].loanTarget > 0 ? formatPricePhp(lo.loans[0].loanTarget) : '-';
                        collection.pastDue = lo.loans[0].pastDue;
                        collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = lo.loans[0].noPastDue;
                        collection.mcbu = lo.loans[0].mcbu;
                        collection.mcbuStr = lo.loans[0].mcbu > 0 ? formatPricePhp(lo.loans[0].mcbu) : '-';
                        collection.mcbuCol = 0;
                        collection.mcbuColStr = '-';
                        collection.mcbuWithdrawal = 0;
                        collection.mcbuWithdrawalStr = '-';
                        collection.noMcbuReturn = 0;
                        collection.mcbuReturnAmt = 0;
                        collection.mcbuReturnAmtStr = '-';
                        collection.mcbuInterest = lo.loans[0].mcbuInterest;
                        collection.mcbuInterestStr = lo.loans[0].mcbuInterest > 0 ? lo.loans[0].mcbuInterest : '-';
                        collection.status = groupStatus;
    
                        totalsLoanRelease += collection.totalLoanRelease ? collection.totalLoanRelease : 0;
                        totalsLoanBalance += collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                        if (lo.transactionType === 'daily') {
                            targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
                        }
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        // totalMcbu += collection.mcbu;
                    }

                    if (lo.transactionType === "weekly") {
                        let loLoanTarget = 0;
                        let loMcbu = 0;

                        if (lo.groups.length > 0) {
                            lo.groups.map(g => {
                                if (g.loanTarget.length > 0) {
                                    loLoanTarget += g.loanTarget[0].loanTarget;
                                    loMcbu += g.loanTarget[0].mcbu;
                                }
                            });
                        }

                        collection.loanTarget = loLoanTarget;
                        collection.loanTargetStr = loLoanTarget > 0 ? formatPricePhp(loLoanTarget) : '-';
                        targetLoanCollection += loLoanTarget;
                        // collection.mcbu = loMcbu;
                        // collection.mcbuStr = loMcbu > 0 ? formatPricePhp(loMcbu) : '-';
                    }
                    
                    if (lo.cashCollections.length > 0) {
                        const loanTarget = collection.loanTarget - lo.cashCollections[0].loanTarget;
                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excess = lo.cashCollections[0].excess;
                        collection.excessStr = lo.cashCollections[0].excess > 0 ? formatPricePhp(lo.cashCollections[0].excess) : '-';
                        collection.total = lo.cashCollections[0].collection;
                        collection.totalStr = lo.cashCollections[0].collection > 0 ? formatPricePhp(lo.cashCollections[0].collection) : '-';
                        collection.mispayment = lo.cashCollections[0].mispayment;
                        collection.mispaymentStr = lo.cashCollections[0].mispayment > 0 ? lo.cashCollections[0].mispayment : '-';
                        collection.offsetPerson = lo.cashCollections[0].offsetPerson ? lo.cashCollections[0].offsetPerson : 0;
                        collection.mcbu = lo.cashCollections[0].mcbu;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = lo.cashCollections[0].mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = lo.cashCollections[0].mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = lo.cashCollections[0].noMcbuReturn;
                        collection.mcbuReturnAmt = lo.cashCollections[0].mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.mcbuInterest = lo.cashCollections[0].mcbuInterest;
                        collection.mcbuInterestStr = lo.cashCollections[0].mcbuInterest > 0 ? lo.cashCollections[0].mcbuInterest : '-';
                        collection.transfer = lo.cashCollections[0].transfer;
                        collection.transferred = lo.cashCollections[0].transferred;
                        collection.status = groupStatus;

                        if (collection.transferred > 0) {
                            collection.transfer = collection.transfer - collection.transferred;
                        }
    
                        excess += lo.cashCollections[0].excess;
                        totalLoanCollection += lo.cashCollections[0].collection;
                        mispayment += lo.cashCollections[0].mispayment;
                        targetLoanCollection = targetLoanCollection - lo.cashCollections[0].loanTarget;
                        offsetPerson += collection.offsetPerson;
                        // totalMcbu += collection.mcbu;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    }
                    totalMcbu += collection.mcbu ? collection.mcbu : 0;
                    totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
    
                    if (lo.currentRelease.length > 0) {
                        const newReleasePerson = lo.currentRelease[0].newCurrentRelease ? lo.currentRelease[0].newCurrentRelease : 0;
                        const reReleasePerson = lo.currentRelease[0].reCurrentRelease ? lo.currentRelease[0].reCurrentRelease : 0;
                        collection.newReleasePerson = newReleasePerson;
                        collection.reReleasePerson = reReleasePerson;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmount = lo.currentRelease[0].currentReleaseAmount;
                        collection.currentReleaseAmountStr = formatPricePhp(lo.currentRelease[0].currentReleaseAmount);
    
                        noOfNewCurrentRelease += lo.currentRelease[0].newCurrentRelease;
                        noOfReCurrentRelease += lo.currentRelease[0].reCurrentRelease;
                        currentReleaseAmount += lo.currentRelease[0].currentReleaseAmount;
                    }
    
                    if (lo.fullPayment.length > 0) {
                        collection.noOfFullPayment = lo.fullPayment[0].noOfFullPayment;
                        collection.fullPaymentAmount = lo.fullPayment[0].fullPaymentAmount;
                        collection.fullPaymentAmountStr = lo.fullPayment[0].fullPaymentAmount > 0 ? formatPricePhp(lo.fullPayment[0].fullPaymentAmount) : '-';
    
                        fullPaymentAmount += lo.fullPayment[0].fullPaymentAmount;
                        noOfFullPayment += lo.fullPayment[0].noOfFullPayment;
                        // noOfNewfullPayment += lo.fullPayment[0].newFullPayment;
                        // noOfRefullPayment += lo.fullPayment[0].reFullPayment;
                    }
                } else {
                    if (lo.cashCollections.length > 0) {
                        collection.activeClients = lo.cashCollections[0].activeClients; 
                        collection.activeBorrowers = lo.cashCollections[0].activeBorrowers;
                        collection.totalLoanRelease = lo.cashCollections[0].totalRelease;
                        collection.totalReleasesStr = lo.cashCollections[0].totalRelease > 0 ? formatPricePhp(lo.cashCollections[0].totalRelease) : '-';
                        collection.totalLoanBalance = lo.cashCollections[0].totalLoanBalance;
                        collection.totalLoanBalanceStr = lo.cashCollections[0].totalLoanBalance > 0 ? formatPricePhp(lo.cashCollections[0].totalLoanBalance) : '-';
                        collection.loanTarget = lo.cashCollections[0].loanTarget;
                        collection.loanTargetStr = lo.cashCollections[0].loanTarget > 0 ? formatPricePhp(lo.cashCollections[0].loanTarget) : '-';
                        collection.excess = lo.cashCollections[0].excess;
                        collection.excessStr = lo.cashCollections[0].excess > 0 ? formatPricePhp(lo.cashCollections[0].excess) : '-';
                        collection.total = lo.cashCollections[0].collection;
                        collection.totalStr = lo.cashCollections[0].collection > 0 ? formatPricePhp(lo.cashCollections[0].collection) : '-';
                        collection.mispayment = lo.cashCollections[0].mispayment;
                        collection.mispaymentStr = lo.cashCollections[0].mispayment > 0 ? lo.cashCollections[0].mispayment : '-';
                        collection.pastDue = lo.cashCollections[0].pastDue;
                        collection.pastDueStr = lo.cashCollections[0].pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = lo.cashCollections[0].noPastDue;
                        collection.offsetPerson = lo.cashCollections[0].offsetPerson;

                        collection.mcbu = lo.cashCollections[0].mcbu ? lo.cashCollections[0].mcbu: 0;
                        collection.mcbuStr = collection.mcbu ? formatPricePhp(collection.mcbu): '-';
                        collection.mcbuCol = lo.cashCollections[0].mcbuCol ? lo.cashCollections[0].mcbuCol: 0;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol): '-';
                        collection.mcbuWithdrawal = lo.cashCollections[0].mcbuWithdrawal ? lo.cashCollections[0].mcbuWithdrawal: 0;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal): '-';
                        collection.noMcbuReturn = lo.cashCollections[0].mcbuReturnNo ? lo.cashCollections[0].mcbuReturnNo: 0;
                        collection.mcbuReturnAmt = lo.cashCollections[0].mcbuReturnAmt ? lo.cashCollections[0].mcbuReturnAmt: 0;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt): '-';
                        collection.mcbuInterest = lo.cashCollections[0].mcbuInterest;
                        collection.mcbuInterestStr = lo.cashCollections[0].mcbuInterest > 0 ? lo.cashCollections[0].mcbuInterest : '-';
                        collection.status = groupStatus;

                        const newReleasePerson = lo.cashCollections[0].newCurrentRelease;
                        const reReleasePerson = lo.cashCollections[0].reCurrentRelease;
                        collection.newReleasePerson = newReleasePerson;
                        collection.reReleasePerson = reReleasePerson;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmount = lo.cashCollections[0].currentReleaseAmount;
                        collection.currentReleaseAmountStr = lo.cashCollections[0].currentReleaseAmount > 0 ? formatPricePhp(lo.cashCollections[0].currentReleaseAmount) : '-';
                        collection.noOfFullPayment = lo.cashCollections[0].noOfFullPayment;
                        collection.fullPaymentAmount = lo.cashCollections[0].fullPaymentAmount;
                        collection.fullPaymentAmountStr = lo.cashCollections[0].fullPaymentAmount > 0 ? formatPricePhp(lo.cashCollections[0].fullPaymentAmount) : '-';

                        collection.transfer = lo.cashCollections[0].transfer;
                        collection.transferred = lo.cashCollections[0].transferred;

                        if (collection.transferred > 0) {
                            collection.transfer = collection.transfer - collection.transferred;
                        }
    
                        noOfClients += lo.cashCollections[0].activeClients;
                        noOfBorrowers += lo.cashCollections[0].activeBorrowers;
                        totalsLoanRelease += collection.totalLoanRelease;
                        totalsLoanBalance += lo.cashCollections[0].totalLoanBalance;
                        targetLoanCollection += lo.cashCollections[0].loanTarget;
                        excess += lo.cashCollections[0].excess;
                        totalLoanCollection += lo.cashCollections[0].collection;
                        mispayment += lo.cashCollections[0].mispayment;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        noOfNewCurrentRelease += lo.cashCollections[0].newCurrentRelease;
                        noOfReCurrentRelease += lo.cashCollections[0].reCurrentRelease;
                        currentReleaseAmount += lo.cashCollections[0].currentReleaseAmount;
                        fullPaymentAmount += lo.cashCollections[0].fullPaymentAmount;
                        noOfFullPayment += lo.cashCollections[0].noOfFullPayment;
                        offsetPerson += collection.offsetPerson ? collection.offsetPerson : 0;
                        totalMcbu += collection.mcbu ? collection.mcbu : 0;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal: 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    }
                }
                
                collectionData.push(collection);
            });

            collectionData.sort((a, b) => a.order - b.order);

            collectionData.push(getDailyTotals(collectionData));
            collectionData.push(getWeeklyTotals(collectionData));

            // totals
            const loTotals = {
                name: 'GRAND TOTALS',
                transfer: totalTransfer,
                noOfNewCurrentRelease: noOfNewCurrentRelease,
                noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmount: currentReleaseAmount,
                currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                totalLoanRelease: totalsLoanRelease,
                totalReleasesStr: formatPricePhp(totalsLoanRelease),
                totalLoanBalance: totalsLoanBalance,
                totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
                targetLoanCollection: targetLoanCollection,
                loanTargetStr: formatPricePhp(targetLoanCollection),
                excess: excess,
                excessStr: formatPricePhp(excess),
                totalLoanCollection: totalLoanCollection,
                totalStr: formatPricePhp(totalLoanCollection),
                mispayment: mispayment,
                mispaymentStr: mispayment + ' / ' + noOfClients,
                fullPaymentAmount: fullPaymentAmount,
                fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
                noOfFullPayment: noOfFullPayment,
                pastDue: totalPastDue,
                pastDueStr: formatPricePhp(totalPastDue),
                noPastDue: totalNoPastDue,
                offsetPerson: offsetPerson,
                mcbu: totalMcbu,
                mcbuStr: formatPricePhp(totalMcbu),
                mcbuCol: totalMcbuCol,
                mcbuColStr: formatPricePhp(totalMcbuCol),
                mcbuWithdrawal: totalMcbuWithdrawal,
                mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
                noMcbuReturn: totalMcbuReturnNo,
                mcbuReturnAmt: totalMcbuReturnAmt,
                mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
                mcbuInterest: totalMcbuInterest,
                mcbuInterestStr: formatPricePhp(totalMcbuInterest),
                totalData: true
            };

            collectionData.push(loTotals);
            const dailyLos = {...createLos(loTotals, date, selectedBranch, false), losType: "daily"};
            dispatch(setBmSummary(dailyLos));
            // const currentMonth = moment().month();
            // if (!filter && currentMonth === 0 && currentUser.role.rep === 3) {
            //     saveYearEndLos(loTotals, selectedBranch, true);
            // }
            
            setUserLOList(collectionData);
            dispatch(setCashCollectionLo(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const getDailyTotals = (collectionData) => {
        let noOfClients = 0;
        let noOfBorrowers = 0;
        let totalsLoanRelease = 0;
        let totalsLoanBalance = 0;
        let noOfNewCurrentRelease = 0;
        let noOfReCurrentRelease = 0;
        let currentReleaseAmount = 0;
        let targetLoanCollection = 0;
        let excess = 0;
        let totalLoanCollection = 0;
        let noOfFullPayment = 0;
        let fullPaymentAmount = 0;
        let mispayment = 0;
        let totalPastDue = 0;
        let totalNoPastDue = 0;
        let offsetPerson = 0;
        let totalMcbu = 0;
        let totalMcbuCol = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuReturnNo = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuInterest = 0;
        let totalTransfer = 0;

        collectionData.filter(u => u.transactionType === 'daily').map(collection => {
            noOfClients += (collection.activeClients && collection.activeClients !== '-') ? collection.activeClients : 0;
            noOfBorrowers += (collection.activeBorrowers && collection.activeBorrowers !== '-') ? collection.activeBorrowers : 0;
            totalsLoanRelease += collection.totalLoanRelease ? collection.totalLoanRelease : 0;
            totalsLoanBalance += collection.totalLoanBalance ? collection.totalLoanBalance : 0;
            noOfNewCurrentRelease += collection.newReleasePerson ? collection.newReleasePerson : 0;
            noOfReCurrentRelease += collection.reReleasePerson ? collection.reReleasePerson : 0;
            currentReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount : 0;
            targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
            excess += collection.excess ? collection.excess : 0;
            totalLoanCollection += collection.total ? collection.total : 0;
            noOfFullPayment += (collection.noOfFullPayment && collection.noOfFullPayment !== '-') ? collection.noOfFullPayment : 0;
            fullPaymentAmount += collection.fullPaymentAmount ? collection.fullPaymentAmount : 0;
            mispayment += (collection.mispayment && collection.mispayment !== '-') ? collection.mispayment : 0;
            totalPastDue += collection.pastDue ? collection.pastDue : 0;
            totalNoPastDue += (collection.noPastDue && collection.noPastDue !== '-') ? collection.noPastDue : 0;
            offsetPerson += collection.offsetPerson ? collection.offsetPerson : 0;
            totalMcbu += collection.mcbu ? collection.mcbu : 0;
            totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
            totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
            totalMcbuReturnNo += collection.mcbuReturnNo ? collection.mcbuReturnNo : 0;
            totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
            totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
            totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
        });

        return {
            name: 'Daily Totals',
            transfer: totalTransfer,
            noOfNewCurrentRelease: noOfNewCurrentRelease,
            noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
            noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
            currentReleaseAmount: currentReleaseAmount,
            currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
            activeClients: noOfClients,
            activeBorrowers: noOfBorrowers,
            totalLoanRelease: totalsLoanRelease,
            totalReleasesStr: formatPricePhp(totalsLoanRelease),
            totalLoanBalance: totalsLoanBalance,
            totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
            targetLoanCollection: targetLoanCollection,
            loanTargetStr: formatPricePhp(targetLoanCollection),
            excess: excess,
            excessStr: formatPricePhp(excess),
            totalLoanCollection: totalLoanCollection,
            totalStr: formatPricePhp(totalLoanCollection),
            mispayment: mispayment,
            mispaymentStr: mispayment + ' / ' + noOfClients,
            fullPaymentAmount: fullPaymentAmount,
            fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
            noOfFullPayment: noOfFullPayment,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
            noPastDue: totalNoPastDue,
            offsetPerson: offsetPerson,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            mcbuCol: totalMcbuCol,
            mcbuColStr: formatPricePhp(totalMcbuCol),
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
            noMcbuReturn: totalMcbuReturnNo,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: formatPricePhp(totalMcbuInterest),
            totalData: true
        };
    }

    const getWeeklyTotals = (collectionData) => {
        let noOfClients = 0;
        let noOfBorrowers = 0;
        let totalsLoanRelease = 0;
        let totalsLoanBalance = 0;
        let noOfNewCurrentRelease = 0;
        let noOfReCurrentRelease = 0;
        let currentReleaseAmount = 0;
        let targetLoanCollection = 0;
        let excess = 0;
        let totalLoanCollection = 0;
        let noOfFullPayment = 0;
        let fullPaymentAmount = 0;
        let mispayment = 0;
        let totalPastDue = 0;
        let totalNoPastDue = 0;
        let offsetPerson = 0;
        let totalMcbu = 0;
        let totalMcbuCol = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuReturnNo = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuInterest = 0;
        let totalTransfer = 0;

        collectionData.filter(u => u.transactionType === 'weekly').map(collection => {
            noOfClients += (collection.activeClients && collection.activeClients !== '-') ? collection.activeClients : 0;
            noOfBorrowers += (collection.activeBorrowers && collection.activeBorrowers !== '-') ? collection.activeBorrowers : 0;
            totalsLoanRelease += collection.totalReleases ? collection.totalReleases : 0;
            totalsLoanBalance += collection.totalLoanBalance ? collection.totalLoanBalance : 0;
            noOfNewCurrentRelease += collection.newReleasePerson ? collection.newReleasePerson : 0;
            noOfReCurrentRelease += collection.reReleasePerson ? collection.reReleasePerson : 0;
            currentReleaseAmount += collection.currentReleaseAmount ? collection.currentReleaseAmount : 0;
            targetLoanCollection += collection.loanTarget ? collection.loanTarget : 0;
            excess += collection.excess ? collection.excess : 0;
            totalLoanCollection += collection.total ? collection.total : 0;
            noOfFullPayment += (collection.noOfFullPayment && collection.noOfFullPayment !== '-') ? collection.noOfFullPayment : 0;
            fullPaymentAmount += collection.fullPaymentAmount ? collection.fullPaymentAmount : 0;
            mispayment += (collection.mispayment && collection.mispayment !== '-') ? collection.mispayment : 0;
            totalPastDue += collection.pastDue ? collection.pastDue : 0;
            totalNoPastDue += (collection.noPastDue && collection.noPastDue !== '-') ? collection.noPastDue : 0;
            offsetPerson += collection.offsetPerson ? collection.offsetPerson : 0;
            totalMcbu += collection.mcbu ? collection.mcbu : 0;
            totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
            totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
            totalMcbuReturnNo += collection.mcbuReturnNo ? collection.mcbuReturnNo : 0;
            totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
            totalMcbuInterest += collection.mcbuInterest ? collection.mcbuInterest : 0;
            totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
        });

        return {
            name: 'Weekly Totals',
            transfer: totalTransfer,
            noOfNewCurrentRelease: noOfNewCurrentRelease,
            noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
            noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
            currentReleaseAmount: currentReleaseAmount,
            currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
            activeClients: noOfClients,
            activeBorrowers: noOfBorrowers,
            totalLoanRelease: totalsLoanRelease,
            totalReleasesStr: formatPricePhp(totalsLoanRelease),
            totalLoanBalance: totalsLoanBalance,
            totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
            targetLoanCollection: targetLoanCollection,
            loanTargetStr: formatPricePhp(targetLoanCollection),
            excess: excess,
            excessStr: formatPricePhp(excess),
            totalLoanCollection: totalLoanCollection,
            totalStr: formatPricePhp(totalLoanCollection),
            mispayment: mispayment,
            mispaymentStr: mispayment + ' / ' + noOfClients,
            fullPaymentAmount: fullPaymentAmount,
            fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
            noOfFullPayment: noOfFullPayment,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
            noPastDue: totalNoPastDue,
            offsetPerson: offsetPerson,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            mcbuCol: totalMcbuCol,
            mcbuColStr: formatPricePhp(totalMcbuCol),
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
            noMcbuReturn: totalMcbuReturnNo,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: formatPricePhp(totalMcbuInterest),
            totalData: true
        };
    }

    const createLos = (totals, selectedBranch, dateFilter, yearEnd) => {
        let grandTotal;

        if (yearEnd) {
            grandTotal = {
                day: 'Year End',
                transfer: 0,
                newMember: 0,
                offsetPerson: 0,
                mcbuTarget: totals.mcbuTarget,
                mcbuActual: totals.mcbuCol,
                mcbuWithdrawal: totals.mcbuWithdrawal,
                mcbuInterest: totals.mcbuInterest,
                noMcbuReturn: totals.noMcbuReturn,
                mcbuReturnAmt: totals.mcbuReturnAmt,
                activeClients: totals.activeClients,
                loanReleasePerson: 0,
                loanReleaseAmount: 0,
                activeLoanReleasePerson: totals.activeBorrowers,
                activeLoanReleaseAmount: totals.totalLoanRelease,
                collectionAdvancePayment: totals.totalLoanRelease - totals.totalLoanBalance,
                collectionActual: totals.totalLoanRelease - totals.totalLoanBalance,
                pastDuePerson: 0,
                pastDueAmount: 0,
                fullPaymentPerson: 0,
                fullPaymentAmount: 0,
                activeBorrowers: totals.activeBorrowers,
                loanBalance: totals.totalLoanBalance
            };
        } else {
            let selectedDate = currentDate;
            if (dateFilter) {
                if (dateFilter !== currentDate) {
                    selectedDate = dateFilter;
                }
            }

            grandTotal = {
                day: selectedDate,
                transfer: totals.transfer,
                newMember: totals.noOfNewCurrentRelease,
                mcbuTarget: totals.mcbuTarget,
                mcbuActual: totals.mcbuCol,
                mcbuWithdrawal: totals.mcbuWithdrawal,
                mcbuInterest: totals.mcbuInterest,
                noMcbuReturn: totals.noMcbuReturn,
                mcbuReturnAmt: totals.mcbuReturnAmt,
                offsetPerson: totals.offsetPerson,
                activeClients: totals.activeClients,
                loanReleasePerson: totals.noCurrentRelease,
                loanReleaseAmount: totals.currentReleaseAmount,
                activeLoanReleasePerson: totals.activeBorrowers,
                activeLoanReleaseAmount: totals.totalLoanRelease,
                collectionTarget: totals.targetLoanCollection,
                collectionAdvancePayment: totals.excess,
                collectionActual: totals.collection,
                pastDuePerson: totals.noPastDue,
                pastDueAmount: totals.pastDue,
                fullPaymentPerson: totals.noOfFullPayment,
                fullPaymentAmount: totals.fullPaymentAmount,
                activeBorrowers: totals.activeBorrowers,
                loanBalance: totals.totalLoanBalance
            };
        }

        let month = yearEnd ? 12 : moment().month() + 1;
        let year = yearEnd ? moment().year() - 1 : moment().year();
        if (dateFilter)  {
            month = moment(dateFilter).month() + 1;
            year = moment(dateFilter).year();
        }

        return {
            userId: currentUser._id,
            userType: 'bm',
            branchId: selectedBranch,
            month: month,
            year: year,
            data: grandTotal
        }
    }

    // const saveYearEndLos = async (totals, selectedBranch, yearEnd) => {
    //     if (currentUser.role.rep === 3) {
    //         const losTotals = {...createLos(totals, selectedBranch, null, yearEnd), losType: 'year-end'};
    //         await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', losTotals);
    //     }
    // }
    
    
    const handleOpen = async (row) => {
        if (row.original.activeClients !== 0) {
            setLoading(true);

            let data = { loId: row.original._id, mode: 'open' };

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/update-group-transaction-status', data);
            
            if (response.success) {
                toast.success(`${data.name} groups transactions are now open!`);
                window.location.reload();
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const handleClose = async (row) => {
        if (row.original.activeClients !== 0) {
            setLoading(true);

            let data = { loId: row.original._id, mode: 'close' };

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/update-group-transaction-status', data);
            if (response.success) {
                toast.success(`Selected loan officer groups are now closed!`);
                window.location.reload();
            } else if (response.error) {
                toast.error(response.message);
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const [rowActionButtons, setRowActionButtons] = useState();

    const [columns, setColumns] = useState();


    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3) {
            mounted && setRowActionButtons([
                { label: 'Close', action: handleClose},
                { label: 'Open', action: handleOpen}
            ]);
        }
        if (branchList.length > 0) {
            let currentBranch;
            
            if (currentUser.role.rep <= 2 && selectedBranchSubject.value) {
                currentBranch = branchList.find(b => b._id === selectedBranchSubject.value);
            } else {
                currentBranch = branchList.find(b => b.code === currentUser.designatedBranch);
            }

            if (dateFilter && currentBranch) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getGroupCashCollections(currentBranch.code, date);
                } else {
                    mounted && getGroupCashCollections(currentBranch.code);
                }
                // if (currentBranch.code === 'B005' || currentBranch.code === 'B015') {
                //     mounted && getGroupCashCollectionsForLos(currentBranch.code, '2022-12-29');
                // } else {
                //     mounted && getGroupCashCollectionsForLos(currentBranch.code, '2022-12-27');
                // }
            } else {
                mounted && getGroupCashCollections(currentBranch.code);
            }
        }

        return () => {
            mounted = false;
        };
    }, [branchList, dateFilter]);

    useEffect(() => {
        let cols = [
            {
                Header: "Loan Officer",
                accessor: 'name',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Type",
                accessor: 'transactionType',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Active Clients", // total number of clients per group
                accessor: 'activeClients',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU",
                accessor: 'mcbuStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Total Loan Releases",
                accessor: 'totalReleasesStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Active Borrowers", // with balance
                accessor: 'activeBorrowers',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Total Loan Balance",
                accessor: 'totalLoanBalanceStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Current Release Person",
                accessor: 'noCurrentReleaseStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Current Release Amount",
                accessor: 'currentReleaseAmountStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Collection",
                accessor: 'mcbuColStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Target Loan Collection",
                accessor: 'loanTargetStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Excess",
                accessor: 'excessStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Actual Loan Collection",
                accessor: 'totalStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Withdrawal",
                accessor: 'mcbuWithdrawalStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Interest",
                accessor: 'mcbuInterestStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "# MCBU Return",
                accessor: 'noMcbuReturn',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Return",
                accessor: 'mcbuReturnAmtStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Full Payment Person",
                accessor: 'noOfFullPayment',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Full Payment Amount",
                accessor: 'fullPaymentAmountStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Mispay",
                accessor: 'mispaymentStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "PD #",
                accessor: 'noPastDue'
            },
            {
                Header: "PD Amount",
                accessor: 'pastDueStr'
            },
            {
                Header: "TFR",
                accessor: 'transfer'
            }
        ];

        setColumns(cols);
    }, [type]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={userLOList} showPagination={false} showFilters={false} hasActionButtons={true} rowActionButtons={rowActionButtons} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;