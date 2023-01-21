import React from "react";
import Layout from "@/components/Layout"
import { useEffect } from "react";
import { useState } from "react";
import Spinner from "@/components/Spinner";
import { useDispatch, useSelector } from "node_modules/react-redux/es/exports";
import { setLosList } from "@/redux/actions/losActions";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from 'react-hot-toast';
import LOSHeader from "@/components/transactions/los/Header";
import { formatPricePhp, getDaysOfMonth, getTotal } from "@/lib/utils";

const LoanOfficerSummary = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.los.list);
    const [currentDate, setCurrentDate] = useState(moment(new Date()).format('YYYY-MM-DD'));
    const [selectedBranch, setSelectedBranch] = useState();
    const [days, setDays] = useState([]);
    const [selectedMonth, setSelectedMonth] = useState(moment().month() + 1);
    const [selectedYear, setSelectedYear] = useState(moment().year());

    const handleMonthFilter = (selected) => {
        setSelectedMonth(selected.value);
    }

    const handleYearFilter = (selected) => {
        setSelectedYear(selected.value);
    }

    const getListLos = async (date) => {
        setLoading(true);

        let filter = false;

        if (moment().format('YYYY-MM') !== moment(date).format('YYYY-MM')) {
            filter = true;
        }

        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loan-officer-summary';
        let losList = [{
            day: 'F / Balance',
            transfer: 0,
            newMember: 0,
            offsetPerson: 0,
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

        if (currentUser.role.rep === 1) {
            url = url + '?' + new URLSearchParams({ date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los,
                        loanReleaseAmountStr: formatPricePhp(los.loanReleaseAmount),
                        collectionTargetStr: formatPricePhp(los.collectionTarget),
                        collectionAdvancePaymentStr: formatPricePhp(los.collectionAdvancePayment),
                        collectionActualStr: formatPricePhp(los.collectionActual),
                        pastDueAmountStr: formatPricePhp(los.pastDueAmount),
                        fullPaymentAmountStr: formatPricePhp(los.fullPaymentAmount),
                        loanBalanceStr: formatPricePhp(los.loanBalance)
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.map(los => {
                    losList.push({
                        ...los,
                        loanReleaseAmountStr: formatPricePhp(los.loanReleaseAmount),
                        collectionTargetStr: formatPricePhp(los.collectionTarget),
                        collectionAdvancePaymentStr: formatPricePhp(los.collectionAdvancePayment),
                        collectionActualStr: formatPricePhp(los.collectionActual),
                        pastDueAmountStr: formatPricePhp(los.pastDueAmount),
                        fullPaymentAmountStr: formatPricePhp(los.fullPaymentAmount),
                        loanBalanceStr: formatPricePhp(los.loanBalance)
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.data.current.map(los => {
                    losList.push({
                        ...los,
                        loanReleaseAmountStr: formatPricePhp(los.loanReleaseAmount),
                        collectionTargetStr: formatPricePhp(los.collectionTarget),
                        collectionAdvancePaymentStr: formatPricePhp(los.collectionAdvancePayment),
                        collectionActualStr: formatPricePhp(los.collectionActual),
                        pastDueAmountStr: formatPricePhp(los.pastDueAmount),
                        fullPaymentAmountStr: formatPricePhp(los.fullPaymentAmount),
                        loanBalanceStr: formatPricePhp(los.loanBalance)
                    });
                });

                dispatch(setLosList(losList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ userId: currentUser._id, date: date ? date : currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let fBal = response.data.fBalance;
                if (fBal.length > 0) {
                    fBal = fBal[0].data;
                    losList[0] = {
                        day: 'F / Balance',
                        transfer: fBal.transfer,
                        newMember: fBal.newMember,
                        offsetPerson: fBal.offsetPerson,
                        activeClients: fBal.activeClients,
                        loanReleasePerson: fBal.loanReleasePerson,
                        loanReleaseAmount: fBal.loanReleaseAmount,
                        loanReleaseAmountStr: formatPricePhp(fBal.loanReleaseAmount),
                        activeLoanReleasePerson: fBal.activeLoanReleasePerson,
                        activeLoanReleaseAmount: fBal.activeLoanReleaseAmount,
                        activeLoanReleaseAmountStr: formatPricePhp(fBal.activeLoanReleaseAmount),
                        collectionAdvancePayment: fBal.collectionAdvancePayment,
                        collectionAdvancePaymentStr: formatPricePhp(fBal.collectionAdvancePayment),
                        collectionActual: fBal.collectionActual,
                        collectionActualStr: formatPricePhp(fBal.collectionActual),
                        pastDuePerson: fBal.pastDuePerson,
                        pastDueAmount: fBal.pastDueAmount,
                        pastDueAmountStr: formatPricePhp(fBal.pastDueAmount),
                        fullPaymentPerson: fBal.fullPaymentPerson,
                        fullPaymentAmount: fBal.fullPaymentAmount,
                        fullPaymentAmountStr: formatPricePhp(fBal.fullPaymentAmount),
                        activeBorrowers: fBal.activeBorrowers,
                        loanBalance: fBal.loanBalance,
                        loanBalanceStr: formatPricePhp(fBal.loanBalance),
                        fBalance: true
                    };
                }
                
                response.data.current.map(los => {
                    const index = losList.findIndex(d => d.day === los._id);
                    if (index > -1) {
                        losList[index] = {
                            ...los,
                            day: los._id,
                            loanReleaseAmountStr: formatPricePhp(los.loanReleaseAmount),
                            collectionTargetStr: formatPricePhp(los.collectionTarget),
                            collectionAdvancePaymentStr: formatPricePhp(los.collectionAdvancePayment),
                            collectionActualStr: formatPricePhp(los.collectionActual),
                            pastDueAmountStr: formatPricePhp(los.pastDueAmount),
                            fullPaymentAmountStr: formatPricePhp(los.fullPaymentAmount),
                            loanBalance: los.loanBalance + los.loanReleaseAmount,
                            loanBalanceStr: formatPricePhp(los.loanBalance + los.loanReleaseAmount)
                        };
                    } else {

                    }
                });

                losList = calculatePersons(losList);
                losList = calculateWeeklyTotals(losList);
                losList.push(calculateMonthlyTotals(losList[0], losList.filter(los => los.weekTotal)));
                losList.push(calculateGrandTotals(losList, filter));
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
        let prevLos;
        return losList.map((los, index) => {
            let temp = {...los};

            if (index !== 0 && !los.weekTotal) {
                const transfer = los.transfer !== '-' ? los.transfer : 0;
                const newMember = los.newMember !== '-' ? los.newMember : 0;
                const offsetPerson = los.offsetPerson !== '-' ? los.offsetPerson : 0;
                const loanReleasePerson = los.loanReleasePerson !== '-' ? los.loanReleasePerson : 0;
                const fullPaymentPerson = los.fullPaymentPerson !== '-' ? los.fullPaymentPerson : 0;
                const fullPaymentAmount = los.fullPaymentAmount !== '-' ? los.fullPaymentAmount : 0;
                const loanReleaseAmount = los.loanReleaseAmount !== '-' ? los.loanReleaseAmount : 0;
                const collectionActual = los.collectionActual !== '-' ? los.collectionActual : 0;

                if (index === 1) {
                    temp.activeClients = fBal.activeClients + transfer + newMember - offsetPerson;
                    temp.activeLoanReleasePerson = fBal.activeLoanReleasePerson + loanReleasePerson - fullPaymentPerson;
                    temp.activeLoanReleaseAmount = fBal.activeLoanReleaseAmount + loanReleaseAmount - fullPaymentAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = fBal.activeBorrowers + loanReleasePerson - fullPaymentPerson;
                    temp.loanBalance = fBal.loanBalance + loanReleaseAmount - collectionActual;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                } else {
                    temp.activeClients = prevLos.activeClients + transfer + newMember - offsetPerson;
                    temp.activeLoanReleasePerson = prevLos.activeLoanReleasePerson + loanReleasePerson - fullPaymentPerson;
                    temp.activeLoanReleaseAmount = prevLos.activeLoanReleaseAmount + loanReleaseAmount - fullPaymentAmount;
                    temp.activeLoanReleaseAmountStr = formatPricePhp(temp.activeLoanReleaseAmount);
                    temp.activeBorrowers = prevLos.activeBorrowers + loanReleasePerson - fullPaymentPerson;
                    temp.loanBalance = prevLos.loanBalance + loanReleaseAmount - collectionActual;
                    temp.loanBalanceStr = formatPricePhp(temp.loanBalance);
                }

                prevLos = temp;
            }

            return temp;
        });
    }

    const calculateWeeklyTotals = (losList) => {
        const weekTotals = losList.filter(los => los.weekTotal);
        const fBal = losList[0];

        let prevWeek;
        weekTotals.map(w => {
            const index = losList.findIndex(los => los.weekNumber === w.weekNumber);
            if (index > -1) {
                let losSlice;
                if (w.weekNumber === 0) { // index = 3
                    losSlice = losList.slice(1, index);
                } else { // index = 15
                    losSlice = losList.slice(index - 5, index);
                }

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
                let totalPastDueAmount = 0;
                let totalFullPaymentPerson = 0;
                let totalFullPaymentAmount = 0;
                let totalActiveBorrowers = 0; // last row
                let totalLoanBalance = 0; // last row
                
                losSlice.map(los => {
                    totalTransfer += los.transfer !== '-' ? los.transfer : 0;
                    totalNewMember += los.newMember !== '-' ? los.newMember : 0;
                    totalOffsetperson += los.offsetPerson !== '-' ? los.offsetPerson : 0;
                    totalLoanReleasePerson += los.loanReleasePerson !== '-' ? los.loanReleasePerson : 0;
                    totalLoanReleaseAmount += los.loanReleaseAmount !== '-' ? los.loanReleaseAmount : 0;
                    totalCollectionTarget += los.collectionTarget !== '-' ? los.collectionTarget : 0;
                    totalCollectionAdvancePayment += los.collectionAdvancePayment !== '-' ? los.collectionAdvancePayment : 0;
                    totalCollectionActual += los.collectionActual !== '-' ? los.collectionActual : 0;
                    totalPastDuePerson += los.pastDuePerson !== '-' ? los.pastDuePerson : 0;
                    totalPastDueAmount += los.pastDueAmount !== '-' ? los.pastDueAmount : 0;
                    totalFullPaymentPerson += los.fullPaymentPerson !== '-' ? los.fullPaymentPerson : 0;
                    totalFullPaymentAmount += los.fullPaymentAmount !== '-' ? los.fullPaymentAmount : 0;
                });

                if (w.weekNumber === 0) {
                    totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalOffsetperson;
                    totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
                    totalActiveBorrowers = fBal.activeBorrowers + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalLoanBalance = fBal.loanBalance + totalLoanReleaseAmount - totalCollectionActual;
                } else {
                    totalActiveClients = prevWeek.activeClients + totalTransfer + totalNewMember - totalOffsetperson;
                    totalActiveLoanReleasePerson = prevWeek.activeLoanReleasePerson + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalActiveLoanReleaseAmount = prevWeek.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
                    totalActiveBorrowers = prevWeek.activeBorrowers + totalLoanReleasePerson - totalFullPaymentPerson;
                    totalLoanBalance = prevWeek.loanBalance + totalLoanReleaseAmount - totalCollectionActual;
                }

                losList[index] = {
                    ...w,
                    transfer: totalTransfer,
                    newMember: totalNewMember,
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
                    fullPaymentPerson: totalFullPaymentPerson,
                    fullPaymentAmount: totalFullPaymentAmount,
                    fullPaymentAmountStr: formatPricePhp(totalFullPaymentAmount),
                    activeBorrowers: totalActiveBorrowers,
                    loanBalance: totalLoanBalance,
                    loanBalanceStr: formatPricePhp(totalLoanBalance)
                }

                prevWeek = losList[index];
            }
        });
    
        return losList;
    }

    const calculateMonthlyTotals = (fBal, weeklyTotals) => {
        let monthlyTotal = {
            day: 'Montly Total',
            transfer: '-',
            newMember: '-',
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
        let totalFullPaymentPerson = 0;
        let totalFullPaymentAmount = 0;
        let totalActiveBorrowers = 0; // last row
        let totalLoanBalance = 0; // last row

        weeklyTotals.map(wt => {
            totalTransfer += wt.transfer;
            totalNewMember += wt.newMember;
            totalOffsetperson += wt.offsetPerson;
            totalLoanReleasePerson += wt.loanReleasePerson;
            totalLoanReleaseAmount += wt.loanReleaseAmount;
            totalCollectionTarget += wt.collectionTarget;
            totalCollectionAdvancePayment += wt.collectionAdvancePayment;
            totalCollectionActual += wt.collectionActual;
            totalPastDuePerson += wt.pastDuePerson;
            totalPastDueAmount += wt.pastDueAmount;
            totalFullPaymentPerson += wt.fullPaymentPerson;
            totalFullPaymentAmount += wt.fullPaymentAmount;
        });

        totalActiveClients = fBal.activeClients + totalTransfer + totalNewMember - totalOffsetperson;
        totalActiveLoanReleasePerson = fBal.activeLoanReleasePerson + totalLoanReleasePerson - totalFullPaymentPerson;
        totalActiveLoanReleaseAmount = fBal.activeLoanReleaseAmount + totalLoanReleaseAmount - totalFullPaymentAmount;
        totalActiveBorrowers = fBal.activeBorrowers + totalLoanReleasePerson - totalFullPaymentPerson;
        totalLoanBalance = fBal.loanBalance + totalLoanReleaseAmount - totalFullPaymentAmount;

        monthlyTotal.transfer = totalTransfer;
        monthlyTotal.newMember = totalNewMember;
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
        monthlyTotal.fullPaymentPerson = totalFullPaymentPerson;
        monthlyTotal.fullPaymentAmount = totalFullPaymentAmount;
        monthlyTotal.fullPaymentAmountStr = formatPricePhp(totalFullPaymentAmount);
        monthlyTotal.activeBorrowers = totalActiveBorrowers;
        monthlyTotal.loanBalance = totalLoanBalance;
        monthlyTotal.loanBalanceStr = formatPricePhp(totalLoanBalance);

        return monthlyTotal;
    }
    
    const calculateGrandTotals = (losList, filter) => {
        let grandTotal = {
            day: 'Commulative',
            transfer: 0,
            newMember: 0,
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
        let totalFullPaymentPerson = 0;
        let totalFullPaymentAmount = 0;
        let totalActiveBorrowers = 0;
        let totalLoanBalance = 0;

        const fBal = losList.find(los => los.fBalance);
        const monthly = losList.find(los => los.monthTotal);

        if (fBal && monthly) {
            totalTransfer = fBal.transfer + monthly.transfer;
            totalNewMember = fBal.newMember + monthly.newMember;
            totalOffsetperson = fBal.offsetPerson + monthly.offsetPerson;
            totalActiveClients = monthly.activeClients ;
            totalLoanReleasePerson = monthly.loanReleasePerson;
            totalLoanReleaseAmount = monthly.loanReleaseAmount;
            totalActiveLoanReleasePerson = monthly.activeLoanReleasePerson;
            totalActiveLoanReleaseAmount = monthly.activeLoanReleaseAmount;
            totalCollectionAdvancePayment = fBal.collectionAdvancePayment + monthly.collectionTarget + monthly.collectionAdvancePayment - monthly.fullPaymentAmount;
            totalCollectionActual = fBal.collectionActual + monthly.collectionActual - monthly.fullPaymentAmount;
            totalPastDuePerson = fBal.pastDuePerson + monthly.pastDuePerson;
            totalPastDueAmount = fBal.pastDueAmount + monthly.pastDueAmount;
            totalFullPaymentPerson = fBal.fullPaymentPerson + monthly.fullPaymentPerson;
            totalFullPaymentAmount = fBal.fullPaymentAmount + monthly.fullPaymentAmount;
            totalActiveBorrowers = monthly.activeBorrowers;
            totalLoanBalance = totalActiveLoanReleaseAmount - totalCollectionActual;
        }

        grandTotal.transfer = totalTransfer;
        grandTotal.newMember = totalNewMember;
        grandTotal.offsetPerson = totalOffsetperson;
        grandTotal.activeClients = totalActiveClients;
        grandTotal.loanReleasePerson = totalLoanReleasePerson;
        grandTotal.loanReleaseAmount = totalLoanReleaseAmount;
        grandTotal.loanReleaseAmountStr = formatPricePhp(totalLoanReleaseAmount);
        grandTotal.activeLoanReleasePerson = totalActiveLoanReleasePerson;
        grandTotal.activeLoanReleaseAmount = totalActiveLoanReleaseAmount;
        grandTotal.activeLoanReleaseAmountStr = formatPricePhp(totalActiveLoanReleaseAmount);
        grandTotal.collectionAdvancePayment = totalCollectionAdvancePayment;
        grandTotal.collectionAdvancePaymentStr = formatPricePhp(totalCollectionAdvancePayment);
        grandTotal.collectionActual = totalCollectionActual;
        grandTotal.collectionActualStr = formatPricePhp(totalCollectionActual);
        grandTotal.pastDuePerson = totalPastDuePerson;
        grandTotal.pastDueAmount = totalPastDueAmount;
        grandTotal.pastDueAmountStr = formatPricePhp(totalPastDueAmount);
        grandTotal.fullPaymentPerson = totalFullPaymentPerson;
        grandTotal.fullPaymentAmount = totalFullPaymentAmount;
        grandTotal.fullPaymentAmountStr = formatPricePhp(totalFullPaymentAmount);
        grandTotal.activeBorrowers = totalActiveBorrowers;
        grandTotal.loanBalance = totalLoanBalance;
        grandTotal.loanBalanceStr = formatPricePhp(totalLoanBalance);

        if (!filter) {
            saveLosTotals(grandTotal);
        }

        return grandTotal;
    }

    const saveLosTotals = async (total) => {
        if (currentUser.role.rep === 4) {
            const losTotals = {
                userId: currentUser._id,
                branchId: selectedBranch && selectedBranch._id,
                month: moment().month() + 1,
                year: moment().year(),
                data: total
            }
    
            await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loan-officer-summary/save-update-totals', losTotals);
        } else {
            // for AM and Admin
            // get BM id for that branch
        }
    }

    useEffect(() => {
        setDays(getDaysOfMonth(selectedYear, selectedMonth));
    }, [selectedMonth, selectedYear]);

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            const getCurrentBranch = async () => {
                const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}branches?`;
                const params = { code: currentUser.designatedBranch };
                const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
                if (response.success) {
                    setSelectedBranch(response.branch);
                } else {
                    toast.error('Error while loading data');
                }
            }

            mounted && getCurrentBranch();
        } else {
            // selectedBranchSubject
        }

        if (days.length > 0) {
            const fMonth = (typeof selectedMonth === 'number' && selectedMonth < 10) ? '0' + selectedMonth : selectedMonth;
            mounted && getListLos(`${selectedYear}-${fMonth}-01`);
            mounted && setLoading(false);
        }

        return (() => {
            mounted = false;
        })
    }, [days]);

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
                            selectedYear={selectedYear} setSelectedYear={setSelectedYear} handleYearFilter={handleYearFilter}/>
                    <div className="flex flex-col h-[55rem] max-h-[55rem] mt-40 pl-6 pr-2 overflow-y-auto">
                        <div className="block rounded-xl overflow-auto h-[49rem] w-[115rem]">
                            <table className="relative w-full table-fixed border-collapse text-sm bg-white mb-8">
                                <thead>
                                    <tr>
                                        <th rowSpan={3} className="sticky top-0 bg-white border border-gray-300 border-l-0 border-t-0 px-2 py-2 text-gray-500 uppercase">Date</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-20 px-2 py-2 text-gray-500 uppercase">Trans.</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-20 px-2 py-2 text-gray-500 uppercase">New Member</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-20 px-2 py-2 text-gray-500 uppercase">Off-set Person</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-20 px-2 py-2 text-gray-500 uppercase">Active Clients</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-52 px-2 py-4 text-gray-500 uppercase">Loan Release W/ Service Charge</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-52 px-2 py-4 text-gray-500 uppercase">ACTIVE LOAN RELEASE W/ Service Charge</th>
                                        <th colSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-72 px-2 text-gray-500 uppercase">COLLECTION (with service charges)</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-52 px-2 text-gray-500 uppercase">Pastdue</th>
                                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-white  border border-gray-300 w-52 border-t-0  px-2 text-gray-500 uppercase">FULL PAYMENT (with service charge)</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-t-0 w-28 px-2 py-2 text-gray-500 uppercase">Active Borrowers</th>
                                        <th rowSpan={3} className="sticky top-0 bg-white  border border-gray-300 border-r-0 border-t-0  px-2 py-2 text-gray-500 uppercase">Loan Balance</th>
                                    </tr>
                                    <tr>
                                        <th colSpan={3} className="sticky top-[2.8rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">REGULAR LOAN</th>
                                    </tr>
                                    <tr>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Person</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Amount</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Person</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Amount</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Target</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Advance Payment</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Actual</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Person</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Amount</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Person</th>
                                        <th className="sticky top-[4.5rem] bg-white  border border-gray-300 px-2 text-gray-500 uppercase">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {list.map((item, index) => {
                                        let rowBg = 'even:bg-gray-100';

                                        if (item.weekTotal || item.monthTotal || item.grandTotal) {
                                            rowBg = 'bg-blue-100';
                                        }

                                        return (
                                            <React.Fragment key={index}>
                                                {(item.fBalance || item.grandTotal ) ? (
                                                    <tr className={`${rowBg} text-red-400 font-bold`}>
                                                        <td className={`${item.fBalance && 'text-black'} px-4 py-4 text-center border border-gray-300`}>{ item.day }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.transfer }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.newMember }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.offsetPerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeClients }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanReleasePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanReleaseAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td colSpan={2} className="px-4 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.collectionActualStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.fullPaymentPerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.fullPaymentAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeBorrowers }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanBalanceStr }</td>
                                                    </tr>
                                                ) : (
                                                    <tr className={`${rowBg} ${(item.weekTotal || item.monthTotal) && 'text-red-400 font-bold'}`}>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.day }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.transfer }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.newMember }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.offsetPerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeClients }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanReleasePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanReleaseAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeLoanReleasePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeLoanReleaseAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.collectionTargetStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.collectionAdvancePaymentStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.collectionActualStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.pastDuePerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.pastDueAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.fullPaymentPerson }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.fullPaymentAmountStr }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.activeBorrowers }</td>
                                                        <td className="px-4 py-4 text-center border border-gray-300">{ item.loanBalanceStr }</td>
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