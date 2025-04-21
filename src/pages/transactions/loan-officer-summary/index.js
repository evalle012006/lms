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

const LoanOfficerSummary = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentBranch = useSelector(state => state.branch.data);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.los.list);
    const userList = useSelector(state => state.user.list);
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

    const calculatePersons = (losList) => {
        const fBal = losList[0];
        let prevLos;
        return losList.map((los, index) => {
            let temp = {...los};

            if (index !== 0 && !los.weekTotal) {
                const mcbuActual = los.mcbuActual !== '-' ? los.mcbuActual : 0;
                const mcbuWithdrawal = los.mcbuWithdrawal !== '-' ? los.mcbuWithdrawal : 0;
                const mcbuInterest = los.mcbuInterest !== '-' ? los.mcbuInterest : 0;
                const mcbuReturnAmt = los.mcbuReturnAmt !== '-' ? los.mcbuReturnAmt : 0;
                const fBalMcbuBalance = fBal.mcbuBalance !== '-' ? fBal.mcbuBalance : 0;
                const mcbuTransfer = 0;

                if (index === 1) {
                    temp.activeClients = temp.activeClients > 0 ? temp.activeClients : fBal.activeClients;
                    temp.activeLoanReleasePerson = temp.activeLoanReleasePerson > 0 ? temp.activeLoanReleasePerson : fBal.activeLoanReleasePerson;
                    temp.activeLoanReleaseAmount = temp.activeLoanReleaseAmount > 0 ? temp.activeLoanReleaseAmount : fBal.activeLoanReleaseAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = temp.activeBorrowers > 0 ? temp.activeBorrowers : fBal.activeBorrowers;
                    temp.loanBalance =
                        !isNaN(temp.loanBalance) && temp.loanBalance > 0 
                          ? temp.loanBalance 
                          : (!isNaN(fBal.loanBalance) && fBal.loanBalance > 0)
                            ? fBal.loanBalance 
                            : !isNaN(temp.loanBalance)
                              ? temp.loanBalance
                              : 0;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                    temp.mcbuBalance = fBalMcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt + mcbuTransfer;
                    temp.mcbuBalanceStr = formatPricePhp(temp.mcbuBalance);
                } else {
                    temp.activeClients = temp.activeClients > 0 ? temp.activeClients : prevLos.activeClients;
                    temp.activeLoanReleasePerson = temp.activeLoanReleasePerson > 0 ? temp.activeLoanReleasePerson : prevLos.activeLoanReleasePerson;
                    temp.activeLoanReleaseAmount = temp.activeLoanReleaseAmount > 0 ? temp.activeLoanReleaseAmount : prevLos.activeLoanReleaseAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = temp.activeBorrowers > 0 ? temp.activeBorrowers : prevLos.activeBorrowers;
                    temp.loanBalance =
                        !isNaN(temp.loanBalance) && temp.loanBalance > 0 
                          ? temp.loanBalance 
                          : (!isNaN(prevLos.loanBalance) && prevLos.loanBalance > 0)
                            ? prevLos.loanBalance 
                            : !isNaN(temp.loanBalance)
                              ? temp.loanBalance
                              : 0;
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
        const updatedLosList = [...losList];
        const fBal = updatedLosList.find(los => los.fBalance);
        let prevWeek = null;
        
        // Find all weekly total rows
        const weekTotalRows = [];
        updatedLosList.forEach((item, index) => {
            if (item.weekTotal) {
                weekTotalRows.push({
                    index: index,
                    weekNumber: item.weekNumber
                });
            }
        });
        
        // Process each week
        let startIndex = 1; // Start after F/Balance
        
        for (let w = 0; w < weekTotalRows.length; w++) {
            const weekTotal = weekTotalRows[w];
            const weekTotalIndex = weekTotal.index;
            const weekNumber = weekTotal.weekNumber;
            
            // Get all regular days in this week
            const regularDays = [];
            const allDaysIncludingTransfers = [];
            
            // Collect all days in this week
            for (let i = startIndex; i < weekTotalIndex; i++) {
                const item = updatedLosList[i];
                allDaysIncludingTransfers.push(item);
                
                if (!item.weekTotal && !item.monthTotal && !item.grandTotal && !item.fBalance && item.flag !== 'transfer') {
                    regularDays.push(item);
                }
            }
            
            // Check for transfer rows to get the final loan balance in the week
            const transferRows = allDaysIncludingTransfers.filter(item => item.flag === 'transfer');
            const lastTransferRow = transferRows.length > 0 ? transferRows[transferRows.length - 1] : null;
            
            // Initialize totals
            let totalTransfer = 0;
            let totalNewMember = 0;
            let totalMcbuTarget = 0;
            let totalMcbuActual = 0;
            let totalMcbuWithdrawal = 0;
            let totalMcbuInterest = 0;
            let totalNoMcbuReturn = 0;
            let totalMcbuReturnAmt = 0;
            let totalOffsetPerson = 0;
            let totalActiveClients = 0;
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
            let totalActiveBorrowers = 0;
            let totalLoanBalance = 0;
            let lastMcbuBalance = 0;
            
            // Process regular days and check for transferGvr/transferRcv within them
            let hasTransfer = false;
            let lastTransferDay = null;
            
            regularDays.forEach(day => {
                // Check if this day has transfer data - if yes, mark it and save a reference
                if ((day.transferGvr && day.transferGvr.transfer !== 0 && day.transferGvr.transfer !== '0' && day.transferGvr.transfer !== '-') || 
                    (day.transferRcv && day.transferRcv.transfer !== 0 && day.transferRcv.transfer !== '0' && day.transferRcv.transfer !== '-')) {
                    hasTransfer = true;
                    lastTransferDay = day;
                }
                
                // Handle transfer values that might be in parentheses
                let transfer = day.transfer;
                if (typeof transfer === 'string' && transfer !== '-') {
                    if (transfer.includes('(')) {
                        transfer = transfer.replace('(', '').replace(')', '');
                        transfer = -Math.abs(parseInt(transfer) || 0);
                    } else {
                        transfer = parseInt(transfer) || 0;
                    }
                } else if (transfer === '-') {
                    transfer = 0;
                }
                
                // Sum up all values, properly handling string/dash values
                totalTransfer += transfer;
                totalNewMember += day.newMember !== '-' ? parseInt(day.newMember) || 0 : 0;
                totalMcbuTarget += day.mcbuTarget !== '-' ? parseFloat(day.mcbuTarget) || 0 : 0;
                totalMcbuActual += day.mcbuActual !== '-' ? parseFloat(day.mcbuActual) || 0 : 0;
                totalMcbuWithdrawal += day.mcbuWithdrawal !== '-' ? parseFloat(day.mcbuWithdrawal) || 0 : 0;
                totalMcbuInterest += day.mcbuInterest !== '-' ? parseFloat(day.mcbuInterest) || 0 : 0;
                totalNoMcbuReturn += day.noMcbuReturn !== '-' ? parseInt(day.noMcbuReturn) || 0 : 0;
                totalMcbuReturnAmt += day.mcbuReturnAmt !== '-' ? parseFloat(day.mcbuReturnAmt) || 0 : 0;
                totalOffsetPerson += day.offsetPerson !== '-' ? parseInt(day.offsetPerson) || 0 : 0;
                totalLoanReleasePerson += day.loanReleasePerson !== '-' ? parseInt(day.loanReleasePerson) || 0 : 0;
                totalLoanReleaseAmount += day.loanReleaseAmount !== '-' ? parseFloat(day.loanReleaseAmount) || 0 : 0;
                totalCollectionTarget += day.collectionTarget !== '-' ? parseFloat(day.collectionTarget) || 0 : 0;
                totalCollectionAdvancePayment += day.collectionAdvancePayment !== '-' ? parseFloat(day.collectionAdvancePayment) || 0 : 0;
                totalCollectionActual += day.collectionActual !== '-' ? parseFloat(day.collectionActual) || 0 : 0;
                totalMispaymentPerson += day.mispaymentPerson !== '-' ? parseInt(day.mispaymentPerson) || 0 : 0;
                totalFullPaymentPerson += day.fullPaymentPerson !== '-' ? parseInt(day.fullPaymentPerson) || 0 : 0;
                totalFullPaymentAmount += day.fullPaymentAmount !== '-' ? parseFloat(day.fullPaymentAmount) || 0 : 0;
                
                // Track the last valid values for certain fields
                if (day.pastDuePerson !== '-') {
                    totalPastDuePerson = parseInt(day.pastDuePerson) || 0;
                }
                
                if (day.pastDueAmount !== '-') {
                    totalPastDueAmount = parseFloat(day.pastDueAmount) || 0;
                }
                
                // Track the last valid values for balance fields
                if (day.loanBalance !== '-' && parseFloat(day.loanBalance) > 0) {
                    totalLoanBalance = parseFloat(day.loanBalance);
                }
                
                if (day.mcbuBalance !== '-' && parseFloat(day.mcbuBalance) !== 0) {
                    lastMcbuBalance = parseFloat(day.mcbuBalance);
                }
                
                // Track the last valid values for client counts
                if (day.activeClients !== '-' && parseInt(day.activeClients) > 0) {
                    totalActiveClients = parseInt(day.activeClients);
                }
                
                if (day.activeBorrowers !== '-' && parseInt(day.activeBorrowers) > 0) {
                    totalActiveBorrowers = parseInt(day.activeBorrowers);
                }
                
                if (day.activeLoanReleasePerson !== '-' && parseInt(day.activeLoanReleasePerson) > 0) {
                    totalActiveLoanReleasePerson = parseInt(day.activeLoanReleasePerson);
                }
                
                if (day.activeLoanReleaseAmount !== '-' && parseFloat(day.activeLoanReleaseAmount) > 0) {
                    totalActiveLoanReleaseAmount = parseFloat(day.activeLoanReleaseAmount);
                }
            });
            
            // Check if we need to update the loan balance from a transfer row
            if (lastTransferRow && lastTransferRow.loanBalance && lastTransferRow.loanBalance !== '-') {
                if (typeof lastTransferRow.loanBalance === 'string') {
                    if (lastTransferRow.loanBalance.includes('(')) {
                        const cleanedValue = lastTransferRow.loanBalance.replace(/[₱,\s()]/g, '');
                        totalLoanBalance = -parseFloat(cleanedValue);
                    } else {
                        const cleanedValue = lastTransferRow.loanBalance.replace(/[₱,\s]/g, '');
                        totalLoanBalance = parseFloat(cleanedValue);
                    }
                } else {
                    totalLoanBalance = lastTransferRow.loanBalance;
                }
            }
            
            // If there are transfer days in this week, create a transfer row and process it
            // to get values that should be forwarded to the weekly total
            if (hasTransfer && lastTransferDay) {
                // Create a temp transfer row and process it
                const transferDetails = processTransferDetails([lastTransferDay]);
                
                // If we got a valid transfer row, forward its key values to the weekly total
                if (transferDetails) {
                    // Forward loan balance value
                    if (transferDetails.loanBalance && transferDetails.loanBalance !== '-') {
                        if (typeof transferDetails.loanBalance === 'string') {
                            if (transferDetails.loanBalance.includes('(')) {
                                const cleanedValue = transferDetails.loanBalance.replace(/[₱,\s()]/g, '');
                                totalLoanBalance = -parseFloat(cleanedValue);
                            } else {
                                const cleanedValue = transferDetails.loanBalance.replace(/[₱,\s]/g, '');
                                totalLoanBalance = parseFloat(cleanedValue);
                            }
                        } else {
                            totalLoanBalance = transferDetails.loanBalance;
                        }
                    } else if (transferDetails.loanBalanceStr && transferDetails.loanBalanceStr !== '-') {
                        if (transferDetails.loanBalanceStr.includes('(')) {
                            const cleanedValue = transferDetails.loanBalanceStr.replace(/[₱,\s()]/g, '');
                            totalLoanBalance = -parseFloat(cleanedValue);
                        } else {
                            const cleanedValue = transferDetails.loanBalanceStr.replace(/[₱,\s]/g, '');
                            totalLoanBalance = parseFloat(cleanedValue);
                        }
                    }
                    
                    // Forward MCBU balance value
                    if (transferDetails.mcbuBalance && transferDetails.mcbuBalance !== '-') {
                        if (typeof transferDetails.mcbuBalance === 'string') {
                            if (transferDetails.mcbuBalance.includes('(')) {
                                const cleanedValue = transferDetails.mcbuBalance.replace(/[₱,\s()]/g, '');
                                lastMcbuBalance = -parseFloat(cleanedValue);
                            } else {
                                const cleanedValue = transferDetails.mcbuBalance.replace(/[₱,\s]/g, '');
                                lastMcbuBalance = parseFloat(cleanedValue);
                            }
                        } else {
                            lastMcbuBalance = transferDetails.mcbuBalance;
                        }
                    } else if (transferDetails.mcbuBalanceStr && transferDetails.mcbuBalanceStr !== '-') {
                        if (transferDetails.mcbuBalanceStr.includes('(')) {
                            const cleanedValue = transferDetails.mcbuBalanceStr.replace(/[₱,\s()]/g, '');
                            lastMcbuBalance = -parseFloat(cleanedValue);
                        } else {
                            const cleanedValue = transferDetails.mcbuBalanceStr.replace(/[₱,\s]/g, '');
                            lastMcbuBalance = parseFloat(cleanedValue);
                        }
                    }
                    
                    // Forward collection target value
                    if (transferDetails.collectionTarget && transferDetails.collectionTarget !== '-') {
                        if (typeof transferDetails.collectionTarget === 'string') {
                            if (transferDetails.collectionTarget.includes('(')) {
                                const cleanedValue = transferDetails.collectionTarget.replace(/[₱,\s()]/g, '');
                                totalCollectionTarget = -parseFloat(cleanedValue);
                            } else {
                                const cleanedValue = transferDetails.collectionTarget.replace(/[₱,\s]/g, '');
                                totalCollectionTarget = parseFloat(cleanedValue);
                            }
                        } else {
                            totalCollectionTarget = transferDetails.collectionTarget;
                        }
                    } else if (transferDetails.collectionTargetStr && transferDetails.collectionTargetStr !== '-') {
                        if (transferDetails.collectionTargetStr.includes('(')) {
                            const cleanedValue = transferDetails.collectionTargetStr.replace(/[₱,\s()]/g, '');
                            totalCollectionTarget = -parseFloat(cleanedValue);
                        } else {
                            const cleanedValue = transferDetails.collectionTargetStr.replace(/[₱,\s]/g, '');
                            totalCollectionTarget = parseFloat(cleanedValue);
                        }
                    }
                    
                    // Forward collection actual value
                    if (transferDetails.collectionActual && transferDetails.collectionActual !== '-') {
                        if (typeof transferDetails.collectionActual === 'string') {
                            if (transferDetails.collectionActual.includes('(')) {
                                const cleanedValue = transferDetails.collectionActual.replace(/[₱,\s()]/g, '');
                                totalCollectionActual = -parseFloat(cleanedValue);
                            } else {
                                const cleanedValue = transferDetails.collectionActual.replace(/[₱,\s]/g, '');
                                totalCollectionActual = parseFloat(cleanedValue);
                            }
                        } else {
                            totalCollectionActual = transferDetails.collectionActual;
                        }
                    } else if (transferDetails.collectionActualStr && transferDetails.collectionActualStr !== '-') {
                        if (transferDetails.collectionActualStr.includes('(')) {
                            const cleanedValue = transferDetails.collectionActualStr.replace(/[₱,\s()]/g, '');
                            totalCollectionActual = -parseFloat(cleanedValue);
                        } else {
                            const cleanedValue = transferDetails.collectionActualStr.replace(/[₱,\s]/g, '');
                            totalCollectionActual = parseFloat(cleanedValue);
                        }
                    }
                }
            }
            
            // Calculate derived values
            if (weekNumber === 0) {
                // First week uses f/balance as reference
                if (!totalActiveClients) {
                    totalActiveClients = (fBal.activeClients || 0) + totalTransfer + totalNewMember - totalNoMcbuReturn;
                }
                
                if (!totalActiveLoanReleasePerson) {
                    totalActiveLoanReleasePerson = (fBal.activeLoanReleasePerson || 0) + totalLoanReleasePerson - totalFullPaymentPerson;
                }
                
                if (!totalActiveLoanReleaseAmount) {
                    totalActiveLoanReleaseAmount = (fBal.activeLoanReleaseAmount || 0) + totalLoanReleaseAmount - totalFullPaymentAmount;
                }
            } else {
                // Later weeks use previous week as reference
                if (!totalActiveClients && prevWeek) {
                    totalActiveClients = (prevWeek.activeClients || 0) + totalTransfer + totalNewMember - totalNoMcbuReturn;
                }
                
                if (!totalActiveLoanReleasePerson && prevWeek) {
                    totalActiveLoanReleasePerson = (prevWeek.activeLoanReleasePerson || 0) + totalLoanReleasePerson - totalFullPaymentPerson;
                }
                
                if (!totalActiveLoanReleaseAmount && prevWeek) {
                    totalActiveLoanReleaseAmount = (prevWeek.activeLoanReleaseAmount || 0) + totalLoanReleaseAmount - totalFullPaymentAmount;
                }
            }
            
            // Format transfer for display
            const formattedTransfer = totalTransfer < 0 ? `(${Math.abs(totalTransfer)})` : totalTransfer;
            
            // Update the weekly total row
            updatedLosList[weekTotalIndex] = {
                ...updatedLosList[weekTotalIndex],
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
                mcbuBalance: lastMcbuBalance,
                mcbuBalanceStr: formatPricePhp(lastMcbuBalance),
                offsetPerson: totalOffsetPerson,
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
            };
            
            // Store this week for next week's calculations
            prevWeek = updatedLosList[weekTotalIndex];
            
            // Forward values from weekly total to the next days until the next weekly total
            if (w < weekTotalRows.length - 1) {
                const nextWeekStartIndex = weekTotalIndex + 1;
                const nextWeekTotalIndex = weekTotalRows[w + 1].index;
                
                // CRITICAL CHANGE: At the beginning of the next week, use this week's MCBU balance
                // as the starting point for calculations
                let runningMcbuBalance = lastMcbuBalance;
                
                // Forward the loan balance and MCBU balance to the next days
                for (let i = nextWeekStartIndex; i < nextWeekTotalIndex; i++) {
                    const item = updatedLosList[i];
                    // Skip special rows
                    if (item.monthTotal || item.grandTotal || item.fBalance) {
                        continue;
                    }
                    
                    // Handle TOC transfer rows specially - they may reset the MCBU balance
                    if (item.flag === 'transfer') {
                        if (item.mcbuBalance !== '-' && !isNaN(parseFloat(item.mcbuBalance))) {
                            runningMcbuBalance = parseFloat(item.mcbuBalance);
                        }
                        continue;
                    }
                    
                    // Only update if the current value is not valid or if it's a regular day
                    if (item.loanBalance === '-' || parseFloat(item.loanBalance) <= 0) {
                        updatedLosList[i] = {
                            ...updatedLosList[i],
                            loanBalance: totalLoanBalance,
                            loanBalanceStr: formatPricePhp(totalLoanBalance)
                        };
                    }
                    
                    // Calculate the MCBU balance for this day based on its transactions
                    const mcbuActual = item.mcbuActual !== '-' ? parseFloat(item.mcbuActual) || 0 : 0;
                    const mcbuWithdrawal = item.mcbuWithdrawal !== '-' ? parseFloat(item.mcbuWithdrawal) || 0 : 0;
                    const mcbuInterest = item.mcbuInterest !== '-' ? parseFloat(item.mcbuInterest) || 0 : 0;
                    const mcbuReturnAmt = item.mcbuReturnAmt !== '-' ? parseFloat(item.mcbuReturnAmt) || 0 : 0;
                    
                    // Calculate new running MCBU balance
                    runningMcbuBalance = runningMcbuBalance + mcbuActual - mcbuWithdrawal + mcbuInterest - mcbuReturnAmt;
                    
                    // Update the MCBU balance
                    updatedLosList[i] = {
                        ...updatedLosList[i],
                        mcbuBalance: runningMcbuBalance,
                        mcbuBalanceStr: formatPricePhp(runningMcbuBalance)
                    };
                }
            }
            
            // Move start index to after this week's total row
            startIndex = weekTotalIndex + 1;
        }
        
        // Add Transfer of Clients (TOC) Total rows if needed
        let finalList = processTransfers(updatedLosList);
        
        return finalList;
    };

    const processTransfers = (losList) => {
        // Identify days with transfers
        const daysWithTransfer = [];
        losList.forEach((item, index) => {
            if ((item.transferGvr && item.transferGvr.transfer !== 0 && item.transferGvr.transfer !== '0' && item.transferGvr.transfer !== '-') || 
                (item.transferRcv && item.transferRcv.transfer !== 0 && item.transferRcv.transfer !== '0' && item.transferRcv.transfer !== '-')) {
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
            
            // Insert TOC Total row after this day
            result.splice(adjustedIndex + 1, 0, transferRow);
            
            // Critical fix: Forward TOC row loan balance AND mcbu balance to all subsequent regular days
            if (transferRow) {
                let transferLoanBalance;
                let transferMcbuBalance;
                
                // Parse the loan balance to ensure we have a numeric value
                if (typeof transferRow.loanBalance === 'string') {
                    if (transferRow.loanBalance.includes('(')) {
                        transferLoanBalance = -parseFloat(transferRow.loanBalance.replace(/[₱,\s()]/g, ''));
                    } else {
                        transferLoanBalance = parseFloat(transferRow.loanBalance.replace(/[₱,\s]/g, ''));
                    }
                } else {
                    transferLoanBalance = parseFloat(transferRow.loanBalance);
                }
                
                // Parse the MCBU balance
                if (typeof transferRow.mcbuBalance === 'string') {
                    if (transferRow.mcbuBalance.includes('(')) {
                        transferMcbuBalance = -parseFloat(transferRow.mcbuBalance.replace(/[₱,\s()]/g, ''));
                    } else {
                        transferMcbuBalance = parseFloat(transferRow.mcbuBalance.replace(/[₱,\s]/g, ''));
                    }
                } else {
                    transferMcbuBalance = parseFloat(transferRow.mcbuBalance);
                }
                
                // Forward these values to all subsequent regular days until next total row
                for (let i = adjustedIndex + 2; i < result.length; i++) {
                    const nextItem = result[i];
                    
                    // Stop at weekly totals, month totals, or other special rows
                    if (nextItem.weekTotal || nextItem.monthTotal || nextItem.grandTotal || 
                        nextItem.fBalance || nextItem.flag === 'transfer') {
                        break;
                    }
                    
                    // Update both loan balance and MCBU balance for regular days
                    result[i] = {
                        ...result[i],
                        loanBalance: transferLoanBalance,
                        loanBalanceStr: formatPricePhp(transferLoanBalance),
                        mcbuBalance: transferMcbuBalance,
                        mcbuBalanceStr: formatPricePhp(transferMcbuBalance)
                    };
                }
                
                // Also update weekly total values if it follows the TOC total
                for (let i = adjustedIndex + 2; i < result.length; i++) {
                    if (result[i].weekTotal) {
                        // First weekly total after this TOC should use these balances
                        result[i] = {
                            ...result[i],
                            loanBalance: transferLoanBalance,
                            loanBalanceStr: formatPricePhp(transferLoanBalance),
                            mcbuBalance: transferMcbuBalance,
                            mcbuBalanceStr: formatPricePhp(transferMcbuBalance)
                        };
                        break;
                    }
                }
            }
            
            offset++;
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

        losList.forEach((los, index) => {
            let temp = {...los};
            let transferGvr;
            let transferRcv;

            // Start with the current loanBalance as a base value
            loanBalance = temp.loanBalance !== '-' && !isNaN(parseFloat(temp.loanBalance)) 
                ? parseFloat(temp.loanBalance) 
                : 0;

            mcbuBalance = temp.mcbuBalance !== '-' && !isNaN(parseFloat(temp.mcbuBalance)) 
                ? parseFloat(temp.mcbuBalance) 
                : 0;

            if (temp?.transferGvr) {
                const data = {...temp.transferGvr};
                let noTransfer = data.transfer;
                if (typeof noTransfer === "string") {
                    noTransfer = noTransfer.replace('(','').replace(')','');
                    noTransfer = -Math.abs(parseInt(noTransfer) || 0);
                }
                
                const mcbuTarget = data.mcbuTarget !== '-' ? data?.mcbuTarget > 0 ? -Math.abs(data.mcbuTarget) : 0 : 0;
                const mcbuActual = data.mcbuCol !== '-' ? -Math.abs(data.mcbuCol || 0) : 0;
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
                    mcbuBalance: -Math.abs((mcbuActual || 0) - (mcbuWithdrawal || 0) + (mcbuInterest || 0) - (mcbuReturnAmt || 0)),
                    currentReleaseAmount: data.currentReleaseAmount || 0,
                    loanReleaseAmount: -Math.abs(data.totalLoanRelease || 0),
                    collectionTarget: -Math.abs((data.targetLoanCollection || 0) + (excess || 0)),
                    collectionActual: -Math.abs(data.collection || 0),
                    pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                    pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue) : 0,
                }

                // Update running totals based on the transfer GVR data
                // activeClients = (temp.activeClients || 0) + (noTransfer || 0);
                // activeBorrowers = (temp.activeBorrowers || 0) + (noTransfer || 0);
                // activeLoanReleasePerson = (temp.activeLoanReleasePerson || 0) + (noTransfer || 0);
                activeLoanReleaseAmount = (temp.activeLoanReleaseAmount || 0) - (data.totalLoanRelease || 0) + (data.currentReleaseAmount || 0);
                
                // Update loan balance calculation
                loanBalance = loanBalance - ((data.totalLoanRelease || 0) - (data.collection || 0)) + (data.currentReleaseAmount || 0);

                if (mcbuBalance === 0 && temp.mcbuBalance) {
                    mcbuBalance = parseFloat(temp.mcbuBalance);
                }
            }

            if (temp?.transferRcv) {
                const data = {...temp.transferRcv};
                let noTransfer = data.transfer;
                if (typeof noTransfer === "string") {
                    noTransfer = noTransfer.replace('(','').replace(')','');
                    noTransfer = -Math.abs(parseInt(noTransfer) || 0);
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
                    mcbuBalance: (mcbuActual || 0) - (mcbuWithdrawal || 0) + (mcbuInterest || 0) - (mcbuReturnAmt || 0),
                    currentReleaseAmount: data.currentReleaseAmount || 0,
                    loanReleaseAmount: data.totalLoanRelease || 0,
                    collectionTarget: (data.targetLoanCollection || 0) + (excess || 0),
                    collectionActual: data.collection || 0,
                    pastDuePerson: (data?.noPastDue && data?.noPastDue !== '-') ? data?.noPastDue : 0,
                    pastDueAmount: (data?.pastDue && data?.pastDue !== '-') ? -Math.abs(data?.pastDue || 0) : 0,
                }

                // Update running totals with transfer RCV data
                // activeClients = (activeClients || 0) + noTransfer - pendingClients;
                // activeBorrowers = (activeBorrowers || 0) + noTransfer - tdaClients;
                // activeLoanReleasePerson = (activeLoanReleasePerson || 0) + noTransfer - tdaClients;
                activeLoanReleaseAmount += data.totalLoanRelease || 0;
                
                // Update loan balance calculation
                loanBalance += ((data.totalLoanRelease || 0) - (data.collection || 0));
                
                totalTdaClients += tdaClients;
                totalPendingClients += pendingClients;

                if (mcbuBalance === 0 && temp.mcbuBalance) {
                    mcbuBalance = parseFloat(temp.mcbuBalance);
                }
            }

            if (transferGvr || transferRcv) {
                if (transferGvr) {
                    totalTransfer = transferGvr?.transfer || 0;
                    totalMcbuTarget = transferGvr?.mcbuTarget || 0;
                    totalMcbuActual = transferGvr?.mcbuActual || 0;
                    totalMcbuWithdrawal = transferGvr?.mcbuWithdrawal || 0;
                    totalMcbuInterest = transferGvr?.mcbuInterest || 0;
                    totalMcbuNoReturn = transferGvr?.noMcbuReturn || 0;
                    totalMcbuReturnAmt = transferGvr?.mcbuReturnAmt || 0;
                    totalMcbuBalance = transferGvr?.mcbuBalance || 0;
                    totalLoanRelease = (transferGvr?.loanReleaseAmount || 0) + (transferGvr?.currentReleaseAmount || 0);
                    totalTargetCollection = transferGvr?.collectionTarget || 0;
                    totalActualCollection = transferGvr?.collectionActual || 0;
                    totalPastDue = transferGvr?.pastDueAmount > 0 ? transferGvr?.pastDueAmount : 0;
                    totalNoPastDue = transferGvr?.pastDuePerson > 0 ? transferGvr?.pastDuePerson : 0;
                }

                if (transferRcv) {
                    totalTransfer += transferRcv?.transfer || 0;
                    totalMcbuTarget += transferRcv?.mcbuTarget || 0;
                    totalMcbuActual += transferRcv?.mcbuActual || 0;
                    totalMcbuWithdrawal += transferRcv?.mcbuWithdrawal || 0;
                    totalMcbuInterest += transferRcv?.mcbuInterest || 0;
                    totalMcbuNoReturn += transferRcv?.noMcbuReturn || 0;
                    totalMcbuReturnAmt += transferRcv.mcbuReturnAmt || 0;
                    totalMcbuBalance += transferRcv?.mcbuBalance || 0;
                    totalLoanRelease += (transferRcv?.loanReleaseAmount || 0) + (transferRcv?.currentReleaseAmount || 0);
                    totalTargetCollection += transferRcv?.collectionTarget || 0;
                    totalActualCollection += transferRcv?.collectionActual || 0;
                    totalPastDue += transferRcv?.pastDueAmount > 0 ? transferRcv?.pastDueAmount : 0;
                    totalNoPastDue += transferRcv?.pastDuePerson > 0 ? transferRcv?.pastDuePerson : 0;
                }

                if (totalMcbuBalance !== 0) {
                    mcbuBalance = temp.mcbuBalance ? temp.mcbuBalance : 0;
                }

                mcbuBalance += totalMcbuBalance;

                activeClients = temp.activeClients || 0;
                activeBorrowers = temp.activeBorrowers || 0;
                activeLoanReleasePerson = temp.activeLoanReleasePerson || 0;
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
            mcbuInterestStr: totalMcbuInterest < 0 ? `(${formatPricePhp(Math.abs(totalMcbuInterest))})` : formatPricePhp(totalMcbuInterest),
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
            collectionAdvancePaymentStr: '-',
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
    };

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
    
        // IMPORTANT: Get the last weekly total to use its MCBU balance
        const lastWeeklyTotal = weeklyTotals.length > 0 ? weeklyTotals[weeklyTotals.length - 1] : null;
        
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
    
        // CHANGE: Use the last weekly total's MCBU balance instead of calculating from scratch
        if (lastWeeklyTotal && lastWeeklyTotal.mcbuBalance !== '-' && !isNaN(parseFloat(lastWeeklyTotal.mcbuBalance))) {
            totalMcbuBalance = parseFloat(lastWeeklyTotal.mcbuBalance);
        } else {
            // Fallback to original calculation if needed
            totalMcbuBalance = fBal.mcbuBalance + totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
        }
        
        totalActiveClients = lastWeeklyTotal ? lastWeeklyTotal.activeClients : (fBal.activeClients + totalTransfer + totalNewMember - totalNoMcbuReturn);
        totalActiveLoanReleasePerson = totalActiveClients <= 0 ? 0 : weeklyTotals[weeklyTotals.length - 1]?.activeBorrowers;
        totalActiveLoanReleaseAmount = totalActiveClients <= 0 ? 0 : fBal.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
        totalActiveBorrowers = totalActiveClients <= 0 ? 0 : weeklyTotals[weeklyTotals.length - 1]?.activeBorrowers;
    
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
    
        const fBal = losList.find(los => los.fBalance);
        const monthly = losList.find(los => los.monthTotal);
    
        // Find the last weekly total to get the correct MCBU balance
        const weeklyTotals = losList.filter(los => los.weekTotal);
        const lastWeeklyTotal = weeklyTotals.length > 0 ? weeklyTotals[weeklyTotals.length - 1] : null;
    
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
            
            // CRITICAL CHANGE: Use last weekly total's MCBU balance instead of calculating it
            if (lastWeeklyTotal && lastWeeklyTotal.mcbuBalance !== '-' && !isNaN(parseFloat(lastWeeklyTotal.mcbuBalance))) {
                totalMcbuBalance = parseFloat(lastWeeklyTotal.mcbuBalance);
            } else {
                // Fallback to calculated value if needed
                totalMcbuBalance = totalMcbuActual - totalMcbuWithdrawal + totalMcbuInterest - totalMcbuReturnAmt;
            }
            
            totalOffsetperson = fBal.offsetPerson + monthly.offsetPerson;
            totalActiveClients = monthly.activeClients;
            totalActiveLoanReleasePerson = monthly.activeLoanReleasePerson;
            totalActiveLoanReleaseAmount = monthly.activeLoanReleaseAmount;
            totalCollectionAdvancePayment = fBal.collectionAdvancePayment + monthly.collectionTarget + monthly.collectionAdvancePayment - monthly.fullPaymentAmount;
            totalCollectionActual = fBal.collectionActual + monthly.collectionActual - monthly.fullPaymentAmount;
            totalMispaymentPerson = fBal.mispaymentPerson + monthly.mispaymentPerson;
            totalFullPaymentPerson = fBal.fullPaymentPerson + monthly.fullPaymentPerson;
            totalFullPaymentAmount = fBal.fullPaymentAmount + monthly.fullPaymentAmount;
            totalActiveBorrowers = monthly.activeBorrowers;
    
            if (monthly.pastDueAmount > 0) {
                totalPastDuePerson = monthly.pastDuePerson;
                totalPastDueAmount = monthly.pastDueAmount;
            }
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
            losTotals = {...losTotals, occurence: currentUser.transactionType};
        } else if (currentUser.role.rep === 3) {
            const loData = userList.find(user => user._id === uuid);
            if (loData) {
                losTotals = {...losTotals, userId: loData._id, occurence: loData.transactionType};
            }
        }

        await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collection-summary/save-update-totals', losTotals);
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
                const apiUrl = `${getApiBaseUrl()}branches?`;
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
        <Layout header={false} noPad={false} hScroll={false} noVScrollBody={true} vScroll={false}>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <div className="flex flex-col">
                    <LOSHeader 
                        page={1} 
                        pageTitle="Loan Officers Summary" 
                        selectedBranch={selectedBranch}
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
                    <div className={`flex flex-col min-h-[55rem] px-6 overflow-y-auto}`}>
                        <div className="shadow-lg rounded-lg bg-white mt-44">
                            <div className="block rounded-xl overflow-auto h-screen">
                                <table className="w-full table-auto border-collapse text-sm" 
                                       style={{ marginBottom: `${currentUser.role.rep == 3 ? "18em" : '14em'}` }}>
                                    <thead>
                                        <tr>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Date</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">TOC</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">NM</th>
                                            <th colSpan={6} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">MCBU</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Act. Clie.</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">MCBU Bal.</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Curr. Loan Rel. with Serv. Charge</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">ACT LOAN RELEASE W/ Serv. Charge</th>
                                            <th colSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">COLLECTION (w/ serv. charge)</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Pastdue</th>
                                            <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">FULL PAYMENT</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Act. Bwr.</th>
                                            <th rowSpan={3} className="sticky top-0 bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider">Loan Balance</th>
                                        </tr>
                                        <tr>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Target Deposit</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Actual Deposit</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">WD</th>
                                            <th rowSpan={2} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Int.</th>
                                            <th colSpan={2} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">MCBU Return</th>
                                            <th colSpan={3} className="sticky top-[2.2rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">REGULAR LOAN</th>
                                        </tr>
                                        <tr>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Amt</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Amt</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Amt</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Target</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Adv. Pmt</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Actl</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Amt</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Pers.</th>
                                            <th className="sticky top-[4.5rem] bg-white border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase">Amt</th>
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
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleasePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.loanReleaseAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeLoanReleasePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.activeLoanReleaseAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionTargetStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionAdvancePaymentStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.collectionActualStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.pastDuePerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.pastDueAmountStr}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentPerson}</td>
                                                    <td className="px-4 py-3 text-center whitespace-nowrap">{item.fullPaymentAmountStr}</td>
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

export default LoanOfficerSummary;