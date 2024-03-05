import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import moment from 'moment';
import { formatPricePhp, getTotal } from "@/lib/utils";
import { setCashCollectionBranch } from "@/redux/actions/cashCollectionActions";

const ViewByBranchPage = ({dateFilter, type, selectedBranchGroup}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);
    const branchCollectionData = useSelector(state => state.cashCollection.branch);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [selectedBranches, setSelectedBranches] = useState([]);

    const router = useRouter();
    // check group status if there is pending change row color to orange/yellow else white
    const getBranchCashCollections = async (date) => {
        setLoading(true);
        const filter = date ? true : false;

        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/get-all-loans-per-branch-v2?' + new URLSearchParams({ date: date ? date : currentDate, branchIds: JSON.stringify(selectedBranches), dayName: dayName, currentDate: currentDate }));
        if (response.success) {
            const collectionDailyTransferred = [];
            const collectionDailyReceived = [];
            const collectionWeeklyTransferred = [];
            const collectionWeeklyReceived = [];
            let collectionData = [];

            let noOfClients = 0;
            let noOfBorrowers = 0;
            let noOfPendings = 0;
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
            let totalMcbu = 0;
            let totalMcbuCol = 0;
            let totalMcbuWithdrawal = 0;
            let totalMcbuReturnNo = 0;
            let totalMcbuReturnAmt = 0;
            let totalTransfer = 0;
            
            response.data.map(branch => {
                let collection = {
                    _id: branch._id,
                    name: branch.code + ' - ' + branch.name,
                    noCurrentReleaseStr: '-',
                    currentReleaseAmountStr: '-',
                    activeClients: '-',
                    activeBorrowers: '-',
                    pendingClients: '-',
                    totalReleasesStr: '-',
                    totalLoanBalanceStr: '-',
                    loanTargetStr: '-',
                    mcbuStr: '-',
                    mcbuColStr: '-',
                    mcbuWithdrawalStr: '-',
                    mcbuReturnAmtStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    mispaymentStr: '-',
                    fullPaymentAmountStr: '-',
                    noOfFullPayment: '-',
                    pastDueStr: '-',
                    noPastDue: '-',
                    transfer: '-',
                    page: 'branch-summary',
                    status: '-'
                };

                let groupStatus = 'open';
                if (branch?.draftCollections?.length > 0) {
                    const transactionStatus = branch.draftCollections[0].groupStatusArr.filter(status => status === "pending");
                    const draft = branch.draftCollections[0].hasDraftsArr.filter(d => d === true);
                    if (transactionStatus.length == 0 && draft.length == 0) {
                        groupStatus = 'close';
                    }
                } else if (branch.cashCollections.length > 0) {
                    const transactionStatus = branch.cashCollections[0].groupStatusArr.filter(status => status === "pending");
                    const draft = branch.cashCollections[0].hasDraftsArr.filter(d => d === true);
                    if (transactionStatus.length == 0 && draft.length == 0) {
                        groupStatus = 'close';
                    }
                }

                if (!filter && (isWeekend || isHoliday)) {
                    groupStatus = 'close';
                }

                if (!filter) {
                    if (branch.activeLoans.length > 0) {
                        collection.activeClients = branch.activeLoans[0].activeClients; 
                        collection.activeBorrowers = branch.activeLoans[0].activeBorrowers;
                        collection.pendingClients = branch.activeLoans[0].pendingClients;
                        noOfClients += branch.activeLoans[0].activeClients;
                        noOfBorrowers += branch.activeLoans[0].activeBorrowers;
                        noOfPendings += branch.activeLoans[0].pendingClients;
                    }
    
                    if (branch.loans.length > 0) {
                        collection.totalReleases = branch.loans[0].totalRelease;
                        collection.totalReleasesStr = collection.totalReleases > 0 ? formatPricePhp(collection.totalReleases) : '-';
                        collection.totalLoanBalance = branch.loans[0].totalLoanBalance;
                        collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                        collection.loanTarget = branch.loans[0].loanTarget;
                        collection.loanTargetStr = branch.loans[0].loanTarget > 0 ? formatPricePhp(branch.loans[0].loanTarget) : '-';
                        collection.pastDue = branch.loans[0].pastDue;
                        collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = branch.loans[0].noPastDue;
                        collection.mcbu = branch.loans[0].mcbu;
                        collection.mcbuStr = branch.loans[0].mcbu > 0 ? formatPricePhp(branch.loans[0].mcbu) : '-';
                        collection.mcbuCol = 0;
                        collection.mcbuColStr = '-';
                        collection.mcbuWithdrawal = 0;
                        collection.mcbuWithdrawalStr = '-';
                        collection.noMcbuReturn = 0;
                        collection.mcbuReturnAmt = 0;
                        collection.mcbuReturnAmtStr = '-';
                        collection.status = groupStatus;
    
                        totalsLoanRelease += collection.totalRelease;
                        totalsLoanBalance += collection.totalLoanBalance;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        // totalMcbu += collection.mcbu;
                    }
                    
                    if (branch?.draftCollections?.length > 0) {
                        const draftCollection = branch.draftCollections[branch.draftCollections.length - 1];
                        const loanTarget = collection.loanTarget - draftCollection.loanTarget;

                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excessStr = draftCollection.excess > 0 ? formatPricePhp(draftCollection.excess) : '-';
                        collection.total = draftCollection.collection;
                        collection.totalStr = draftCollection.collection > 0 ? formatPricePhp(draftCollection.collection) : '-';
                        collection.mispaymentStr = draftCollection.mispayment > 0 ? draftCollection.mispayment : '-';
                        collection.mcbu = draftCollection.mcbu;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = draftCollection.mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = draftCollection.mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = draftCollection.mcbuReturnNo;
                        collection.mcbuReturnAmt = draftCollection.mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.transfer = 0;
                        collection.transferStr = '-';
    
                        excess += draftCollection.excess;
                        totalLoanCollection += draftCollection.collection;
                        mispayment += draftCollection.mispayment;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    } else if (branch.cashCollections.length > 0) {
                        const loanTarget = collection.loanTarget - branch.cashCollections[0].loanTarget;

                        collection.loanTarget = loanTarget;
                        collection.loanTargetStr = loanTarget > 0 ? formatPricePhp(loanTarget) : '-';
                        collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                        collection.total = branch.cashCollections[0].collection;
                        collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                        collection.mispaymentStr = branch.cashCollections[0].mispayment > 0 ? branch.cashCollections[0].mispayment : '-';
                        collection.mcbu = branch.cashCollections[0].mcbu;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu) : '-';
                        collection.mcbuCol = branch.cashCollections[0].mcbuCol;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol) : '-';
                        collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal ? formatPricePhp(collection.mcbuWithdrawal) : '-';
                        collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo;
                        collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt ? formatPricePhp(collection.mcbuReturnAmt) : '-';
                        collection.transfer = 0;
                        collection.transferStr = '-';
    
                        excess += branch.cashCollections[0].excess;
                        totalLoanCollection += branch.cashCollections[0].collection;
                        mispayment += branch.cashCollections[0].mispayment;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    }
    
                    if (branch.currentRelease.length > 0) {
                        const newReleasePerson = branch.currentRelease[0].newCurrentRelease ? branch.currentRelease[0].newCurrentRelease : 0;
                        const reReleasePerson = branch.currentRelease[0].reCurrentRelease ? branch.currentRelease[0].reCurrentRelease : 0;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmountStr = formatPricePhp(branch.currentRelease[0].currentReleaseAmount);
    
                        noOfNewCurrentRelease += branch.currentRelease[0].newCurrentRelease;
                        noOfReCurrentRelease += branch.currentRelease[0].reCurrentRelease;
                        currentReleaseAmount += branch.currentRelease[0].currentReleaseAmount;

                        if (newReleasePerson > 0 && collection.activeClients === '-') {
                            collection.allNew = true;
                            noOfClients += newReleasePerson;
                        }
                    }
    
                    if (branch.fullPayment.length > 0) {
                        collection.noOfFullPayment = branch.fullPayment[0].noOfFullPayment;
                        collection.fullPaymentAmountStr = formatPricePhp(branch.fullPayment[0].fullPaymentAmount);
    
                        fullPaymentAmount += branch.fullPayment[0].fullPaymentAmount;
                        noOfFullPayment += branch.fullPayment[0].noOfFullPayment;
                    }
                } else {
                    if (branch.cashCollections.length > 0) {
                        collection.activeClients = branch.cashCollections[0].activeClients; 
                        collection.activeBorrowers = branch.cashCollections[0].activeBorrowers;
                        collection.pendingClients = branch.cashCollections[0].pendingClients;

                        collection.totalReleases = branch.cashCollections[0].totalRelease;
                        collection.totalReleasesStr = collection.totalRelease > 0 ? formatPricePhp(collection.totalReleases) : '-';
                        collection.totalLoanBalance = branch.cashCollections[0].totalLoanBalance;
                        collection.totalLoanBalanceStr = collection.totalLoanBalance > 0 ? formatPricePhp(collection.totalLoanBalance) : '-';
                        collection.loanTarget = branch.cashCollections[0].loanTarget;
                        collection.loanTargetStr = branch.cashCollections[0].loanTarget > 0 ? formatPricePhp(branch.cashCollections[0].loanTarget) : '-';
                        
                        collection.excessStr = branch.cashCollections[0].excess > 0 ? formatPricePhp(branch.cashCollections[0].excess) : '-';
                        collection.total = branch.cashCollections[0].collection;
                        collection.totalStr = branch.cashCollections[0].collection > 0 ? formatPricePhp(branch.cashCollections[0].collection) : '-';
                        collection.mispaymentStr = branch.cashCollections[0].mispayment;
                        collection.pastDue = branch.cashCollections[0].pastDue ? branch.cashCollections[0].pastDue : 0;
                        collection.pastDueStr = collection.pastDue > 0 ? formatPricePhp(collection.pastDue) : '-';
                        collection.noPastDue = branch.cashCollections[0].noPastDue ? branch.cashCollections[0].noPastDue : 0;

                        collection.mcbu = branch.cashCollections[0].mcbu ? branch.cashCollections[0].mcbu: 0;
                        collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                        collection.mcbuCol = branch.cashCollections[0].mcbuCol ? branch.cashCollections[0].mcbuCol: 0;
                        collection.mcbuColStr = collection.mcbuCol > 0 ? formatPricePhp(collection.mcbuCol): '-';
                        collection.mcbuWithdrawal = branch.cashCollections[0].mcbuWithdrawal ? branch.cashCollections[0].mcbuWithdrawal: 0;
                        collection.mcbuWithdrawalStr = collection.mcbuWithdrawal > 0 ? formatPricePhp(collection.mcbuWithdrawal): '-';
                        collection.noMcbuReturn = branch.cashCollections[0].mcbuReturnNo ? branch.cashCollections[0].mcbuReturnNo: 0;
                        collection.mcbuReturnAmt = branch.cashCollections[0].mcbuReturnAmt ? branch.cashCollections[0].mcbuReturnAmt: 0;
                        collection.mcbuReturnAmtStr = collection.mcbuReturnAmt > 0 ? formatPricePhp(collection.mcbuReturnAmt): '-';

                        const newReleasePerson = branch.cashCollections[0].newCurrentRelease;
                        const reReleasePerson = branch.cashCollections[0].reCurrentRelease;
                        collection.noCurrentReleaseStr = newReleasePerson + ' / ' + reReleasePerson;
                        collection.currentReleaseAmountStr = formatPricePhp(branch.cashCollections[0].currentReleaseAmount);

                        collection.noOfFullPayment = branch.cashCollections[0].noOfFullPayment;
                        collection.fullPaymentAmountStr = formatPricePhp(branch.cashCollections[0].fullPaymentAmount);
                        collection.status = groupStatus;

                        collection.transfer = 0;
                        collection.transferStr = '-';
    
                        noOfClients += branch.cashCollections[0].activeClients;
                        noOfBorrowers += branch.cashCollections[0].activeBorrowers;
                        noOfPendings += branch.cashCollections[0].pendingClients;
                        totalsLoanRelease += branch.cashCollections[0].totalRelease;
                        totalsLoanBalance += branch.cashCollections[0].totalLoanBalance;
                        targetLoanCollection += branch.cashCollections[0].loanTarget;
                        excess += branch.cashCollections[0].excess;
                        totalLoanCollection += branch.cashCollections[0].collection;
                        mispayment += branch.cashCollections[0].mispayment;
                        totalPastDue += collection.pastDue;
                        totalNoPastDue += collection.noPastDue;
                        noOfNewCurrentRelease += branch.cashCollections[0].newCurrentRelease;
                        noOfReCurrentRelease += branch.cashCollections[0].reCurrentRelease;
                        currentReleaseAmount += branch.cashCollections[0].currentReleaseAmount;
                        fullPaymentAmount += branch.cashCollections[0].fullPaymentAmount;
                        noOfFullPayment += branch.cashCollections[0].noOfFullPayment;
                        // totalMcbu += collection.mcbu ? collection.mcbu : 0;
                        totalMcbuCol += collection.mcbuCol ? collection.mcbuCol : 0;
                        totalMcbuWithdrawal += collection.mcbuWithdrawal ? collection.mcbuWithdrawal : 0;
                        totalMcbuReturnNo += collection.noMcbuReturn ? collection.noMcbuReturn : 0;
                        totalMcbuReturnAmt += collection.mcbuReturnAmt ? collection.mcbuReturnAmt : 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                    }
                }

                if (branch.transferDailyGiverDetails.length > 0 || branch.transferDailyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0) {
                    let transfer = 0;
                    let totalTransferMcbu = 0;
                    let totalTransferTargetCollection = 0;
                    let totalTransferActualCollection = 0;

                    if (branch.transferDailyGiverDetails.length > 0) {
                        collectionDailyReceived.push.apply(collectionDailyReceived, branch.transferDailyGiverDetails);
                        transfer = transfer - branch.transferDailyGiverDetails.length;

                        branch.transferDailyGiverDetails.map(giver => {    
                            if (filter) {
                                collection.activeClients -= 1;
                                collection.activeBorrowers -= 1;
                            }

                            collection.mcbu -= giver.mcbu;
                            totalTransferMcbu -= giver.mcbu;

                            const details = giver.data[0];
                            const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                            totalTransferTargetCollection -= actualCollection;
                            totalTransferActualCollection -= actualCollection;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                            totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                            totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                        });
                    }

                    if (branch.transferDailyReceivedDetails.length > 0) {
                        collectionDailyTransferred.push.apply(collectionDailyTransferred, branch.transferDailyReceivedDetails);
                        transfer = transfer + branch.transferDailyReceivedDetails.length;
                        
                        branch.transferDailyReceivedDetails.map(rcv => {
                            totalTransferMcbu += rcv.mcbu;
                            const details = rcv.data[0];
                            const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                            totalTransferTargetCollection += actualCollection;
                            totalTransferActualCollection += actualCollection;

                            if (!filter) {
                                if (rcv.status !== 'pending') {
                                    collection.activeClients += 1;
                                    if (collection.status !== "completed") {
                                        collection.activeBorrowers += 1;
                                    }
                                    collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;
        
                                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                                    collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                                    collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
        
                                    totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                    totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                }
                            } else {
                                if (rcv.status !== 'pending') {
                                    if (rcv.status == "completed") {
                                        collection.activeBorrowers -= 1;
                                    }
                                    collection.loanTarget -= rcv.targetCollection;
                                    collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                                    if (rcv.status == 'tomorrow') {
                                        collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                        collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                        totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                        totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                    }
            
                                    targetLoanCollection -= rcv.targetCollection;
                                }
                            }
                        });
                    }

                    if (branch.transferWeeklyGiverDetails.length > 0) {
                        collectionWeeklyReceived.push.apply(collectionWeeklyReceived, branch.transferWeeklyGiverDetails);
                        transfer = transfer - branch.transferWeeklyGiverDetails.length;

                        branch.transferWeeklyGiverDetails.map(giver => {
                            if (filter) {
                                collection.activeClients -= 1;
                                collection.activeBorrowers -= 1;
                            }
                            collection.mcbu -= giver.mcbu;
                            totalTransferMcbu -= giver.mcbu;

                            const details = giver.data[0];
                            const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                            totalTransferTargetCollection -= actualCollection;
                            totalTransferActualCollection -= actualCollection;

                            collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                            collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                            collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                            collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                            totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                            totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                        });
                    }
                    
                    if (branch.transferWeeklyReceivedDetails.length > 0) {
                        collectionWeeklyTransferred.push.apply(collectionWeeklyTransferred, branch.transferWeeklyReceivedDetails);
                        transfer = transfer + branch.transferWeeklyReceivedDetails.length;

                        branch.transferWeeklyReceivedDetails.map(rcv => {
                            totalTransferMcbu += rcv.mcbu;
                            const details = rcv.data[0];
                            const actualCollection = details?.actualCollection ? details?.actualCollection : 0;
                            // const detailsExcess = details?.excess ? details?.excess : 0;
                            totalTransferTargetCollection += actualCollection;
                            totalTransferActualCollection += actualCollection;
                            if (!filter) {
                                if (rcv.status !== 'pending') {
                                    collection.activeClients += 1;
                                    if (collection.status !== "completed") {
                                        collection.activeBorrowers += 1;
                                    }
                                    collection.mcbu += rcv.mcbu ? rcv.mcbu : 0;
        
                                    collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                                    collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                    collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                                    collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
        
                                    totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                    totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                }
                            } else {
                                if (rcv.status !== 'pending') {
                                    if (rcv.status == "completed") {
                                        collection.activeBorrowers -= 1;
                                    }
                                    collection.loanTarget -= rcv.targetCollection;
                                    collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                                    if (rcv.status == 'tomorrow') {
                                        collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                        collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                        totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                        totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                    }
            
                                    targetLoanCollection -= rcv.targetCollection;
                                }
                            }
                        });
                    }

                    if (branch.transferDailyReceivedDetails.length > 0 || branch.transferDailyGiverDetails.length > 0 || branch.transferWeeklyReceivedDetails.length > 0 || branch.transferWeeklyGiverDetails.length > 0) {
                        collection.mcbuStr = formatPricePhp(collection.mcbu);
                        collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                        collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                        collection.mcbuCol += totalTransferMcbu;
                        collection.mcbuColStr = formatPricePhp(collection.mcbuCol);
                        collection.loanTarget += totalTransferTargetCollection;
                        collection.loanTargetStr = formatPricePhp(collection.loanTarget);
                        collection.total += totalTransferActualCollection;
                        collection.totalStr = formatPricePhp(collection.total);

                        collection.activeClients = collection.activeClients > -1 ? collection.activeClients : 0;
                        collection.activeBorrowers = collection.activeBorrowers > -1 ? collection.activeBorrowers : 0;
                    }
                    
                    collection.transfer = transfer;
                    collection.transferStr = transfer >= 0 ? transfer : `(${transfer * -1})`;
                    totalTransfer += transfer;
                }

                collectionData.push(collection);
            });

            collectionData.map(c => {
                totalMcbu += c.mcbu ? c.mcbu : 0;
                noOfClients += c.activeClients !== '-' ? c.activeClients : 0;
                noOfBorrowers += c.activeBorrowers !== '-' ? c.activeBorrowers : 0;
            });

            const transferGvr = transferDetailsTotal(collectionDailyTransferred, collectionWeeklyTransferred, 'Transfer GVR');
            const transferRcv = transferDetailsTotal(collectionDailyReceived, collectionWeeklyReceived, 'Transfer RCV');
            if (collectionDailyTransferred.length > 0 || collectionWeeklyTransferred.length > 0) {
                collectionData.push(transferGvr);
            }
            if (collectionDailyReceived.length > 0 || collectionWeeklyReceived.length > 0) {
                collectionData.push(transferRcv);
            }

            const branchTotals = {
                name: 'GRAND TOTALS',
                transfer: totalTransfer,
                noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                currentReleaseAmountStr: formatPricePhp(currentReleaseAmount),
                activeClients: noOfClients,
                activeBorrowers: noOfBorrowers,
                pendingClients: noOfPendings,
                totalReleasesStr: formatPricePhp(totalsLoanRelease),
                totalLoanBalanceStr: formatPricePhp(totalsLoanBalance),
                loanTargetStr: targetLoanCollection > 0 ? formatPricePhp(targetLoanCollection) : 0,
                excessStr: formatPricePhp(excess),
                totalStr: formatPricePhp(totalLoanCollection),
                mispaymentStr: mispayment + ' / ' + noOfClients,
                fullPaymentAmountStr: formatPricePhp(fullPaymentAmount),
                noOfFullPayment: noOfFullPayment,
                pastDueStr: formatPricePhp(totalPastDue),
                noPastDue: totalNoPastDue,
                mcbu: totalMcbu,
                mcbuStr: formatPricePhp(totalMcbu),
                mcbuCol: totalMcbuCol,
                mcbuColStr: formatPricePhp(totalMcbuCol),
                mcbuWithdrawal: totalMcbuWithdrawal,
                mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
                noMcbuReturn: totalMcbuReturnNo,
                mcbuReturnAmt: totalMcbuReturnAmt,
                mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
                totalData: true
            };

            collectionData.push(branchTotals);
            
            dispatch(setCashCollectionBranch(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const transferDetailsTotal = (detailsDaily, detailsWeekly, type) => {
        let totalTransfer = 0;
        let totalMcbu = 0;
        let totalMcbuTarget = 0;
        let totalMcbuCol = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuNoReturn = 0;
        let totalMcbuInterest = 0;
        let totalLoanRelease = 0;
        let totalLoanBalance = 0;
        let totalTargetCollection = 0;
        let totalExcess = 0;
        let totalActualCollection = 0;
        let totalPastDue = 0;
        let totalNoPastDue = 0;
        let totalMispay = 0;
        let totalTdaClients = 0;
        let totalPendingClients = 0;
        let totalCurrentReleaseAMount = 0;

        detailsDaily.map(transfer => {
            totalTransfer++;
            totalMcbu += transfer.mcbu;
            totalLoanRelease += transfer.amountRelease;
            totalLoanBalance += transfer.loanBalance;
            totalCurrentReleaseAMount += transfer.currentReleaseAmount;

            if (type == 'Transfer RCV') {
                if (transfer.status == 'completed') {
                    totalTdaClients += 1;
                } else if (transfer.status == 'pending') {
                    totalPendingClients += 1;
                }
            }

            const details = transfer?.data[0];
            if (details) {
                totalMcbuTarget += details.mcbuTarget;
                totalMcbuCol += details.mcbuCol;
                totalTargetCollection += details.actualCollection;
                totalActualCollection += details.actualCollection;
                totalPastDue += details.pastDue;
                totalNoPastDue += details.noPastDue;
            }
        });

        detailsWeekly.map(transfer => {
            totalTransfer++;
            totalMcbu += transfer.mcbu;
            totalLoanRelease += transfer.amountRelease;
            totalLoanBalance += transfer.loanBalance;
            totalCurrentReleaseAMount += transfer.currentReleaseAmount;

            if (type == 'Transfer RCV') {
                if (transfer.status == 'completed') {
                    totalTdaClients += 1;
                } else if (transfer.status == 'pending') {
                    totalPendingClients += 1;
                }
            }

            const details = transfer?.data[0];
            if (details) {
                totalMcbuTarget += details.mcbuTarget;
                totalMcbuCol += details.mcbuCol;
                totalTargetCollection += details.actualCollection;
                totalActualCollection += details.actualCollection;
                totalPastDue += details.pastDue;
                totalNoPastDue += details.noPastDue;
            }
        });
        
        return {
            name: type.toUpperCase(),
            transfer: (type === 'Transfer GVR' && totalTransfer > 0) ? -Math.abs(totalTransfer) : totalTransfer,
            transferStr: (type === 'Transfer GVR' && totalTransfer > 0) ? `(${totalTransfer})` : totalTransfer,
            noOfNewCurrentRelease: '-',
            noCurrentReleaseStr: '-',
            currentReleaseAmount: (type === 'Transfer GVR' && totalCurrentReleaseAMount > 0) ? -Math.abs(totalCurrentReleaseAMount) : totalCurrentReleaseAMount,
            currentReleaseAmountStr: '-', // don't display in group summary
            activeClients: '-',
            activeBorrowers: '-',
            totalLoanRelease: totalLoanRelease,
            totalReleasesStr: '-',
            totalLoanBalance: 0,
            totalLoanBalanceStr: '-',
            targetLoanCollection: totalTargetCollection,
            loanTargetStr: (type === 'Transfer GVR' && totalTargetCollection > 0) ? `(${formatPricePhp(totalTargetCollection)})` : formatPricePhp(totalTargetCollection),
            excess: 0,
            excessStr: '-', //(type === 'Transfer GVR' && totalExcess > 0) ? `(${formatPricePhp(totalExcess)})` : formatPricePhp(totalExcess),
            collection: totalActualCollection,
            collectionStr: (type === 'Transfer GVR' && totalActualCollection > 0) ? `(${formatPricePhp(totalActualCollection)})` : formatPricePhp(totalActualCollection),
            mispaymentPerson: totalMispay,
            mispayment: '-',
            fullPaymentAmountStr: '-',
            noOfFullPayment: '-',
            pastDue: totalPastDue,
            pastDueStr: (type === 'Transfer GVR' && totalPastDue > 0) ? `(${formatPricePhp(totalPastDue)})` : formatPricePhp(totalPastDue),
            noPastDue: (type === 'Transfer GVR' && totalNoPastDue > 0) ? `(${totalNoPastDue})` : totalNoPastDue,
            mcbuTarget: totalMcbuTarget,
            mcbu: 0,
            mcbuStr: '-',
            mcbuCol: totalMcbu,
            mcbuColStr: (type === 'Transfer GVR' && totalMcbu > 0) ? `(${formatPricePhp(totalMcbu)})` : formatPricePhp(totalMcbu),
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: (type === 'Transfer GVR' && totalMcbuWithdrawal > 0) ? `(${formatPricePhp(totalMcbuWithdrawal)})` : formatPricePhp(totalMcbuWithdrawal),
            noMcbuReturn: totalMcbuNoReturn,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: (type === 'Transfer GVR' && totalMcbuReturnAmt > 0) ? `(${formatPricePhp(totalMcbuReturnAmt)})` : formatPricePhp(totalMcbuReturnAmt),
            mcbuTarget: '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: (type === 'Transfer GVR' && totalMcbuInterest > 0) ? `(${formatPricePhp(totalMcbuInterest)})` : formatPricePhp(totalMcbuInterest),
            totalData: true,
            status: '-'
        }
    }

    const [columns, setColumns] = useState();

    const handleRowClick = (selected) => {
        if (!selected?.totalData) {
            router.push(`/transactions/branch-manager/cash-collection/users/${selected._id}`);
            localStorage.setItem('selectedBranch', selected._id);
        }
    };

    useEffect(() => {
        let cols = [];
        if (type === 'daily') {
            cols = [
                {
                    Header: "Branch Name",
                    accessor: 'name',
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
                    Header: "PND",
                    accessor: 'pendingClients'
                }
            ];
        } else {
            cols = [
                {
                    Header: "Branch Name",
                    accessor: 'name',
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
                    Header: "MCBU Refund",
                    accessor: 'mcbuWithdrawalStr',
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
                    Header: "PND",
                    accessor: 'pendingClients'
                },
                {
                    Header: "TFR",
                    accessor: 'transfer'
                }
            ];
        }

        setColumns(cols);
    }, []);

    useEffect(() => {
        if (branchList) {
            let branchIds = branchList.map(branch =>  branch._id );

            if (currentUser.role.rep == 2 && selectedBranchGroup == 'mine') {
                branchIds = branchList.filter(branch => currentUser.designatedBranch.includes(branch.code)).map(branch => branch._id);
            }
            
            setSelectedBranches(branchIds);
        }
    }, [branchList, selectedBranchGroup]);

    useEffect(() => {
        let mounted = true;

        if (selectedBranches.length > 0) {
            if (dateFilter) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getBranchCashCollections(date);
                } else {
                    mounted && getBranchCashCollections();
                }
            } else {
                mounted && getBranchCashCollections();
            }
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter, selectedBranches]);
    

    return (
        <React.Fragment>
            {loading ?
                (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : <TableComponent columns={columns} data={branchCollectionData} hasActionButtons={false} rowActionButtons={false} showFilters={false} showPagination={false} pageSize={100} rowClick={handleRowClick} />}
        </React.Fragment>
    );
}

export default ViewByBranchPage;