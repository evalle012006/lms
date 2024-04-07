import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import moment from 'moment';
import { setCashCollectionList, setGroupSummaryTotals, setLoSummary } from "@/redux/actions/cashCollectionActions";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import { BehaviorSubject } from 'rxjs';
import { setGroupList } from "@/redux/actions/groupActions";

const ViewCashCollectionPage = ({ pageNo, dateFilter, type }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const [loading, setLoading] = useState(true);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);

    const getCashCollections = async (dateFilter) => {
        setLoading(true);
        const filter = dateFilter ? true : false;
        let url = process.env.NEXT_PUBLIC_API_URL + 
            'transactions/cash-collections/get-all-loans-per-group-v2?' 
            + new URLSearchParams({ 
                    date: dateFilter ? dateFilter : currentDate,
                    mode: type, 
                    groupIds: JSON.stringify(selectedGroupIds),
                    dayName: dayName,
                    currentDate: currentDate
                });

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let collectionData = [];
            const collectionTransferred = [];
            const collectionReceived = [];
            const collectionTransferredByGroup = [];
            const collectionReceivedByGroup = [];
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
            let totalPastDue = 0;
            let totalNoPastDue = 0;
            // let totalNoPaidPastDue = 0;
            let mispayment = 0;
            let offsetPerson = 0;
            let totalMcbu = 0;
            let totalMcbuCol = 0;
            let totalMcbuWithdrawal = 0;
            let totalMcbuReturnNo = 0;
            let totalMcbuReturnAmt = 0;
            let totalMcbuTarget = 0;
            let totalMcbuInterest = 0;
            let totalMcbuDailyWithdrawal = 0;
            let totalTransfer = 0; // total transfer to new group/lo/branch

            let selectedBranch;
            const responseData = response.data.filter(rd => rd?.origin !== 'automation-trf');
            responseData && responseData.map(cc => {
                let collection = {
                    groupId: cc._id,
                    group: cc.name,
                    groupNo: cc.groupNo,
                    noOfClients: cc.noOfClients,
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
                    mcbuDailyWithdrawalStr: '-',
                    mcbuReturnAmtStr: '-',
                    mcbuInterestStr: '-',
                    excessStr: '-',
                    totalStr: '-',
                    collectionStr: '-',
                    mispayment: '-',
                    fullPaymentAmountStr: '-',
                    pastDueStr: '-',
                    noPastDue: '-',
                    noOfFullPayment: '-',
                    offSetPerson: '-',
                    transfer: 0,
                    transferStr: '-',
                    status: '-'
                };
                selectedBranch = cc.branchId;
                let noCurrentRelease = '0 / 0';
                let groupStatus = 'pending';
                let isDraft = false;

                if (cc?.draftCollections?.length > 0) {
                    const transactionStatus = cc.draftCollections[0].groupStatusArr.filter(status => status === "closed");
                    if (transactionStatus.length > 0) {
                        groupStatus = 'closed';
                    }

                    const draft = cc.draftCollections[0].hasDraftsArr.filter(d => d === true);
                    if (draft.length > 0) {
                        isDraft = true;
                    }
                } else if (cc.cashCollections.length > 0) {
                    if (cc.cashCollections[0].groupStatusArr.length > 0) {
                        const transactionStatus = cc.cashCollections[0].groupStatusArr.filter(status => status === "pending");
                        if (transactionStatus.length === 0) {
                            groupStatus = 'closed';
                        }

                        const draft = cc.cashCollections[0].hasDraftsArr.filter(d => d === true);
                        if (draft.length > 0) {
                            isDraft = true;
                        }
                    }
                }

                if (!filter && (isWeekend || isHoliday)) {
                    groupStatus = 'closed';
                }

                if (!filter) {
                    if (cc.loans.length > 0) {
                        let loanTarget = 0;
                        if ((cc.occurence === 'weekly' && cc.day === dayName) || cc.occurence === 'daily') {
                            loanTarget = cc.loans[0].loanTarget && cc.loans[0].loanTarget;
                        }

                        collection = {
                            groupId: cc._id,
                            group: cc.name,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: 0,
                            reCurrentRelease: 0,
                            currentReleaseAmount: 0,
                            currentReleaseAmountStr: 0,
                            activeClients: 0,
                            activeBorrowers: 0,
                            pendingClients: 0,
                            mispayment: collection.mispayment,
                            loanTarget: loanTarget,
                            loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : '-',
                            collection: cc.loans[0].collection && cc.loans[0].collection,
                            collectionStr: cc.loans[0].collection ? formatPricePhp(cc.loans[0].collection) : '-',
                            excess: cc.loans[0].excess && cc.loans[0].excess,
                            excessStr: cc.loans[0].excess ? formatPricePhp(cc.loans[0].excess) : 0,
                            total: cc.loans[0].total,
                            totalStr: formatPricePhp(cc.loans[0].total),
                            totalReleases: cc.loans[0].totalRelease && cc.loans[0].totalRelease,
                            totalReleasesStr: cc.loans[0].totalRelease ? formatPricePhp(cc.loans[0].totalRelease) : '-',
                            totalLoanBalance: cc.loans[0].totalLoanBalance && cc.loans[0].totalLoanBalance,
                            totalLoanBalanceStr: cc.loans[0].totalLoanBalance ? formatPricePhp(cc.loans[0].totalLoanBalance) : '-',
                            fullPaymentAmount: '-',
                            fullPaymentAmountStr: '-',
                            noOfFullPayment: 0,
                            newFullPayment: 0,
                            reFullPayment: 0,
                            pastDue: cc.loans[0].pastDue,
                            pastDueStr: cc.loans[0].pastDue > 0 ? formatPricePhp(cc.loans[0].pastDue) : '-',
                            noPastDue: cc.loans[0].noPastDue > 0 ? cc.loans[0].noPastDue : '-',
                            mcbu: cc.loans[0].mcbu,
                            mcbuStr: cc.loans[0].mcbu > 0 ? formatPricePhp(cc.loans[0].mcbu): '-',
                            mcbuCol: 0,
                            mcbuColStr: '-',
                            mcbuWithdrawal: 0,
                            mcbuWithdrawalStr: '-',
                            mcbuDailyWithdrawal: 0,
                            mcbuDailyWithdrawalStr: '-',
                            noMcbuReturn: 0,
                            mcbuReturnAmt: 0,
                            mcbuReturnAmtStr: '-',
                            mcbuInterest: cc.loans[0].mcbuInterest,
                            mcbuInterestStr: cc.loans[0].mcbuInterest > 0 ? formatPricePhp(cc.loans[0].mcbuInterest) : '-',
                            transfer: 0,
                            transferStr: '-',
                            status: groupStatus,
                            isDraft: isDraft,
                            page: 'collection'
                        };
    
                        totalsLoanRelease += cc.loans[0].totalRelease ? cc.loans[0].totalRelease : 0;
                        totalsLoanBalance += cc.loans[0].totalLoanBalance ? cc.loans[0].totalLoanBalance : 0;
                        // targetLoanCollection += loanTarget;
                        totalPastDue += cc.loans[0].pastDue;
                        totalNoPastDue += cc.loans[0].noPastDue;
                        // totalMcbuTarget += cc.loans[0].mcbuTarget ? cc.loans[0].mcbuTarget : 0;
                        totalMcbuInterest += cc.loans[0].mcbuInterest;
                    } 

                    if (cc.activeLoans.length > 0) {
                        collection = {
                            ...collection,
                            activeClients: cc.activeLoans[0].activeClients,
                            activeBorrowers: cc.activeLoans[0].activeBorrowers,
                            pendingClients: cc.activeLoans[0].pendingClients
                        }
    
                        noOfClients += cc.activeLoans[0].activeClients ? cc.activeLoans[0].activeClients : 0;
                        noOfBorrowers += cc.activeLoans[0].activeBorrowers ? cc.activeLoans[0].activeBorrowers : 0;
                        noOfPendings += cc.activeLoans[0].pendingClients ? cc.activeLoans[0].pendingClients : 0;
                    }
                    
                    if (cc?.draftCollections?.length > 0) {
                        const draftCollection = cc.draftCollections[cc.draftCollections.length - 1];
                        let loanTarget = 0;
                        if ((cc.occurence === 'weekly' && cc.day === dayName) || cc.occurence === 'daily') {
                            loanTarget = collection.loanTarget - draftCollection.loanTarget;
                        }

                        collection = { ...collection,
                            mispayment: draftCollection.mispayment ? draftCollection.mispayment : 0,
                            collection: draftCollection.collection && draftCollection.collection,
                            collectionStr: draftCollection.collection ? formatPricePhp(draftCollection.collection) : '-',
                            excess: draftCollection.excess && draftCollection.excess,
                            excessStr: draftCollection.excess ? formatPricePhp(draftCollection.excess) : '-',
                            loanTarget: loanTarget,
                            loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : 0,
                            offsetPerson: draftCollection.offsetPerson ? draftCollection.offsetPerson : 0,
                            mcbuCol: draftCollection.mcbuCol ? draftCollection.mcbuCol: 0,
                            mcbuColStr: draftCollection.mcbuCol > 0 ? formatPricePhp(draftCollection.mcbuCol): '-',
                            mcbuWithdrawal: draftCollection.mcbuWithdrawal ? draftCollection.mcbuWithdrawal: 0,
                            mcbuWithdrawalStr: draftCollection.mcbuWithdrawal > 0 ? formatPricePhp(draftCollection.mcbuWithdrawal): '-',
                            mcbuWithdrawal: draftCollection.mcbuDailyWithdrawal ? draftCollection.mcbuDailyWithdrawal: 0,
                            mcbuWithdrawalStr: draftCollection.mcbuDailyWithdrawal > 0 ? formatPricePhp(draftCollection.mcbuDailyWithdrawal): '-',
                            noMcbuReturn: draftCollection.mcbuReturnNo ? draftCollection.mcbuReturnNo: 0,
                            mcbuReturnAmt: draftCollection.mcbuReturnAmt ? draftCollection.mcbuReturnAmt: 0,
                            mcbuReturnAmtStr: draftCollection.mcbuReturnAmt > 0 ? formatPricePhp(draftCollection.mcbuReturnAmt): '-',
                            transfer: 0,
                            transferStr: '-',
                        };
                        
                        if (draftCollection.mcbu > 0) {
                            collection.mcbu = draftCollection.mcbu;
                            collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                        }

                        excess += draftCollection.excess ? draftCollection.excess : 0;
                        totalLoanCollection += draftCollection.collection ? draftCollection.collection : 0;
                        mispayment += draftCollection.mispayment ? draftCollection.mispayment : 0;
                        offsetPerson += draftCollection.offsetPerson ? draftCollection.offsetPerson : 0;
                        totalMcbuCol += draftCollection.mcbuCol ? draftCollection.mcbuCol: 0;
                        totalMcbuWithdrawal += draftCollection.mcbuWithdrawal ? draftCollection.mcbuWithdrawal: 0;
                        totalMcbuDailyWithdrawal += draftCollection.mcbuDailyWithdrawal ? draftCollection.mcbuDailyWithdrawal: 0;
                        totalMcbuReturnNo += collection.noMcbuReturn;
                        totalMcbuReturnAmt += draftCollection.mcbuReturnAmt ? draftCollection.mcbuReturnAmt: 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                        totalMcbuTarget += draftCollection.mcbuTarget ? draftCollection.mcbuTarget : 0;

                        if (draftCollection.transferredAmountRelease > 0) {
                            totalsLoanRelease += draftCollection.transferredAmountRelease;
                            collection.totalReleases += draftCollection.transferredAmountRelease;
                            collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                        }

                        if (draftCollection.transferredLoanBalance > 0) {
                            totalsLoanBalance += draftCollection.transferredLoanBalance;
                            collection.totalLoanBalance += draftCollection.transferredLoanBalance;
                            collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                        }

                        if (draftCollection.transferMCBU > 0) {
                            collection.mcbu -= draftCollection.transferMCBU;
                            collection.mcbuStr = formatPricePhp(collection.mcbu);
                        }

                        if (draftCollection.transfer > 0) {
                            collection.activeBorrowers -= draftCollection.transfer;
                            collection.activeClients -= draftCollection.transfer;
                        }
                    } else if (cc.cashCollections.length > 0) {
                        let loanTarget = 0;
                        if ((cc.occurence === 'weekly' && cc.day === dayName) || cc.occurence === 'daily') {
                            loanTarget = collection.loanTarget - cc.cashCollections[0].loanTarget;
                            // targetLoanCollection = targetLoanCollection - cc.cashCollections[0].loanTarget;
                        }

                        collection = { ...collection,
                            mispayment: cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0,
                            collection: cc.cashCollections[0].collection && cc.cashCollections[0].collection,
                            collectionStr: cc.cashCollections[0].collection ? formatPricePhp(cc.cashCollections[0].collection) : '-',
                            excess: cc.cashCollections[0].excess && cc.cashCollections[0].excess,
                            excessStr: cc.cashCollections[0].excess ? formatPricePhp(cc.cashCollections[0].excess) : '-',
                            loanTarget: loanTarget,
                            loanTargetStr: loanTarget > 0 ? formatPricePhp(loanTarget) : 0,
                            offsetPerson: cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0,
                            mcbuCol: cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol: 0,
                            mcbuColStr: cc.cashCollections[0].mcbuCol > 0 ? formatPricePhp(cc.cashCollections[0].mcbuCol): '-',
                            mcbuWithdrawal: cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal: 0,
                            mcbuWithdrawalStr: cc.cashCollections[0].mcbuWithdrawal > 0 ? formatPricePhp(cc.cashCollections[0].mcbuWithdrawal): '-',
                            mcbuDailyWithdrawal: cc.cashCollections[0].mcbuDailyWithdrawal ? cc.cashCollections[0].mcbuDailyWithdrawal: 0,
                            mcbuDailyWithdrawalStr: cc.cashCollections[0].mcbuDailyWithdrawal > 0 ? formatPricePhp(cc.cashCollections[0].mcbuDailyWithdrawal): '-',
                            noMcbuReturn: cc.cashCollections[0].mcbuReturnNo ? cc.cashCollections[0].mcbuReturnNo: 0,
                            mcbuReturnAmt: cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt: 0,
                            mcbuReturnAmtStr: cc.cashCollections[0].mcbuReturnAmt > 0 ? formatPricePhp(cc.cashCollections[0].mcbuReturnAmt): '-',
                            transfer: 0,
                            transferStr: '-',
                        };
                        
                        if (cc.cashCollections[0].mcbu > 0) {
                            collection.mcbu = cc.cashCollections[0].mcbu;
                            collection.mcbuStr = collection.mcbu > 0 ? formatPricePhp(collection.mcbu): '-';
                        }

                        excess += cc.cashCollections[0].excess ? cc.cashCollections[0].excess : 0;
                        totalLoanCollection += cc.cashCollections[0].collection ? cc.cashCollections[0].collection : 0;
                        mispayment += cc.cashCollections[0].mispayment ? cc.cashCollections[0].mispayment : 0;
                        offsetPerson += cc.cashCollections[0].offsetPerson ? cc.cashCollections[0].offsetPerson : 0;
                        totalMcbuCol += cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol: 0;
                        totalMcbuWithdrawal += cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal: 0;
                        totalMcbuDailyWithdrawal += cc.cashCollections[0].mcbuDailyWithdrawal ? cc.cashCollections[0].mcbuDailyWithdrawal: 0;
                        totalMcbuReturnNo += collection.noMcbuReturn;
                        totalMcbuReturnAmt += cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt: 0;
                        totalTransfer += collection.transfer !== '-' ? collection.transfer : 0;
                        totalMcbuTarget += cc.cashCollections[0].mcbuTarget ? cc.cashCollections[0].mcbuTarget : 0;

                        if (cc.cashCollections[0].transferredAmountRelease > 0) {
                            totalsLoanRelease += cc.cashCollections[0].transferredAmountRelease;
                            collection.totalReleases += cc.cashCollections[0].transferredAmountRelease;
                            collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                        }

                        if (cc.cashCollections[0].transferredLoanBalance > 0) {
                            totalsLoanBalance += cc.cashCollections[0].transferredLoanBalance;
                            collection.totalLoanBalance += cc.cashCollections[0].transferredLoanBalance;
                            collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);
                        }

                        if (cc.cashCollections[0].transferMCBU > 0) {
                            collection.mcbu -= cc.cashCollections[0].transferMCBU;
                            collection.mcbuStr = formatPricePhp(collection.mcbu);
                        }

                        if (cc.cashCollections[0].transfer > 0) {
                            collection.activeBorrowers -= cc.cashCollections[0].transfer;
                            collection.activeClients -= cc.cashCollections[0].transfer;
                        }
                    }
    
                    if (cc.currentRelease.length > 0) {
                        const totalCurrentRelease = cc.currentRelease[0].noOfCurrentRelease;
                        noCurrentRelease = cc.currentRelease[0].newCurrentRelease + ' / ' + cc.currentRelease[0].reCurrentRelease;
                        collection = {
                            ...collection,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0,
                            reCurrentRelease: cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0,
                            currentReleaseAmount: cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0,
                            currentReleaseAmountStr: cc.currentRelease[0].currentReleaseAmount ? formatPricePhp(cc.currentRelease[0].currentReleaseAmount) : '-'
                        };
    
                        noOfNewCurrentRelease += cc.currentRelease[0].newCurrentRelease ? cc.currentRelease[0].newCurrentRelease : 0;
                        noOfReCurrentRelease += cc.currentRelease[0].reCurrentRelease ? cc.currentRelease[0].reCurrentRelease : 0;
                        currentReleaseAmount += cc.currentRelease[0].currentReleaseAmount ? cc.currentRelease[0].currentReleaseAmount : 0;
                        
                        if ((!collection.hasOwnProperty('status') || collection.status === '-')) {
                            collection.activeClients = collection.newCurrentRelease;
                            collection.status = "closed";
                            collection.page = "collection";
                            noOfClients += collection.newCurrentRelease;
                        }

                        if (collection.activeClients == 0 && (collection.activeBorrowers > 0 || totalCurrentRelease > 0)) {
                            collection.activeClients = totalCurrentRelease;
                            collection.status = "closed";
                        }
                    }
    
                    if (cc.fullPayment.length > 0) {
                        collection = {
                            ...collection,
                            fullPaymentAmount: cc.fullPayment.length > 0 ? cc.fullPayment[0].fullPaymentAmount : 0,
                            fullPaymentAmountStr: cc.fullPayment.length > 0 ? formatPricePhp(cc.fullPayment[0].fullPaymentAmount) : 0,
                            noOfFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].noOfFullPayment : 0,
                            newFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].newFullPayment : 0,
                            reFullPayment: cc.fullPayment.length > 0 ? cc.fullPayment[0].reFullPayment : 0
                        };
    
                        fullPaymentAmount += cc.fullPayment[0].fullPaymentAmount ? cc.fullPayment[0].fullPaymentAmount : 0;
                        noOfFullPayment += cc.fullPayment[0].noOfFullPayment ? cc.fullPayment[0].noOfFullPayment : 0;
                    }
                } else {
                    if (cc.cashCollections.length > 0) {
                        noCurrentRelease = cc.cashCollections[0].newCurrentRelease + ' / ' + cc.cashCollections[0].reCurrentRelease;
                        const dayNameFilter = moment(dateFilter).format('dddd').toLowerCase();
                        let loanTarget = 0;
                        if ((cc.occurence === 'weekly' && cc.day === dayNameFilter) || cc.occurence === 'daily') {
                            loanTarget = cc.cashCollections[0].loanTarget && cc.cashCollections[0].loanTarget;
                        }

                        collection = {
                            groupId: cc._id,
                            group: cc.name,
                            groupNo: cc.groupNo,
                            noCurrentReleaseStr: noCurrentRelease,
                            newCurrentRelease: cc.cashCollections[0].newCurrentRelease,
                            reCurrentRelease: cc.cashCollections[0].reCurrentRelease,
                            currentReleaseAmount: cc.cashCollections[0].currentReleaseAmount,
                            currentReleaseAmountStr: formatPricePhp(cc.cashCollections[0].currentReleaseAmount),
                            activeClients: cc.cashCollections[0].activeClients,
                            activeBorrowers: cc.cashCollections[0].activeBorrowers,
                            pendingClients: cc.cashCollections[0].pendingClients,
                            mispayment: cc.cashCollections[0].mispayment,
                            collection: cc.cashCollections[0].collection,
                            collectionStr: formatPricePhp(cc.cashCollections[0].collection),
                            excess: cc.cashCollections[0].excess,
                            excessStr: formatPricePhp(cc.cashCollections[0].excess),
                            loanTarget: loanTarget,
                            loanTargetStr: formatPricePhp(loanTarget),
                            pastDue: cc.cashCollections[0].pastDue,
                            pastDueStr: formatPricePhp(cc.cashCollections[0].pastDue),
                            noPastDue: cc.cashCollections[0].noPastDue,
                            totalReleases: cc.cashCollections[0].totalRelease,
                            totalReleasesStr: formatPricePhp(cc.cashCollections[0].totalRelease),
                            totalLoanBalance: cc.cashCollections[0].totalLoanBalance,
                            totalLoanBalanceStr: formatPricePhp(cc.cashCollections[0].totalLoanBalance),
                            fullPaymentAmount: cc.cashCollections[0].fullPaymentAmount,
                            fullPaymentAmountStr: formatPricePhp(cc.cashCollections[0].fullPaymentAmount),
                            noOfFullPayment: cc.cashCollections[0].noOfFullPayment,
                            newFullPayment: cc.cashCollections[0].newFullPayment,
                            reFullPayment: cc.cashCollections[0].reFullPayment,
                            mcbu: cc.cashCollections[0].mcbu ? cc.cashCollections[0].mcbu: 0,
                            mcbuStr: cc.cashCollections[0].mcbu ? formatPricePhp(cc.cashCollections[0].mcbu): 0,
                            mcbuCol: cc.cashCollections[0].mcbuCol ? cc.cashCollections[0].mcbuCol: 0,
                            mcbuColStr: cc.cashCollections[0].mcbuCol ? formatPricePhp(cc.cashCollections[0].mcbuCol): 0,
                            mcbuWithdrawal: cc.cashCollections[0].mcbuWithdrawal ? cc.cashCollections[0].mcbuWithdrawal: 0,
                            mcbuWithdrawalStr: cc.cashCollections[0].mcbuWithdrawal ? formatPricePhp(cc.cashCollections[0].mcbuWithdrawal): 0,
                            mcbuDailyWithdrawal: cc.cashCollections[0].mcbuDailyWithdrawal ? cc.cashCollections[0].mcbuDailyWithdrawal: 0,
                            mcbuDailyWithdrawalStr: cc.cashCollections[0].mcbuDailyWithdrawal ? formatPricePhp(cc.cashCollections[0].mcbuDailyWithdrawal): 0,
                            noMcbuReturn: cc.cashCollections[0].mcbuReturnNo ? cc.cashCollections[0].mcbuReturnNo: 0,
                            mcbuReturnAmt: cc.cashCollections[0].mcbuReturnAmt ? cc.cashCollections[0].mcbuReturnAmt: 0,
                            mcbuReturnAmtStr: cc.cashCollections[0].mcbuReturnAmt ? formatPricePhp(cc.cashCollections[0].mcbuReturnAmt): 0,
                            mcbuInterest: cc.cashCollections[0].mcbuInterest,
                            mcbuInterestStr: cc.cashCollections[0].mcbuInterest > 0 ? formatPricePhp(cc.cashCollections[0].mcbuInterest) : '-',
                            transfer: 0,
                            transferStr: '-',
                            status: groupStatus,
                            isDraft: isDraft,
                            page: 'collection'
                        };
    
                        noOfNewCurrentRelease += cc.cashCollections[0].newCurrentRelease;
                        noOfReCurrentRelease += cc.cashCollections[0].reCurrentRelease;
                        currentReleaseAmount += cc.cashCollections[0].currentReleaseAmount;
                        noOfClients += cc.cashCollections[0].activeClients;
                        noOfBorrowers += cc.cashCollections[0].activeBorrowers;
                        noOfPendings += cc.cashCollections[0].pendingClients;
                        excess += cc.cashCollections[0].excess;
                        totalLoanCollection += cc.cashCollections[0].collection;
                        mispayment += cc.cashCollections[0].mispayment;
                        totalPastDue += cc.cashCollections[0].pastDue;
                        totalNoPastDue += cc.cashCollections[0].noPastDue;
                        totalsLoanRelease += cc.cashCollections[0].totalRelease;
                        totalsLoanBalance += cc.cashCollections[0].totalLoanBalance;
                        // targetLoanCollection += loanTarget;
                        fullPaymentAmount += cc.cashCollections[0].fullPaymentAmount;
                        noOfFullPayment += cc.cashCollections[0].noOfFullPayment;
                        // totalMcbu += cc.cashCollections[0].mcbu;
                        totalMcbuCol += cc.cashCollections[0].mcbuCol;
                        totalMcbuWithdrawal += cc.cashCollections[0].mcbuWithdrawal;
                        totalMcbuDailyWithdrawal += cc.cashCollections[0].mcbuDailyWithdrawal;
                        totalMcbuReturnNo += collection.noMcbuReturn;
                        totalMcbuReturnAmt += cc.cashCollections[0].mcbuReturnAmt;
                        totalMcbuTarget += cc.cashCollections[0].mcbuTarget ? cc.cashCollections[0].mcbuTarget : 0;
                        totalMcbuInterest += cc.cashCollections[0].mcbuInterest;
                    }
                }

                let transfer = 0;

                if (cc.transferGiverDetails.length > 0) {
                    collectionTransferred.push.apply(collectionTransferred, cc.transferGiverDetails);
                    transfer = transfer - cc.transferGiverDetails.length;

                    cc.transferGiverDetails.map(giver => {
                        if (giver.sameLo) {
                            collectionTransferredByGroup.push(giver);
                        }

                        if (filter) {
                            collection.activeClients -= 1;
                            collection.activeBorrowers -= 1;
                        }

                        collection.mcbu -= giver.mcbu;
                        collection.totalReleases = collection.totalReleases ? collection.totalReleases : 0;
                        collection.totalReleases -= giver.amountRelease ? giver.amountRelease : 0;
                        collection.totalLoanBalance = collection.totalLoanBalance ? collection.totalLoanBalance : 0;
                        collection.totalLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;

                        totalsLoanRelease -= giver.amountRelease ? giver.amountRelease : 0;
                        totalsLoanBalance -= giver.loanBalance ? giver.loanBalance : 0;
                    });
                }

                if (cc.transferReceivedDetails.length > 0) {
                    collectionReceived.push.apply(collectionReceived, cc.transferReceivedDetails);
                    transfer = transfer + cc.transferReceivedDetails.length;

                    cc.transferReceivedDetails.map(rcv => {
                        if (rcv.sameLo) {
                            collectionReceivedByGroup.push(rcv);
                        }

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
                                // if (rcv.status == "completed") {
                                //     collection.activeBorrowers -= 1;
                                // }
                                collection.loanTarget -= rcv.targetCollection;
                                collection.loanTargetStr = formatPricePhp(collection.loanTarget);

                                if (rcv.status == 'tomorrow') {
                                    collection.totalReleases += rcv.amountRelease ? rcv.amountRelease : 0;
                                    collection.totalLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;

                                    totalsLoanRelease += rcv.amountRelease ? rcv.amountRelease : 0;
                                    totalsLoanBalance += rcv.loanBalance ? rcv.loanBalance : 0;
                                }
        
                                // targetLoanCollection -= rcv.targetCollection;
                            }
                        }
                    });
                }

                if (cc.transferGiverDetails.length > 0 || cc.transferReceivedDetails.length > 0) {
                    collection.mcbuStr = formatPricePhp(collection.mcbu);
                    collection.totalReleasesStr = formatPricePhp(collection.totalReleases);
                    collection.totalLoanBalanceStr = formatPricePhp(collection.totalLoanBalance);

                    collection.activeClients = collection.activeClients > -1 ? collection.activeClients : 0;
                    collection.activeBorrowers = collection.activeBorrowers > -1 ? collection.activeBorrowers : 0;
                }

                collection.transfer = transfer;
                collection.transferStr = transfer >= 0 ? transfer : `(${transfer * -1})`;
                totalTransfer += transfer;

                collectionData.push(collection);
            });

            collectionData.sort((a, b) => { return a.groupNo - b.groupNo; });
            noOfClients = 0;
            noOfBorrowers = 0;
            collectionData.map(c => {
                targetLoanCollection += (c.loanTarget && c.loanTarget !== '-') ? c.loanTarget : 0;
                totalMcbu += c.mcbu ? c.mcbu : 0
                noOfClients += c.activeClients !== '-' ? c.activeClients : 0;
                noOfBorrowers += c.activeBorrowers !== '-' ? c.activeBorrowers : 0;
            });


            if (collectionData.length > 0) {
                const transferGvr = transferDetailsTotal(collectionTransferred, 'Transfer GVR');
                const transferRcv = transferDetailsTotal(collectionReceived, 'Transfer RCV');
                const transferGvrByGroup = transferDetailsTotal(collectionTransferredByGroup, 'Transfer GVR');
                const transferRcvByGroup = transferDetailsTotal(collectionReceivedByGroup, 'Transfer RCV');
                
                let totals = {
                    group: 'GRAND TOTALS',
                    transfer: totalTransfer >= 0 ? totalTransfer : -Math.abs(totalTransfer),
                    transferStr: totalTransfer >= 0 ? totalTransfer : `(${totalTransfer * -1})`,
                    noOfNewCurrentRelease: noOfNewCurrentRelease,
                    noCurrentRelease: noOfNewCurrentRelease + noOfReCurrentRelease,
                    noCurrentReleaseStr: noOfNewCurrentRelease + ' / ' + noOfReCurrentRelease,
                    currentReleaseAmount: currentReleaseAmount,
                    currentReleaseAmountStr: currentReleaseAmount ? formatPricePhp(currentReleaseAmount) : 0,
                    activeClients: noOfClients >= 0 ? noOfClients : 0,
                    activeBorrowers: noOfBorrowers >= 0 ? noOfBorrowers : 0,
                    pendingClients: noOfPendings,
                    totalLoanRelease: totalsLoanRelease,
                    totalReleasesStr: totalsLoanRelease ? formatPricePhp(totalsLoanRelease) : 0,
                    totalLoanBalance: totalsLoanBalance,
                    totalLoanBalanceStr: totalsLoanBalance ? formatPricePhp(totalsLoanBalance) : 0,
                    targetLoanCollection: targetLoanCollection,
                    loanTargetStr: targetLoanCollection ? formatPricePhp(targetLoanCollection) : 0,
                    excess: excess,
                    excessStr: excess ? formatPricePhp(excess) : 0,
                    collection: totalLoanCollection,
                    collectionStr: totalLoanCollection ? formatPricePhp(totalLoanCollection) : 0,
                    mispaymentPerson: mispayment,
                    mispayment: mispayment + ' / ' + noOfClients,
                    fullPaymentAmount: fullPaymentAmount,
                    fullPaymentAmountStr: fullPaymentAmount ? formatPricePhp(fullPaymentAmount) : 0,
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
                    mcbuDailyWithdrawal: totalMcbuDailyWithdrawal,
                    mcbuDailyWithdrawalStr: formatPricePhp(totalMcbuDailyWithdrawal),
                    noMcbuReturn: totalMcbuReturnNo,
                    mcbuReturnAmt: totalMcbuReturnAmt,
                    mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
                    mcbuTarget: totalMcbuTarget,
                    mcbuInterest: totalMcbuInterest,
                    mcbuInterestStr: formatPricePhp(totalMcbuInterest),
                    totalData: true,
                    status: '-'
                }
                const consolidateTotalData = consolidateTotals(totals, transferGvr, transferRcv);
                if (collectionTransferred.length > 0 || collectionReceived.length > 0) {
                    collectionData.push(consolidateTotalData);
                }

                if (transferGvr?.totalLoanRelease > 0) {
                    totals.mcbuCol -= transferGvr.mcbuCol;
                    totals.mcbuColStr = formatPricePhp(totals.mcbuCol);
                    totals.targetLoanCollection -= transferGvr.targetLoanCollection;
                    totals.loanTargetStr = formatPricePhp(totals.targetLoanCollection);
                    totals.excess -= transferGvr.excess;
                    totals.excessStr = totals.excess > 0 ? formatPricePhp(totals.excess) : '-';
                    totals.collection -= transferGvr.collection;
                    totals.collectionStr = formatPricePhp(totals.collection);
                    totals.mcbuWithdrawal -= transferGvr.mcbuWithdrawal;
                    totals.mcbuWithdrawalStr = formatPricePhp(totals.mcbuWithdrawal);
                    totals.mcbuReturnAmt -= transferGvr.mcbuReturnAmt;
                    totals.mcbuReturnAmtStr = formatPricePhp(totals.mcbuReturnAmt);
                    totals.pastDue -= transferGvr.pastDue;
                    totals.pastDueStr = formatPricePhp(totals.pastDue);
                    // totals.currentReleaseAmount += transferGvr.currentReleaseAmount;
                    // totals.currentReleaseAmountStr = formatPricePhp(totals.currentReleaseAmount);
                }

                if (transferRcv?.totalLoanRelease > 0) {
                    totals.mcbuCol += transferRcv.mcbuCol;
                    totals.mcbuColStr = formatPricePhp(totals.mcbuCol);
                    totals.targetLoanCollection += transferRcv.targetLoanCollection;
                    totals.loanTargetStr = formatPricePhp(totals.targetLoanCollection);
                    totals.excess += transferRcv.excess;
                    totals.excessStr = totals.excess > 0 ? formatPricePhp(totals.excess) : '-';
                    totals.collection += transferRcv.collection;
                    totals.collectionStr = formatPricePhp(totals.collection);
                    totals.mcbuWithdrawal += transferRcv.mcbuWithdrawal;
                    totals.mcbuWithdrawalStr = formatPricePhp(totals.mcbuWithdrawal);
                    totals.mcbuReturnAmt += transferRcv.mcbuReturnAmt;
                    totals.mcbuReturnAmtStr = formatPricePhp(totals.mcbuReturnAmt);
                    totals.pastDue += transferRcv.pastDue;
                    totals.pastDueStr = formatPricePhp(totals.pastDue);
                    // totals.currentReleaseAmount += transferRcv.currentReleaseAmount;
                    // totals.currentReleaseAmountStr = formatPricePhp(totals.currentReleaseAmount);
                }

                if (collectionTransferred.length > 0) {
                    collectionData.push(transferGvr);
                }
                if (collectionReceived.length > 0) {
                    collectionData.push(transferRcv);
                }
                collectionData.push(totals);
                dispatch(setGroupSummaryTotals(totals));
                const dailyLos = {...createLos(totals, selectedBranch, selectedLOSubject.value, dateFilter, false, transferGvr, transferRcv, transferGvrByGroup, transferRcvByGroup, consolidateTotalData), losType: 'daily'};
                if ((collectionTransferred.length > 0 || collectionReceived.length > 0) && !filter && !isWeekend && !isHoliday) {
                    await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/add-transfer-data-to-los', { userId: currentUser._id, date: currentDate, newLos: dailyLos });
                }
                dispatch(setLoSummary(dailyLos));
                const currentMonth = moment().month();
                if (!filter && currentMonth === 12) {
                    saveYearEndLos(totals, selectedBranch, true);
                }
            }

            dispatch(setCashCollectionList(collectionData));
            
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }
    // next thing to do verify LOS after submition with transfers
    // verify data in date filters
    const consolidateTotals = (totals, transferGvr, transferRcv) => {
        let totalTransfer = 0;
        let totalMcbu = totals.mcbu;
        let totalLoanRelease = totals.totalLoanRelease;
        let totalLoanBalance = totals.totalLoanBalance;
        let totalTargetCollection = totals.targetLoanCollection;
        let totalPastDue = totals.pastDue;
        let totalNoPastDue = totals.noPastDue;

        if (transferGvr) {
            let transfer = transferGvr.transfer;

            if (transfer && typeof transfer === 'string' && transfer !== "-") {
                transfer = transfer.replace("(", "").replace(")", "");
                transfer = parseInt(transfer);
            }

            transfer = Math.abs(transfer);
            totalTransfer += transfer !== "-" ? transfer : 0;
            totalMcbu += transferGvr.mcbu;
            totalPastDue += (transferGvr.pastDue && transferGvr.pastDue !== '-') ? transferGvr.pastDue : 0;
            totalNoPastDue += (transferGvr.noPastDue && transferGvr.noPastDue !== '-') ? transferGvr.noPastDue : 0;
        }

        if (transferRcv) {
            let transfer = transferRcv.transfer;
            totalTransfer -= transfer !== "-" ? transfer : 0;
            totalMcbu -= transferRcv.mcbu;
            totalPastDue -= (transferRcv.pastDue && transferRcv.pastDue !== '-') ? transferRcv.pastDue : 0;
            totalNoPastDue -= (transferRcv.noPastDue && transferRcv.noPastDue !== '-') ? transferRcv.noPastDue : 0;
        }

        const activeClients = totals.activeClients + totalTransfer;
        const activeBorrowers = totals.activeBorrowers + totalTransfer;
        totalTargetCollection = totalTargetCollection > 0 ? totalTargetCollection : 0;
        totalPastDue = totalPastDue > 0 ? totalPastDue : 0;
        totalNoPastDue = totalNoPastDue > 0 ? totalNoPastDue : 0;

        return {
            ...totals,
            group: 'TOTALS',
            transfer: 0,
            transferStr: "-",
            activeClients: activeClients > 0 ? activeClients : 0,
            activeBorrowers: activeBorrowers > 0 ? activeBorrowers : 0,
            totalLoanRelease: totalLoanRelease,
            totalReleasesStr: totalLoanRelease ? formatPricePhp(totalLoanRelease) : 0,
            totalLoanBalance: totalLoanBalance,
            totalLoanBalanceStr: totalLoanBalance ? formatPricePhp(totalLoanBalance) : 0,
            targetLoanCollection: totalTargetCollection,
            loanTargetStr: totalTargetCollection ? formatPricePhp(totalTargetCollection) : 0,
            excessStr: '-',
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue),
            noPastDue: totalNoPastDue,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            totalData: true,
            status: '-'
        }
    }

    const transferDetailsTotal = (details, type) => {
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

        details.map(transfer => {
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
            group: type.toUpperCase(),
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
            totalLoanBalance: totalLoanBalance,
            totalLoanBalanceStr: '-',
            targetLoanCollection: totalTargetCollection,
            loanTargetStr: (type === 'Transfer GVR' && totalTargetCollection > 0) ? `(${formatPricePhp(totalTargetCollection)})` : formatPricePhp(totalTargetCollection),
            excess: 0,
            excessStr: '-', // (type === 'Transfer GVR' && totalExcess > 0) ? `(${formatPricePhp(totalExcess)})` : formatPricePhp(totalExcess),
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
            totalTdaClients: (type === 'Transfer RCV') ? totalTdaClients : 0,
            totalPendingClients: (type === 'Transfer RCV') ? totalPendingClients : 0,
            totalData: true,
            status: '-'
        }
    }

    const createLos = (totals, selectedBranch, selectedLO, dateFilter, yearEnd, transferGvr, transferRcv, transferGvrByGroup, transferRcvByGroup, consolidateTotalData) => {
        let grandTotal;

        let totalsLoanRelease = totals.totalLoanRelease + totals.currentReleaseAmount;
        let totalsLoanBalance = totals.totalLoanBalance + totals.currentReleaseAmount;
        let totalActiveClients = totals.activeClients;
        let totalActiveBorrowers = totals.activeBorrowers;
        let prevMcbuBalance = totals.mcbu > 0 ? totals.mcbu - totals.mcbuCol : 0;
        let totalsMcbuTransfer = 0;
        let totalsMcbuCol = totals.mcbuCol;
        let totalsCurrentReleaseAmount = totals.currentReleaseAmount;
        let totalsCollectionTarget = totals.targetLoanCollection;
        let totalsCollectionExcess = totals.excess;
        let totalsCollectionActual = totals.collection;

        if ((transferGvr?.totalLoanRelease > 0 && transferGvr.totalLoanRelease !== transferGvrByGroup.totalLoanRelease) 
                || (transferRcv?.totalLoanRelease > 0 && transferRcv.totalLoanRelease !== transferRcvByGroup.totalLoanRelease)) {
            let transferLoanReleaseAmount = 0;
            if (transferGvr?.totalLoanRelease > 0) {
                transferLoanReleaseAmount = transferGvr.totalLoanRelease;
                // transferLoanReleaseAmount += transferGvr.currentReleaseAmount;
                totalsLoanBalance -= transferGvr.targetLoanCollection;
                totalsLoanBalance -= transferGvr.excess;
                // totalsLoanBalance += transferGvr.currentReleaseAmount;
            }
            
            if (transferRcv?.totalLoanRelease > 0) {
                transferLoanReleaseAmount -= transferRcv.totalLoanRelease;
                // transferLoanReleaseAmount += transferRcv.currentReleaseAmount;
                totalsLoanBalance += transferRcv.targetLoanCollection;
                totalsLoanBalance += transferRcv.excess;
                // totalsLoanBalance += transferRcv.currentReleaseAmount;

            }

            totalsLoanRelease += transferLoanReleaseAmount;
            totalsLoanBalance += transferLoanReleaseAmount;
            totalsMcbuCol = consolidateTotalData.mcbuCol;
            totalsCollectionTarget = consolidateTotalData.targetLoanCollection;
            totalsCollectionActual = consolidateTotalData.collection;
            totalActiveClients = consolidateTotalData.activeClients;
            totalActiveBorrowers = consolidateTotalData.activeBorrowers;
        }

        if (yearEnd) {
            grandTotal = {
                day: 'Year End',
                transfer: 0,
                newMember: 0,
                offsetPerson: 0,
                prevMcbuBalance: prevMcbuBalance,
                mcbuTransfer: totalsMcbuTransfer,
                mcbuTarget: totals.mcbuTarget,
                mcbuActual: totalsMcbuCol,
                mcbuWithdrawal: totals.mcbuWithdrawal + totals?.mcbuDailyWithdrawal ? totals.mcbuDailyWithdrawal : 0,
                mcbuInterest: totals.mcbuInterest,
                noMcbuReturn: totals.noMcbuReturn,
                mcbuReturnAmt: totals.mcbuReturnAmt,
                activeClients: totalActiveClients,
                loanReleasePerson: 0,
                loanReleaseAmount: 0,
                activeLoanReleasePerson: totalActiveBorrowers,
                activeLoanReleaseAmount: totalsLoanRelease,
                collectionAdvancePayment: 0,
                collectionActual: totalsCollectionActual,
                pastDuePerson: 0,
                pastDueAmount: 0,
                mispaymentPerson: totals.mispaymentPerson,
                fullPaymentPerson: 0,
                fullPaymentAmount: 0,
                activeBorrowers: totalActiveBorrowers,
                loanBalance: totalsLoanBalance,
                transferGvr: transferGvr,
                transferRcv: transferRcv
            };
        } else {
            let selectedDate = currentDate;
            if (dateFilter) {
                if (dateFilter !== currentDate) {
                    selectedDate = dateFilter;
                }
            }

            // let totalActiveBorrowers = totals.activeBorrowers;
            if (totalActiveBorrowers === 0 && totalActiveClients > 0) {
                totalActiveBorrowers = totalActiveClients;
            }

            grandTotal = {
                day: selectedDate,
                transfer: 0,
                newMember: totals.noOfNewCurrentRelease,
                prevMcbuBalance: prevMcbuBalance,
                mcbuTransfer: totalsMcbuTransfer,
                mcbuTarget: totals.mcbuTarget,
                mcbuActual: totalsMcbuCol,
                mcbuWithdrawal: totals.mcbuWithdrawal + totals?.mcbuDailyWithdrawal ? totals.mcbuDailyWithdrawal : 0,
                mcbuInterest: totals.mcbuInterest,
                noMcbuReturn: totals.noMcbuReturn,
                mcbuReturnAmt: totals.mcbuReturnAmt,
                offsetPerson: totals.offsetPerson,
                activeClients: totalActiveClients,
                loanReleasePerson: totals.noCurrentRelease,
                loanReleaseAmount: totalsCurrentReleaseAmount,
                activeLoanReleasePerson: totalActiveBorrowers,
                activeLoanReleaseAmount: totalsLoanRelease,
                collectionTarget: totalsCollectionTarget,
                collectionAdvancePayment: totalsCollectionExcess,
                collectionActual: totalsCollectionActual,
                pastDuePerson: totals.noPastDue,
                pastDueAmount: totals.pastDue,
                mispaymentPerson: totals.mispaymentPerson,
                fullPaymentPerson: totals.noOfFullPayment,
                fullPaymentAmount: totals.fullPaymentAmount,
                activeBorrowers: totalActiveBorrowers,
                loanBalance: totalsLoanBalance,
                transferGvr: transferGvr,
                transferRcv: transferRcv
            };
        }

        let month = yearEnd ? 12 : moment().month() + 1;
        let year = yearEnd ? moment().year() - 1 : moment().year();
        if (dateFilter)  {
            month = moment(dateFilter).month() + 1;
            year = moment(dateFilter).year();
        }

        return {
            branchId: currentBranch,
            userId: selectedLO ? selectedLO : currentUser._id,
            userType: 'lo',
            branchId: selectedBranch,
            month: month,
            year: year,
            data: grandTotal,
            occurence: type,
            currentDate: currentDate
        }
    }

    const saveYearEndLos = async (totals, selectedBranch, yearEnd) => {
        if (currentUser.role.rep === 4) {
            const losTotals = {...createLos(totals, selectedBranch, null, null, yearEnd), losType: 'year-end', currentDate: currentDate};
    
            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', losTotals);
        }
    }

    const handleRowClick = (selected) => {
        if (!selected.totalData) {
            if (pageNo === 1) {
                router.push(`./${type}-cash-collection/client/${selected.groupId}`);
            } else if (pageNo === 2) {
                router.push(`/transactions/${type}-cash-collection/client/${selected.groupId}`);
            }
            
            localStorage.setItem('cashCollectionDateFilter', dateFilter);
        } else {
            if (selected.group !== 'TOTALS') {
                toast.error('No loans on this group yet.')
            }
        }
    };

    const [columns, setColumns] = useState();

    useEffect(() => {
        let cols = [
            {
                Header: "Group",
                accessor: 'group',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "Active Clients",
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
                accessor: 'collectionStr',
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
                Header: "MCBU Withdrawal",
                accessor: 'mcbuDailyWithdrawalStr'
            },
            {
                Header: "MCBU Interest",
                accessor: 'mcbuInterestStr',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Return Person",
                accessor: 'noMcbuReturn',
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            {
                Header: "MCBU Return Amount",
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
                accessor: 'mispayment',
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
                accessor: 'transferStr'
            },
            {
                Header: "Save Status",
                accessor: 'status',
                Cell: StatusPill,
                Filter: SelectColumnFilter,
                filter: 'includes'
            },
            // to be implemented
            // {
            //     Header: "Remakrs",
            //     accessor: 'remarks',
            //     Filter: SelectColumnFilter,
            //     filter: 'includes'
            // }
        ];

        setColumns(cols);
    }, []);

    useEffect(() => {
        const getListGroup = async (loId) => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ mode: "filter", occurence: type, loId: loId });

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
                setSelectedGroupIds(groups.map(group => group._id));
                dispatch(setGroupList(groups));
            } else if (response.error) {
                toast.error(response.message);
            }
        }

        if (type) {
            if (currentUser.role.rep == 4) {
                getListGroup(currentUser._id);
            } else if (selectedLOSubject.value.length > 0) {
                getListGroup(selectedLOSubject.value);
            }
        }
    }, [type]);

    useEffect(() => {
        let mounted = true;
        localStorage.removeItem('cashCollectionDateFilter');
        if (selectedGroupIds.length > 0) {
            if (dateFilter) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getCashCollections(date);
                } else {
                    mounted && getCashCollections();
                }
            } else {
                getCashCollections();
            }
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter, selectedGroupIds]);

    useEffect(() => {
        if (type === 'weekly' && !isHoliday && !isWeekend) {
            const preSaveCollections = async () => {
                const data = {
                    loId: currentUser.role.rep === 4 ? currentUser._id : selectedLOSubject.value.length > 0 && selectedLOSubject.value,
                    currentDate: currentDate,
                    currentUser: currentUser._id
                };
    
                await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collections/pre-save-collections', data);
            }

            setTimeout(() => {
                preSaveCollections();
            }, 1000);
        }
    }, [type, isHoliday, isWeekend]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={cashCollectionList} showPagination={false} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}


export default ViewCashCollectionPage;