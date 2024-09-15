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

const LoanOfficerSummary = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentBranch = useSelector(state => state.branch.data);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.los.list);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const selectedBranch = useSelector(state => state.branch.data);
    const [days, setDays] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState();
    const [selectedYear, setSelectedYear] = useState();
    const [selectedLoGroup, setSelectedLoGroup] = useState('all');
    const [selectedLo, setSelectedLo] = useState();
    const { uuid } = router.query;

    const handleMonthFilter = (selected) => {
        setSelectedMonth(selected.value);
    }

    const handleYearFilter = (selected) => {
        setSelectedYear(selected.value);
    }

    const handleSelectedLoGroupChange = (value) => {
        if (value == 'all') {
            setSelectedLo(null);
        } else {
            router.push('/transactions/branch-manager/summary');
        }

        setSelectedLoGroup(value);
    }

    const handleSelectedLoChange = (selected) => {
        setSelectedLo(selected);
        router.push(`/transactions/loan-officer-summary?uuid=${selected._id}`);
    }

    const getListLos = async (date) => {
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
            // offsetPerson: 0,
            activeClients: 0,
            loanReleasePerson: 0,
            loanReleaseAmount: 0,
            loanReleaseAmountStr: 0,
            activeLoanReleasePerson: 0,
            activeLoanReleaseAmount: 0,
            activeLoanReleaseAmountStr: 0,
            collectionAdvancePayment: 0,
            collectionAdvancePaymentStr: 0,
            collectionActual: 0,
            collectionActualStr: 0,
            pastDuePerson: 0,
            pastDueAmount: 0,
            pastDueAmountStr: 0,
            mispaymentPerson: 0,
            fullPaymentPerson: 0,
            fullPaymentAmount: 0,
            fullPaymentAmountStr: 0,
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
                loanReleasePerson: '-',
                loanReleaseAmount: '-',
                loanReleaseAmountStr: '-',
                activeLoanReleasePerson: '-',
                activeLoanReleaseAmount: '-',
                activeLoanReleaseAmountStr: '-',
                collectionTarget: '-',
                collectionTargetStr: '-',
                collectionAdvancePayment: '-',
                collectionAdvancePaymentStr: '-',
                collectionActual: '-',
                collectionActualStr: '-',
                pastDuePerson: '-',
                pastDueAmount: '-',
                pastDueAmountStr: '-',
                mispaymentPerson: '-',
                fullPaymentPerson: '-',
                fullPaymentAmount: '-',
                fullPaymentAmountStr: '-',
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
                    loanReleasePerson: '-',
                    loanReleaseAmount: '-',
                    loanReleaseAmountStr: '-',
                    activeLoanReleasePerson: '-',
                    activeLoanReleaseAmount: '-',
                    activeLoanReleaseAmountStr: '-',
                    collectionTarget: '-',
                    collectionTargetStr: '-',
                    collectionAdvancePayment: '-',
                    collectionAdvancePaymentStr: '-',
                    collectionActual: '-',
                    collectionActualStr: '-',
                    pastDuePerson: '-',
                    pastDueAmount: '-',
                    pastDueAmountStr: '-',
                    mispaymentPerson: '-',
                    fullPaymentPerson: '-',
                    fullPaymentAmount: '-',
                    fullPaymentAmountStr: '-',
                    activeBorrowers: '-',
                    loanBalance: '-',
                    loanBalanceStr: '-',
                    weekNumber: weekNumber++,
                    weekTotal: true
                });
            }
        });
        
        if (currentUser.role.rep == 4) {
            url = url + '?' + new URLSearchParams({ userId: currentUser._id, date: date ? date : currentDate });
        } else if (currentUser.role.rep == 3 && uuid) {
            url = url + '?' + new URLSearchParams({ userId: uuid, date: date ? date : currentDate });
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let fBal = response.data.fBalance;
            if (fBal.length > 0) {
                fBal = fBal[0].data;
                const activeClients = fBal.activeClients;
                losList[0] = {
                    day: 'F / Balance',
                    transfer: activeClients > 0 ? fBal.transfer : 0,
                    newMember: activeClients > 0 ? fBal.newMember : 0,
                    mcbuTarget: activeClients > 0 ? fBal.mcbuTarget : 0,
                    mcbuTargetStr: activeClients > 0 ? formatPricePhp(fBal.mcbuTarget) : '-',
                    mcbuActual: activeClients > 0 ? fBal.mcbuActual : 0,
                    mcbuActualStr: activeClients > 0 ? formatPricePhp(fBal.mcbuActual) : '-',
                    mcbuWithdrawal: activeClients > 0 ? fBal.mcbuWithdrawal : 0,
                    mcbuWithdrawalStr: activeClients > 0 ? formatPricePhp(fBal.mcbuWithdrawal) : '-',
                    mcbuInterest: activeClients > 0 ? fBal.mcbuInterest : 0,
                    mcbuInterestStr: activeClients > 0 ? formatPricePhp(fBal.mcbuInterest) : '-',
                    noMcbuReturn: activeClients > 0 ? fBal.noMcbuReturn : 0,
                    mcbuReturnAmt: activeClients > 0 ? fBal.mcbuReturnAmt : 0,
                    mcbuReturnAmtStr: activeClients > 0 ? formatPricePhp(fBal.mcbuReturnAmt) : '-',
                    mcbuBalance: activeClients > 0 ? fBal.mcbuBalance : 0,
                    mcbuBalanceStr: activeClients > 0 ? formatPricePhp(fBal.mcbuBalance) : '-',
                    offsetPerson: activeClients > 0 ? fBal.offsetPerson : 0,
                    activeClients: activeClients,
                    loanReleasePerson: activeClients > 0 ? fBal.loanReleasePerson : 0,
                    loanReleaseAmount: activeClients > 0 ? fBal.loanReleaseAmount : 0,
                    loanReleaseAmountStr: activeClients > 0 ? formatPricePhp(fBal.loanReleaseAmount) : '-',
                    activeLoanReleasePerson: activeClients > 0 ? fBal.activeLoanReleasePerson : 0,
                    activeLoanReleaseAmount: activeClients > 0 ? fBal.activeLoanReleaseAmount : 0,
                    activeLoanReleaseAmountStr: activeClients > 0 ? formatPricePhp(fBal.activeLoanReleaseAmount) : '-',
                    collectionAdvancePayment: activeClients > 0 ? fBal.collectionAdvancePayment : 0,
                    collectionAdvancePaymentStr: activeClients > 0 ? formatPricePhp(fBal.collectionAdvancePayment) : '-',
                    collectionActual: activeClients > 0 ? fBal.collectionActual : 0,
                    collectionActualStr: activeClients > 0 ? formatPricePhp(fBal.collectionActual) : '-',
                    pastDuePerson: activeClients > 0 ? fBal.pastDuePerson : 0,
                    pastDueAmount: activeClients > 0 ? fBal.pastDueAmount : 0,
                    pastDueAmountStr: activeClients > 0 ? formatPricePhp(fBal.pastDueAmount) : '-',
                    mispaymentPerson: activeClients > 0 ? fBal.mispaymentPerson : 0,
                    fullPaymentPerson: activeClients > 0 ? fBal.fullPaymentPerson : 0,
                    fullPaymentAmount: activeClients > 0 ? fBal.fullPaymentAmount : 0,
                    fullPaymentAmountStr: activeClients > 0 ? formatPricePhp(fBal.fullPaymentAmount) : '-',
                    activeBorrowers: activeClients > 0 ? fBal.activeBorrowers : 0,
                    loanBalance: activeClients > 0 ? fBal.loanBalance : 0,
                    loanBalanceStr: activeClients > 0 ? formatPricePhp(fBal.loanBalance) : '-',
                    fBalance: true
                };
            }
            
            response.data.current.map(los => {
                const index = losList.findIndex(d => d.day === los.dateAdded);
                if (index > -1) {
                    losList[index] = {
                        ...los.data,
                        day: los.dateAdded,
                        prevMcbuBalance: los.data.prevMcbuBalance,
                        mcbuTarget: currentUser.transactionType === 'daily' ? 0 : los.data.mcbuTarget,
                        mcbuTargetStr: currentUser.transactionType === 'daily' ? '-' : formatPricePhp(los.data.mcbuTarget),
                        mcbuActualStr: formatPricePhp(los.data.mcbuActual),
                        mcbuWithdrawalStr: formatPricePhp(los.data.mcbuWithdrawal),
                        mcbuInterestStr: formatPricePhp(los.data.mcbuInterest),
                        mcbuReturnAmtStr: formatPricePhp(los.data.mcbuReturnAmt),
                        loanReleaseAmountStr: formatPricePhp(los.data.loanReleaseAmount),
                        activeLoanReleaseAmountStr: formatPricePhp(los.data.activeLoanReleaseAmount),
                        collectionTargetStr: formatPricePhp(los.data.collectionTarget),
                        collectionAdvancePaymentStr: formatPricePhp(los.data.collectionAdvancePayment),
                        collectionActualStr: formatPricePhp(los.data.collectionActual),
                        pastDueAmountStr: formatPricePhp(los.data.pastDueAmount),
                        fullPaymentAmountStr: formatPricePhp(los.data.fullPaymentAmount),
                        loanBalance: los.data.loanBalance,
                        loanBalanceStr: formatPricePhp(los.data.loanBalance)
                    };
                }
            });

            losList = calculatePersons(losList);
            losList = calculateWeeklyTotals(losList);
            losList.push(calculateMonthlyTotals(losList[0], losList.filter(los => los.weekTotal)));
            losList.push(calculateGrandTotals(losList.filter(los => !los.hasOwnProperty('flag')), filter, date));
            dispatch(setLosList(losList));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
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
        let totalTargetCollection = 0;
        let totalExcess = 0;
        let totalActualCollection = 0;
        let totalPastDue = 0;
        let totalNoPastDue = 0;
        let totalLoanRelease = 0;

        let mcbuBalance = 0;
        let activeClients = 0;
        let activeBorrowers = 0;
        let activeLoanReleasePerson = 0;
        let activeLoanReleaseAmount = 0;
        let loanBalance = 0;
        let totalTdaClients = 0;
        let totalPendingClients = 0;

        losList.map((los, index) => {
            let temp = {...los};
            let transferGvr;
            let transferRcv;

            if (temp?.transferGvr) {
                const data = {...temp.transferGvr};
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
                
                transferGvr = {
                    transfer: noTransfer,
                    mcbuTarget: mcbuTarget,
                    mcbuActual: mcbuActual,
                    mcbuWithdrawal: mcbuWithdrawal,
                    mcbuInterest: mcbuInterest,
                    noMcbuReturn: noMcbuReturn,
                    mcbuReturnAmt: mcbuReturnAmt,
                    mcbuBalance: -Math.abs(mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt),
                    currentReleaseAmount: data.currentReleaseAmount,
                    loanReleaseAmount: -Math.abs(data.totalLoanRelease),
                    collectionTarget: -Math.abs(data.targetLoanCollection + excess),
                    collectionActual: -Math.abs(data.collection),
                    pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                    pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                    // excess: excess
                }

                activeClients = temp.activeClients + noTransfer;
                activeBorrowers = temp.activeBorrowers + noTransfer;
                activeLoanReleasePerson = temp.activeLoanReleasePerson + noTransfer;
                activeLoanReleaseAmount = temp.activeLoanReleaseAmount - data.totalLoanRelease + data.currentReleaseAmount;
                loanBalance = temp.loanBalance - (data.totalLoanRelease - data.collection) + data.currentReleaseAmount;
            }

            if (temp?.transferRcv) {
                const data = {...temp.transferRcv};
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

                transferRcv = {
                    transfer: noTransfer,
                    mcbuTarget: mcbuTarget,
                    mcbuActual: mcbuActual,
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
                    // excess: excess
                }

                activeClients = activeClients + noTransfer - pendingClients;
                activeBorrowers = activeBorrowers + noTransfer - tdaClients;
                activeLoanReleasePerson = activeLoanReleasePerson + noTransfer - tdaClients;
                activeLoanReleaseAmount += data.totalLoanRelease //+ data.currentReleaseAmount;
                loanBalance += (data.totalLoanRelease - data.collection) //+ data.currentReleaseAmount;
                totalTdaClients += tdaClients;
                totalPendingClients += pendingClients;
            }

            if (transferGvr || transferRcv) {
                if (transferGvr) {
                    totalTransfer = transferGvr?.transfer;
                    totalMcbuTarget = transferGvr?.mcbuTarget;
                    totalMcbuActual = transferGvr?.mcbuActual;
                    totalMcbuWithdrawal = transferGvr?.mcbuWithdrawal;
                    totalMcbuInterest = transferGvr?.mcbuInterest;
                    totalMcbuNoReturn = transferGvr?.noMcbuReturn;
                    totalMcbuReturnAmt = transferGvr?.mcbuReturnAmt;
                    totalMcbuBalance = transferGvr?.mcbuBalance;
                    totalLoanRelease = transferGvr?.loanReleaseAmount;
                    totalTargetCollection = transferGvr?.collectionTarget;
                    totalActualCollection = transferGvr?.collectionActual;
                    totalPastDue = transferGvr?.pastDueAmount > 0 ? transferGvr?.pastDueAmount : 0;
                    totalNoPastDue = transferGvr?.pastDuePerson > 0 ? transferGvr?.pastDuePerson : 0;
                    // totalExcess = transferGvr?.excess;
                }

                if (transferRcv) {
                    totalTransfer += transferRcv?.transfer;
                    totalMcbuTarget += transferRcv?.mcbuTarget;
                    totalMcbuActual += transferRcv?.mcbuActual;
                    totalMcbuWithdrawal += transferRcv?.mcbuWithdrawal;
                    totalMcbuInterest += transferRcv?.mcbuInterest;
                    totalMcbuNoReturn += transferRcv?.noMcbuReturn;
                    totalMcbuReturnAmt += transferRcv.mcbuReturnAmt;
                    totalMcbuBalance += transferRcv?.mcbuBalance;
                    totalLoanRelease += transferRcv?.loanReleaseAmount;
                    totalTargetCollection += transferRcv?.collectionTarget;
                    totalActualCollection += transferRcv?.collectionActual;
                    totalPastDue += transferRcv?.pastDueAmount > 0 ? transferRcv?.pastDueAmount : 0;
                    totalNoPastDue += transferRcv?.pastDuePerson > 0 ? transferRcv?.pastDuePerson : 0;
                    // totalExcess += transferRcv?.excess;
                }

                activeLoanReleaseAmount += Math.abs(transferGvr?.currentReleaseAmount);
                loanBalance += Math.abs(transferGvr?.currentReleaseAmount);

                if (totalMcbuBalance !== 0) {
                    mcbuBalance = temp.mcbuBalance ? temp.mcbuBalance : 0 //+ totalMcbuBalance;
                }

                mcbuBalance += totalMcbuBalance;
            }
        });

        return {
            day: 'TOC Total',
            transfer: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
            newMember: '-',
            mcbuTarget: totalMcbuTarget,
            mcbuTargetStr: totalMcbuTarget < 0 ? `(${formatPricePhp(Math.abs(totalMcbuTarget))})` : formatPricePhp(totalMcbuTarget),
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
            loanReleasePerson: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
            loanReleaseAmount: totalLoanRelease,
            loanReleaseAmountStr: totalLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalLoanRelease))})` : formatPricePhp(totalLoanRelease),
            activeLoanReleasePerson: activeBorrowers,
            activeLoanReleaseAmount: activeLoanReleaseAmount,
            activeLoanReleaseAmountStr: activeLoanReleaseAmount < 0 ? `(${formatPricePhp(Math.abs(activeLoanReleaseAmount))})` : formatPricePhp(activeLoanReleaseAmount),
            collectionTarget: totalTargetCollection,
            collectionTargetStr: totalTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalTargetCollection))})` : formatPricePhp(totalTargetCollection),
            collectionAdvancePayment: 0,
            collectionAdvancePaymentStr: '-',//totalExcess < 0 ? `(${formatPricePhp(Math.abs(totalExcess))})` : formatPricePhp(totalExcess),
            collectionActual: totalActualCollection,
            collectionActualStr: totalActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalActualCollection))})` : formatPricePhp(totalActualCollection),
            pastDuePerson: totalNoPastDue,
            pastDueAmount: totalPastDue,
            pastDueAmountStr: totalPastDue < 0 ? `(${formatPricePhp(Math.abs(totalPastDue))})` : formatPricePhp(totalPastDue),
            mispaymentPerson: '-',
            fullPaymentPerson: '-',
            fullPaymentAmount: 0,
            fullPaymentAmountStr: '-',
            activeBorrowers: activeBorrowers,
            loanBalance: loanBalance,
            loanBalanceStr: loanBalance < 0 ? `(${formatPricePhp(Math.abs(loanBalance))})` : formatPricePhp(loanBalance),
            tdaClients: totalTdaClients,
            pendingClients: totalPendingClients,
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
                const mcbuTransfer = 0;

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
                    temp.mcbuBalance = fBalMcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + mcbuTransfer;
                    temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                } else {
                    temp.activeClients = temp.activeClients > 0 ? temp.activeClients : prevLos.activeClients;
                    temp.activeLoanReleasePerson = temp.activeLoanReleasePerson > 0 ? temp.activeLoanReleasePerson : prevLos.activeLoanReleasePerson;
                    temp.activeLoanReleaseAmount = temp.activeLoanReleaseAmount > 0 ? temp.activeLoanReleaseAmount : prevLos.activeLoanReleaseAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = temp.activeBorrowers > 0 ? temp.activeBorrowers : prevLos.activeBorrowers;
                    temp.loanBalance = temp.loanBalance > 0 ? temp.loanBalance : prevLos.loanBalance;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                    temp.mcbuBalance = prevLos.mcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + mcbuTransfer;
                    temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                }

                prevLos = temp;
            }

            return temp;
        });
    }

    const calculateWeeklyTotals = (losList) => {
        const transferRow = processTransferDetails(losList);
        const weekTotals = losList.filter(los => los.weekTotal);
        const fBal = losList[0];

        let prevWeek;
        let lastWeekTotalIdx;
        weekTotals.map((w, wIndex) => {
            const index = losList.findIndex(los => los.weekNumber === w.weekNumber);
            if (index > -1) {
                let losSlice;
                if (w.weekNumber === 0) {
                    losSlice = losList.slice(1, index);
                } else { // index = 15
                    losSlice = losList.slice(index - 5, index);
                    const hasWeek = losSlice.find(los => los.weekTotal);
                    if (hasWeek) {
                        const hasWeekIdx = losList.findIndex(los => los.weekNumber === hasWeek.weekNumber);
                        losSlice = losList.slice(hasWeekIdx + 1, index);
                    }
                }
                // bring down only to weekly
                // offset and activeclient
                let totalTransfer = 0;
                let totalNewMember = 0;
                let totalOffsetperson = 0;
                let totalActiveClients = 0; // last row
                let totalLoanReleasePerson = 0;
                let totalLoanReleaseAmount = 0;
                let totalActiveLoanReleasePerson = 0;
                let totalActiveLoanReleaseAmount = 0;
                let totalCollectionTarget = 0;
                let totalCollectionAdvancePayment = 0;
                let totalCollectionActual = 0;
                let totalPastDuePerson = 0;
                let totalMispaymentPerson = 0;
                let totalPastDueAmount = 0;
                let totalFullPaymentPerson = 0;
                let totalFullPaymentAmount = 0;
                let totalActiveBorrowers = 0; // last row
                let totalLoanBalance = 0; // last row

                let lastPastDueAmount = 0;
                let lastPastDuePerson = 0;
                let lastLoanBalance = 0;
                let lastMcbuBalance = 0;

                let totalMcbuTarget = 0;
                let totalMcbuActual = 0;
                let totalMcbuWithdrawal = 0;
                let totalMcbuInterest = 0;
                let totalNoMcbuReturn = 0;
                let totalMcbuReturnAmt = 0;
                let totalMcbuBalance = 0;
                
                losSlice.map(los => {
                    totalNewMember += los.newMember !== '-' ? los.newMember : 0;
                    totalOffsetperson += los.offsetPerson !== '-' ? los.offsetPerson : 0;
                    totalLoanReleasePerson += los.loanReleasePerson !== '-' ? los.loanReleasePerson : 0;
                    totalLoanReleaseAmount += los.loanReleaseAmount !== '-' ? los.loanReleaseAmount : 0;
                    totalCollectionTarget += los.collectionTarget !== '-' ? los.collectionTarget : 0;
                    totalCollectionAdvancePayment += los.collectionAdvancePayment !== '-' ? los.collectionAdvancePayment : 0;
                    totalCollectionActual += los.collectionActual !== '-' ? los.collectionActual : 0;
                    totalMispaymentPerson += los.mispaymentPerson !== '-' ? los.mispaymentPerson : 0;

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

                    totalFullPaymentPerson += los.fullPaymentPerson !== '-' ? los.fullPaymentPerson : 0;
                    totalFullPaymentAmount += los.fullPaymentAmount !== '-' ? los.fullPaymentAmount : 0;
                    totalMcbuTarget += (los.mcbuTarget !== '-' && los.mcbuTarget) ? los.mcbuTarget : 0;
                    totalMcbuActual += (los.mcbuActual !== '-'  && los.mcbuActual)? los.mcbuActual : 0;
                    totalMcbuWithdrawal += (los.mcbuWithdrawal !== '-' && los.mcbuWithdrawal) ? los.mcbuWithdrawal : 0;
                    totalMcbuInterest += (los.mcbuInterest !== '-' && los.mcbuInterest) ? los.mcbuInterest : 0;
                    totalNoMcbuReturn += (los.noMcbuReturn !== '-' && los.noMcbuReturn) ? los.noMcbuReturn : 0;
                    totalMcbuReturnAmt += (los.mcbuReturnAmt !== '-' && los.mcbuReturnAmt) ? los.mcbuReturnAmt : 0;
                });

                if (w.weekNumber === 0) {
                    totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                    totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
                } else {
                    totalActiveClients = prevWeek.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                    totalActiveLoanReleasePerson = prevWeek.activeLoanReleasePerson + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalActiveLoanReleaseAmount = prevWeek.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
                }

                totalMcbuBalance = lastMcbuBalance;
                totalPastDuePerson = lastPastDuePerson;
                totalPastDueAmount = lastPastDueAmount;
                totalActiveBorrowers = losSlice[losSlice.length - 1].activeBorrowers;
                totalLoanBalance =  lastLoanBalance;

                // +/- with the transfer
                // apply only to the last week total
                if (wIndex === weekTotals.length - 1) {
                    let noTransfer = transferRow.transfer;
                    if (typeof noTransfer === "string" && noTransfer !== '-') {
                        noTransfer = noTransfer.replace('(','').replace(')','');
                        noTransfer = -Math.abs(noTransfer);
                    }
                    totalActiveClients += noTransfer;
                    totalTransfer = transferRow.transfer;
                    totalMcbuTarget += transferRow.mcbuTarget ? transferRow.mcbuTarget : 0;
                    totalMcbuActual += transferRow.mcbuActual ? transferRow.mcbuActual : 0;
                    totalMcbuWithdrawal += transferRow.mcbuWithdrawal;
                    totalMcbuInterest += transferRow.mcbuInterest;
                    totalNoMcbuReturn += transferRow.noMcbuReturn;
                    totalMcbuReturnAmt += transferRow.mcbuReturnAmt;
                    if (transferRow.mcbuBalance > 0) {
                        totalMcbuBalance = transferRow.mcbuBalance;
                    }
                    totalLoanReleasePerson += noTransfer;
                    totalLoanReleaseAmount += transferRow.loanReleaseAmount;
                    totalActiveLoanReleasePerson = totalActiveClients <= 0 ? 0 : transferRow.activeLoanReleasePerson;
                    totalActiveLoanReleaseAmount = totalActiveClients <= 0 ? 0 :  transferRow.activeLoanReleaseAmount;
                    totalCollectionTarget += transferRow.collectionTarget ? transferRow.collectionTarget : 0;
                    totalCollectionAdvancePayment += transferRow.collectionAdvancePayment;
                    totalCollectionActual += transferRow.collectionActual;
                    totalPastDuePerson += transferRow.pastDuePerson;
                    totalPastDueAmount += transferRow.pastDueAmount;
                    totalActiveBorrowers = totalActiveClients <= 0 ? 0 : transferRow.activeBorrowers;
                    totalLoanBalance = totalActiveClients <= 0 ? 0 : transferRow.loanBalance;
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
                    loanReleasePerson: totalLoanReleasePerson,
                    loanReleaseAmount: totalLoanReleaseAmount,
                    loanReleaseAmountStr: formatPricePhp(totalLoanReleaseAmount),
                    activeLoanReleasePerson: totalActiveLoanReleasePerson,
                    activeLoanReleaseAmount: totalActiveLoanReleaseAmount,
                    activeLoanReleaseAmountStr: formatPricePhp(totalActiveLoanReleaseAmount),
                    collectionTarget: totalCollectionTarget,
                    collectionTargetStr: formatPricePhp(totalCollectionTarget),
                    collectionAdvancePayment: totalCollectionAdvancePayment,
                    collectionAdvancePaymentStr: formatPricePhp(totalCollectionAdvancePayment),
                    collectionActual: totalCollectionActual,
                    collectionActualStr: formatPricePhp(totalCollectionActual),
                    pastDuePerson: totalPastDuePerson,
                    pastDueAmount: totalPastDueAmount,
                    pastDueAmountStr: formatPricePhp(totalPastDueAmount),
                    mispaymentPerson: totalMispaymentPerson,
                    fullPaymentPerson: totalFullPaymentPerson,
                    fullPaymentAmount: totalFullPaymentAmount,
                    fullPaymentAmountStr: formatPricePhp(totalFullPaymentAmount),
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
            loanReleasePerson: '-',
            loanReleaseAmount: '-',
            loanReleaseAmountStr: '-',
            activeLoanReleasePerson: '-',
            activeLoanReleaseAmount: '-',
            activeLoanReleaseAmountStr: '-',
            collectionTarget: '-',
            collectionTargetStr: '-',
            collectionAdvancePayment: '-',
            collectionAdvancePaymentStr: '-',
            collectionActual: '-',
            collectionActualStr: '-',
            pastDuePerson: '-',
            pastDueAmount: '-',
            pastDueAmountStr: '-',
            mispaymentPerson: '-',
            fullPaymentPerson: '-',
            fullPaymentAmount: '-',
            fullPaymentAmountStr: '-',
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
        let totalLoanReleasePerson = 0;
        let totalLoanReleaseAmount = 0;
        let totalActiveLoanReleasePerson = 0;
        let totalActiveLoanReleaseAmount = 0;
        let totalCollectionTarget = 0;
        let totalCollectionAdvancePayment = 0;
        let totalCollectionActual = 0;
        let totalPastDuePerson = 0;
        let totalPastDueAmount = 0;
        let totalMispaymentPerson = 0;
        let totalFullPaymentPerson = 0;
        let totalFullPaymentAmount = 0;
        let totalActiveBorrowers = 0; // last row
        let totalLoanBalance = 0; // last row

        weeklyTotals.map(wt => {
            let noTransfer = wt.transfer;
            if (typeof noTransfer === "string" && noTransfer !== '-') {
                noTransfer = noTransfer.replace('(','').replace(')','');
                noTransfer = -Math.abs(noTransfer);
            }

            totalTransfer += noTransfer;
            totalNewMember += wt.newMember;
            totalMcbuTarget += wt.mcbuTarget;
            totalMcbuActual += wt.mcbuActual ? wt.mcbuActual : 0;
            totalMcbuWithdrawal += wt.mcbuWithdrawal;
            totalMcbuInterest += wt.mcbuInterest;
            totalNoMcbuReturn += wt.noMcbuReturn;
            totalMcbuReturnAmt += wt.mcbuReturnAmt;
            totalOffsetperson += wt.offsetPerson;
            totalLoanReleasePerson += wt.loanReleasePerson;
            totalLoanReleaseAmount += wt.loanReleaseAmount;
            totalCollectionTarget += wt.collectionTarget;
            totalCollectionAdvancePayment += wt.collectionAdvancePayment;
            totalCollectionActual += wt.collectionActual;
            totalMispaymentPerson += wt.mispaymentPerson;
            totalFullPaymentPerson += wt.fullPaymentPerson;
            totalFullPaymentAmount += wt.fullPaymentAmount;
            totalPastDuePerson = wt.pastDuePerson;
            totalPastDueAmount = wt.pastDueAmount;
            totalLoanBalance = wt.loanBalance;
        });

        totalMcbuBalance = fBal.mcbuBalance + totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
        totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn; // bring down on last week
        totalActiveLoanReleasePerson = totalActiveClients <= 0 ? 0 : weeklyTotals[weeklyTotals.length - 1]?.activeBorrowers;
        totalActiveLoanReleaseAmount = totalActiveClients <= 0 ? 0 : fBal.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
        totalActiveBorrowers = totalActiveClients <= 0 ? 0 : weeklyTotals[weeklyTotals.length - 1]?.activeBorrowers; // fBal.activeBorrowers + totalLoanReleasePerson - totalFullPaymentPerson;

        monthlyTotal.transfer = totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer;
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
        monthlyTotal.loanReleasePerson = totalLoanReleasePerson;
        monthlyTotal.loanReleaseAmount = totalLoanReleaseAmount;
        monthlyTotal.loanReleaseAmountStr = formatPricePhp(totalLoanReleaseAmount);
        monthlyTotal.activeLoanReleasePerson = totalActiveLoanReleasePerson;
        monthlyTotal.activeLoanReleaseAmount = totalActiveLoanReleaseAmount;
        monthlyTotal.activeLoanReleaseAmountStr = formatPricePhp(totalActiveLoanReleaseAmount);
        monthlyTotal.collectionTarget = totalCollectionTarget;
        monthlyTotal.collectionTargetStr = formatPricePhp(totalCollectionTarget);
        monthlyTotal.collectionAdvancePayment = totalCollectionAdvancePayment;
        monthlyTotal.collectionAdvancePaymentStr = formatPricePhp(totalCollectionAdvancePayment);
        monthlyTotal.collectionActual = totalCollectionActual;
        monthlyTotal.collectionActualStr = formatPricePhp(totalCollectionActual);
        monthlyTotal.pastDuePerson = totalPastDuePerson;
        monthlyTotal.pastDueAmount = totalPastDueAmount;
        monthlyTotal.pastDueAmountStr = formatPricePhp(totalPastDueAmount);
        monthlyTotal.mispaymentPerson = totalMispaymentPerson;
        monthlyTotal.fullPaymentPerson = totalFullPaymentPerson;
        monthlyTotal.fullPaymentAmount = totalFullPaymentAmount;
        monthlyTotal.fullPaymentAmountStr = formatPricePhp(totalFullPaymentAmount);
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
            loanReleaseAmount: 0,
            loanReleaseAmountStr: 0,
            activeLoanReleasePerson: 0,
            activeLoanReleaseAmount: 0,
            activeLoanReleaseAmountStr: 0,
            collectionAdvancePayment: 0,
            collectionAdvancePaymentStr: 0,
            collectionActual: 0,
            collectionActualStr: 0,
            pastDuePerson: 0,
            pastDueAmount: 0,
            pastDueAmountStr: 0,
            mispaymentPerson: 0,
            fullPaymentPerson: 0,
            fullPaymentAmount: 0,
            fullPaymentAmountStr: 0,
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
        let totalLoanReleasePerson = 0;
        let totalLoanReleaseAmount = 0;
        let totalActiveLoanReleasePerson = 0;
        let totalActiveLoanReleaseAmount = 0;
        let totalCollectionAdvancePayment = 0;
        let totalCollectionActual = 0;
        let totalPastDuePerson = 0;
        let totalPastDueAmount = 0;
        let totalMispaymentPerson = 0;
        let totalFullPaymentPerson = 0;
        let totalFullPaymentAmount = 0;
        let totalActiveBorrowers = 0;
        // let totalLoanBalance = 0;

        const fBal = losList.find(los => los.fBalance);
        const monthly = losList.find(los => los.monthTotal);

        if (fBal && monthly) {
            let fnoTransfer = fBal.transfer;
            if (typeof fnoTransfer === "string") {
                fnoTransfer = fnoTransfer.replace('(','').replace(')','');
                fnoTransfer = -Math.abs(fnoTransfer);
            }

            let mnoTransfer = monthly.transfer;
            if (typeof mnoTransfer === "string") {
                mnoTransfer = mnoTransfer.replace('(','').replace(')','');
                mnoTransfer = -Math.abs(mnoTransfer);
            }
            const tTransfer = fnoTransfer + mnoTransfer;
            totalTransfer = tTransfer < 0 ? `(${Math.abs(tTransfer)})` : tTransfer;
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
            totalCollectionAdvancePayment = fBal.collectionAdvancePayment + monthly.collectionTarget + monthly.collectionAdvancePayment - monthly.fullPaymentAmount;
            totalCollectionActual = fBal.collectionActual + monthly.collectionActual - monthly.fullPaymentAmount;
            // totalPastDuePerson = fBal.pastDuePerson + monthly.pastDuePerson;
            // totalPastDueAmount = fBal.pastDueAmount + monthly.pastDueAmount;
            totalMispaymentPerson = fBal.mispaymentPerson + monthly.mispaymentPerson;
            totalFullPaymentPerson = fBal.fullPaymentPerson + monthly.fullPaymentPerson;
            totalFullPaymentAmount = fBal.fullPaymentAmount + monthly.fullPaymentAmount;
            totalActiveBorrowers = monthly.activeBorrowers;
            // totalLoanBalance = totalActiveLoanReleaseAmount - totalCollectionActual;

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
        grandTotal.loanReleasePerson = "-";
        grandTotal.loanReleaseAmount = totalLoanReleaseAmount;
        grandTotal.loanReleaseAmountStr = '-';
        grandTotal.activeLoanReleasePerson = totalActiveLoanReleasePerson;
        grandTotal.activeLoanReleaseAmount = totalActiveLoanReleaseAmount;
        grandTotal.activeLoanReleaseAmountStr = formatPricePhp(totalActiveLoanReleaseAmount);
        grandTotal.collectionAdvancePayment = totalCollectionAdvancePayment <= 0 ? 0 : totalCollectionAdvancePayment;
        grandTotal.collectionAdvancePaymentStr = formatPricePhp(grandTotal.collectionAdvancePayment);
        grandTotal.collectionActual = totalCollectionActual <= 0 ? 0 : totalCollectionActual;
        grandTotal.collectionActualStr = formatPricePhp(grandTotal.collectionActual);
        grandTotal.pastDuePerson = totalPastDuePerson;
        grandTotal.pastDueAmount = totalPastDueAmount;
        grandTotal.pastDueAmountStr = formatPricePhp(totalPastDueAmount);
        grandTotal.mispaymentPerson = totalMispaymentPerson;
        grandTotal.fullPaymentPerson = totalFullPaymentPerson;
        grandTotal.fullPaymentAmount = totalFullPaymentAmount;
        grandTotal.fullPaymentAmountStr = formatPricePhp(totalFullPaymentAmount);
        grandTotal.activeBorrowers = totalActiveBorrowers;
        grandTotal.loanBalance = monthly.loanBalance;
        grandTotal.loanBalanceStr = formatPricePhp(monthly.loanBalance);

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
            branchId: selectedBranch && selectedBranch._id,
            month: filter ? moment(date).month() + 1 : moment(currentDate).month() + 1,
            year: filter ? moment(date).year() : moment(currentDate).year(),
            data: total,
            losType: 'commulative',
            currentDate: currentDate
        }

        if (currentUser.role.rep === 4) {
            if (currentUser.transactionType === 'daily') {
                losTotals = {...losTotals, occurence: 'daily'};
            } else {
                losTotals = {...losTotals, occurence: 'weekly'};
            }
        }

        await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary/save-update-totals', losTotals);
    }

    useEffect(() => {
        if (currentDate) {
            setSelectedMonth(moment(currentDate).month() + 1);
            setSelectedYear(moment(currentDate).year());
        }
    }, [currentDate]);

    useEffect(() => {
        setDays(getDaysOfMonth(selectedYear, selectedMonth));
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            const getCurrentBranch = async () => {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}branches?`;
                const params = { code: currentUser.designatedBranch, date: currentDate };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    dispatch(setBranch(response.branch));
                } else {
                    toast.error('Error while loading data');
                }
            }

            mounted && getCurrentBranch();
        }

        return (() => {
            mounted = false;
        });
    }, [currentUser]);

    useEffect(() => {
        let mounted = true;

        if (days && days.length > 0) {
            const fMonth = (typeof selectedMonth === 'number' && selectedMonth < 10) ? '0' + selectedMonth : selectedMonth;
            if (uuid) {
                mounted && getListLos(`${selectedYear}-${fMonth}-01`, uuid);
            } else {
                mounted && getListLos(`${selectedYear}-${fMonth}-01`);
            }
        }

        return (() => {
            mounted = false;
        });
    }, [days, uuid]);

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

                setSelectedLo(userListArr.find(user => user._id == uuid));
            } else {
                toast.error('Error retrieving user list.');
            }
        }

        if (currentUser.role.rep == 3 && currentBranch && selectedLoGroup) {
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
                    <LOSHeader page={1} pageTitle="Loan Officers Summary" selectedBranch={selectedBranch} 
                            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} handleMonthFilter={handleMonthFilter}
                            selectedYear={selectedYear} setSelectedYear={setSelectedYear} handleYearFilter={handleYearFilter}
                            selectedLoGroup={selectedLoGroup} handleSelectedLoGroupChange={handleSelectedLoGroupChange}
                            selectedLo={selectedLo} handleSelectedLoChange={handleSelectedLoChange} />
                    <div className={`flex flex-col min-h-[55rem] mt-40 pl-6 pr-2 overflow-y-auto ${currentUser.role.rep == 3 && 'mt-56'}`}>
                        <div className="block rounded-xl overflow-auto h-screen">
                            <table className="relative w-full table-auto border-collapse text-sm bg-white" style={{ marginBottom: `${currentUser.role.rep == 3 ? "18em" : '14em'}`, marginRight: "2em" }}>
                                <thead>
                                    <tr>
                                        <th rowSpan={3} className="sticky top-0 bg-white border border-gray-300 border-l-0 border-t-0  px-2 py-2 text-gray-500 uppercase">Date</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">TOC</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">NM</th>
                                        <th colSpan={6} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">MCBU</th> 
                                        {/* <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">OFST Pers.</th> */}
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Act. Clie.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">MCBU Bal.</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-4 text-gray-500 uppercase">Curr. Loan Rel. with Serv. Charge</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 py-4 text-gray-500 uppercase">ACT LOAN RELEASE W/ Serv. Charge</th>
                                        <th colSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">COLLECTION (w/ serv. charge)</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">Pastdue</th>
                                        {/* <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Mispay Pers.</th> */}
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase">FULL PAYMENT (w/ serv. charge)</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Act. Bwr.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-r-0 border-t-0 px-2 py-2 text-gray-500 uppercase">Loan Balance</th>
                                    </tr>
                                    <tr>
                                        <th rowSpan={2} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">Target Deposit</th>
                                        <th rowSpan={2} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">Actual Deposit</th>
                                        <th rowSpan={2} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">WD</th>
                                        <th rowSpan={2} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">Int.</th>
                                        <th colSpan={2} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">MCBU Return</th>
                                        <th colSpan={3} className="sticky top-[2.2rem] bg-white  border border-gray-300 text-gray-500 uppercase">REGULAR LOAN</th>
                                    </tr>
                                    <tr>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Target</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Adv. Pmt</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Actl</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Pers.</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 text-gray-500 uppercase">Amt</th>
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
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td colSpan={2} className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.mispaymentPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentAmountStr }</td>
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
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.loanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionTargetStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.collectionActualStr }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        {/* <td className="px-2 py-4 text-center border border-gray-300">{ item.mispaymentPerson }</td> */}
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentPerson }</td>
                                                        <td className="px-2 py-4 text-center border border-gray-300">{ item.fullPaymentAmountStr }</td>
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

export default LoanOfficerSummary;