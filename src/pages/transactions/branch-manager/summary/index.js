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
import { formatPricePhp } from "@/lib/utils";
import { getDaysOfMonth } from "@/lib/date-utils";
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

        let url = getApiBaseUrl() + 'transactions/cash-collection-summary';
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

    const calculatePersons = (losList) => {
        const fBal = losList[0];
        let prevLos = fBal; // Initialize prevLos with fBal to have proper initial values
        
        return losList.map((los, index) => {
            let temp = {...los};
    
            if (index !== 0 && !los.weekTotal) {
                // Handle mcbuBalance calculation
                const mcbuActual = los.mcbuActual !== '-' ? los.mcbuActual : 0;
                const mcbuWithdrawal = los.mcbuWithdrawal !== '-' ? los.mcbuWithdrawal : 0;
                const mcbuInterest = los.mcbuInterest !== '-' ? los.mcbuInterest : 0;
                const mcbuReturnAmt = los.mcbuReturnAmt !== '-' ? los.mcbuReturnAmt : 0;
                const transferMCBU = los.transferMcbu ? los.transferMcbu : 0;
    
                // Always maintain the activeClients and other values from previous row unless explicitly changed
                temp.activeClients = los.activeClients !== '-' && los.activeClients > 0 ? 
                    los.activeClients : prevLos.activeClients;
                    
                temp.activeLoanReleasePerson = los.activeLoanReleasePerson !== '-' && los.activeLoanReleasePerson > 0 ? 
                    los.activeLoanReleasePerson : prevLos.activeLoanReleasePerson;
                    
                temp.activeLoanReleaseAmount = los.activeLoanReleaseAmount !== '-' && los.activeLoanReleaseAmount > 0 ? 
                    los.activeLoanReleaseAmount : prevLos.activeLoanReleaseAmount;
                    
                temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                
                temp.activeBorrowers = los.activeBorrowers !== '-' && los.activeBorrowers > 0 ? 
                    los.activeBorrowers : prevLos.activeBorrowers;
                    
                temp.loanBalance = los.loanBalance !== '-' && los.loanBalance > 0 ? 
                    los.loanBalance : prevLos.loanBalance;
                    
                temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
    
                // Calculate the mcbuBalance based on previous row and current transactions
                if (index === 1) {
                    // For the first row after fBalance, use fBalance as base
                    temp.mcbuBalance = fBal.mcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + transferMCBU;
                } else {
                    // For subsequent rows, use the previous row's mcbuBalance
                    temp.mcbuBalance = prevLos.mcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + transferMCBU;
                }
                
                // Format the mcbuBalance as currency string
                temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                
                // Update prevLos for the next iteration
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
        
        // Process each weekly total
        weekTotals.map((w, wIndex) => {
            const index = losList.findIndex(los => los.weekNumber === w.weekNumber);
            if (index > -1) {
                let losSlice;
                // Determine which rows to include in this week's calculations
                if (w.weekNumber === 0) { // First week
                    losSlice = losList.slice(1, index);
                } else { // Subsequent weeks
                    losSlice = losList.slice(index - 5, index);
                    const hasWeek = losSlice.find(los => los.weekTotal);
                    if (hasWeek) {
                        const hasWeekIdx = losList.findIndex(los => los.weekNumber === hasWeek.weekNumber);
                        losSlice = losList.slice(hasWeekIdx + 1, index);
                    }
                }
        
                // Initialize totals for this week
                let totalTransfer = 0;
                let totalNewMember = 0;
                let totalOffsetperson = 0;
                let totalActiveClients = 0; 
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
                let totalActiveBorrowers = 0;
                let totalLoanBalance = 0;
        
                // Track the last valid values seen
                let lastActiveClients = 0;
                let lastPastDueAmount = 0;
                let lastPastDuePerson = 0;
                let lastLoanBalance = 0;
                let lastMcbuBalance = 0;
                let lastActiveLoanReleasePerson = 0;
                let lastActiveLoanReleaseAmount = 0;
                let lastActiveBorrowers = 0;
        
                let totalMcbuTarget = 0;
                let totalMcbuActual = 0;
                let totalMcbuWithdrawal = 0;
                let totalMcbuInterest = 0;
                let totalNoMcbuReturn = 0;
                let totalMcbuReturnAmt = 0;
                let totalMcbuBalance = 0;
                
                // Process regular days - exclude transfer rows from calculations
                losSlice.filter(los => !los.flag || los.flag !== 'transfer').map(los => {
                    // Process transfer value (handle parentheses for negative values)
                    let noTransfer = los.transfer;
                    if (typeof noTransfer === "string" && noTransfer !== '-') {
                        noTransfer = noTransfer.replace('(','').replace(')','');
                        noTransfer = parseInt(noTransfer);
                        if (isNaN(noTransfer)) noTransfer = 0;
                    } else if (noTransfer === '-') {
                        noTransfer = 0;
                    }
                    
                    totalTransfer += noTransfer;
                    totalNewMember += los.newMember !== '-' ? parseInt(los.newMember) || 0 : 0;
                    totalOffsetperson += los.offsetPerson !== '-' ? parseInt(los.offsetPerson) || 0 : 0;
                    totalLoanReleaseDailyPerson += los.loanReleaseDailyPerson !== '-' ? 
                        (typeof los.loanReleaseDailyPerson === 'string' && los.loanReleaseDailyPerson.includes('(')) ? 
                            -parseInt(los.loanReleaseDailyPerson.replace(/[()]/g, '')) : 
                            parseInt(los.loanReleaseDailyPerson) || 0 : 0;
                    totalLoanReleaseDailyAmount += los.loanReleaseDailyAmount !== '-' ? parseFloat(los.loanReleaseDailyAmount) || 0 : 0;
                    totalLoanReleaseWeeklyPerson += los.loanReleaseWeeklyPerson !== '-' ? 
                        (typeof los.loanReleaseWeeklyPerson === 'string' && los.loanReleaseWeeklyPerson.includes('(')) ? 
                            -parseInt(los.loanReleaseWeeklyPerson.replace(/[()]/g, '')) : 
                            parseInt(los.loanReleaseWeeklyPerson) || 0 : 0;
                    totalLoanReleaseWeeklyAmount += los.loanReleaseWeeklyAmount !== '-' ? parseFloat(los.loanReleaseWeeklyAmount) || 0 : 0;
                    totalConsolidatedLoanReleasePerson += los.consolidatedLoanReleasePerson !== '-' ? 
                        (typeof los.consolidatedLoanReleasePerson === 'string' && los.consolidatedLoanReleasePerson.includes('(')) ? 
                            -parseInt(los.consolidatedLoanReleasePerson.replace(/[()]/g, '')) : 
                            parseInt(los.consolidatedLoanReleasePerson) || 0 : 0;
                    totalConsolidatedLoanReleaseAmount += los.consolidatedLoanReleaseAmount !== '-' ? parseFloat(los.consolidatedLoanReleaseAmount) || 0 : 0;
                    totalCollectionTargetDaily += los.collectionTargetDaily !== '-' ? parseFloat(los.collectionTargetDaily) || 0 : 0;
                    totalCollectionAdvancePaymentDaily += los.collectionAdvancePaymentDaily !== '-' ? parseFloat(los.collectionAdvancePaymentDaily) || 0 : 0;
                    totalCollectionActualDaily += los.collectionActualDaily !== '-' ? parseFloat(los.collectionActualDaily) || 0 : 0;
                    totalCollectionTargetWeekly += los.collectionTargetWeekly !== '-' ? parseFloat(los.collectionTargetWeekly) || 0 : 0;
                    totalCollectionAdvancePaymentWeekly += los.collectionAdvancePaymentWeekly !== '-' ? parseFloat(los.collectionAdvancePaymentWeekly) || 0 : 0;
                    totalCollectionActualWeekly += los.collectionActualWeekly !== '-' ? parseFloat(los.collectionActualWeekly) || 0 : 0;
                    totalConsolidatedCollection += los.consolidatedCollection !== '-' ? parseFloat(los.consolidatedCollection) || 0 : 0;
                    totalMispaymentPerson += los.mispaymentPerson !== '-' ? parseInt(los.mispaymentPerson) || 0 : 0;
                    
                    // Keep track of the last valid value for each field
                    if (los.activeClients && los.activeClients !== '-' && parseInt(los.activeClients) > 0) {
                        lastActiveClients = parseInt(los.activeClients);
                    }
        
                    if (los.pastDuePerson !== '-') {
                        lastPastDuePerson = parseInt(los.pastDuePerson) || 0;
                    }
        
                    if (los.pastDueAmount !== '-') {
                        lastPastDueAmount = parseFloat(los.pastDueAmount) || 0;
                    }
        
                    if (los.loanBalance && los.loanBalance !== '-' && parseFloat(los.loanBalance) > 0) {
                        lastLoanBalance = parseFloat(los.loanBalance);
                    }
        
                    if (los.mcbuBalance && los.mcbuBalance !== '-' && parseFloat(los.mcbuBalance) > 0) {
                        lastMcbuBalance = parseFloat(los.mcbuBalance);
                    }
        
                    if (los.activeLoanReleasePerson && los.activeLoanReleasePerson !== '-' && parseInt(los.activeLoanReleasePerson) > 0) {
                        lastActiveLoanReleasePerson = parseInt(los.activeLoanReleasePerson);
                    }
        
                    if (los.activeLoanReleaseAmount && los.activeLoanReleaseAmount !== '-' && parseFloat(los.activeLoanReleaseAmount) > 0) {
                        lastActiveLoanReleaseAmount = parseFloat(los.activeLoanReleaseAmount);
                    }

                    if (los.activeBorrowers && los.activeBorrowers !== '-' && parseInt(los.activeBorrowers) > 0) {
                        lastActiveBorrowers = parseInt(los.activeBorrowers);
                    }
        
                    totalFullPaymentDailyPerson += los.fullPaymentDailyPerson !== '-' ? parseInt(los.fullPaymentDailyPerson) || 0 : 0;
                    totalFullPaymentDailyAmount += los.fullPaymentDailyAmount !== '-' ? parseFloat(los.fullPaymentDailyAmount) || 0 : 0;
                    totalFullPaymentWeeklyPerson += los.fullPaymentWeeklyPerson !== '-' ? parseInt(los.fullPaymentWeeklyPerson) || 0 : 0;
                    totalFullPaymentWeeklyAmount += los.fullPaymentWeeklyAmount !== '-' ? parseFloat(los.fullPaymentWeeklyAmount) || 0 : 0;
                    totalConsolidatedFullPaymentPerson += los.consolidatedFullPaymentPerson !== '-' ? parseInt(los.consolidatedFullPaymentPerson) || 0 : 0;
                    totalConsolidatedFullPaymentAmount += los.consolidatedFullPaymentAmount !== '-' ? parseFloat(los.consolidatedFullPaymentAmount) || 0 : 0;
        
                    totalMcbuTarget += (los.mcbuTarget !== '-' && los.mcbuTarget) ? parseFloat(los.mcbuTarget) || 0 : 0;
                    totalMcbuActual += (los.mcbuActual !== '-' && los.mcbuActual) ? parseFloat(los.mcbuActual) || 0 : 0;
                    totalMcbuWithdrawal += (los.mcbuWithdrawal !== '-' && los.mcbuWithdrawal) ? parseFloat(los.mcbuWithdrawal) || 0 : 0;
                    totalMcbuInterest += (los.mcbuInterest !== '-' && los.mcbuInterest) ? parseFloat(los.mcbuInterest) || 0 : 0;
                    totalNoMcbuReturn += (los.noMcbuReturn !== '-' && los.noMcbuReturn) ? parseInt(los.noMcbuReturn) || 0 : 0;
                    totalMcbuReturnAmt += (los.mcbuReturnAmt !== '-' && los.mcbuReturnAmt) ? parseFloat(los.mcbuReturnAmt) || 0 : 0;
                });
        
                // Process transfer rows for this week
                const transferRows = losSlice.filter(los => los.flag === 'transfer');
                transferRows.forEach(trow => {
                    // Parse transfer number (might be in parentheses for negative)
                    let tTransfer = trow.transfer;
                    if (typeof tTransfer === "string" && tTransfer !== '-') {
                        if (tTransfer.includes('(')) {
                            tTransfer = -parseInt(tTransfer.replace(/[()]/g, '')) || 0;
                        } else {
                            tTransfer = parseInt(tTransfer) || 0;
                        }
                    } else if (tTransfer === '-') {
                        tTransfer = 0;
                    }
                    
                    totalTransfer += tTransfer;
                    
                    // Update values from transfer rows - only if they have valid data
                    if (trow.loanBalance && trow.loanBalance !== '-') {
                        if (typeof trow.loanBalance === 'string' && trow.loanBalance.includes('(')) {
                            lastLoanBalance = -parseFloat(trow.loanBalance.replace(/[₱,\s()]/g, ''));
                        } else if (typeof trow.loanBalance === 'string') {
                            lastLoanBalance = parseFloat(trow.loanBalance.replace(/[₱,\s]/g, '')) || 0;
                        } else {
                            lastLoanBalance = parseFloat(trow.loanBalance) || 0;
                        }
                    }
                    
                    // Only update client counts if there's an actual transfer
                    if (tTransfer !== 0) {
                        if (trow.activeClients && trow.activeClients !== '-') {
                            lastActiveClients = parseInt(trow.activeClients) || 0;
                        }
                        
                        if (trow.activeBorrowers && trow.activeBorrowers !== '-') {
                            lastActiveBorrowers = parseInt(trow.activeBorrowers) || 0;
                            totalActiveBorrowers = parseInt(trow.activeBorrowers) || 0;
                        }
                    }
                    
                    if (trow.pastDuePerson && trow.pastDuePerson !== '-') {
                        lastPastDuePerson = parseInt(trow.pastDuePerson) || 0;
                    }
                    
                    if (trow.pastDueAmount && trow.pastDueAmount !== '-') {
                        if (typeof trow.pastDueAmount === 'string' && trow.pastDueAmount.includes('(')) {
                            lastPastDueAmount = -parseFloat(trow.pastDueAmount.replace(/[₱,\s()]/g, ''));
                        } else if (typeof trow.pastDueAmount === 'string') {
                            lastPastDueAmount = parseFloat(trow.pastDueAmount.replace(/[₱,\s]/g, '')) || 0;
                        } else {
                            lastPastDueAmount = parseFloat(trow.pastDueAmount) || 0;
                        }
                    }
                    
                    // Add other transfer values to totals
                    totalLoanReleaseDailyAmount += trow.loanReleaseDailyAmount !== '-' ? parseFloat(trow.loanReleaseDailyAmount) || 0 : 0;
                    totalLoanReleaseWeeklyAmount += trow.loanReleaseWeeklyAmount !== '-' ? parseFloat(trow.loanReleaseWeeklyAmount) || 0 : 0;
                    totalConsolidatedLoanReleaseAmount += trow.consolidatedLoanReleaseAmount !== '-' ? parseFloat(trow.consolidatedLoanReleaseAmount) || 0 : 0;
                    totalCollectionActualDaily += trow.collectionActualDaily !== '-' ? parseFloat(trow.collectionActualDaily) || 0 : 0;
                    totalCollectionActualWeekly += trow.collectionActualWeekly !== '-' ? parseFloat(trow.collectionActualWeekly) || 0 : 0;
                    totalConsolidatedCollection += trow.consolidatedCollection !== '-' ? parseFloat(trow.consolidatedCollection) || 0 : 0;
                    
                    if (trow.mcbuBalance && trow.mcbuBalance !== '-') {
                        if (typeof trow.mcbuBalance === 'string' && trow.mcbuBalance.includes('(')) {
                            lastMcbuBalance = -parseFloat(trow.mcbuBalance.replace(/[₱,\s()]/g, ''));
                        } else if (typeof trow.mcbuBalance === 'string') {
                            lastMcbuBalance = parseFloat(trow.mcbuBalance.replace(/[₱,\s]/g, '')) || 0;
                        } else {
                            lastMcbuBalance = parseFloat(trow.mcbuBalance) || 0;
                        }
                    }
                    
                    // Only update loan release person counts if there's an actual transfer
                    if (tTransfer !== 0) {
                        if (trow.activeLoanReleasePerson && trow.activeLoanReleasePerson !== '-') {
                            lastActiveLoanReleasePerson = parseInt(trow.activeLoanReleasePerson) || 0;
                        }
                    }
                    
                    if (trow.activeLoanReleaseAmount && trow.activeLoanReleaseAmount !== '-') {
                        if (typeof trow.activeLoanReleaseAmount === 'string' && trow.activeLoanReleaseAmount.includes('(')) {
                            lastActiveLoanReleaseAmount = -parseFloat(trow.activeLoanReleaseAmount.replace(/[₱,\s()]/g, ''));
                        } else if (typeof trow.activeLoanReleaseAmount === 'string') {
                            lastActiveLoanReleaseAmount = parseFloat(trow.activeLoanReleaseAmount.replace(/[₱,\s]/g, '')) || 0;
                        } else {
                            lastActiveLoanReleaseAmount = parseFloat(trow.activeLoanReleaseAmount) || 0;
                        }
                    }
                });
    
                // Calculate active clients based on data
                if (w.weekNumber === 0) {
                    // For the first week, use the F/Balance as the starting point
                    totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                    totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
                    totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;
                    if (totalTransfer === 0) {
                        // If no transfers, use the last valid values
                        totalActiveBorrowers = lastActiveBorrowers > 0 ? lastActiveBorrowers : fBal.activeBorrowers;
                    }
                } else {
                    // For subsequent weeks, use the previous week's values
                    if (prevWeek && prevWeek.activeClients && prevWeek.activeClients !== 0) {
                        totalActiveClients = prevWeek.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
                        totalActiveLoanReleasePerson = prevWeek.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
                        totalActiveLoanReleaseAmount = prevWeek.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;
                        if (totalTransfer === 0) {
                            // If no transfers, maintain the previous week's active borrowers
                            totalActiveBorrowers = prevWeek.activeBorrowers;
                        }
                    } else {
                        // Fallback to using the last row's values
                        totalActiveClients = lastActiveClients;
                        totalActiveLoanReleasePerson = lastActiveLoanReleasePerson;
                        totalActiveLoanReleaseAmount = lastActiveLoanReleaseAmount;
                        totalActiveBorrowers = lastActiveBorrowers;
                    }
                }
    
                // If we have explicit values from the data, use them instead of calculated values
                if (lastActiveClients > 0) {
                    totalActiveClients = lastActiveClients;
                }
                
                // Use the most recent balances
                totalMcbuBalance = lastMcbuBalance;
                totalPastDuePerson = lastPastDuePerson;
                totalPastDueAmount = lastPastDueAmount;
                
                if (totalActiveBorrowers === 0) {
                    // Get last valid active borrowers count
                    const lastValidRow = losSlice[losSlice.length - 1];
                    totalActiveBorrowers = lastValidRow && lastValidRow.activeBorrowers && lastValidRow.activeBorrowers !== '-' ? 
                        parseInt(lastValidRow.activeBorrowers) : 0;
                }
                
                totalLoanBalance = lastLoanBalance;
    
                // Apply specific transfer row from month-end to the last week total
                if (wIndex === weekTotals.length - 1 && transferRow) {
                    // Parse transfer value
                    let tTransfer = transferRow.transfer;
                    if (typeof tTransfer === "string" && tTransfer !== '-') {
                        if (tTransfer.includes('(')) {
                            tTransfer = -parseInt(tTransfer.replace(/[()]/g, '')) || 0;
                        } else {
                            tTransfer = parseInt(tTransfer) || 0;
                        }
                    } else if (tTransfer === '-') {
                        tTransfer = 0;
                    }
                    
                    // Parse loan release daily person
                    let tDailyPerson = transferRow.loanReleaseDailyPerson;
                    if (typeof tDailyPerson === "string" && tDailyPerson !== '-') {
                        if (tDailyPerson.includes('(')) {
                            tDailyPerson = -parseInt(tDailyPerson.replace(/[()]/g, '')) || 0;
                        } else {
                            tDailyPerson = parseInt(tDailyPerson) || 0;
                        }
                    } else if (tDailyPerson === '-') {
                        tDailyPerson = 0;
                    }
                    
                    // Parse loan release weekly person
                    let tWeeklyPerson = transferRow.loanReleaseWeeklyPerson;
                    if (typeof tWeeklyPerson === "string" && tWeeklyPerson !== '-') {
                        if (tWeeklyPerson.includes('(')) {
                            tWeeklyPerson = -parseInt(tWeeklyPerson.replace(/[()]/g, '')) || 0;
                        } else {
                            tWeeklyPerson = parseInt(tWeeklyPerson) || 0;
                        }
                    } else if (tWeeklyPerson === '-') {
                        tWeeklyPerson = 0;
                    }
                    
                    // Parse consolidated person
                    let tConsolidatedPerson = transferRow.consolidatedLoanReleasePerson;
                    if (typeof tConsolidatedPerson === "string" && tConsolidatedPerson !== '-') {
                        if (tConsolidatedPerson.includes('(')) {
                            tConsolidatedPerson = -parseInt(tConsolidatedPerson.replace(/[()]/g, '')) || 0;
                        } else {
                            tConsolidatedPerson = parseInt(tConsolidatedPerson) || 0;
                        }
                    } else if (tConsolidatedPerson === '-') {
                        tConsolidatedPerson = 0;
                    }
    
                    // Add transfer values to totals
                    totalTransfer += tTransfer;
                    totalActiveClients += tTransfer;
                    totalMcbuTarget += transferRow.mcbuTarget ? parseFloat(transferRow.mcbuTarget) || 0 : 0;
                    totalMcbuActual += transferRow.mcbuActual ? parseFloat(transferRow.mcbuActual) || 0 : 0;
                    totalMcbuWithdrawal += transferRow.mcbuWithdrawal ? parseFloat(transferRow.mcbuWithdrawal) || 0 : 0;
                    totalMcbuInterest += transferRow.mcbuInterest ? parseFloat(transferRow.mcbuInterest) || 0 : 0;
                    totalNoMcbuReturn += transferRow.noMcbuReturn ? parseInt(transferRow.noMcbuReturn) || 0 : 0;
                    totalMcbuReturnAmt += transferRow.mcbuReturnAmt ? parseFloat(transferRow.mcbuReturnAmt) || 0 : 0;
                    
                    // Use transfer's mcbuBalance if available
                    if (transferRow.mcbuBalance > 0) {
                        totalMcbuBalance = parseFloat(transferRow.mcbuBalance);
                    }
                    
                    totalLoanReleaseDailyPerson += tDailyPerson;
                    totalLoanReleaseDailyAmount += transferRow.loanReleaseDailyAmount ? parseFloat(transferRow.loanReleaseDailyAmount) || 0 : 0;
                    totalLoanReleaseWeeklyPerson += tWeeklyPerson;
                    totalLoanReleaseWeeklyAmount += transferRow.loanReleaseWeeklyAmount ? parseFloat(transferRow.loanReleaseWeeklyAmount) || 0 : 0;
                    totalConsolidatedLoanReleasePerson += tConsolidatedPerson;
                    totalConsolidatedLoanReleaseAmount += transferRow.consolidatedLoanReleaseAmount ? parseFloat(transferRow.consolidatedLoanReleaseAmount) || 0 : 0;
                    
                    // Use transfer's active loan values if available
                    if (transferRow.activeLoanReleasePerson > 0) {
                        totalActiveLoanReleasePerson = parseInt(transferRow.activeLoanReleasePerson) || totalActiveLoanReleasePerson + tConsolidatedPerson;
                    }
                    
                    if (transferRow.activeLoanReleaseAmount > 0) {
                        totalActiveLoanReleaseAmount = parseFloat(transferRow.activeLoanReleaseAmount) || totalActiveLoanReleaseAmount + (transferRow.consolidatedLoanReleaseAmount ? parseFloat(transferRow.consolidatedLoanReleaseAmount) : 0);
                    }
                    
                    totalCollectionTargetDaily += transferRow.collectionTargetDaily ? parseFloat(transferRow.collectionTargetDaily) || 0 : 0;
                    totalCollectionActualDaily += transferRow.collectionActualDaily ? parseFloat(transferRow.collectionActualDaily) || 0 : 0;
                    totalCollectionTargetWeekly += transferRow.collectionTargetWeekly ? parseFloat(transferRow.collectionTargetWeekly) || 0 : 0;
                    totalCollectionActualWeekly += transferRow.collectionActualWeekly ? parseFloat(transferRow.collectionActualWeekly) || 0 : 0;
                    totalConsolidatedCollection += transferRow.consolidatedCollection ? parseFloat(transferRow.consolidatedCollection) || 0 : 0;
                    
                    if (transferRow.pastDuePerson && transferRow.pastDuePerson !== '-') {
                        totalPastDuePerson += parseInt(transferRow.pastDuePerson) || 0;
                    }
                    
                    if (transferRow.pastDueAmount && transferRow.pastDueAmount !== '-') {
                        totalPastDueAmount += parseFloat(transferRow.pastDueAmount) || 0;
                    }
                    
                    if (transferRow.activeBorrowers > 0) {
                        totalActiveBorrowers = parseInt(transferRow.activeBorrowers) || totalActiveBorrowers + tConsolidatedPerson;
                    }
                    
                    if (transferRow.loanBalance > 0) {
                        totalLoanBalance = parseFloat(transferRow.loanBalance);
                    }
                }
    
                // Format the transfer value for display
                const formattedTransfer = totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer;
    
                // Update the weekly total row with calculated values
                losList[index] = {
                    ...w,
                    transfer: formattedTransfer,
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
        
        // Process all transfers to add TOC Total rows where needed
        const updatedWithTransfers = processTransfers(losList);
        
        return updatedWithTransfers;
    }

    const processTransfers = (losList) => {
        // Identify days with actual transfers
        const daysWithTransfer = [];
        
        losList.forEach((item, index) => {
            let hasActualTransfer = false;
            
            // Check for transfers in all possible locations
            if (item.transferDailyGvr && Array.isArray(item.transferDailyGvr)) {
                for (const gvr of item.transferDailyGvr) {
                    if (gvr && 
                        typeof gvr === 'object' && 
                        ((gvr.transfer !== undefined && 
                          gvr.transfer !== 0 && 
                          gvr.transfer !== '0' && 
                          gvr.transfer !== '-') || 
                         (gvr.totalLoanBalance && gvr.totalLoanBalance > 0))) {
                        hasActualTransfer = true;
                        break;
                    }
                }
            }
            
            if (!hasActualTransfer && item.transferDailyRcv && Array.isArray(item.transferDailyRcv)) {
                for (const rcv of item.transferDailyRcv) {
                    if (rcv && 
                        typeof rcv === 'object' && 
                        ((rcv.transfer !== undefined && 
                          rcv.transfer !== 0 && 
                          rcv.transfer !== '0' && 
                          rcv.transfer !== '-') || 
                         (rcv.totalLoanBalance && rcv.totalLoanBalance > 0))) {
                        hasActualTransfer = true;
                        break;
                    }
                }
            }
            
            if (!hasActualTransfer && item.transferWeeklyGvr && Array.isArray(item.transferWeeklyGvr)) {
                for (const wgvr of item.transferWeeklyGvr) {
                    if (wgvr && 
                        typeof wgvr === 'object' && 
                        ((wgvr.transfer !== undefined && 
                          wgvr.transfer !== 0 && 
                          wgvr.transfer !== '0' && 
                          wgvr.transfer !== '-') || 
                         (wgvr.totalLoanBalance && wgvr.totalLoanBalance > 0))) {
                        hasActualTransfer = true;
                        break;
                    }
                }
            }
            
            if (!hasActualTransfer && item.transferWeeklyRcv && Array.isArray(item.transferWeeklyRcv)) {
                for (const wrcv of item.transferWeeklyRcv) {
                    if (wrcv && 
                        typeof wrcv === 'object' && 
                        ((wrcv.transfer !== undefined && 
                          wrcv.transfer !== 0 && 
                          wrcv.transfer !== '0' && 
                          wrcv.transfer !== '-') || 
                         (wrcv.totalLoanBalance && wrcv.totalLoanBalance > 0))) {
                        hasActualTransfer = true;
                        break;
                    }
                }
            }
            
            // Only add days with actual transfers
            if (hasActualTransfer && !item.weekTotal && !item.monthTotal && !item.grandTotal && !item.fBalance) {
                daysWithTransfer.push({
                    item,
                    index
                });
            }
        });
        
        // Create a new list with TOC Total rows inserted
        const result = [...losList];
        let offset = 0;
        
        daysWithTransfer.forEach(({ item, index }) => {
            const adjustedIndex = index + offset;
            const transferRow = processTransferDetails([item]);
            
            // Only proceed if we got a valid transfer row
            if (transferRow) {
                // Insert TOC Total row after this day
                result.splice(adjustedIndex + 1, 0, transferRow);
                offset++;
                
                // Parse and store the transfer values for propagation
                let transferLoanBalance = transferRow.loanBalance;
                let transferMcbuBalance = transferRow.mcbuBalance;
                let transferActiveClients = transferRow.activeClients;
                let transferActiveBorrowers = transferRow.activeBorrowers;
                
                // Parse the loan balance to ensure we have a numeric value
                if (typeof transferRow.loanBalance === 'string') {
                    if (transferRow.loanBalance.includes('(')) {
                        transferLoanBalance = -parseFloat(transferRow.loanBalance.replace(/[₱,\\s()]/g, ''));
                    } else {
                        transferLoanBalance = parseFloat(transferRow.loanBalance.replace(/[₱,\\s]/g, ''));
                    }
                } else {
                    transferLoanBalance = parseFloat(transferRow.loanBalance);
                }
                
                // Parse the MCBU balance
                if (typeof transferRow.mcbuBalance === 'string') {
                    if (transferRow.mcbuBalance.includes('(')) {
                        transferMcbuBalance = -parseFloat(transferRow.mcbuBalance.replace(/[₱,\\s()]/g, ''));
                    } else {
                        transferMcbuBalance = parseFloat(transferRow.mcbuBalance.replace(/[₱,\\s]/g, ''));
                    }
                } else {
                    transferMcbuBalance = parseFloat(transferRow.mcbuBalance);
                }
                
                // Parse activeClients value
                if (typeof transferRow.activeClients === 'string') {
                    transferActiveClients = parseInt(transferRow.activeClients.replace(/[,\\s]/g, ''));
                } else if (typeof transferRow.activeClients === 'number') {
                    transferActiveClients = transferRow.activeClients;
                }
                
                // Parse activeBorrowers value
                if (typeof transferRow.activeBorrowers === 'string') {
                    transferActiveBorrowers = parseInt(transferRow.activeBorrowers.replace(/[,\\s]/g, ''));
                } else if (typeof transferRow.activeBorrowers === 'number') {
                    transferActiveBorrowers = transferRow.activeBorrowers;
                }
                
                // Check if there's an actual transfer (non-zero value)
                let actualTransferAmount = 0;
                if (typeof transferRow.transfer === 'string' && transferRow.transfer !== '-') {
                    if (transferRow.transfer.includes('(')) {
                        actualTransferAmount = -parseInt(transferRow.transfer.replace(/[()]/g, ''));
                    } else {
                        actualTransferAmount = parseInt(transferRow.transfer);
                    }
                } else if (typeof transferRow.transfer === 'number') {
                    actualTransferAmount = transferRow.transfer;
                }
                
                // 1. First, update all subsequent regular rows
                for (let i = adjustedIndex + 2; i < result.length; i++) {
                    const nextItem = result[i];
                    
                    // Stop at month totals, grand totals, or other special rows
                    if (nextItem.monthTotal || nextItem.grandTotal || nextItem.fBalance) {
                        break;
                    }
                    
                    // For transfer rows, skip
                    if (nextItem.flag === 'transfer') {
                        continue;
                    }
                    
                    // For weekly totals, handle separately
                    if (nextItem.weekTotal) {
                        continue;
                    }
                    
                    // Update regular days with the transferred values
                    if (actualTransferAmount !== 0) {
                        // If there's an actual transfer, update all values including client counts
                        result[i] = {
                            ...result[i],
                            loanBalance: transferLoanBalance,
                            loanBalanceStr: formatPricePhp(transferLoanBalance),
                            mcbuBalance: transferMcbuBalance,
                            mcbuBalanceStr: formatPricePhp(transferMcbuBalance),
                            activeClients: transferActiveClients,
                            activeBorrowers: transferActiveBorrowers
                        };
                    } else {
                        // If no actual transfer, only update financial values, not client counts
                        result[i] = {
                            ...result[i],
                            loanBalance: transferLoanBalance,
                            loanBalanceStr: formatPricePhp(transferLoanBalance),
                            mcbuBalance: transferMcbuBalance,
                            mcbuBalanceStr: formatPricePhp(transferMcbuBalance)
                            // Don't update activeClients and activeBorrowers when no actual transfer
                        };
                    }
                }
                
                // 2. Now handle ALL weekly totals
                // Find all remaining weekly totals after this transfer
                for (let i = adjustedIndex + 1; i < result.length; i++) {
                    if (result[i].weekTotal) {
                        if (actualTransferAmount !== 0) {
                            // Only update client counts if there's an actual transfer
                            result[i] = {
                                ...result[i], 
                                mcbuBalance: transferMcbuBalance,
                                mcbuBalanceStr: formatPricePhp(transferMcbuBalance),
                                loanBalance: transferLoanBalance,
                                loanBalanceStr: formatPricePhp(transferLoanBalance),
                                activeClients: transferActiveClients,
                                activeBorrowers: transferActiveBorrowers
                            };
                        } else {
                            // If no actual transfer, only update financial values
                            result[i] = {
                                ...result[i], 
                                mcbuBalance: transferMcbuBalance,
                                mcbuBalanceStr: formatPricePhp(transferMcbuBalance),
                                loanBalance: transferLoanBalance,
                                loanBalanceStr: formatPricePhp(transferLoanBalance)
                                // Don't update activeClients and activeBorrowers when no actual transfer
                            };
                        }
                        
                        // If we reach the next month or grand total, stop
                        if (i+1 < result.length && (result[i+1].monthTotal || result[i+1].grandTotal)) {
                            break;
                        }
                    }
                }
                
                // Update the lastMcbuBalance values that are used in the calculateWeeklyTotals function
                // This is important for the next week's total calculation
                for (let i = 0; i < result.length; i++) {
                    if (result[i].weekTotal && result[i].lastMcbuBalance !== undefined) {
                        result[i].lastMcbuBalance = transferMcbuBalance;
                    }
                }
            }
        });
        
        return result;
    };
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
    
        // Use the current values from the row being processed as starting values
        let currentRow = losList[0];
        let mcbuBalance = currentRow.mcbuBalance !== '-' && !isNaN(parseFloat(currentRow.mcbuBalance)) 
            ? parseFloat(currentRow.mcbuBalance) 
            : 0;
        let activeClients = currentRow.activeClients !== '-' ? parseInt(currentRow.activeClients) || 0 : 0;
        let activeBorrowers = currentRow.activeBorrowers !== '-' ? parseInt(currentRow.activeBorrowers) || 0 : 0;
        let activeLoanReleasePerson = currentRow.activeLoanReleasePerson !== '-' ? parseInt(currentRow.activeLoanReleasePerson) || 0 : 0;
        let activeLoanReleaseAmount = currentRow.activeLoanReleaseAmount !== '-' ? parseFloat(currentRow.activeLoanReleaseAmount) || 0 : 0;
        let loanBalance = currentRow.loanBalance !== '-' ? parseFloat(currentRow.loanBalance) || 0 : 0;
        let hasValidTransfer = false;
    
        losList.filter(los => los.day != 'Weekly Total').map((los, index) => {
            let temp = {...los};
            let transferDailyGvr = [];
            let transferDailyRcv = [];
            let transferWeeklyGvr = [];
            let transferWeeklyRcv = [];
    
            // Process transferDailyGvr entries
            if (temp.transferDailyGvr && Array.isArray(temp.transferDailyGvr)) {
                temp.transferDailyGvr.forEach(dailyGvr => {
                    if (dailyGvr && typeof dailyGvr === 'object') {
                        const data = {...dailyGvr};
                        
                        // Check if this is an actual transfer - either by transfer value or loan balance
                        if ((data.transfer !== undefined && 
                            data.transfer !== 0 && 
                            data.transfer !== '0' && 
                            data.transfer !== '-') || 
                            (data.totalLoanBalance && data.totalLoanBalance > 0)) {
                            
                            hasValidTransfer = true;
                            
                            let noTransfer = data.transfer;
                            if (typeof noTransfer === "string") {
                                noTransfer = noTransfer.replace('(','').replace(')','');
                                noTransfer = -Math.abs(parseInt(noTransfer) || 0);
                            } else if (typeof noTransfer === "number") {
                                noTransfer = -Math.abs(noTransfer);
                            } else {
                                noTransfer = 0;
                            }
    
                            const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? -Math.abs(data.mcbuTarget) : 0 : 0;
                            const mcbuActual = data.mcbuCol !== '-' ? -Math.abs(data.mcbuCol || 0) : 0;
                            const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? -Math.abs(data.mcbuWithdrawal) : 0;
                            const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? -Math.abs(data.mcbuInterest) : 0;
                            const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? -Math.abs(data.noMcbuReturn) : 0;
                            const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? -Math.abs(data.mcbuReturnAmt) : 0;
                            const excess = data.excess !== '-' ? data.excess > 0 ? -Math.abs(data.excess) : 0 : 0;
    
                            transferDailyGvr.push({
                                transfer: noTransfer,
                                mcbuTarget: mcbuTarget,
                                mcbuActual: mcbuActual,
                                mcbuWithdrawal: mcbuWithdrawal,
                                mcbuInterest: mcbuInterest,
                                noMcbuReturn: noMcbuReturn,
                                mcbuReturnAmt: mcbuReturnAmt,
                                mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                                currentReleaseAmount: data.currentReleaseAmount || 0,
                                loanReleaseAmount: data.totalLoanRelease ? -Math.abs(data.totalLoanRelease) : 0,
                                collectionTarget: data.targetLoanCollection ? -Math.abs(data.targetLoanCollection + (excess || 0)) : 0,
                                collectionActual: data.collection ? -Math.abs(data.collection) : 0,
                                pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                                pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                            });
        
        // IMPORTANT: Return a TOC row if there's any valid transfer, even if totals are zero
        if (!hasValidTransfer && totalTransfer === 0 && totalMcbuActual === 0 && 
            totalDailyLoanRelease === 0 && totalWeeklyLoanRelease === 0 && loanBalance === 0) {
            return null;
        }
    
        // Create and return the TOC row with all the updated values
        return {
            day: 'TOC Total',
            transfer: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
            newMember: '-',
            mcbuTarget: 0,
            mcbuTargetStr: '-',
            mcbuActual: totalMcbuActual,
            mcbuActualStr: totalMcbuActual ? (totalMcbuActual < 0 ? `(${formatPricePhp(Math.abs(totalMcbuActual))})` : formatPricePhp(totalMcbuActual)) : '-',
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: totalMcbuWithdrawal ? (totalMcbuWithdrawal < 0 ? `(${formatPricePhp(Math.abs(totalMcbuWithdrawal))})` : formatPricePhp(totalMcbuWithdrawal)) : '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest ? (totalMcbuInterest < 0 ? `(${formatPricePhp(Math.abs(totalMcbuInterest))})` : formatPricePhp(totalMcbuInterest)) : '-',
            noMcbuReturn: totalMcbuNoReturn,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: totalMcbuReturnAmt ? (totalMcbuReturnAmt < 0 ? `(${formatPricePhp(Math.abs(totalMcbuReturnAmt))})` : formatPricePhp(totalMcbuReturnAmt)) : '-',
            mcbuBalance: mcbuBalance,
            mcbuBalanceStr: mcbuBalance ? (mcbuBalance < 0 ? `(${formatPricePhp(Math.abs(mcbuBalance))})` : formatPricePhp(mcbuBalance)) : '-',
            offsetPerson: '-',
            activeClients: activeClients,
            loanReleaseDailyPerson: totalDailyNoLoanRelease ? (totalDailyNoLoanRelease < 0 ? `(${Math.abs(totalDailyNoLoanRelease)})` : totalDailyNoLoanRelease) : '-',
            loanReleaseDailyAmount: totalDailyLoanRelease,
            loanReleaseDailyAmountStr: totalDailyLoanRelease ? (totalDailyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalDailyLoanRelease))})` : formatPricePhp(totalDailyLoanRelease)) : '-',
            loanReleaseWeeklyPerson: totalWeeklyNoLoanRelease ? (totalWeeklyNoLoanRelease < 0 ? `(${Math.abs(totalWeeklyNoLoanRelease)})` : totalWeeklyNoLoanRelease) : '-',
            loanReleaseWeeklyAmount: totalWeeklyLoanRelease,
            loanReleaseWeeklyAmountStr: totalWeeklyLoanRelease ? (totalWeeklyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyLoanRelease))})` : formatPricePhp(totalWeeklyLoanRelease)) : '-',
            consolidatedLoanReleasePerson: totalConsolidatedNoLoanRelease ? (totalConsolidatedNoLoanRelease < 0 ? `(${Math.abs(totalConsolidatedNoLoanRelease)})` : totalConsolidatedNoLoanRelease) : '-',
            consolidatedLoanReleaseAmount: totalConsolidatedLoanRelease,
            consolidatedLoanReleaseAmountStr: totalConsolidatedLoanRelease ? (totalConsolidatedLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedLoanRelease))})` : formatPricePhp(totalConsolidatedLoanRelease)) : '-',
            activeLoanReleasePerson: activeLoanReleasePerson,
            activeLoanReleaseAmount: activeLoanReleaseAmount,
            activeLoanReleaseAmountStr: activeLoanReleaseAmount ? (activeLoanReleaseAmount < 0 ? `(${formatPricePhp(Math.abs(activeLoanReleaseAmount))})` : formatPricePhp(activeLoanReleaseAmount)) : '-',
            collectionTargetDaily: totalDailyTargetCollection,
            collectionTargetDailyStr: totalDailyTargetCollection ? (totalDailyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyTargetCollection))})` : formatPricePhp(totalDailyTargetCollection)) : '-',
            collectionAdvancePaymentDaily: 0,
            collectionAdvancePaymentDailyStr: '-',
            collectionActualDaily: totalDailyActualCollection,
            collectionActualDailyStr: totalDailyActualCollection ? (totalDailyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyActualCollection))})` : formatPricePhp(totalDailyActualCollection)) : '-',
            collectionTargetWeekly: totalWeeklyTargetCollection,
            collectionTargetWeeklyStr: totalWeeklyTargetCollection ? (totalWeeklyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyTargetCollection))})` : formatPricePhp(totalWeeklyTargetCollection)) : '-',
            collectionAdvancePaymentWeekly: 0,
            collectionAdvancePaymentWeeklyStr: '-',
            collectionActualWeekly: totalWeeklyActualCollection,
            collectionActualWeeklyStr: totalWeeklyActualCollection ? (totalWeeklyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyActualCollection))})` : formatPricePhp(totalWeeklyActualCollection)) : '-',
            consolidatedCollection: totalConsolidatedActualCollection,
            consolidatedCollectionStr: totalConsolidatedActualCollection ? (totalConsolidatedActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedActualCollection))})` : formatPricePhp(totalConsolidatedActualCollection)) : '-',
            fullPaymentDailyPerson: '-',
            fullPaymentDailyAmount: 0,
            fullPaymentDailyAmountStr: '-',
            fullPaymentWeeklyPerson: '-',
            fullPaymentWeeklyAmount: 0,
            fullPaymentWeeklyAmountStr: '-',
            consolidatedFullPaymentPerson: '-',
            consolidatedFullPaymentAmount: 0,
            consolidatedFullPaymentAmountStr: '-',
            pastDuePerson: totalNoPastDue || '-',
            pastDueAmount: totalPastDue,
            pastDueAmountStr: totalPastDue ? (totalPastDue < 0 ? `(${formatPricePhp(Math.abs(totalPastDue))})` : formatPricePhp(totalPastDue)) : '-',
            mispaymentPerson: '-',
            activeBorrowers: activeBorrowers,
            loanBalance: loanBalance,
            loanBalanceStr: loanBalance ? (loanBalance < 0 ? `(${formatPricePhp(Math.abs(loanBalance))})` : formatPricePhp(loanBalance)) : '-',
            flag: 'transfer'
        };;
    
                            // Update active clients and borrowers
                            if (noTransfer !== 0) {
                                activeClients += noTransfer;
                                activeBorrowers += noTransfer;
                                activeLoanReleasePerson += noTransfer;
                            }
                            
                            // Update loan releases and balances
                            if (data.totalLoanRelease) {
                                activeLoanReleaseAmount -= Math.abs(data.totalLoanRelease || 0);
                            }
                            
                            if (data.currentReleaseAmount) {
                                activeLoanReleaseAmount += data.currentReleaseAmount;
                            }
                            
                            // Update loan balance
                            if (data.totalLoanRelease || data.collection || data.currentReleaseAmount) {
                                const totalRelease = data.totalLoanRelease || 0;
                                const collection = data.collection || 0;
                                const currentRelease = data.currentReleaseAmount || 0;
                                
                                loanBalance = loanBalance - (totalRelease - collection) + currentRelease;
                            }
                        }
                    }
                });
            }
    
            // Process transferDailyRcv entries
            if (temp.transferDailyRcv && Array.isArray(temp.transferDailyRcv)) {
                temp.transferDailyRcv.forEach(dailyRcv => {
                    if (dailyRcv && typeof dailyRcv === 'object') {
                        const data = {...dailyRcv};
                        
                        // Check if this is an actual transfer - either by transfer value or loan balance
                        if ((data.transfer !== undefined && 
                             data.transfer !== 0 && 
                             data.transfer !== '0' && 
                             data.transfer !== '-') || 
                            (data.totalLoanBalance && data.totalLoanBalance > 0)) {
                            
                            hasValidTransfer = true;
                            
                            let noTransfer = data.transfer;
                            if (typeof noTransfer === "string") {
                                noTransfer = noTransfer.replace('(','').replace(')','');
                                noTransfer = parseInt(noTransfer) || 0;
                            } else if (typeof noTransfer !== "number") {
                                noTransfer = 0;
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
                                mcbuActual: mcbuActual,
                                mcbuWithdrawal: mcbuWithdrawal,
                                mcbuInterest: mcbuInterest,
                                noMcbuReturn: noMcbuReturn,
                                mcbuReturnAmt: mcbuReturnAmt,
                                mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                                currentReleaseAmount: data.currentReleaseAmount || 0,
                                loanReleaseAmount: data.totalLoanRelease || 0,
                                collectionTarget: (data.targetLoanCollection || 0) + (excess || 0),
                                collectionActual: data.collection || 0,
                                pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                                pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? data?.pastDue : 0,
                            });
    
                            // Update active clients and borrowers
                            if (noTransfer !== 0) {
                                activeClients = activeClients + noTransfer - pendingClients;
                                activeBorrowers = activeBorrowers + noTransfer - tdaClients;
                                activeLoanReleasePerson = activeLoanReleasePerson + noTransfer - tdaClients;
                            }
                            
                            // Update loan balance and releases
                            if (data.totalLoanRelease) {
                                activeLoanReleaseAmount += data.totalLoanRelease;
                            }
                            
                            if (data.currentReleaseAmount) {
                                activeLoanReleaseAmount += data.currentReleaseAmount;
                            }
                            
                            // Update loan balance
                            if (data.totalLoanRelease || data.collection || data.currentReleaseAmount) {
                                const totalRelease = data.totalLoanRelease || 0;
                                const collection = data.collection || 0; 
                                const currentRelease = data.currentReleaseAmount || 0;
                                
                                loanBalance = loanBalance + (totalRelease - collection) + currentRelease;
                            }
                        }
                    }
                });
            }
    
            // Process transferWeeklyGvr entries (similar to daily)
            if (temp.transferWeeklyGvr && Array.isArray(temp.transferWeeklyGvr)) {
                temp.transferWeeklyGvr.forEach(weeklyGvr => {
                    if (weeklyGvr && typeof weeklyGvr === 'object') {
                        const data = {...weeklyGvr};
                        
                        // Check if this is an actual transfer
                        if ((data.transfer !== undefined && 
                            data.transfer !== 0 && 
                            data.transfer !== '0' && 
                            data.transfer !== '-') || 
                            (data.totalLoanBalance && data.totalLoanBalance > 0)) {
                            
                            hasValidTransfer = true;
                            
                            let noTransfer = data.transfer;
                            if (typeof noTransfer === "string") {
                                noTransfer = noTransfer.replace('(','').replace(')','');
                                noTransfer = -Math.abs(parseInt(noTransfer) || 0);
                            } else if (typeof noTransfer === "number") {
                                noTransfer = -Math.abs(noTransfer);
                            } else {
                                noTransfer = 0;
                            }
    
                            const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? -Math.abs(data.mcbuTarget) : 0 : 0;
                            const mcbuActual = data.mcbuCol !== '-' ? -Math.abs(data.mcbuCol || 0) : 0;
                            const mcbuWithdrawal = (data.mcbuWithdrawal && data.mcbuWithdrawal !== '-') ? -Math.abs(data.mcbuWithdrawal) : 0;
                            const mcbuInterest = (data.mcbuInterest && data.mcbuInterest !== '-') ? -Math.abs(data.mcbuInterest) : 0;
                            const noMcbuReturn = (data.noMcbuReturn && data.noMcbuReturn !== '-') ? -Math.abs(data.noMcbuReturn) : 0;
                            const mcbuReturnAmt = (data.mcbuReturnAmt && data.mcbuReturnAmt !== '-') ? -Math.abs(data.mcbuReturnAmt) : 0;
                            const excess = data.excess !== '-' ? data.excess > 0 ? -Math.abs(data.excess) : 0 : 0;
    
                            transferWeeklyGvr.push({
                                transfer: noTransfer,
                                mcbuTarget: mcbuTarget,
                                mcbuActual: mcbuActual,
                                mcbuWithdrawal: mcbuWithdrawal,
                                mcbuInterest: mcbuInterest,
                                noMcbuReturn: noMcbuReturn,
                                mcbuReturnAmt: mcbuReturnAmt,
                                mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                                currentReleaseAmount: data.currentReleaseAmount || 0,
                                loanReleaseAmount: data.totalLoanRelease ? -Math.abs(data.totalLoanRelease) : 0,
                                collectionTarget: data.targetLoanCollection ? -Math.abs(data.targetLoanCollection + (excess || 0)) : 0,
                                collectionActual: data.collection ? -Math.abs(data.collection) : 0,
                                pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                                pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                            });
    
                            // Update values
                            if (noTransfer !== 0) {
                                activeClients += noTransfer;
                                activeBorrowers += noTransfer;
                                activeLoanReleasePerson += noTransfer;
                            }
                            
                            if (data.totalLoanRelease) {
                                activeLoanReleaseAmount -= Math.abs(data.totalLoanRelease || 0);
                            }
                            
                            if (data.currentReleaseAmount) {
                                activeLoanReleaseAmount += data.currentReleaseAmount;
                            }
                            
                            if (data.totalLoanRelease || data.collection || data.currentReleaseAmount) {
                                const totalRelease = data.totalLoanRelease || 0;
                                const collection = data.collection || 0;
                                const currentRelease = data.currentReleaseAmount || 0;
                                
                                loanBalance = loanBalance - (totalRelease - collection) + currentRelease;
                            }
                        }
                    }
                });
            }
    
            // Process transferWeeklyRcv entries
            if (temp.transferWeeklyRcv && Array.isArray(temp.transferWeeklyRcv)) {
                temp.transferWeeklyRcv.forEach(weeklyRcv => {
                    if (weeklyRcv && typeof weeklyRcv === 'object') {
                        const data = {...weeklyRcv};
                        
                        if ((data.transfer !== undefined && 
                             data.transfer !== 0 && 
                             data.transfer !== '0' && 
                             data.transfer !== '-') || 
                            (data.totalLoanBalance && data.totalLoanBalance > 0)) {
                            
                            hasValidTransfer = true;
                            
                            let noTransfer = data.transfer;
                            if (typeof noTransfer === "string") {
                                noTransfer = noTransfer.replace('(','').replace(')','');
                                noTransfer = parseInt(noTransfer) || 0;
                            } else if (typeof noTransfer !== "number") {
                                noTransfer = 0;
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
                            
                            transferWeeklyRcv.push({
                                transfer: noTransfer,
                                mcbuTarget: mcbuTarget,
                                mcbuActual: mcbuActual,
                                mcbuWithdrawal: mcbuWithdrawal,
                                mcbuInterest: mcbuInterest,
                                noMcbuReturn: noMcbuReturn,
                                mcbuReturnAmt: mcbuReturnAmt,
                                mcbuBalance: mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt,
                                currentReleaseAmount: data.currentReleaseAmount || 0,
                                loanReleaseAmount: data.totalLoanRelease || 0,
                                collectionTarget: (data.targetLoanCollection || 0) + (excess || 0),
                                collectionActual: data.collection || 0,
                                pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                                pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? data?.pastDue : 0,
                            });
    
                            // Update values
                            if (noTransfer !== 0) {
                                activeClients = activeClients + noTransfer - pendingClients;
                                activeBorrowers = activeBorrowers + noTransfer - tdaClients;
                                activeLoanReleasePerson = activeLoanReleasePerson + noTransfer - tdaClients;
                            }
                            
                            if (data.totalLoanRelease) {
                                activeLoanReleaseAmount += data.totalLoanRelease;
                            }
                            
                            if (data.currentReleaseAmount) {
                                activeLoanReleaseAmount += data.currentReleaseAmount;
                            }
                            
                            if (data.totalLoanRelease || data.collection || data.currentReleaseAmount) {
                                const totalRelease = data.totalLoanRelease || 0;
                                const collection = data.collection || 0; 
                                const currentRelease = data.currentReleaseAmount || 0;
                                
                                loanBalance = loanBalance + (totalRelease - collection) + currentRelease;
                            }
                        }
                    }
                });
            }
    
            // Calculate totals for all transfers
            if (transferDailyGvr.length > 0 || transferDailyRcv.length > 0 || transferWeeklyGvr.length > 0 || transferWeeklyRcv.length > 0) {
                // Process Daily GVR totals
                transferDailyGvr.forEach(dGvr => {
                    totalTransfer += dGvr.transfer || 0;
                    totalMcbuTarget += dGvr.mcbuTarget || 0;
                    totalMcbuActual += dGvr.mcbuActual || 0;
                    totalMcbuWithdrawal += dGvr.mcbuWithdrawal || 0;
                    totalMcbuInterest += dGvr.mcbuInterest || 0;
                    totalMcbuNoReturn += dGvr.noMcbuReturn || 0;
                    totalMcbuReturnAmt += dGvr.mcbuReturnAmt || 0;
                    totalMcbuBalance += dGvr.mcbuBalance || 0;
                    totalDailyNoLoanRelease += dGvr.transfer || 0;
                    totalDailyLoanRelease += (dGvr.loanReleaseAmount || 0) + (dGvr.currentReleaseAmount || 0);
                    totalDailyTargetCollection += dGvr.collectionTarget || 0;
                    totalDailyActualCollection += dGvr.collectionActual || 0;
                    totalPastDue += dGvr.pastDueAmount > 0 ? dGvr.pastDueAmount : 0;
                    totalNoPastDue += dGvr.pastDuePerson > 0 ? dGvr.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += dGvr.excess || 0;
                });
                
                // Process Daily RCV totals
                transferDailyRcv.forEach(dRcv => {
                    totalTransfer += dRcv.transfer || 0;
                    totalMcbuTarget += dRcv.mcbuTarget || 0;
                    totalMcbuActual += dRcv.mcbuActual || 0;
                    totalMcbuWithdrawal += dRcv.mcbuWithdrawal || 0;
                    totalMcbuInterest += dRcv.mcbuInterest || 0;
                    totalMcbuNoReturn += dRcv.noMcbuReturn || 0;
                    totalMcbuReturnAmt += dRcv.mcbuReturnAmt || 0;
                    totalMcbuBalance += dRcv.mcbuBalance || 0;
                    totalDailyNoLoanRelease += dRcv.transfer || 0;
                    totalDailyLoanRelease += (dRcv.loanReleaseAmount || 0) + (dRcv.currentReleaseAmount || 0);
                    totalDailyTargetCollection += dRcv.collectionTarget || 0;
                    totalDailyActualCollection += dRcv.collectionActual || 0;
                    totalPastDue += dRcv.pastDueAmount > 0 ? dRcv.pastDueAmount : 0;
                    totalNoPastDue += dRcv.pastDuePerson > 0 ? dRcv.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += dRcv.excess || 0;
                });
                
                transferWeeklyGvr.forEach(wGvr => {
                    totalTransfer += wGvr.transfer || 0;
                    totalMcbuTarget += wGvr.mcbuTarget || 0;
                    totalMcbuActual += wGvr.mcbuActual || 0;
                    totalMcbuWithdrawal += wGvr.mcbuWithdrawal || 0;
                    totalMcbuInterest += wGvr.mcbuInterest || 0;
                    totalMcbuNoReturn += wGvr.noMcbuReturn || 0;
                    totalMcbuReturnAmt += wGvr.mcbuReturnAmt || 0;
                    totalMcbuBalance += wGvr.mcbuBalance || 0;
                    totalDailyNoLoanRelease += wGvr.transfer || 0;
                    totalDailyLoanRelease += (wGvr.loanReleaseAmount || 0) + (wGvr.currentReleaseAmount || 0);
                    totalDailyTargetCollection += wGvr.collectionTarget || 0;
                    totalDailyActualCollection += wGvr.collectionActual || 0;
                    totalPastDue += wGvr.pastDueAmount > 0 ? wGvr.pastDueAmount : 0;
                    totalNoPastDue += wGvr.pastDuePerson > 0 ? wGvr.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += wGvr.excess || 0;
                });
                
                transferWeeklyRcv.forEach(wRcv => {
                    totalTransfer += wRcv.transfer || 0;
                    totalMcbuTarget += wRcv.mcbuTarget || 0;
                    totalMcbuActual += wRcv.mcbuActual || 0;
                    totalMcbuWithdrawal += wRcv.mcbuWithdrawal || 0;
                    totalMcbuInterest += wRcv.mcbuInterest || 0;
                    totalMcbuNoReturn += wRcv.noMcbuReturn || 0;
                    totalMcbuReturnAmt += wRcv.mcbuReturnAmt || 0;
                    totalMcbuBalance += wRcv.mcbuBalance || 0;
                    totalDailyNoLoanRelease += wRcv.transfer || 0;
                    totalDailyLoanRelease += (wRcv.loanReleaseAmount || 0) + (wRcv.currentReleaseAmount || 0);
                    totalDailyTargetCollection += wRcv.collectionTarget || 0;
                    totalDailyActualCollection += wRcv.collectionActual || 0;
                    totalPastDue += wRcv.pastDueAmount > 0 ? wRcv.pastDueAmount : 0;
                    totalNoPastDue += wRcv.pastDuePerson > 0 ? wRcv.pastDuePerson : 0;
                    totalDailyCollectionAdvancePayment += wRcv.excess || 0;
                });
                
                // Update MCBU balance if needed
                if (totalMcbuBalance !== 0) {
                    mcbuBalance += totalMcbuBalance;
                }
    
                totalConsolidatedActualCollection = totalDailyActualCollection + totalWeeklyActualCollection;
                totalConsolidatedNoLoanRelease = totalDailyNoLoanRelease + totalWeeklyNoLoanRelease;
                totalConsolidatedLoanRelease = totalDailyLoanRelease + totalWeeklyLoanRelease;
            }
        });
    
        // IMPORTANT: Return a TOC row if there's any valid transfer, even if totals are zero
        if (!hasValidTransfer && totalTransfer === 0 && totalMcbuActual === 0 && 
            totalDailyLoanRelease === 0 && totalWeeklyLoanRelease === 0 && loanBalance === 0) {
            return null;
        }
    
        // Create and return the TOC row
        return {
            day: 'TOC Total',
            transfer: totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer,
            newMember: '-',
            mcbuTarget: 0,
            mcbuTargetStr: '-',
            mcbuActual: totalMcbuActual,
            mcbuActualStr: totalMcbuActual ? (totalMcbuActual < 0 ? `(${formatPricePhp(Math.abs(totalMcbuActual))})` : formatPricePhp(totalMcbuActual)) : '-',
            mcbuWithdrawal: totalMcbuWithdrawal,
            mcbuWithdrawalStr: totalMcbuWithdrawal ? (totalMcbuWithdrawal < 0 ? `(${formatPricePhp(Math.abs(totalMcbuWithdrawal))})` : formatPricePhp(totalMcbuWithdrawal)) : '-',
            mcbuInterest: totalMcbuInterest,
            mcbuInterestStr: totalMcbuInterest ? (totalMcbuInterest < 0 ? `(${formatPricePhp(Math.abs(totalMcbuInterest))})` : formatPricePhp(totalMcbuInterest)) : '-',
            noMcbuReturn: totalMcbuNoReturn,
            mcbuReturnAmt: totalMcbuReturnAmt,
            mcbuReturnAmtStr: totalMcbuReturnAmt ? (totalMcbuReturnAmt < 0 ? `(${formatPricePhp(Math.abs(totalMcbuReturnAmt))})` : formatPricePhp(totalMcbuReturnAmt)) : '-',
            mcbuBalance: mcbuBalance,
            mcbuBalanceStr: mcbuBalance ? (mcbuBalance < 0 ? `(${formatPricePhp(Math.abs(mcbuBalance))})` : formatPricePhp(mcbuBalance)) : '-',
            offsetPerson: '-',
            activeClients: activeClients,
            loanReleaseDailyPerson: totalDailyNoLoanRelease ? (totalDailyNoLoanRelease < 0 ? `(${Math.abs(totalDailyNoLoanRelease)})` : totalDailyNoLoanRelease) : '-',
            loanReleaseDailyAmount: totalDailyLoanRelease,
            loanReleaseDailyAmountStr: totalDailyLoanRelease ? (totalDailyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalDailyLoanRelease))})` : formatPricePhp(totalDailyLoanRelease)) : '-',
            loanReleaseWeeklyPerson: totalWeeklyNoLoanRelease ? (totalWeeklyNoLoanRelease < 0 ? `(${Math.abs(totalWeeklyNoLoanRelease)})` : totalWeeklyNoLoanRelease) : '-',
            loanReleaseWeeklyAmount: totalWeeklyLoanRelease,
            loanReleaseWeeklyAmountStr: totalWeeklyLoanRelease ? (totalWeeklyLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyLoanRelease))})` : formatPricePhp(totalWeeklyLoanRelease)) : '-',
            consolidatedLoanReleasePerson: totalConsolidatedNoLoanRelease ? (totalConsolidatedNoLoanRelease < 0 ? `(${Math.abs(totalConsolidatedNoLoanRelease)})` : totalConsolidatedNoLoanRelease) : '-',
            consolidatedLoanReleaseAmount: totalConsolidatedLoanRelease,
            consolidatedLoanReleaseAmountStr: totalConsolidatedLoanRelease ? (totalConsolidatedLoanRelease < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedLoanRelease))})` : formatPricePhp(totalConsolidatedLoanRelease)) : '-',
            activeLoanReleasePerson: activeLoanReleasePerson,
            activeLoanReleaseAmount: activeLoanReleaseAmount,
            activeLoanReleaseAmountStr: activeLoanReleaseAmount ? (activeLoanReleaseAmount < 0 ? `(${formatPricePhp(Math.abs(activeLoanReleaseAmount))})` : formatPricePhp(activeLoanReleaseAmount)) : '-',
            collectionTargetDaily: totalDailyTargetCollection,
            collectionTargetDailyStr: totalDailyTargetCollection ? (totalDailyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyTargetCollection))})` : formatPricePhp(totalDailyTargetCollection)) : '-',
            collectionAdvancePaymentDaily: 0,
            collectionAdvancePaymentDailyStr: '-',
            collectionActualDaily: totalDailyActualCollection,
            collectionActualDailyStr: totalDailyActualCollection ? (totalDailyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalDailyActualCollection))})` : formatPricePhp(totalDailyActualCollection)) : '-',
            collectionTargetWeekly: totalWeeklyTargetCollection,
            collectionTargetWeeklyStr: totalWeeklyTargetCollection ? (totalWeeklyTargetCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyTargetCollection))})` : formatPricePhp(totalWeeklyTargetCollection)) : '-',
            collectionAdvancePaymentWeekly: 0,
            collectionAdvancePaymentWeeklyStr: '-',
            collectionActualWeekly: totalWeeklyActualCollection,
            collectionActualWeeklyStr: totalWeeklyActualCollection ? (totalWeeklyActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalWeeklyActualCollection))})` : formatPricePhp(totalWeeklyActualCollection)) : '-',
            consolidatedCollection: totalConsolidatedActualCollection,
            consolidatedCollectionStr: totalConsolidatedActualCollection ? (totalConsolidatedActualCollection < 0 ? `(${formatPricePhp(Math.abs(totalConsolidatedActualCollection))})` : formatPricePhp(totalConsolidatedActualCollection)) : '-',
            fullPaymentDailyPerson: '-',
            fullPaymentDailyAmount: 0,
            fullPaymentDailyAmountStr: '-',
            fullPaymentWeeklyPerson: '-',
            fullPaymentWeeklyAmount: 0,
            fullPaymentWeeklyAmountStr: '-',
            consolidatedFullPaymentPerson: '-',
            consolidatedFullPaymentAmount: 0,
            consolidatedFullPaymentAmountStr: '-',
            pastDuePerson: totalNoPastDue || '-',
            pastDueAmount: totalPastDue,
            pastDueAmountStr: totalPastDue ? (totalPastDue < 0 ? `(${formatPricePhp(Math.abs(totalPastDue))})` : formatPricePhp(totalPastDue)) : '-',
            mispaymentPerson: '-',
            activeBorrowers: activeBorrowers,
            loanBalance: loanBalance,
            loanBalanceStr: loanBalance ? (loanBalance < 0 ? `(${formatPricePhp(Math.abs(loanBalance))})` : formatPricePhp(loanBalance)) : '-',
            flag: 'transfer'
        };
    };

    const calculateMonthlyTotals = (fBal, weeklyTotals) => {
        let monthlyTotal = {
            day: 'Monthly Total', // Fixed typo from 'Montly Total'
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
        let totalActiveClients = 0;
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
        let totalActiveBorrowers = 0;
        let totalLoanBalance = 0;
        
        // Get the last weekly total to use its values
        const lastWeekTotal = weeklyTotals.length > 0 ? weeklyTotals[weeklyTotals.length - 1] : null;
    
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
        });
    
        // Calculate MCBU balance
        totalMcbuBalance = fBal.mcbuBalance + totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
        
        // CRITICAL FIX: Use the last weekly total's values for key metrics
        if (lastWeekTotal) {
            // For Active Clients - use directly from last weekly total
            if (typeof lastWeekTotal.activeClients !== 'undefined' && lastWeekTotal.activeClients !== '-') {
                totalActiveClients = lastWeekTotal.activeClients;
            }
            
            // For Active Borrowers - use directly from last weekly total
            if (typeof lastWeekTotal.activeBorrowers !== 'undefined' && lastWeekTotal.activeBorrowers !== '-') {
                totalActiveBorrowers = lastWeekTotal.activeBorrowers;
            }
            
            // For Active Loan Release Person - use directly from last weekly total
            if (typeof lastWeekTotal.activeLoanReleasePerson !== 'undefined' && lastWeekTotal.activeLoanReleasePerson !== '-') {
                totalActiveLoanReleasePerson = lastWeekTotal.activeLoanReleasePerson;
            }
            
            // For Active Loan Release Amount - use directly from last weekly total
            if (typeof lastWeekTotal.activeLoanReleaseAmount !== 'undefined' && lastWeekTotal.activeLoanReleaseAmount !== '-') {
                totalActiveLoanReleaseAmount = lastWeekTotal.activeLoanReleaseAmount;
            }
            
            // For Loan Balance - use directly from last weekly total
            if (typeof lastWeekTotal.loanBalance !== 'undefined' && lastWeekTotal.loanBalance !== '-') {
                totalLoanBalance = lastWeekTotal.loanBalance;
            }
        } else {
            // Fallback calculations if there's no valid weekly total
            totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn;
            totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalConsolidatedLoanReleasePerson - totalConsolidatedFullPaymentPerson;
            totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalConsolidatedLoanReleaseAmount - totalConsolidatedFullPaymentAmount;
            totalActiveBorrowers = fBal.activeBorrowers;
            totalLoanBalance = fBal.loanBalance;
        }
    
        // Set all values in the monthly total
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
            day: 'Cumulative', // Fixed typo from 'Commulative'
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
            
            // CRITICAL FIX: Simply use the monthly values directly instead of trying to recalculate
            // For Active Clients - use directly from monthly total
            if (typeof monthly.activeClients !== 'undefined' && monthly.activeClients !== '-') {
                totalActiveClients = monthly.activeClients;
            }
            
            // For Active Borrowers - use directly from monthly total
            if (typeof monthly.activeBorrowers !== 'undefined' && monthly.activeBorrowers !== '-') {
                totalActiveBorrowers = monthly.activeBorrowers;
            }
            
            // For Active Loan Release Person - use directly from monthly total
            if (typeof monthly.activeLoanReleasePerson !== 'undefined' && monthly.activeLoanReleasePerson !== '-') {
                totalActiveLoanReleasePerson = monthly.activeLoanReleasePerson;
            }
            
            // For Active Loan Release Amount - use directly from monthly total
            if (typeof monthly.activeLoanReleaseAmount !== 'undefined' && monthly.activeLoanReleaseAmount !== '-') {
                totalActiveLoanReleaseAmount = monthly.activeLoanReleaseAmount;
            }
            
            // For Loan Balance - use directly from monthly total
            if (typeof monthly.loanBalance !== 'undefined' && monthly.loanBalance !== '-') {
                totalLoanBalance = monthly.loanBalance;
            }
            
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
    
            if (monthly.pastDueAmount > 0) {
                totalPastDuePerson = monthly.pastDuePerson;
                totalPastDueAmount = monthly.pastDueAmount;
            }
        }
    
        // Set all values in the grand total
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

        await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collection-summary/save-update-totals', losTotals);
    }

    useEffect(() => {
        if (currentDate) {
            setSelectedMonth(moment(currentDate).month() + 1);
            setSelectedYear(moment(currentDate).year());
        }
    }, [currentDate]);

    useEffect(() => {
        let mounted = true;

        if ((currentUser.role.rep === 3 || currentUser.role.rep === 4) && currentDate) {
            const getCurrentBranch = async () => {
                const apiUrl = `${getApiBaseUrl()}branches?`;
                const params = { code: currentUser.designatedBranch, date: currentDate };
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
    }, [currentUser, currentDate]);

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
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ loOnly: true, branchCode: currentBranch?.code, selectedLoGroup: selectedLoGroup });
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
        <Layout header={false} noPad={false} hScroll={false} noVScrollBody={true} vScroll={false}>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <div className="flex flex-col">
                    <LOSHeader 
                        page={1} 
                        pageTitle="Branch Manager Summary" 
                        selectedBranch={currentBranch}
                        selectedMonth={selectedMonth} 
                        setSelectedMonth={setSelectedMonth} 
                        handleMonthFilter={handleMonthFilter}
                        selectedYear={selectedYear} 
                        setSelectedYear={setSelectedYear} 
                        handleYearFilter={handleYearFilter}
                        selectedLoGroup={selectedLoGroup} 
                        handleSelectedLoGroupChange={handleSelectedLoGroupChange}
                        selectedLo={selectedLo} 
                        handleSelectedLoChange={handleSelectedLoChange} 
                    />
                    <div className="flex flex-col min-h-[55rem] mt-32 px-6 overflow-y-auto">
                        <div className="shadow-lg rounded-lg bg-white">
                            <div className="block rounded-xl overflow-auto h-screen">
                                <table className="w-full table-auto border-collapse text-sm" style={{ marginBottom: "14em" }}>
                                <thead>
                                        <tr>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Date</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">TOC</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">NM</th>
                                            <th colSpan={6} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">MCBU</th> 
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Act. Clie.</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">MCBU Bal.</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Curr. Loan Rel. w/SC (Regular Loan Daily)</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Curr. Loan Rel. w/SC (Other Loan Weekly)</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Consol. Total Loan Release w/SC</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">ACT LOAN RELEASE W/ Serv. Charge</th>
                                            <th colSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">COLLECTION (w/SC)</th>
                                            <th colSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">COLLECTION (w/SC)</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Consol. Total Act. Collection</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pastdue</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">FULL PAYMENT (w/SC Daily)</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">FULL PAYMENT (w/SC Weekly)</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Consol. FULL PAYMENT</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Act. Bwr.</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Loan Balance</th>
                                        </tr>
                                        <tr>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Target Deposit</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Actual Deposit</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">WD</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Int.</th>
                                            <th colSpan={2} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">MCBU Return</th>
                                            <th colSpan={3} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">REG. LOAN (Daily)</th>
                                            <th colSpan={3} className="sticky top-[2.2rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">OTHER LOAN (Weekly)</th>
                                        </tr>
                                        <tr>
                                            {/* MCBU Return */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* Loan Release Daily */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* Loan Release Weekly */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* ACTIVE LOAN RELEASE W/ Service Charge */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                             {/* REGULAR LOAN (Daily) */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Target</th> 
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Adv. Pmt</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Actl</th>
                                            {/* OTHER LOAN (Weekly) */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Target</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Adv. Pmt</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Actl</th>
                                            {/* PAST DUE */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* FULL PAYMENT (w/SC Daily) */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* FULL PAYMENT (w/SC Weekly) */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                            {/* Consolidated FULL PAYMENT (w/SC) */}
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white px-4 py-3 text-gray-600 uppercase tracking-wider whitespace-nowrap border-b-2 border-gray-200">Amt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {list.map((item, index) => {
                                            let rowStyles = 'hover:bg-gray-50 transition-colors duration-150';
                                            let textStyles = '';

                                            if (item.weekTotal || item.monthTotal || item.grandTotal) {
                                                rowStyles = 'bg-blue-50 hover:bg-blue-100 transition-colors duration-150';
                                                textStyles = 'text-blue-700 font-semibold';
                                            } else if (item.flag === 'transfer') {
                                                rowStyles = 'bg-orange-50 hover:bg-orange-100 transition-colors duration-150';
                                                textStyles = 'text-orange-700 font-semibold';
                                            } else if (item.fBalance) {
                                                rowStyles = 'bg-gray-50 hover:bg-gray-100 transition-colors duration-150';
                                                textStyles = 'font-semibold';
                                            }

                                            return (
                                                <tr key={index} className={`${rowStyles} ${textStyles}`}>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.day}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.transfer}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.newMember}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuTargetStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuActualStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuWithdrawalStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuInterestStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.noMcbuReturn}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuReturnAmtStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeClients}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.mcbuBalanceStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleaseDailyPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleaseDailyAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleaseWeeklyPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleaseWeeklyAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.consolidatedLoanReleasePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.consolidatedLoanReleaseAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeLoanReleasePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeLoanReleaseAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionTargetDailyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionAdvancePaymentDailyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionActualDailyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionTargetWeeklyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionAdvancePaymentWeeklyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionActualWeeklyStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.consolidatedCollectionStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.pastDuePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.pastDueAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentDailyPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentDailyAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentWeeklyPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentWeeklyAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.consolidatedFullPaymentPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.consolidatedFullPaymentAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeBorrowers}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanBalanceStr}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

export default BranchManagerSummary;