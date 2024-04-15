import React from "react";
import Layout from "@/components/Layout"
import { useEffect } from "react";
import { useState } from "react";
import Spinner from "@/components/Spinner";
import { useDispatch, useSelector } from "node_modules/react-redux/es/exports";
import { setLosList } from "@/redux/actions/losActions";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import LOSHeader from "@/components/transactions/los/Header";
import { formatPricePhp, getDaysOfMonth } from "@/lib/utils";
import { useRouter } from "node_modules/next/router";
import { setBranch } from "@/redux/actions/branchActions";
import { setUserList } from "@/redux/actions/userActions";
import { getApiBaseUrl } from "@/lib/constants";

const BranchManagerSummary = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.los.list);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentBranch = useSelector(state => state.branch.data);
    const [days, setDays] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState();
    const [selectedYear, setSelectedYear] = useState();
    const [selectedLoGroup, setSelectedLoGroup] = useState('all');
    const [selectedLo, setSelectedLo] = useState();

    const handleMonthFilter = (selected) => {
        setSelectedMonth(selected.value);
    }

    const handleYearFilter = (selected) => {
        setSelectedYear(selected.value);
    }

    const handleSelectedLoGroupChange = (value) => {
        if (value == 'all') {
            setSelectedLo(null);
        }

        setSelectedLoGroup(value);
    }

    const handleSelectedLoChange = (selected) => {
        setSelectedLo(selected);
        router.push(`/transactions/loan-officer-summary?uuid=${selected._id}`);
    }

    const getListLos = async (date, loGroup) => {
        setLoading(true);

        let filter = false;

        if (moment(currentDate).format('YYYY-MM') !== moment(date).format('YYYY-MM')) {
            filter = true;
        }

        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary';
        let losList = [{
            day: 'F / Balance',
            transfer: 0,
            newMember: 0,
            mcbuTarget: 0,
            mcbuTargetStr: 0,
            mcbuActual: 0,
            mcbuActualStr: 0,
            mcbuWithdrawal: 0,
            mcbuWithdrawalStr: 0,
            mcbuInterest: 0,
            mcbuInterestStr: 0,
            noMcbuReturn: 0,
            mcbuReturnAmt: 0,
            mcbuReturnAmtStr: 0,
            mcbuBalance: 0,
            mcbuBalanceStr: 0,
            offsetPerson: 0,
            activeClients: 0,
            loanReleaseDailyPerson: 0,
            loanReleaseDailyAmount: 0,
            loanReleaseDailyAmountStr: 0,
            loanReleaseWeeklyPerson: 0,
            loanReleaseWeeklyAmount: 0,
            loanReleaseWeeklyAmountStr: 0,
            consolidatedLoanReleasePerson: 0,
            consolidatedLoanReleaseAmount: 0,
            consolidatedLoanReleaseAmountStr: 0,
            activeLoanReleasePerson: 0,
            activeLoanReleaseAmount: 0,
            activeLoanReleaseAmountStr: 0,
            collectionAdvancePaymentDaily: 0,
            collectionAdvancePaymentDailyStr: 0,
            collectionActualDaily: 0,
            collectionActualDailyStr: 0,
            collectionAdvancePaymentWeekly: 0,
            collectionAdvancePaymentWeeklyStr: 0,
            collectionActualWeekly: 0,
            collectionActualWeeklyStr: 0,
            consolidatedCollection: 0,
            consolidatedCollectionStr: 0,
            pastDuePerson: 0,
            pastDueAmount: 0,
            pastDueAmountStr: 0,
            mispaymentPerson: 0,
            fullPaymentDailyPerson: 0,
            fullPaymentDailyAmount: 0,
            fullPaymentDailyAmountStr: 0,
            fullPaymentWeeklyPerson: 0,
            fullPaymentWeeklyAmount: 0,
            fullPaymentWeeklyAmountStr: 0,
            consolidatedFullPaymentPerson: 0,
            consolidatedFullPaymentAmount: 0,
            consolidatedFullPaymentAmountStr: 0,
            activeBorrowers: 0,
            loanBalance: 0,
            loanBalanceStr: 0,
            fBalance: true
        }];
        let weekNumber = 0;
        days.map((day, index) => {
            const dayName = moment(day).format('dddd');

            if (dayName === 'Saturday' || dayName === 'Sunday') {
                return;
            }

            losList.push({
                day: day,
                dayName: dayName,
                transfer: '-',
                newMember: '-',
                mcbuTarget: '-',
                mcbuTargetStr: '-',
                mcbuActual: '-',
                mcbuActualStr: '-',
                mcbuWithdrawal: '-',
                mcbuWithdrawalStr: '-',
                mcbuInterest: '-',
                mcbuInterestStr: '-',
                noMcbuReturn: '-',
                mcbuReturnAmt: '-',
                mcbuReturnAmtStr: '-',
                offsetPerson: '-',
                activeClients: '-',
                mcbuBalance: '-',
                mcbuBalanceStr: '-',
                loanReleaseDailyPerson: '-',
                loanReleaseDailyAmount: '-',
                loanReleaseDailyAmountStr: '-',
                loanReleaseWeeklyPerson: '-',
                loanReleaseWeeklyAmount: '-',
                loanReleaseWeeklyAmountStr: '-',
                consolidatedLoanReleasePerson: '-',
                consolidatedLoanReleaseAmount: '-',
                consolidatedLoanReleaseAmountStr: '-',
                activeLoanReleasePerson: '-',
                activeLoanReleaseAmount: '-',
                activeLoanReleaseAmountStr: '-',
                collectionTargetDaily: '-',
                collectionTargetDailyStr: '-',
                collectionAdvancePaymentDaily: '-',
                collectionAdvancePaymentDailyStr: '-',
                collectionActualDaily: '-',
                collectionActualDailyStr: '-',
                collectionTargetWeekly: '-',
                collectionTargetWeeklyStr: '-',
                collectionAdvancePaymentWeekly: '-',
                collectionAdvancePaymentWeeklyStr: '-',
                collectionActualWeekly: '-',
                collectionActualWeeklyStr: '-',
                consolidatedCollection: '-',
                consolidatedCollectionStr: '-',
                pastDuePerson: '-',
                pastDueAmount: '-',
                pastDueAmountStr: '-',
                mispaymentPerson: '-',
                fullPaymentDailyPerson: '-',
                fullPaymentDailyAmount: '-',
                fullPaymentDailyAmountStr: '-',
                fullPaymentWeeklyPerson: '-',
                fullPaymentWeeklyAmount: '-',
                fullPaymentWeeklyAmountStr: '-',
                consolidatedFullPaymentPerson: '-',
                consolidatedFullPaymentAmount: '-',
                consolidatedFullPaymentAmountStr: '-',
                activeBorrowers: '-',
                loanBalance: '-',
                loanBalanceStr: '-'
            });

            if (dayName === 'Friday' || index === days.length - 1) {
                losList.push({
                    day: 'Weekly Total',
                    transfer: '-',
                    newMember: '-',
                    mcbuTargetStr: '-',
                    mcbuActualStr: '-',
                    mcbuWithdrawalStr: '-',
                    mcbuInterestStr: '-',
                    noMcbuReturnStr: '-',
                    mcbuReturnAmtStr: '-',
                    offsetPerson: '-',
                    activeClients: '-',
                    mcbuBalanceStr: '-',
                    loanReleaseDailyPerson: '-',
                    loanReleaseDailyAmount: '-',
                    loanReleaseDailyAmountStr: '-',
                    loanReleaseWeeklyPerson: '-',
                    loanReleaseWeeklyAmount: '-',
                    loanReleaseWeeklyAmountStr: '-',
                    consolidatedLoanReleasePerson: '-',
                    consolidatedLoanReleaseAmount: '-',
                    consolidatedLoanReleaseAmountStr: '-',
                    activeLoanReleasePerson: '-',
                    activeLoanReleaseAmount: '-',
                    activeLoanReleaseAmountStr: '-',
                    collectionTargetDaily: '-',
                    collectionTargetDailyStr: '-',
                    collectionAdvancePaymentDaily: '-',
                    collectionAdvancePaymentDailyStr: '-',
                    collectionActualDaily: '-',
                    collectionActualDailyStr: '-',
                    collectionTargetWeekly: '-',
                    collectionTargetWeeklyStr: '-',
                    collectionAdvancePaymentWeekly: '-',
                    collectionAdvancePaymentWeeklyStr: '-',
                    collectionActualWeekly: '-',
                    collectionActualWeeklyStr: '-',
                    consolidatedCollection: '-',
                    consolidatedCollectionStr: '-',
                    pastDuePerson: '-',
                    pastDueAmount: '-',
                    pastDueAmountStr: '-',
                    mispaymentPerson: '-',
                    fullPaymentDailyPerson: '-',
                    fullPaymentDailyAmount: '-',
                    fullPaymentDailyAmountStr: '-',
                    fullPaymentWeeklyPerson: '-',
                    fullPaymentWeeklyAmount: '-',
                    fullPaymentWeeklyAmountStr: '-',
                    consolidatedFullPaymentPerson: '-',
                    consolidatedFullPaymentAmount: '-',
                    consolidatedFullPaymentAmountStr: '-',
                    activeBorrowers: '-',
                    loanBalance: '-',
                    loanBalanceStr: '-',
                    weekNumber: weekNumber++,
                    weekTotal: true
                });
            }
        });

        if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ userId: currentUser._id, branchId: currentUser.designatedBranchId, date: date ? date : currentDate, loGroup: loGroup });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let fBal = response.data.fBalance;
                if (fBal.length > 0) {
                    fBal = fBal[0].data;
                    losList[0] = {
                        day: 'F / Balance',
                        transfer: fBal.transfer,
                        newMember: fBal.newMember,
                        mcbuTarget: fBal.mcbuTarget,
                        mcbuTargetStr: formatPricePhp(fBal.mcbuTarget),
                        mcbuActual: fBal.mcbuActual,
                        mcbuActualStr: formatPricePhp(fBal.mcbuActual),
                        mcbuWithdrawal: fBal.mcbuWithdrawal,
                        mcbuWithdrawalStr: formatPricePhp(fBal.mcbuWithdrawal),
                        mcbuInterest: fBal.mcbuInterest,
                        mcbuInterestStr: formatPricePhp(fBal.mcbuInterest),
                        noMcbuReturn: fBal.noMcbuReturn,
                        mcbuReturnAmt: fBal.mcbuReturnAmt,
                        mcbuReturnAmtStr: formatPricePhp(fBal.mcbuReturnAmt),
                        mcbuBalance: fBal.mcbuBalance,
                        mcbuBalanceStr: formatPricePhp(fBal.mcbuBalance),
                        offsetPerson: fBal.offsetPerson,
                        activeClients: fBal.activeClients,
                        loanReleaseDailyPerson: fBal.loanReleaseDailyPerson,
                        loanReleaseDailyAmount: fBal.loanReleaseDailyAmount,
                        loanReleaseDailyAmountStr: formatPricePhp(fBal.loanReleaseDailyAmount),
                        loanReleaseWeeklyPerson: fBal.loanReleaseWeeklyPerson,
                        loanReleaseWeeklyAmount: fBal.loanReleaseWeeklyAmount,
                        loanReleaseWeeklyAmountStr: formatPricePhp(fBal.loanReleaseWeeklyAmount),
                        consolidatedLoanReleasePerson: fBal.consolidatedLoanReleasePerson,
                        consolidatedLoanReleaseAmount: fBal.consolidatedLoanReleaseAmount,
                        consolidatedLoanReleaseAmountStr: formatPricePhp(fBal.consolidatedLoanReleaseAmount),
                        activeLoanReleasePerson: fBal.activeLoanReleasePerson,
                        activeLoanReleaseAmount: fBal.activeLoanReleaseAmount,
                        activeLoanReleaseAmountStr: formatPricePhp(fBal.activeLoanReleaseAmount),
                        collectionAdvancePaymentDaily: fBal.collectionAdvancePaymentDaily,
                        collectionAdvancePaymentDailyStr: formatPricePhp(fBal.collectionAdvancePaymentDaily),
                        collectionActualDaily: fBal.collectionActualDaily,
                        collectionActualDailyStr: formatPricePhp(fBal.collectionActualDaily),
                        collectionAdvancePaymentWeekly: fBal.collectionAdvancePaymentWeekly,
                        collectionAdvancePaymentWeeklyStr: formatPricePhp(fBal.collectionAdvancePaymentWeekly),
                        collectionActualWeekly: fBal.collectionActualWeekly,
                        collectionActualWeeklyStr: formatPricePhp(fBal.collectionActualWeekly),
                        consolidatedCollection: fBal.consolidatedCollection,
                        consolidatedCollectionStr: formatPricePhp(fBal.consolidatedCollection),
                        pastDuePerson: fBal.pastDuePerson,
                        pastDueAmount: fBal.pastDueAmount,
                        pastDueAmountStr: formatPricePhp(fBal.pastDueAmount),
                        mispaymentPerson: fBal.mispaymentPerson,
                        fullPaymentDailyPerson: fBal.fullPaymentDailyPerson,
                        fullPaymentDailyAmount: fBal.fullPaymentDailyAmount,
                        fullPaymentDailyAmountStr: formatPricePhp(fBal.fullPaymentDailyAmount),
                        fullPaymentWeeklyPerson: fBal.fullPaymentWeeklyPerson,
                        fullPaymentWeeklyAmount: fBal.fullPaymentWeeklyAmount,
                        fullPaymentWeeklyAmountStr: formatPricePhp(fBal.fullPaymentWeeklyAmount),
                        consolidatedFullPaymentPerson: fBal.consolidatedFullPaymentPerson,
                        consolidatedFullPaymentAmount: fBal.consolidatedFullPaymentAmount,
                        consolidatedFullPaymentAmountStr: formatPricePhp(fBal.consolidatedFullPaymentAmount),
                        activeBorrowers: fBal.activeBorrowers,
                        loanBalance: fBal.loanBalance,
                        loanBalanceStr: formatPricePhp(fBal.loanBalance),
                        fBalance: true
                    };
                }
                
                response.data.current.map(los => {
                    const index = losList.findIndex(d => d.day === los._id.dateAdded);
                    if (index > -1) {
                        losList[index] = {
                            ...los,
                            day: los._id.dateAdded,
                            transfer: los.transfer,
                            prevMcbuBalance: los.prevMcbuBalance,
                            mcbuTargetStr: los.mcbuTarget > 0 ? formatPricePhp(los.mcbuTarget) : '-',
                            mcbuActualStr: los.mcbuActual > 0 ? formatPricePhp(los.mcbuActual) : '-',
                            mcbuWithdrawalStr: los.mcbuWithdrawal > 0 ? formatPricePhp(los.mcbuWithdrawal) : '-',
                            mcbuInterestStr: los.mcbuInterest > 0 ? formatPricePhp(los.mcbuInterest) : '-',
                            mcbuReturnAmtStr: los.mcbuReturnAmt > 0 ? formatPricePhp(los.mcbuReturnAmt) : '-',
                            loanReleaseDailyAmountStr: los.loanReleaseDailyAmount ? formatPricePhp(los.loanReleaseDailyAmount) : '-',
                            loanReleaseWeeklyAmountStr: los.loanReleaseWeeklyAmount > 0 ? formatPricePhp(los.loanReleaseWeeklyAmount) : '-',
                            activeLoanReleaseAmountStr: formatPricePhp(los.activeLoanReleaseAmount),
                            consolidatedLoanReleaseAmountStr: los.consolidatedLoanReleaseAmount > 0 ? formatPricePhp(los.consolidatedLoanReleaseAmount) : '-',
                            collectionTargetDailyStr: los.collectionTargetDaily > 0 ? formatPricePhp(los.collectionTargetDaily) : '-',
                            collectionAdvancePaymentDailyStr: los.collectionAdvancePaymentDaily > 0 ? formatPricePhp(los.collectionAdvancePaymentDaily) : '-',
                            collectionActualDailyStr: los.collectionActualDaily > 0 ? formatPricePhp(los.collectionActualDaily) : '-',
                            collectionTargetWeeklyStr: los.collectionTargetWeekly > 0 ? formatPricePhp(los.collectionTargetWeekly) : '-',
                            collectionAdvancePaymentWeeklyStr: los.collectionAdvancePaymentWeekly > 0 ? formatPricePhp(los.collectionAdvancePaymentWeekly) : '-',
                            collectionActualWeeklyStr: los.collectionActualWeekly > 0 ? formatPricePhp(los.collectionActualWeekly) : '-',
                            consolidatedCollectionStr: los.consolidatedCollection > 0 ? formatPricePhp(los.consolidatedCollection) : '-',
                            pastDueAmountStr: los.pastDueAmount > 0 ? formatPricePhp(los.pastDueAmount) : '-',
                            fullPaymentDailyAmountStr: los.fullPaymentDailyAmount > 0 ? formatPricePhp(los.fullPaymentDailyAmount) : '-',
                            fullPaymentWeeklyAmountStr: los.fullPaymentWeeklyAmount > 0 ? formatPricePhp(los.fullPaymentWeeklyAmount) : '-',
                            consolidatedFullPaymentAmountStr: los.consolidatedFullPaymentAmount > 0 ? formatPricePhp(los.consolidatedFullPaymentAmount) : '-',
                            loanBalanceStr: los.loanBalance > 0 ? formatPricePhp(los.loanBalance) : '-'
                        };
                    }
                });

                losList = calculatePersons(losList);
                const transferRow = processTransferDetails(losList);
                losList = calculateWeeklyTotals(losList, transferRow);
                losList.push(calculateMonthlyTotals(losList[0], losList.filter(los => los.weekTotal)));
                losList.push(calculateGrandTotals(losList.filter(los => !los.hasOwnProperty('flag')), filter, date));
                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const processTransferDetails = (losList) => {
        let totalTransfer = 0;
        let totalMcbuTarget = 0;
        let totalMcbuActual = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuInterest = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuNoReturn = 0;
        let totalMcbuBalance = 0;
        let totalDailyTargetCollection = 0;
        let totalWeeklyTargetCollection = 0;
        let totalDailyCollectionAdvancePayment = 0;
        let totalWeeklyCollectionAdvancePayment = 0;
        let totalDailyActualCollection = 0;
        let totalWeeklyActualCollection = 0;
        let totalConsolidatedActualCollection = 0;
        let totalPastDue = 0;
        let totalNoPastDue = 0;
        let totalDailyNoLoanRelease = 0;
        let totalWeeklyNoLoanRelease = 0;
        let totalDailyLoanRelease = 0;
        let totalWeeklyLoanRelease = 0;
        let totalConsolidatedNoLoanRelease = 0;
        let totalConsolidatedLoanRelease = 0;

        let mcbuBalance = 0;
        let activeClients = 0;
        let activeBorrowers = 0;
        let activeLoanReleasePerson = 0;
        let activeLoanReleaseAmount = 0;
        let loanBalance = 0;

        losList.map((los, index) => {
            let temp = {...los};
            let transferDailyGvr = [];
            let transferDailyRcv = [];
            let transferWeeklyGvr = [];
            let transferWeeklyRcv = [];

            activeClients = temp.activeClients;
            activeBorrowers = temp.activeBorrowers;
            activeLoanReleasePerson = temp.activeLoanReleasePerson;
            activeLoanReleaseAmount = temp.activeLoanReleaseAmount !== '-' ? temp.activeLoanReleaseAmount : 0;
            // loanBalance = temp.loanBalance !== '-' ? temp.loanBalance : 0;

            temp?.transferDailyGvr?.map(dailyGvr => {
                if (dailyGvr) {
                    const data = {...dailyGvr};
                    if (data.totalLoanBalance > 0) {
                        let noTransfer = data.transfer;
                        if (typeof noTransfer === "string") {
                            noTransfer = noTransfer.replace('(','').replace(')','');
                            noTransfer = -Math.abs(noTransfer);
                        }

                        const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? -Math.abs(data.mcbuTarget) : 0 : 0;
                        const mcbuActual = data.mcbuCol !== '-' ? -Math.abs(data.mcbuCol) : 0;
                        const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? -Math.abs(data.mcbuWithdrawal) : 0;
                        const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? -Math.abs(data.mcbuInterest) : 0;
                        const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? -Math.abs(data.noMcbuReturn) : 0;
                        const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? -Math.abs(data.mcbuReturnAmt) : 0;
                        const excess = data.excess !== '-' ? data.excess > 0 ? -Math.abs(data.excess) : 0 : 0;

                        transferDailyGvr.push({
                            transfer: noTransfer,
                            mcbuTarget: mcbuTarget,
                            mcbuActual: (transferDailyGvr && transferDailyGvr.mcbuActual) ? transferDailyGvr.mcbuActual + mcbuActual : mcbuActual,
                            mcbuWithdrawal: mcbuWithdrawal,
                            mcbuInterest: mcbuInterest,
                            noMcbuReturn: noMcbuReturn,
                            mcbuReturnAmt: mcbuReturnAmt,
                            mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                            currentReleaseAmount: data.currentReleaseAmount,
                            loanReleaseAmount: -Math.abs(data.totalLoanRelease),
                            collectionTarget: -Math.abs(data.targetLoanCollection + excess),
                            collectionActual: -Math.abs(data.collection),
                            pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                            pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                        });

                        activeClients += noTransfer;
                        activeBorrowers += noTransfer;
                        activeLoanReleasePerson += noTransfer;
                        activeLoanReleaseAmount = activeLoanReleaseAmount - data.totalLoanRelease ? data.totalLoanRelease : 0 + data.currentReleaseAmount ? data.currentReleaseAmount : 0;
                        loanBalance = temp.loanBalance - (data.totalLoanRelease - data.collection) + data.currentReleaseAmount;
                    }
                }
            });

            temp?.transferDailyRcv?.map(dailyRcv => {
                if (dailyRcv) {
                    const data = {...dailyRcv};
                    if (data.totalLoanBalance > 0) {
                        let noTransfer = data.transfer;
                        if (typeof noTransfer === "string") {
                            noTransfer = noTransfer.replace('(','').replace(')','');
                            noTransfer = -Math.abs(noTransfer);
                        }

                        const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? data.mcbuTarget : 0 : 0;
                        const mcbuActual = data.mcbuCol !== '-' ? data.mcbuCol : 0;
                        const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? data.mcbuWithdrawal : 0;
                        const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? data.mcbuInterest : 0;
                        const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? data.noMcbuReturn : 0;
                        const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? data.mcbuReturnAmt : 0;
                        const excess = data.excess !== '-' ? data.excess : 0;
                        const tdaClients = data.hasOwnProperty('totalTdaClients') ? data.totalTdaClients : 0;
                        const pendingClients = data.hasOwnProperty('totalPendingClients') ? data.totalPendingClients : 0;
                        
                        transferDailyRcv.push({
                            transfer: noTransfer,
                            mcbuTarget: mcbuTarget,
                            mcbuActual: (transferDailyRcv && transferDailyRcv.mcbuActual) ? transferDailyRcv.mcbuActual + mcbuActual : mcbuActual,
                            mcbuWithdrawal: mcbuWithdrawal,
                            mcbuInterest: mcbuInterest,
                            noMcbuReturn: noMcbuReturn,
                            mcbuReturnAmt: mcbuReturnAmt,
                            mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                            currentReleaseAmount: data.currentReleaseAmount,
                            loanReleaseAmount: data.totalLoanRelease,
                            collectionTarget: data.targetLoanCollection + excess,
                            collectionActual: data.collection,
                            pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                            pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                        });

                        activeClients = activeClients + noTransfer - pendingClients;
                        activeBorrowers = activeBorrowers + noTransfer - tdaClients;
                        activeLoanReleasePerson = activeLoanReleasePerson + noTransfer - tdaClients;
                        activeLoanReleaseAmount += data.totalLoanRelease ? data.totalLoanRelease : 0 + data.currentReleaseAmount ? data.currentReleaseAmount : 0;
                        loanBalance += (data.totalLoanRelease - data.collection) + data.currentReleaseAmount;
                    }
                }
            });

            temp?.transferWeeklyGvr?.map(weeklyGvr => {
                if (weeklyGvr) {
                    const data = {...weeklyGvr};
                    if (data.totalLoanBalance > 0) {
                        let noTransfer = data.transfer;
                        if (typeof noTransfer === "string") {
                            noTransfer = noTransfer.replace('(','').replace(')','');
                            noTransfer = -Math.abs(noTransfer);
                        }

                        const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? -Math.abs(data.mcbuTarget) : 0 : 0;
                        const mcbuActual = data.mcbu !== '-' ? -Math.abs(data.mcbu) : 0;
                        const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? -Math.abs(data.mcbuWithdrawal) : 0;
                        const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? -Math.abs(data.mcbuInterest) : 0;
                        const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? -Math.abs(data.noMcbuReturn) : 0;
                        const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? -Math.abs(data.mcbuReturnAmt) : 0;
                        const excess = data.excess !== '-' ? data.excess > 0 ? -Math.abs(data.excess) : 0 : 0;

                        transferWeeklyGvr.push({
                            transfer: noTransfer,
                            mcbuTarget: mcbuTarget,
                            mcbuActual: (transferWeeklyGvr && transferWeeklyGvr.mcbuActual) ? transferWeeklyGvr.mcbuActual + mcbuActual : mcbuActual,
                            mcbuWithdrawal: mcbuWithdrawal,
                            mcbuInterest: mcbuInterest,
                            noMcbuReturn: noMcbuReturn,
                            mcbuReturnAmt: mcbuReturnAmt,
                            mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                            currentReleaseAmount: data.currentReleaseAmount,
                            loanReleaseAmount: -Math.abs(data.totalLoanRelease),
                            collectionTarget: -Math.abs(data.targetLoanCollection + excess),
                            collectionActual: -Math.abs(data.collection),
                            pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                            pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                        });

                        activeClients += noTransfer;
                        activeBorrowers += noTransfer;
                        activeLoanReleasePerson += noTransfer;
                        activeLoanReleaseAmount = activeLoanReleaseAmount - data.totalLoanRelease ? data.totalLoanRelease : 0 + data.currentReleaseAmount ? data.currentReleaseAmount : 0;
                        loanBalance = loanBalance - (data.totalLoanRelease - data.collection) + data.currentReleaseAmount;
                    }
                }
            });

            temp?.transferWeeklyRcv?.map(weeklyRcv => {
                if (weeklyRcv) {
                    const data = {...weeklyRcv};
                    if (data.totalLoanBalance > 0) {
                        let noTransfer = data.transfer;
                        if (typeof noTransfer === "string") {
                            noTransfer = noTransfer.replace('(','').replace(')','');
                            noTransfer = -Math.abs(noTransfer);
                        }

                        const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? data.mcbuTarget : 0 : 0;
                        const mcbuActual = data.mcbu !== '-' ? data.mcbu : 0;
                        const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? data.mcbuWithdrawal : 0;
                        const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? data.mcbuInterest : 0;
                        const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? data.noMcbuReturn : 0;
                        const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? data.mcbuReturnAmt : 0;
                        const excess = data.excess !== '-' ? data.excess : 0;
                        const tdaClients = data.hasOwnProperty('totalTdaClients') ? data.totalTdaClients : 0;
                        const pendingClients = data.hasOwnProperty('totalPendingClients') ? data.totalPendingClients : 0;

                        transferWeeklyRcv.push({
                            transfer: noTransfer,
                            mcbuTarget: mcbuTarget,
                            mcbuActual: (transferWeeklyRcv && transferWeeklyRcv.mcbuActual) ? transferWeeklyRcv.mcbuActual + mcbuActual : mcbuActual,
                            mcbuWithdrawal: mcbuWithdrawal,
                            mcbuInterest: mcbuInterest,
                            noMcbuReturn: noMcbuReturn,
                            mcbuReturnAmt: mcbuReturnAmt,
                            mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                            currentReleaseAmount: data.currentReleaseAmount,
                            loanReleaseAmount: data.totalLoanRelease,
                            collectionTarget: data.targetLoanCollection + excess,
                            collectionActual: data.collection,
                            pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                            pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                        });

                        activeClients = activeClients + noTransfer - pendingClients;
                        activeBorrowers = activeBorrowers + noTransfer - tdaClients;
                        activeLoanReleasePerson = activeLoanReleasePerson + noTransfer - tdaClients;
                        activeLoanReleaseAmount += data.totalLoanRelease ? data.totalLoanRelease : 0 + data.currentReleaseAmount ? data.currentReleaseAmount : 0;
                        loanBalance += (data.totalLoanRelease - data.collection) + data.currentReleaseAmount;
                    }
                }
            });

            if (transferDailyGvr.length > 0 || transferDailyRcv.length > 0 || transferWeeklyGvr.length > 0 || transferWeeklyRcv.length > 0) {
                transferDailyGvr.map(dGvr => {
                    totalTransfer += dGvr.transfer;
                    totalMcbuTarget += dGvr.mcbuTarget;
                    totalMcbuActual += dGvr.mcbuActual;
                    totalMcbuWithdrawal += dGvr.mcbuWithdrawal;
                    totalMcbuInterest += dGvr.mcbuInterest;
                    totalMcbuNoReturn += dGvr.noMcbuReturn;
                    totalMcbuReturnAmt += dGvr.mcbuReturnAmt;
                    totalMcbuBalance += dGvr.mcbuBalance;
                    totalDailyNoLoanRelease += dGvr.transfer;
                    totalDailyLoanRelease += dGvr.loanReleaseAmount + dGvr?.currentReleaseAmount;
                    totalDailyTargetCollection += dGvr.collectionTarget;
                    totalDailyActualCollection += dGvr.collectionActual;
                    totalPastDue += dGvr.pastDueAmount > 0 ? dGvr.pastDueAmount : 0;
                    totalNoPastDue += dGvr.pastDuePerson > 0 ? dGvr.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += dGvr.excess;
                });
                
                transferDailyRcv.map(dRcv => {
                    totalTransfer += dRcv.transfer;
                    totalMcbuTarget += dRcv.mcbuTarget;
                    totalMcbuActual += dRcv.mcbuActual;
                    totalMcbuWithdrawal += dRcv.mcbuWithdrawal;
                    totalMcbuInterest += dRcv.mcbuInterest;
                    totalMcbuNoReturn += dRcv.noMcbuReturn;
                    totalMcbuReturnAmt += transferDailyRcv.mcbuReturnAmt;
                    totalMcbuBalance += dRcv.mcbuBalance;
                    totalDailyNoLoanRelease += dRcv.transfer;
                    totalDailyLoanRelease += dRcv.loanReleaseAmount + dRcv?.currentReleaseAmount;
                    totalDailyTargetCollection += dRcv.collectionTarget;
                    totalDailyActualCollection += dRcv.collectionActual;
                    totalPastDue += dRcv.pastDueAmount > 0 ? dRcv.pastDueAmount : 0;
                    totalNoPastDue += dRcv.pastDuePerson > 0 ? dRcv.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += dRcv.excess;
                });
                
                transferWeeklyGvr.map(wGvr => {
                    totalTransfer += wGvr.transfer;
                    totalMcbuTarget += dRcv.mcbuTarget;
                    totalMcbuActual += wGvr.mcbuActual;
                    totalMcbuWithdrawal += wGvr.mcbuWithdrawal;
                    totalMcbuInterest += wGvr.mcbuInterest;
                    totalMcbuNoReturn += wGvr.noMcbuReturn;
                    totalMcbuReturnAmt += transferWeeklyGvr.mcbuReturnAmt;
                    totalMcbuBalance += wGvr.mcbuBalance;
                    totalWeeklyNoLoanRelease = wGvr.transfer;
                    totalWeeklyLoanRelease += wGvr.loanReleaseAmount + wGvr?.currentReleaseAmount;
                    totalWeeklyTargetCollection += wGvr.collectionTarget;
                    totalWeeklyActualCollection += wGvr.collectionActual;
                    totalPastDue += wGvr.pastDueAmount > 0 ? dRcv.pastDueAmount : 0;
                    totalNoPastDue += wGvr.pastDuePerson > 0 ? wGvr.pastDuePerson : 0;
                    totalWeeklyCollectionAdvancePayment += wGvr.excess;
                });

                transferWeeklyRcv.map(wRcv => {
                    totalTransfer += wRcv.transfer;
                    totalMcbuTarget += dRcv.mcbuTarget;
                    totalMcbuActual += wRcv.mcbuActual;
                    totalMcbuWithdrawal += wRcv.mcbuWithdrawal;
                    totalMcbuInterest += wRcv.mcbuInterest;
                    totalMcbuNoReturn += wRcv.noMcbuReturn;
                    totalMcbuReturnAmt += transferWeeklyRcv.mcbuReturnAmt;
                    totalMcbuBalance += wRcv.mcbuBalance;
                    totalWeeklyNoLoanRelease += wRcv?.transfer;
                    totalWeeklyLoanRelease += wRcv.loanReleaseAmount + wRcv?.currentReleaseAmount;
                    totalWeeklyTargetCollection += wRcv.collectionTarget;
                    totalWeeklyActualCollection += wRcv.collectionActual;
                    totalPastDue += wRcv.pastDueAmount > 0 ? wRcv.pastDueAmount : 0;
                    totalNoPastDue += wRcv.pastDuePerson > 0 ? wRcv.pastDuePerson : 0;
                    totalWeeklyCollectionAdvancePayment += wRcv.excess;
                });
                
                if (totalMcbuBalance !== 0) {
                    mcbuBalance = temp.mcbuBalance ? temp.mcbuBalance : 0;
                }

                mcbuBalance += totalMcbuBalance;

                totalConsolidatedActualCollection = totalDailyActualCollection + totalWeeklyActualCollection;
                totalConsolidatedNoLoanRelease = totalDailyNoLoanRelease + totalWeeklyNoLoanRelease;
                totalConsolidatedLoanRelease = totalDailyLoanRelease + totalWeeklyLoanRelease;
            }
        });

        return {
            day: 'TFR Total',
            transfer: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
            newMember: '-',
            mcbuTarget: 0,
            mcbuTargetStr: '-',
            mcbuActual: totalMcbuActual,
            mcbuActualStr: totalMcbuActual < 0 ? `(${formatPricePhp(Math.abs(totalMcbuActual))})` : formatPricePhp(totalMcbuActual),
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: totalMcbuWithdrawal < 0 ? `(${formatPricePhp(Math.abs(totalMcbuWithdrawal))})` : formatPricePhp(totalMcbuWithdrawal),
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest < 0 ? `(${formatPricePhp(Match.abs(totalMcbuInterest))})` : formatPricePhp(totalMcbuInterest),
            noMcbuReturn: totalMcbuNoReturn,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: totalMcbuReturnAmt < 0 ? `(${formatPricePhp(Math.abs(totalMcbuReturnAmt))})` : formatPricePhp(totalMcbuReturnAmt),
            mcbuBalance: mcbuBalance,
            mcbuBalanceStr: mcbuBalance < 0 ? `(${formatPricePhp(Math.abs(mcbuBalance))})` : formatPricePhp(mcbuBalance),
            offsetPerson: '-',
            activeClients: activeClients,
            loanReleaseDailyPerson: totalDailyNoLoanRelease < 0 ? `(${Math.abs(totalDailyNoLoanRelease)})` : totalDailyNoLoanRelease,
            loanReleaseDailyAmount: totalDailyLoanRelease,
            loanReleaseDailyAmountStr: totalDailyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalDailyLoanRelease))})` : formatPricePhp(totalDailyLoanRelease),
            loanReleaseWeeklyPerson: totalWeeklyNoLoanRelease < 0 ? `(${Math.abs(totalWeeklyNoLoanRelease)})` : totalWeeklyNoLoanRelease,
            loanReleaseWeeklyAmount: totalWeeklyLoanRelease,
            loanReleaseWeeklyAmountStr: totalWeeklyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyLoanRelease))})` : formatPricePhp(totalWeeklyLoanRelease),
            consolidatedLoanReleasePerson: totalConsolidatedNoLoanRelease < 0 ? `(${Math.abs(totalConsolidatedNoLoanRelease)})` : totalConsolidatedNoLoanRelease,
            consolidatedLoanReleaseAmount: totalConsolidatedLoanRelease,
            consolidatedLoanReleaseAmountStr: totalConsolidatedLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedLoanRelease))})` : formatPricePhp(totalConsolidatedLoanRelease),
            activeLoanReleasePerson: activeLoanReleasePerson,
            activeLoanReleaseAmount: activeLoanReleaseAmount,
            activeLoanReleaseAmountStr: activeLoanReleaseAmount < 0 ? `(${formatPricePhp(Math.abs(activeLoanReleaseAmount))})` : formatPricePhp(activeLoanReleaseAmount),
            collectionTargetDaily: totalDailyTargetCollection,
            collectionTargetDailyStr: totalDailyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyTargetCollection))})` : formatPricePhp(totalDailyTargetCollection),
            collectionAdvancePaymentDaily: 0,
            collectionAdvancePaymentDailyStr: '-', //totalDailyCollectionAdvancePayment < 0 ? `(${formatPricePhp(Math.abs(totalDailyCollectionAdvancePayment))})` : formatPricePhp(totalDailyCollectionAdvancePayment),
            collectionActualDaily: totalDailyActualCollection,
            collectionActualDailyStr: totalDailyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyActualCollection))})` : formatPricePhp(totalDailyActualCollection),
            collectionTargetWeekly: totalWeeklyTargetCollection,
            collectionTargetWeeklyStr: totalWeeklyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyTargetCollection))})` : formatPricePhp(totalWeeklyTargetCollection),
            collectionAdvancePaymentWeekly: 0,
            collectionAdvancePaymentWeeklyStr: '-', //totalWeeklyCollectionAdvancePayment < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyCollectionAdvancePayment))})` : formatPricePhp(totalWeeklyCollectionAdvancePayment),
            collectionActualWeekly: totalWeeklyActualCollection,
            collectionActualWeeklyStr: totalWeeklyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyActualCollection))})` : formatPricePhp(totalWeeklyActualCollection),
            consolidatedCollection: totalConsolidatedActualCollection,
            consolidatedCollectionStr: totalConsolidatedActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedActualCollection))})` : formatPricePhp(totalConsolidatedActualCollection),
            fullPaymentDailyPerson: '-',
            fullPaymentDailyAmount: 0,
            fullPaymentDailyAmountStr: '-',
            fullPaymentWeeklyPerson: '-',
            fullPaymentWeeklyAmount: 0,
            fullPaymentWeeklyAmountStr: '-',
            consolidatedFullPaymentPerson: '-',
            consolidatedFullPaymentAmount: 0,
            consolidatedFullPaymentAmountStr: '-',
            pastDuePerson: totalNoPastDue,
            pastDueAmount: totalPastDue,
            pastDueAmountStr: totalPastDue < 0 ? `(${formatPricePhp(Math.abs(totalPastDue))})` : formatPricePhp(totalPastDue),
            mispaymentPerson: '-',
            activeBorrowers: activeBorrowers,
            loanBalance: loanBalance,
            loanBalanceStr: loanBalance < 0 ? `(${formatPricePhp(Math.abs(loanBalance))})` : formatPricePhp(loanBalance),
            flag: 'transfer'
        };
    }

    const calculatePersons = (losList) => {
        const fBal = losList[0];
        let prevLos;
        return losList.map((los, index) => {
            let temp = {...los};

            if (index !== 0 && !los.weekTotal) {
                // const prevMcbuBalance = los.prevMcbuBalance;
                const mcbuActual = los.mcbuActual !== '-' ? los.mcbuActual : 0;
                const mcbuWithdrawal = los.mcbuWithdrawal !== '-' ? los.mcbuWithdrawal : 0;
                const mcbuInterest = los.mcbuInterest !== '-' ? los.mcbuInterest : 0;
                const mcbuReturnAmt = los.mcbuReturnAmt !== '-' ? los.mcbuReturnAmt : 0;
                const fBalMcbuBalance = fBal.mcbuBalance !== '-' ? fBal.mcbuBalance : 0;
                const transferMCBU = los.transferMcbu ? los.transferMcbu : 0;

                // if (fBalMcbuBalance == 0) {
                //     fBalMcbuBalance = prevMcbuBalance ? prevMcbuBalance : 0;
                // }

                // if (prevLos && prevLos?.mcbuBalance == 0) {
                //     prevLos.mcbuBalance = prevMcbuBalance ? prevMcbuBalance : 0;
                // }

                if (index === 1) {
                    temp.activeClients = temp.activeClients > 0 ? temp.activeClients : fBal.activeClients;
                    temp.activeLoanReleasePerson = temp.activeLoanReleasePerson > 0 ? temp.activeLoanReleasePerson : fBal.activeLoanReleasePerson;
                    temp.activeLoanReleaseAmount = temp.activeLoanReleaseAmount > 0 ? temp.activeLoanReleaseAmount : fBal.activeLoanReleaseAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = temp.activeBorrowers > 0 ? temp.activeBorrowers : fBal.activeBorrowers;
                    temp.loanBalance = temp.loanBalance > 0 ? temp.loanBalance : fBal.loanBalance;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                    temp.mcbuBalance = fBalMcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + transferMCBU;
                    temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                } else {
                    temp.activeClients = temp.activeClients > 0 ? temp.activeClients : prevLos.activeClients;
                    temp.activeLoanReleasePerson = temp.activeLoanReleasePerson > 0 ? temp.activeLoanReleasePerson : prevLos.activeLoanReleasePerson;
                    temp.activeLoanReleaseAmount = temp.activeLoanReleaseAmount > 0 ? temp.activeLoanReleaseAmount : prevLos.activeLoanReleaseAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = temp.activeBorrowers > 0 ? temp.activeBorrowers : prevLos.activeBorrowers;
                    temp.loanBalance = temp.loanBalance > 0 ? temp.loanBalance : prevLos.loanBalance;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                    temp.mcbuBalance = prevLos.mcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + transferMCBU;
                    temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                }

                prevLos = temp;
            }

            return temp;
        });
    }

    const calculateWeeklyTotals = (losList, transferRow) => {
        const weekTotals = losList.filter(los => los.weekTotal);
        const fBal = losList[0];

        let prevWeek;
        let lastWeekTotalIdx;
        weekTotals.map((w, wIndex) => {
            const index = losList.findIndex(los => los.weekNumber === w.weekNumber);
            if (index > -1) {
                let losSlice;
                if (w.weekNumber === 0) { // index = 3
                    losSlice = losList.slice(1, index);
                } else { // index = 15
                    losSlice = losList.slice(index - 5, index);
                    const hasWeek = losSlice.find(los => los.weekTotal);
                    if (hasWeek) {
                        const hasWeekIdx = losList.findIndex(los => los.weekNumber === hasWeek.weekNumber);
                        losSlice = losList.slice(hasWeekIdx + 1, index);
                    }
                }

                let totalTransfer = 0;
                let totalNewMember = 0;
                let totalOffsetperson = 0;
                let totalActiveClients = 0; // last row
                let totalLoanReleaseDailyPerson = 0;
                let totalLoanReleaseDailyAmount = 0;
                let totalLoanReleaseWeeklyPerson = 0;
                let totalLoanReleaseWeeklyAmount = 0;
                let totalConsolidatedLoanReleasePerson = 0;
                let totalConsolidatedLoanReleaseAmount = 0;
                let totalActiveLoanReleasePerson = 0;
                let totalActiveLoanReleaseAmount = 0;
                let totalCollectionTargetDaily = 0;
                let totalCollectionAdvancePaymentDaily = 0;
                let totalCollectionActualDaily = 0;
                let totalCollectionTargetWeekly = 0;
                let totalCollectionAdvancePaymentWeekly = 0;
                let totalCollectionActualWeekly = 0;
                let totalConsolidatedCollection = 0;
                let totalPastDuePerson = 0;
                let totalPastDueAmount = 0;
                let totalMispaymentPerson = 0;
                let totalFullPaymentDailyPerson = 0;
                let totalFullPaymentDailyAmount = 0;
                let totalFullPaymentWeeklyPerson = 0;
                let totalFullPaymentWeeklyAmount = 0;
                let totalConsolidatedFullPaymentPerson = 0;
                let totalConsolidatedFullPaymentAmount = 0;
                let totalActiveBorrowers = 0; // last row
                let totalLoanBalance = 0; // last row

                // let lastActiveClients = 0;
                let lastPastDueAmount = 0;
                let lastPastDuePerson = 0;
                let lastLoanBalance = 0;
                let lastMcbuBalance = 0;
                // let lastActiveLoanReleasePerson = 0;
                // let lastActiveLoanReleaseAmount = 0;

                let totalMcbuTarget = 0;
                let totalMcbuActual = 0;
                let totalMcbuWithdrawal = 0;
                let totalMcbuInterest = 0;
                let totalNoMcbuReturn = 0;
                let totalMcbuReturnAmt = 0;
                let totalMcbuBalance = 0;
                
                losSlice.map(los => {
                    // let noTransfer = los.transfer;
                    // console.log(los)
                    // if (typeof noTransfer === "string" && noTransfer !== '-') {
                    //     noTransfer = noTransfer.replace('(','').replace(')','');
                    //     noTransfer = -Math.abs(noTransfer);
                    // }
                    
                    // totalTransfer += noTransfer !== '-' ? noTransfer : 0;
                    totalNewMember += los.newMember !== '-' ? los.newMember : 0;
                    totalOffsetperson += los.offsetPerson !== '-' ? los.offsetPerson : 0;
                    totalLoanReleaseDailyPerson += los.loanReleaseDailyPerson !== '-' ? los.loanReleaseDailyPerson : 0;
                    totalLoanReleaseDailyAmount += los.loanReleaseDailyAmount !== '-' ? los.loanReleaseDailyAmount : 0;
                    totalLoanReleaseWeeklyPerson += los.loanReleaseWeeklyPerson !== '-' ? los.loanReleaseWeeklyPerson : 0;
                    totalLoanReleaseWeeklyAmount += los.loanReleaseWeeklyAmount !== '-' ? los.loanReleaseWeeklyAmount : 0;
                    totalConsolidatedLoanReleasePerson += los.consolidatedLoanReleasePerson !== '-' ? los.consolidatedLoanReleasePerson : 0;
                    totalConsolidatedLoanReleaseAmount += los.consolidatedLoanReleaseAmount !== '-' ? los.consolidatedLoanReleaseAmount : 0;
                    totalCollectionTargetDaily += los.collectionTargetDaily !== '-' ? los.collectionTargetDaily : 0;
                    totalCollectionAdvancePaymentDaily += los.collectionAdvancePaymentDaily !== '-' ? los.collectionAdvancePaymentDaily : 0;
                    totalCollectionActualDaily += los.collectionActualDaily !== '-' ? los.collectionActualDaily : 0;
                    totalCollectionTargetWeekly += los.collectionTargetWeekly !== '-' ? los.collectionTargetWeekly : 0;
                    totalCollectionAdvancePaymentWeekly += los.collectionAdvancePaymentWeekly !== '-' ? los.collectionAdvancePaymentWeekly : 0;
                    totalCollectionActualWeekly += los.collectionActualWeekly !== '-' ? los.collectionActualWeekly : 0;
                    totalConsolidatedCollection += los.consolidatedCollection !== '-' ? los.consolidatedCollection : 0;
                    totalMispaymentPerson += los.mispaymentPerson !== '-' ? los.mispaymentPerson : 0;
                    
                    // if (los.activeClients > 0) {
                    //     lastActiveClients = los.activeClients;
                    // }

                    if (los.pastDuePerson !== '-') {
                        lastPastDuePerson = los.pastDuePerson;
                    }

                    if (los.pastDueAmount !== '-') {
                        lastPastDueAmount = los.pastDueAmount;
                    }

                    if (los.loanBalance > 0) {
                        lastLoanBalance = los.loanBalance;
                    }

                    if (los.mcbuBalance > 0) {
                        lastMcbuBalance = los.mcbuBalance;
                    }

                    // if (los.activeLoanReleasePerson > 0) {
                    //     lastActiveLoanReleasePerson = los.activeLoanReleasePerson;
                    // }

                    // if (los.activeLoanReleaseAmount > 0) {
                    //     lastActiveLoanReleaseAmount = los.activeLoanReleaseAmount;
                    // }

                    totalFullPaymentDailyPerson += los.fullPaymentDailyPerson !== '-' ? los.fullPaymentDailyPerson : 0;
                    totalFullPaymentDailyAmount += los.fullPaymentDailyAmount !== '-' ? los.fullPaymentDailyAmount : 0;
                    totalFullPaymentWeeklyPerson += los.fullPaymentWeeklyPerson !== '-' ? los.fullPaymentWeeklyPerson : 0;
                    totalFullPaymentWeeklyAmount += los.fullPaymentWeeklyAmount !== '-' ? los.fullPaymentWeeklyAmount : 0;
                    totalConsolidatedFullPaymentPerson += los.consolidatedFullPaymentPerson !== '-' ? los.consolidatedFullPaymentPerson : 0;
                    totalConsolidatedFullPaymentAmount += los.consolidatedFullPaymentAmount !== '-' ? los.consolidatedFullPaymentAmount : 0;

                    totalMcbuTarget += (los.mcbuTarget !== '-' && los.mcbuTarget) ? los.mcbuTarget : 0;
                    totalMcbuActual += (los.mcbuActual !== '-'  && los.mcbuActual)? los.mcbuActual : 0;
                    totalMcbuWithdrawal += (los.mcbuWithdrawal !== '-' && los.mcbuWithdrawal) ? los.mcbuWithdrawal : 0;
                    totalMcbuInterest += (los.mcbuInterest !== '-' && los.mcbuInterest) ? los.mcbuInterest : 0;
                    totalNoMcbuReturn += (los.noMcbuReturn !== '-' && los.noMcbuReturn) ? los.noMcbuReturn : 0;
                    totalMcbuReturnAmt += (los.mcbuReturnAmt !== '-' && los.mcbuReturnAmt) ? los.mcbuReturnAmt : 0;
                });

                if (w.weekNumber === 0) {
                    totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                    totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
                    totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;
                } else {
                    totalActiveClients = prevWeek.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                    totalActiveLoanReleasePerson = prevWeek.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
                    totalActiveLoanReleaseAmount = prevWeek.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;
                }
                
                // if (totalActiveClients == 0) {
                //     totalActiveClients = lastActiveClients;
                // }

                totalMcbuBalance = lastMcbuBalance;
                totalPastDuePerson = lastPastDuePerson;
                totalPastDueAmount = lastPastDueAmount;
                totalActiveBorrowers = losSlice[losSlice.length - 1].activeBorrowers;
                totalLoanBalance =  lastLoanBalance;
                // totalActiveLoanReleasePerson = totalActiveLoanReleasePerson == 0 ? lastActiveLoanReleasePerson : totalActiveLoanReleasePerson;
                // totalActiveLoanReleaseAmount = totalActiveLoanReleaseAmount == 0 ? lastActiveLoanReleaseAmount : totalActiveLoanReleaseAmount;

                // +/- with the transfer
                // apply only to the last week total
                if (wIndex === weekTotals.length - 1) {
                    let noDailyTransfer = transferRow.loanReleaseDailyPerson;
                    if (typeof noDailyTransfer === "string" && noDailyTransfer !== '-') {
                        noDailyTransfer = noDailyTransfer.replace('(','').replace(')','');
                        noDailyTransfer = -Math.abs(noDailyTransfer);
                    }

                    let noWeeklyTransfer = transferRow.loanReleaseWeeklyPerson;
                    if (typeof noWeeklyTransfer === "string" && noWeeklyTransfer !== '-') {
                        noWeeklyTransfer = noWeeklyTransfer.replace('(','').replace(')','');
                        noWeeklyTransfer = -Math.abs(noWeeklyTransfer);
                    }

                    let noConsolidatedTransfer = transferRow.consolidatedLoanReleasePerson;
                    if (typeof noConsolidatedTransfer === "string" && noConsolidatedTransfer !== '-') {
                        noConsolidatedTransfer = noConsolidatedTransfer.replace('(','').replace(')','');
                        noConsolidatedTransfer = -Math.abs(noConsolidatedTransfer);
                    }

                    totalTransfer = noConsolidatedTransfer;
                    totalActiveClients += noConsolidatedTransfer;
                    totalMcbuTarget += transferRow.mcbuTarget ? transferRow.mcbuTarget : 0;
                    totalMcbuActual += transferRow.mcbuActual ? transferRow.mcbuActual : 0;
                    totalMcbuWithdrawal += transferRow.mcbuWithdrawal ? transferRow.mcbuWithdrawal : 0;
                    totalMcbuInterest += transferRow.mcbuInterest ? transferRow.mcbuInterest : 0;
                    totalNoMcbuReturn += transferRow.noMcbuReturn ? transferRow.noMcbuReturn : 0;
                    totalMcbuReturnAmt += transferRow.noMcbuReturn ? transferRow.noMcbuReturn : 0;
                    if (transferRow.mcbuBalance > 0) {
                        totalMcbuBalance = transferRow.mcbuBalance;
                    }
                    totalLoanReleaseDailyPerson += noDailyTransfer;
                    totalLoanReleaseDailyAmount += transferRow.loanReleaseDailyAmount;
                    totalLoanReleaseWeeklyPerson += noWeeklyTransfer;
                    totalLoanReleaseWeeklyAmount += transferRow.loanReleaseWeeklyAmount;
                    totalConsolidatedLoanReleasePerson += noConsolidatedTransfer;
                    totalConsolidatedLoanReleaseAmount += transferRow.consolidatedLoanReleaseAmount;
                    totalActiveLoanReleasePerson = transferRow.activeLoanReleasePerson > 0 ? transferRow.activeLoanReleasePerson : totalActiveLoanReleasePerson + noConsolidatedTransfer;
                    totalActiveLoanReleaseAmount = transferRow.activeLoanReleaseAmount > 0 ? transferRow.activeLoanReleaseAmount : totalActiveLoanReleaseAmount + transferRow.consolidatedLoanReleaseAmount;
                    totalCollectionTargetDaily += transferRow.collectionTargetDaily ? transferRow.collectionTargetDaily : 0;
                    totalCollectionActualDaily += transferRow.collectionActualDaily;
                    totalCollectionTargetWeekly += transferRow.collectionTargetWeekly ? transferRow.collectionTargetWeekly : 0;
                    totalCollectionActualWeekly += transferRow.collectionActualWeekly;
                    totalConsolidatedCollection += transferRow.consolidatedCollection;
                    totalPastDuePerson += transferRow.pastDuePerson;
                    totalPastDueAmount += transferRow.pastDueAmount;
                    totalActiveBorrowers = transferRow.activeBorrowers > 0 ? transferRow.activeBorrowers : totalActiveBorrowers + noConsolidatedTransfer;
                    totalLoanBalance = transferRow.loanBalance > 0 ? transferRow.loanBalance : totalLoanBalance;
                }

                losList[index] = {
                    ...w,
                    transfer: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
                    newMember: totalNewMember,
                    mcbuTarget: totalMcbuTarget,
                    mcbuTargetStr: formatPricePhp(totalMcbuTarget),
                    mcbuActual: totalMcbuActual,
                    mcbuActualStr: formatPricePhp(totalMcbuActual),
                    mcbuWithdrawal: totalMcbuWithdrawal,
                    mcbuWithdrawalStr: formatPricePhp(totalMcbuWithdrawal),
                    mcbuInterest: totalMcbuInterest,
                    mcbuInterestStr: formatPricePhp(totalMcbuInterest),
                    noMcbuReturn: totalNoMcbuReturn,
                    mcbuReturnAmt: totalMcbuReturnAmt,
                    mcbuReturnAmtStr: formatPricePhp(totalMcbuReturnAmt),
                    mcbuBalance: totalMcbuBalance,
                    mcbuBalanceStr: formatPricePhp(totalMcbuBalance),
                    offsetPerson: totalOffsetperson,
                    activeClients: totalActiveClients,
                    loanReleaseDailyPerson: totalLoanReleaseDailyPerson,
                    loanReleaseDailyAmount: totalLoanReleaseDailyAmount,
                    loanReleaseDailyAmountStr: formatPricePhp(totalLoanReleaseDailyAmount),
                    loanReleaseWeeklyPerson: totalLoanReleaseWeeklyPerson,
                    loanReleaseWeeklyAmount: totalLoanReleaseWeeklyAmount,
                    loanReleaseWeeklyAmountStr: formatPricePhp(totalLoanReleaseWeeklyAmount),
                    consolidatedLoanReleasePerson: totalConsolidatedLoanReleasePerson,
                    consolidatedLoanReleaseAmount: totalConsolidatedLoanReleaseAmount,
                    consolidatedLoanReleaseAmountStr: formatPricePhp(totalConsolidatedLoanReleaseAmount),
                    activeLoanReleasePerson: totalActiveLoanReleasePerson,
                    activeLoanReleaseAmount: totalActiveLoanReleaseAmount,
                    activeLoanReleaseAmountStr: formatPricePhp(totalActiveLoanReleaseAmount),
                    collectionTargetDaily: totalCollectionTargetDaily,
                    collectionTargetDailyStr: formatPricePhp(totalCollectionTargetDaily),
                    collectionAdvancePaymentDaily: totalCollectionAdvancePaymentDaily,
                    collectionAdvancePaymentDailyStr: formatPricePhp(totalCollectionAdvancePaymentDaily),
                    collectionActualDaily: totalCollectionActualDaily,
                    collectionActualDailyStr: formatPricePhp(totalCollectionActualDaily),
                    collectionTargetWeekly: totalCollectionTargetWeekly,
                    collectionTargetWeeklyStr: formatPricePhp(totalCollectionTargetWeekly),
                    collectionAdvancePaymentWeekly: totalCollectionAdvancePaymentWeekly,
                    collectionAdvancePaymentWeeklyStr: formatPricePhp(totalCollectionAdvancePaymentWeekly),
                    collectionActualWeekly: totalCollectionActualWeekly,
                    collectionActualWeeklyStr: formatPricePhp(totalCollectionActualWeekly),
                    consolidatedCollection: totalConsolidatedCollection,
                    consolidatedCollectionStr: formatPricePhp(totalConsolidatedCollection),
                    pastDuePerson: totalPastDuePerson,
                    pastDueAmount: totalPastDueAmount,
                    pastDueAmountStr: formatPricePhp(totalPastDueAmount),
                    mispaymentPerson: totalMispaymentPerson,
                    fullPaymentDailyPerson: totalFullPaymentDailyPerson,
                    fullPaymentDailyAmount: totalFullPaymentDailyAmount,
                    fullPaymentDailyAmountStr: formatPricePhp(totalFullPaymentDailyAmount),
                    fullPaymentWeeklyPerson: totalFullPaymentWeeklyPerson,
                    fullPaymentWeeklyAmount: totalFullPaymentWeeklyAmount,
                    fullPaymentWeeklyAmountStr: formatPricePhp(totalFullPaymentWeeklyAmount),
                    consolidatedFullPaymentPerson: totalConsolidatedFullPaymentPerson,
                    consolidatedFullPaymentAmount: totalConsolidatedFullPaymentAmount,
                    consolidatedFullPaymentAmountStr: formatPricePhp(totalConsolidatedFullPaymentAmount),
                    activeBorrowers: totalActiveBorrowers,
                    loanBalance: totalLoanBalance,
                    loanBalanceStr: formatPricePhp(totalLoanBalance)
                }
                prevWeek = losList[index];
                lastWeekTotalIdx = index;
            }
        });
    
        const updatedWithTransfer = [...losList];
        updatedWithTransfer.splice(lastWeekTotalIdx, 0, transferRow);

        return updatedWithTransfer;
    }

    const calculateMonthlyTotals = (fBal, weeklyTotals) => {
        let monthlyTotal = {
            day: 'Montly Total',
            transfer: '-',
            newMember: '-',
            mcbuTarget: '-',
            mcbuTargetStr: '-',
            mcbuActual: '-',
            mcbuActualStr: '-',
            mcbuWithdrawal: '-',
            mcbuWithdrawalStr: '-',
            mcbuInterest: '-',
            mcbuInterestStr: '-',
            noMcbuReturn: '-',
            mcbuReturnAmt: '-',
            mcbuReturnAmtStr: '-',
            mcbuBalance: '-',
            mcbuBalanceStr: '-',
            offsetPerson: '-',
            activeClients: '-',
            loanReleaseDailyPerson: '-',
            loanReleaseDailyAmount: '-',
            loanReleaseDailyAmountStr: '-',
            loanReleaseWeeklyPerson: '-',
            loanReleaseWeeklyAmount: '-',
            loanReleaseWeeklyAmountStr: '-',
            consolidatedLoanReleasePerson: '-',
            consolidatedLoanReleaseAmount: '-',
            consolidatedLoanReleaseAmountStr: '-',
            activeLoanReleasePerson: '-',
            activeLoanReleaseAmount: '-',
            activeLoanReleaseAmountStr: '-',
            collectionTargetDaily: '-',
            collectionTargetDailyStr: '-',
            collectionAdvancePaymentDaily: '-',
            collectionAdvancePaymentDailyStr: '-',
            collectionActualDaily: '-',
            collectionActualDailyStr: '-',
            collectionTargetWeekly: '-',
            collectionTargetWeeklyStr: '-',
            collectionAdvancePaymentWeekly: '-',
            collectionAdvancePaymentWeeklyStr: '-',
            collectionActualWeekly: '-',
            collectionActualWeeklyStr: '-',
            consolidatedCollection: '-',
            consolidatedCollectionStr: '-',
            pastDuePerson: '-',
            pastDueAmount: '-',
            pastDueAmountStr: '-',
            mispaymentPerson: '-',
            fullPaymentDailyPerson: '-',
            fullPaymentDailyAmount: '-',
            fullPaymentDailyAmountStr: '-',
            fullPaymentWeeklyPerson: '-',
            fullPaymentWeeklyAmount: '-',
            fullPaymentWeeklyAmountStr: '-',
            consolidatedFullPaymentPerson: '-',
            consolidatedFullPaymentAmount: '-',
            consolidatedFullPaymentAmountStr: '-',
            activeBorrowers: '-',
            loanBalance: '-',
            loanBalanceStr: '-',
            monthTotal: true
        };

        let totalTransfer = 0;
        let totalNewMember = 0;
        let totalMcbuTarget = 0;
        let totalMcbuActual = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuInterest = 0;
        let totalNoMcbuReturn = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuBalance = 0;
        let totalOffsetperson = 0;
        let totalActiveClients = 0; // last row
        let totalLoanReleaseDailyPerson = 0;
        let totalLoanReleaseDailyAmount = 0;
        let totalLoanReleaseWeeklyPerson = 0;
        let totalLoanReleaseWeeklyAmount = 0;
        let totalConsolidatedLoanReleasePerson = 0;
        let totalConsolidatedLoanReleaseAmount = 0;
        let totalActiveLoanReleasePerson = 0;
        let totalActiveLoanReleaseAmount = 0;
        let totalCollectionTargetDaily = 0;
        let totalCollectionAdvancePaymentDaily = 0;
        let totalCollectionActualDaily = 0;
        let totalCollectionTargetWeekly = 0;
        let totalCollectionAdvancePaymentWeekly = 0;
        let totalCollectionActualWeekly = 0;
        let totalConsolidatedCollection = 0;
        let totalPastDuePerson = 0;
        let totalPastDueAmount = 0;
        let totalMispaymentPerson = 0;
        let totalFullPaymentDailyPerson = 0;
        let totalFullPaymentDailyAmount = 0;
        let totalFullPaymentWeeklyPerson = 0;
        let totalFullPaymentWeeklyAmount = 0;
        let totalConsolidatedFullPaymentPerson = 0;
        let totalConsolidatedFullPaymentAmount = 0;
        let totalActiveBorrowers = 0; // last row
        let totalLoanBalance = 0; // last row
        // let lastActiveClients = 0;
        // let lastActiveLoanReleasePerson = 0;
        // let lastActiveLoanReleaseAmount = 0;
        let lastActiveBorrowers = 0;
        let lastLoanBalance = 0;

        weeklyTotals.map(wt => {
            let transfer = wt.transfer;
            if (typeof wt.transfer === "string" && wt.transfer !== '-') {
                transfer = wt.transfer.replace('(','').replace(')','');
                transfer = -Math.abs(transfer);
            }
            
            totalTransfer += transfer;
            totalNewMember += wt.newMember;
            totalMcbuActual += wt.mcbuActual ? wt.mcbuActual : 0;
            totalMcbuWithdrawal += wt.mcbuWithdrawal ? wt.mcbuWithdrawal : 0;
            totalMcbuInterest += wt.mcbuInterest ? wt.mcbuInterest : 0;
            totalNoMcbuReturn += wt.noMcbuReturn ? wt.noMcbuReturn : 0;
            totalMcbuReturnAmt += wt.mcbuReturnAmt ? wt.mcbuReturnAmt : 0;
            totalOffsetperson += wt.offsetPerson;
            totalLoanReleaseDailyPerson += wt.loanReleaseDailyPerson;
            totalLoanReleaseDailyAmount += wt.loanReleaseDailyAmount;
            totalLoanReleaseWeeklyPerson += wt.loanReleaseWeeklyPerson;
            totalLoanReleaseWeeklyAmount += wt.loanReleaseWeeklyAmount;
            totalConsolidatedLoanReleasePerson += wt.consolidatedLoanReleasePerson;
            totalConsolidatedLoanReleaseAmount += wt.consolidatedLoanReleaseAmount;
            totalCollectionTargetDaily += wt.collectionTargetDaily;
            totalCollectionAdvancePaymentDaily += wt.collectionAdvancePaymentDaily;
            totalCollectionActualDaily += wt.collectionActualDaily;
            totalCollectionTargetWeekly += wt.collectionTargetWeekly;
            totalCollectionAdvancePaymentWeekly += wt.collectionAdvancePaymentWeekly;
            totalCollectionActualWeekly += wt.collectionActualWeekly;
            totalConsolidatedCollection += wt.consolidatedCollection;
            totalMispaymentPerson += wt.mispaymentPerson;
            totalFullPaymentDailyPerson += wt.fullPaymentDailyPerson;
            totalFullPaymentDailyAmount += wt.fullPaymentDailyAmount;
            totalFullPaymentWeeklyPerson += wt.fullPaymentWeeklyPerson;
            totalFullPaymentWeeklyAmount += wt.fullPaymentWeeklyAmount;
            totalConsolidatedFullPaymentPerson += wt.consolidatedFullPaymentPerson;
            totalConsolidatedFullPaymentAmount += wt.consolidatedFullPaymentAmount;
            totalPastDuePerson = wt.pastDuePerson;
            totalPastDueAmount = wt.pastDueAmount;
            totalActiveBorrowers = wt.activeBorrowers;
            totalLoanBalance = wt.loanBalance;

            // if (wt.activeClients > 0) {
            //     lastActiveClients = wt.activeClients;
            // }

            // if (wt.activeLoanReleasePerson > 0) {
            //     lastActiveLoanReleasePerson = wt.activeLoanReleasePerson;
            // }

            // if (wt.activeLoanReleaseAmount > 0) {
            //     lastActiveLoanReleaseAmount = wt.activeLoanReleaseAmount;
            // }

            // if (wt.activeBorrowers > 0) {
            //     lastActiveBorrowers = wt.activeBorrowers;
            // }

            // if (wt.loanBalance > 0) {
            //     lastLoanBalance = wt.loanBalance;
            // }
        });

        totalMcbuBalance = fBal.mcbuBalance + totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
        totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
        totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
        totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;

        // if (totalActiveClients == 0) {
        //     totalActiveClients = lastActiveClients;
        // }
        
        // if (totalActiveLoanReleasePerson == 0) {
        //     totalActiveLoanReleasePerson = lastActiveLoanReleasePerson;
        // }

        // if (totalActiveLoanReleaseAmount == 0) {
        //     totalActiveLoanReleaseAmount = lastActiveLoanReleaseAmount;
        // }

        // totalActiveBorrowers = fBal.activeBorrowers + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
        // totalLoanBalance = fBal.loanBalance + totalConsolidatedLoanReleaseAmount - totalConsolidatedCollection;

        // totalActiveBorrowers = lastActiveBorrowers;
        // totalLoanBalance = lastLoanBalance;

        monthlyTotal.transfer = totalTransfer;
        monthlyTotal.newMember = totalNewMember;
        monthlyTotal.mcbuTarget = totalMcbuTarget;
        monthlyTotal.mcbuTargetStr = formatPricePhp(totalMcbuTarget);
        monthlyTotal.mcbuActual = totalMcbuActual;
        monthlyTotal.mcbuActualStr = formatPricePhp(totalMcbuActual);
        monthlyTotal.mcbuWithdrawal = totalMcbuWithdrawal;
        monthlyTotal.mcbuWithdrawalStr = formatPricePhp(totalMcbuWithdrawal);
        monthlyTotal.mcbuInterest = totalMcbuInterest;
        monthlyTotal.mcbuInterestStr = formatPricePhp(totalMcbuInterest);
        monthlyTotal.noMcbuReturn = totalNoMcbuReturn;
        monthlyTotal.mcbuReturnAmt = totalMcbuReturnAmt;
        monthlyTotal.mcbuReturnAmtStr = formatPricePhp(totalMcbuReturnAmt);
        monthlyTotal.mcbuBalance = totalMcbuBalance;
        monthlyTotal.mcbuBalanceStr = formatPricePhp(totalMcbuBalance);
        monthlyTotal.offsetPerson = totalOffsetperson;
        monthlyTotal.activeClients = totalActiveClients;
        monthlyTotal.loanReleaseDailyPerson = totalLoanReleaseDailyPerson;
        monthlyTotal.loanReleaseDailyAmount = totalLoanReleaseDailyAmount;
        monthlyTotal.loanReleaseDailyAmountStr = formatPricePhp(totalLoanReleaseDailyAmount);
        monthlyTotal.loanReleaseWeeklyPerson = totalLoanReleaseWeeklyPerson;
        monthlyTotal.loanReleaseWeeklyAmount = totalLoanReleaseWeeklyAmount;
        monthlyTotal.loanReleaseWeeklyAmountStr = formatPricePhp(totalLoanReleaseWeeklyAmount);
        monthlyTotal.consolidatedLoanReleasePerson = totalConsolidatedLoanReleasePerson;
        monthlyTotal.consolidatedLoanReleaseAmount = totalConsolidatedLoanReleaseAmount;
        monthlyTotal.consolidatedLoanReleaseAmountStr = formatPricePhp(totalConsolidatedLoanReleaseAmount);
        monthlyTotal.activeLoanReleasePerson = totalActiveLoanReleasePerson;
        monthlyTotal.activeLoanReleaseAmount = totalActiveLoanReleaseAmount;
        monthlyTotal.activeLoanReleaseAmountStr = formatPricePhp(totalActiveLoanReleaseAmount);
        monthlyTotal.collectionTargetDaily = totalCollectionTargetDaily;
        monthlyTotal.collectionTargetDailyStr = formatPricePhp(totalCollectionTargetDaily);
        monthlyTotal.collectionAdvancePaymentDaily = totalCollectionAdvancePaymentDaily;
        monthlyTotal.collectionAdvancePaymentDailyStr = formatPricePhp(totalCollectionAdvancePaymentDaily);
        monthlyTotal.collectionActualDaily = totalCollectionActualDaily;
        monthlyTotal.collectionActualDailyStr = formatPricePhp(totalCollectionActualDaily);
        monthlyTotal.collectionTargetWeekly = totalCollectionTargetWeekly;
        monthlyTotal.collectionTargetWeeklyStr = formatPricePhp(totalCollectionTargetWeekly);
        monthlyTotal.collectionAdvancePaymentWeekly = totalCollectionAdvancePaymentWeekly;
        monthlyTotal.collectionAdvancePaymentWeeklyStr = formatPricePhp(totalCollectionAdvancePaymentWeekly);
        monthlyTotal.collectionActualWeekly = totalCollectionActualWeekly;
        monthlyTotal.collectionActualWeeklyStr = formatPricePhp(totalCollectionActualWeekly);
        monthlyTotal.consolidatedCollection = totalConsolidatedCollection;
        monthlyTotal.consolidatedCollectionStr = formatPricePhp(totalConsolidatedCollection);
        monthlyTotal.pastDuePerson = totalPastDuePerson;
        monthlyTotal.pastDueAmount = totalPastDueAmount;
        monthlyTotal.pastDueAmountStr = formatPricePhp(totalPastDueAmount);
        monthlyTotal.mispaymentPerson = totalMispaymentPerson;
        monthlyTotal.fullPaymentDailyPerson = totalFullPaymentDailyPerson;
        monthlyTotal.fullPaymentDailyAmount = totalFullPaymentDailyAmount;
        monthlyTotal.fullPaymentDailyAmountStr = formatPricePhp(totalFullPaymentDailyAmount);
        monthlyTotal.fullPaymentWeeklyPerson = totalFullPaymentWeeklyPerson;
        monthlyTotal.fullPaymentWeeklyAmount = totalFullPaymentWeeklyAmount;
        monthlyTotal.fullPaymentWeeklyAmountStr = formatPricePhp(totalFullPaymentWeeklyAmount);
        monthlyTotal.consolidatedFullPaymentPerson = totalConsolidatedFullPaymentPerson;
        monthlyTotal.consolidatedFullPaymentAmount = totalConsolidatedFullPaymentAmount;
        monthlyTotal.consolidatedFullPaymentAmountStr = formatPricePhp(totalConsolidatedFullPaymentAmount);
        monthlyTotal.activeBorrowers = totalActiveBorrowers;
        monthlyTotal.loanBalance = totalLoanBalance;
        monthlyTotal.loanBalanceStr = formatPricePhp(totalLoanBalance);

        return monthlyTotal;
    }
    
    const calculateGrandTotals = (losList, filter, date) => {
        let grandTotal = {
            day: 'Commulative',
            transfer: 0,
            newMember: 0,
            mcbuTarget: 0,
            mcbuTargetStr: 0,
            mcbuActual: 0,
            mcbuActualStr: 0,
            mcbuWithdrawal: 0,
            mcbuWithdrawalStr: 0,
            mcbuInterest: 0,
            mcbuInterestStr: 0,
            noMcbuReturn: 0,
            mcbuReturnAmt: 0,
            mcbuReturnAmtStr: 0,
            mcbuBalance: 0,
            mcbuBalanceStr: 0,
            offsetPerson: 0,
            activeClients: 0,
            loanReleaseDailyPerson: 0,
            loanReleaseDailyAmount: 0,
            loanReleaseDailyAmountStr: 0,
            loanReleaseWeeklyPerson: 0,
            loanReleaseWeeklyAmount: 0,
            loanReleaseWeeklyAmountStr: 0,
            consolidatedLoanReleasePerson: 0,
            consolidatedLoanReleaseAmount: 0,
            consolidatedLoanReleaseAmountStr: 0,
            activeLoanReleasePerson: 0,
            activeLoanReleaseAmount: 0,
            activeLoanReleaseAmountStr: 0,
            collectionAdvancePaymentDaily: 0,
            collectionAdvancePaymentDailyStr: 0,
            collectionActualDaily: 0,
            collectionActualDailyStr: 0,
            collectionAdvancePaymentWeekly: 0,
            collectionAdvancePaymentWeeklyStr: 0,
            collectionActualWeekly: 0,
            collectionActualWeeklyStr: 0,
            consolidatedCollection: 0,
            consolidatedCollectionStr: 0,
            pastDuePerson: 0,
            pastDueAmount: 0,
            pastDueAmountStr: 0,
            mispaymentPerson: 0,
            fullPaymentDailyPerson: 0,
            fullPaymentDailyAmount: 0,
            fullPaymentDailyAmountStr: 0,
            fullPaymentWeeklyPerson: 0,
            fullPaymentWeeklyAmount: 0,
            fullPaymentWeeklyAmountStr: 0,
            consolidatedFullPaymentPerson: 0,
            consolidatedFullPaymentAmount: 0,
            consolidatedFullPaymentAmountStr: 0,
            activeBorrowers: 0,
            loanBalance: 0,
            loanBalanceStr: 0,
            grandTotal: true
        };

        let totalTransfer = 0;
        let totalNewMember = 0;
        let totalMcbuTarget = 0;
        let totalMcbuActual = 0;
        let totalMcbuWithdrawal = 0;
        let totalMcbuInterest = 0;
        let totalNoMcbuReturn = 0;
        let totalMcbuReturnAmt = 0;
        let totalMcbuBalance = 0;
        let totalOffsetperson = 0;
        let totalActiveClients = 0;
        let totalActiveLoanReleasePerson = 0;
        let totalActiveLoanReleaseAmount = 0;
        let totalCollectionAdvancePaymentDaily = 0;
        let totalCollectionActualDaily = 0;
        let totalCollectionAdvancePaymentWeekly = 0;
        let totalCollectionActualWeekly = 0;
        let totalConsolidatedCollection = 0;
        let totalPastDuePerson = 0;
        let totalPastDueAmount = 0;
        let totalMispaymentPerson = 0;
        let totalFullPaymentDailyPerson = 0;
        let totalFullPaymentDailyAmount = 0;
        let totalFullPaymentWeeklyPerson = 0;
        let totalFullPaymentWeeklyAmount = 0;
        let totalConsolidatedFullPaymentPerson = 0;
        let totalConsolidatedFullPaymentAmount = 0;
        let totalActiveBorrowers = 0;
        let totalLoanBalance = 0;

        const fBal = losList.find(los => los.fBalance);
        const monthly = losList.find(los => los.monthTotal);

        if (fBal && monthly) {
            totalTransfer = fBal.transfer + monthly.transfer;
            totalNewMember = fBal.newMember + monthly.newMember;
            totalMcbuTarget = fBal.mcbuTarget + monthly.mcbuTarget;
            totalMcbuActual = fBal.mcbuActual + monthly.mcbuActual;
            totalMcbuWithdrawal = fBal.mcbuWithdrawal + monthly.mcbuWithdrawal;
            totalMcbuInterest = fBal.mcbuInterest + monthly.mcbuInterest;
            totalNoMcbuReturn = fBal.noMcbuReturn + monthly.noMcbuReturn;
            totalMcbuReturnAmt = fBal.mcbuReturnAmt + monthly.mcbuReturnAmt;
            totalMcbuBalance = totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
            totalOffsetperson = fBal.offsetPerson + monthly.offsetPerson;
            totalActiveClients = monthly.activeClients ;
            totalActiveLoanReleasePerson = monthly.activeLoanReleasePerson;
            totalActiveLoanReleaseAmount = monthly.activeLoanReleaseAmount;
            totalCollectionAdvancePaymentDaily = fBal.collectionAdvancePaymentDaily + monthly.collectionTargetDaily + monthly.collectionAdvancePaymentDaily - monthly.fullPaymentDailyAmount;
            totalCollectionActualDaily = fBal.collectionActualDaily + monthly.collectionActualDaily - monthly.fullPaymentDailyAmount;
            totalCollectionAdvancePaymentWeekly = fBal.collectionAdvancePaymentWeekly + monthly.collectionTargetWeekly + monthly.collectionAdvancePaymentWeekly - monthly.fullPaymentWeeklyAmount;
            totalCollectionActualWeekly = fBal.collectionActualWeekly + monthly.collectionActualWeekly - monthly.fullPaymentWeeklyAmount;
            totalConsolidatedCollection = fBal.consolidatedCollection + monthly.consolidatedCollection - monthly.consolidatedFullPaymentAmount;
            totalMispaymentPerson = fBal.mispaymentPerson + monthly.mispaymentPerson;
            totalFullPaymentDailyPerson = fBal.fullPaymentDailyPerson + monthly.fullPaymentDailyPerson;
            totalFullPaymentDailyAmount = fBal.fullPaymentDailyAmount + monthly.fullPaymentDailyAmount;
            totalFullPaymentWeeklyPerson = fBal.fullPaymentWeeklyPerson + monthly.fullPaymentWeeklyPerson;
            totalFullPaymentWeeklyAmount = fBal.fullPaymentWeeklyAmount + monthly.fullPaymentWeeklyAmount;
            totalConsolidatedFullPaymentPerson = fBal.consolidatedFullPaymentPerson + monthly.consolidatedFullPaymentPerson;
            totalConsolidatedFullPaymentAmount = fBal.consolidatedFullPaymentAmount + monthly.consolidatedFullPaymentAmount;
            totalActiveBorrowers = monthly.activeBorrowers;
            // totalLoanBalance = totalActiveLoanReleaseAmount - totalConsolidatedCollection;
            totalLoanBalance = monthly.loanBalance;

            if (monthly.pastDueAmount > 0) {
                totalPastDuePerson = monthly.pastDuePerson;
                totalPastDueAmount = monthly.pastDueAmount;
            }


            // if (monthly.loanReleaseAmount === 0 && fBal.loanReleaseAmount === 0) {
            //     totalLoanBalance = monthly.loanBalance;
            // }
        }

        grandTotal.transfer = totalTransfer;
        grandTotal.newMember = totalNewMember;
        grandTotal.mcbuTarget = totalMcbuTarget;
        grandTotal.mcbuTargetStr = formatPricePhp(totalMcbuTarget);
        grandTotal.mcbuActual = totalMcbuActual;
        grandTotal.mcbuActualStr = formatPricePhp(totalMcbuActual);
        grandTotal.mcbuWithdrawal = totalMcbuWithdrawal;
        grandTotal.mcbuWithdrawalStr = formatPricePhp(totalMcbuWithdrawal);
        grandTotal.mcbuInterest = totalMcbuInterest;
        grandTotal.mcbuInterestStr = formatPricePhp(totalMcbuInterest);
        grandTotal.noMcbuReturn = totalNoMcbuReturn;
        grandTotal.mcbuReturnAmt = totalMcbuReturnAmt;
        grandTotal.mcbuReturnAmtStr = formatPricePhp(totalMcbuReturnAmt);
        grandTotal.mcbuBalance = totalMcbuBalance;
        grandTotal.mcbuBalanceStr = formatPricePhp(totalMcbuBalance);
        grandTotal.offsetPerson = totalOffsetperson;
        grandTotal.activeClients = totalActiveClients;
        grandTotal.loanReleaseDailyPerson = 0;
        grandTotal.loanReleaseDailyAmount = 0;
        grandTotal.loanReleaseDailyAmountStr = '-';
        grandTotal.loanReleaseWeeklyPerson = 0;
        grandTotal.loanReleaseWeeklyAmount = 0;
        grandTotal.loanReleaseWeeklyAmountStr = '-';
        grandTotal.consolidatedLoanReleasePerson = 0;
        grandTotal.consolidatedLoanReleaseAmount = 0;
        grandTotal.consolidatedLoanReleaseAmountStr = '-';
        grandTotal.activeLoanReleasePerson = totalActiveLoanReleasePerson;
        grandTotal.activeLoanReleaseAmount = totalActiveLoanReleaseAmount;
        grandTotal.activeLoanReleaseAmountStr = formatPricePhp(totalActiveLoanReleaseAmount);
        grandTotal.collectionAdvancePaymentDaily = totalCollectionAdvancePaymentDaily;
        grandTotal.collectionAdvancePaymentDailyStr = formatPricePhp(totalCollectionAdvancePaymentDaily);
        grandTotal.collectionActualDaily = totalCollectionActualDaily;
        grandTotal.collectionActualDailyStr = formatPricePhp(totalCollectionActualDaily);
        grandTotal.collectionAdvancePaymentWeekly = totalCollectionAdvancePaymentWeekly;
        grandTotal.collectionAdvancePaymentWeeklyStr = formatPricePhp(totalCollectionAdvancePaymentWeekly);
        grandTotal.collectionActualWeekly = totalCollectionActualWeekly;
        grandTotal.collectionActualWeeklyStr = formatPricePhp(totalCollectionActualWeekly);
        grandTotal.consolidatedCollection = totalConsolidatedCollection;
        grandTotal.consolidatedCollectionStr = formatPricePhp(totalConsolidatedCollection);
        grandTotal.pastDuePerson = totalPastDuePerson;
        grandTotal.pastDueAmount = totalPastDueAmount;
        grandTotal.pastDueAmountStr = formatPricePhp(totalPastDueAmount);
        grandTotal.mispaymentPerson = totalMispaymentPerson;
        grandTotal.fullPaymentDailyPerson = totalFullPaymentDailyPerson;
        grandTotal.fullPaymentDailyAmount = totalFullPaymentDailyAmount;
        grandTotal.fullPaymentDailyAmountStr = formatPricePhp(totalFullPaymentDailyAmount);
        grandTotal.fullPaymentWeeklyPerson = totalFullPaymentWeeklyPerson;
        grandTotal.fullPaymentWeeklyAmount = totalFullPaymentWeeklyAmount;
        grandTotal.fullPaymentWeeklyAmountStr = formatPricePhp(totalFullPaymentWeeklyAmount);
        grandTotal.consolidatedFullPaymentPerson = totalConsolidatedFullPaymentPerson;
        grandTotal.consolidatedFullPaymentAmount = totalConsolidatedFullPaymentAmount;
        grandTotal.consolidatedFullPaymentAmountStr = formatPricePhp(totalConsolidatedFullPaymentAmount);
        grandTotal.activeBorrowers = totalActiveBorrowers;
        grandTotal.loanBalance = totalLoanBalance;
        grandTotal.loanBalanceStr = formatPricePhp(totalLoanBalance);

        if (grandTotal.loanBalance > 0) {
            if (!filter) {
                saveLosTotals(grandTotal);
            } else {
                saveLosTotals(grandTotal, true, date)
            }
        }

        return grandTotal;
    }

    const saveLosTotals = async (total, filter, date) => {
        let losTotals = {
            userId: currentUser._id,
            branchId: currentBranch && currentBranch._id,
            month: filter ? moment(date).month() + 1 : moment(currentDate).month() + 1,
            year: filter ? moment(date).year() : moment(currentDate).year(),
            data: total,
            losType: 'commulative',
            currentDate: currentDate,
            officeType: selectedLoGroup
        }

        // if (currentUser.role.rep === 4) {
        //     if (currentUser.transactionType === 'daily') {
        //         losTotals = {...losTotals, occurence: 'daily'};
        //     } else {
        //         losTotals = {...losTotals, occurence: 'weekly'};
        //     }
        // }

        await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', losTotals);
    }

    useEffect(() => {
        if (currentDate) {
            setSelectedMonth(moment(currentDate).month() + 1);
            setSelectedYear(moment(currentDate).year());
        }
    }, [currentDate]);

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            const getCurrentBranch = async () => {
                const apiUrl = `${getApiBaseUrl()}branches?`;
                const params = { code: currentUser.designatedBranch };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    dispatch(setBranch(response.branch))
                } else {
                    toast.error('Error while loading data');
                }
            }

            mounted && getCurrentBranch();
        } else {
            // selectedBranchSubject
        }

        return (() => {
            mounted = false;
        })
    }, [currentUser]);

    useEffect(() => {
        setDays(getDaysOfMonth(selectedYear, selectedMonth));
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        let mounted = true;
        if (days && days.length > 0) {
            const fMonth = (typeof selectedMonth === 'number' && selectedMonth < 10) ? '0' + selectedMonth : selectedMonth;
            mounted && getListLos(`${selectedYear}-${fMonth}-01`, selectedLoGroup);
        }

        return (() => {
            mounted = false;
        })
    }, [days, selectedLoGroup]);

    useEffect(() => {
        const getListUser = async () => {
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list?' + new URLSearchParams({ loOnly: true, branchCode: currentBranch?.code, selectedLoGroup: selectedLoGroup });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const userListArr = [];
                response.users && response.users.map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userListArr.push({
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    });
                });
                userListArr.sort((a, b) => { return a.loNo - b.loNo; });
                dispatch(setUserList(userListArr));
            } else {
                toast.error('Error retrieving user list.');
            }
        }

        if (currentBranch && selectedLoGroup) {
            getListUser();
        }
    }, [selectedLoGroup, currentBranch]);

    return (
        <Layout header={false} noPad={false} hScroll={false}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="flex flex-col">
                    <LOSHeader page={1} pageTitle="Branch Manager Summary" selectedBranch={currentBranch} 
                            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} handleMonthFilter={handleMonthFilter}
                            selectedYear={selectedYear} setSelectedYear={setSelectedYear} handleYearFilter={handleYearFilter}
                            selectedLoGroup={selectedLoGroup} handleSelectedLoGroupChange={handleSelectedLoGroupChange}
                            selectedLo={selectedLo} handleSelectedLoChange={handleSelectedLoChange} />
                    <div className="flex flex-col min-h-[55rem] mt-40 pl-6 pr-2 overflow-y-auto">
                        <div className="block rounded-xl overflow-auto h-screen">
                            <table className="relative w-full table-auto border-collapse text-sm bg-white" style={{ marginBottom: "14em" }}>
                                <thead>
                                    <tr>
                                        <th rowSpan={3} className="sticky top-0 bg-white border border-gray-300 border-l-0 border-t-0  px-2 py-2 text-gray-500 uppercase">Date</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">TFR</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">NM</th>
                                        <th colSpan={6} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">MCBU</th> 
                                        {/* <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">OFST Pers.</th> */}
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Act. Clie.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">MCBU Bal.</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-4 text-gray-500 uppercase">Curr. Loan Rel. w/SC (Regular Loan Daily)</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-4 text-gray-500 uppercase">Curr. Loan Rel. w/SC (Other Loan Weekly)</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Pers.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Consol. Total Loan Release w/SC</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 py-4 text-gray-500 uppercase">ACT LOAN RELEASE W/ Serv. Charge</th>
                                        <th colSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">COLLECTION (w/SC)</th>
                                        <th colSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">COLLECTION (w/SC)</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Consol. Total Act. Collection</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">Pastdue</th>
                                        {/* <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Mispay Pers.</th> */}
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">FULL PAYMENT (w/SC Daily)</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">FULL PAYMENT (w/SC Weekly)</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">Consol. FULL PAYMENT</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Act. Bwr.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-r-0 border-t-0 px-2 py-2 text-gray-500 uppercase">Loan Balance</th>
                                    </tr>
                                    <tr>
                                        <th rowSpan={2} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">Target Deposit</th>
                                        <th rowSpan={2} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">Actual Deposit</th>
                                        <th rowSpan={2} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">WD</th>
                                        <th rowSpan={2} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">Int.</th>
                                        <th colSpan={2} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">MCBU Return</th>
                                        <th colSpan={3} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">REG. LOAN (Daily)</th>
                                        <th colSpan={3} className="sticky top-[1.4rem] bg-white  border border-gray-300 text-gray-500 uppercase">OTHER LOAN (Weekly)</th>
                                    </tr>
                                    <tr>
                                        {/* MCBU Return */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* Loan Release Daily */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* Loan Release Weekly */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* ACTIVE LOAN RELEASE W/ Service Charge */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* REGULAR LOAN (Daily) */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Target</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Adv. Pmt</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Actl</th>
                                        {/* OTHER LOAN (Weekly) */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Target</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Adv. Pmt</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Actl</th>
                                        {/* PAST DUE */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* FULL PAYMENT (w/SC Daily) */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* FULL PAYMENT (w/SC Weekly) */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        {/* Consolidated FULL PAYMENT (w/SC) */}
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[7.02rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {list.map((item, index) => {
                                        let rowBg = 'even:bg-gray-100';

                                        if (item.weekTotal || item.monthTotal || item.grandTotal || item?.flag === 'transfer') {
                                            rowBg = 'bg-blue-100';
                                        }

                                        return (
                                            <React.Fragment key={index}>
                                                {(item.fBalance || item.grandTotal ) ? (
                                                    <tr className={`${rowBg} text-red-400 font-bold`}>
                                                        <td className={`${item.fBalance && 'text-black'} px-4 py-4 text-center border border-gray-300 border-l-0`}>{ item.day }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.transfer }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.newMember }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuTargetStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuActualStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuWithdrawalStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuInterestStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.noMcbuReturn }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuReturnAmtStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.offsetPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeClients }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuBalanceStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseDailyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseDailyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseWeeklyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseWeeklyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedLoanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td colSpan={2} className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentDailyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualDailyStr }</td>
                                                        <td colSpan={2} className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentWeeklyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualWeeklyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedCollectionStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.mispaymentPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentDailyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentDailyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentWeeklyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentWeeklyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedFullPaymentPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedFullPaymentAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeBorrowers }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300 border-r-0">{ item.loanBalanceStr }</td>
                                                    </tr>
                                                ) : (
                                                    <tr className={`${rowBg} ${(item.weekTotal || item.monthTotal) && 'text-red-400 font-bold'} ${item?.flag === 'transfer' && 'text-orange-400 font-bold'}`}>
                                                        <td className="px-2 py-4 text-center border border-gray-300 border-l-0">{ item.day }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.transfer }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.newMember }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuTargetStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuActualStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuWithdrawalStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuInterestStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.noMcbuReturn }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuReturnAmtStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.offsetPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeClients }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.mcbuBalanceStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseDailyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseDailyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseWeeklyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseWeeklyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedLoanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionTargetDailyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentDailyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualDailyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionTargetWeeklyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentWeeklyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualWeeklyStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedCollectionStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.mispaymentPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentDailyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentDailyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentWeeklyPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentWeeklyAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedFullPaymentPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.consolidatedFullPaymentAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeBorrowers }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300 border-r-0">{ item.loanBalanceStr }</td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

export default BranchManagerSummary;