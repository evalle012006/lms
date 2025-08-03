import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout"
import Spinner from "@/components/Spinner";
import { useDispatch, useSelector } from "react-redux";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { toast } from "react-toastify";
import LOSHeader from "@/components/transactions/los/Header";
import { formatPricePhp } from "@/lib/utils";
import { useRouter } from "next/router";
import { getApiBaseUrl } from "@/lib/constants";
import { setUserList } from "@/redux/actions/userActions"; // Import the action

const TransactionSummary = () => {
    const router = useRouter();
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [summaryData, setSummaryData] = useState([]);
    const currentBranch = useSelector(state => state.branch.data);
    const currentUser = useSelector(state => state.user.data);
    const userList = useSelector(state => state.user.list);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const selectedBranch = useSelector(state => state.branch.data);
    
    // Filter states
    const [selectedMonth, setSelectedMonth] = useState();
    const [selectedYear, setSelectedYear] = useState();
    const [selectedLoGroup, setSelectedLoGroup] = useState('all');
    const [selectedLo, setSelectedLo] = useState();
    const { uuid } = router.query;

    // Determine if this is a branch manager view
    // Show branch manager view only when:
    // 1. User is branch manager (role.rep = 3) AND
    // 2. No specific loan officer is selected (viewing all LOs summary)
    const isBranchManagerView = currentUser?.role?.rep === 3 && !selectedLo;

    // Initialize date filters
    useEffect(() => {
        if (currentDate) {
            const currentMoment = moment(currentDate);
            setSelectedMonth(currentMoment.month() + 1);
            setSelectedYear(currentMoment.year());
        }
    }, [currentDate]);

    // Fetch userList for role.rep = 3 users (Branch Managers)
    useEffect(() => {
        const getListUser = async () => {
            // For role.rep = 3, use currentUser.designatedBranch, otherwise use currentBranch?.code
            const branchCode = currentUser?.role?.rep === 3 
                ? currentUser.designatedBranch 
                : currentBranch?.code;
                
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ 
                loOnly: true, 
                branchCode: branchCode, 
                selectedLoGroup: selectedLoGroup 
            });
            
            try {
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

                    // If there's a uuid in the URL, set the selected LO
                    if (uuid) {
                        setSelectedLo(userListArr.find(user => user._id == uuid));
                    }
                } else {
                    toast.error('Error retrieving user list.');
                }
            } catch (error) {
                console.error('Error fetching user list:', error);
                toast.error('Failed to fetch loan officers list.');
            }
        }

        // Only fetch userList for branch managers (role.rep = 3) when they have currentUser data
        // For role.rep = 3, we need currentUser.designatedBranch
        // For other roles, we need currentBranch data
        const shouldFetchUsers = currentUser?.role?.rep === 3 
            ? (currentUser && currentUser.designatedBranch && selectedLoGroup)
            : (currentUser?.role?.rep === 3 && currentBranch && selectedLoGroup);
            
        if (shouldFetchUsers) {
            getListUser();
        }
    }, [selectedLoGroup, currentBranch, currentUser, uuid, dispatch]);

    // Filter handlers
    const handleMonthFilter = (selected) => {
        setSelectedMonth(selected.value);
    }

    const handleYearFilter = (selected) => {
        setSelectedYear(selected.value);
    }

    const handleSelectedLoGroupChange = (selected) => {
        setSelectedLoGroup(selected.value);
    }

    const handleSelectedLoChange = (selected) => {
        if (selected && selected.value) {
            const selectedUser = userList.find(user => user._id === selected.value);
            setSelectedLo(selectedUser);
        } else {
            setSelectedLo(null);
        }
    }

    // Fetch summary data using the new API endpoint
    const getSummaryData = async () => {
        if (!selectedMonth || !selectedYear || !currentUser) return;
        
        // For role.rep 3 and 4, use currentUser.designatedBranchId
        const branchId = (currentUser?.role?.rep === 3 || currentUser?.role?.rep === 4) 
            ? currentUser.designatedBranchId 
            : selectedBranch?._id;
            
        if (!branchId) return;

        setLoading(true);
        try {
            const selectedDate = moment()
                .year(selectedYear)
                .month(selectedMonth - 1)
                .endOf('month')
                .format('YYYY-MM-DD');

            const params = new URLSearchParams({
                branch_id: branchId,
                selected_date: selectedDate
            });

            // For role.rep = 4 (loan officer level), always include lo_id
            if (currentUser?.role?.rep === 4) {
                params.append('lo_id', currentUser._id);
            }
            // For role.rep = 3 (branch manager level), include lo_id when specific LO is selected
            else if (currentUser?.role?.rep === 3 && selectedLo && selectedLo !== 'all') {
                params.append('lo_id', selectedLo._id);
            }

            const response = await fetchWrapper.get(
                `${getApiBaseUrl()}/data/get_cash_collection_summary_v2?${params.toString()}`
            );

            const apiData = response?.data || [];
            
            // Generate prefilled rows with API data merged in
            const prefilledRows = generatePrefilledRows(selectedYear, selectedMonth, apiData);
            
            setSummaryData(prefilledRows);

        } catch (error) {
            console.error('Error fetching summary data:', error);
            toast.error('Failed to fetch summary data');
            
            // Even on error, show prefilled structure with empty data
            const prefilledRows = generatePrefilledRows(selectedYear, selectedMonth, []);
            setSummaryData(prefilledRows);
        } finally {
            setLoading(false);
        }
    };

    // Load data when filters change
    useEffect(() => {
        if (selectedMonth && selectedYear) {
            // Initialize with prefilled structure immediately
            const prefilledRows = generatePrefilledRows(selectedYear, selectedMonth, []);
            setSummaryData(prefilledRows);
            
            // Then fetch actual data
            getSummaryData();
        }
    }, [selectedMonth, selectedYear, selectedLo, currentUser, selectedBranch]);

    // Helper function to generate prefilled row structure
    const generatePrefilledRows = (year, month, apiData = []) => {
        const rows = [];
        const startOfMonth = moment().year(year).month(month - 1).startOf('month');
        const endOfMonth = moment().year(year).month(month - 1).endOf('month');
        const previousMonthEnd = moment().year(year).month(month - 1).subtract(1, 'month').endOf('month');
        
        // Default empty row structure
        const createEmptyRow = (period, txnType) => ({
            period,
            txn_type: txnType,
            mispay: 0,
            mcbu: 0,
            mcbuTarget: 0,
            mcbuCollection: 0,
            mcbuWithdrawal: 0,
            mcbuReturnNo: 0,
            mcbuReturn: 0,
            activeClients: 0,
            currentReleasePerson_New: 0,
            currentReleasePerson_Rel: 0,
            currentReleaseAmount: 0,
            totalLoanRelease: 0,
            targetLoanCollection: 0,
            excess: 0,
            actualLoanCollection: 0,
            pastDueNo: 0,
            pastDueAmount: 0,
            fullPaymentPerson: 0,
            fullPaymentAmount: 0,
            activeBorrowers: 0,
            totalLoanBalance: 0,
            transferClients: 0,
            transferredClients: 0,
            // Branch manager specific fields
            loanReleaseDailyPerson: 0,
            loanReleaseDailyAmount: 0,
            loanReleaseWeeklyPerson: 0,
            loanReleaseWeeklyAmount: 0,
            consolidatedLoanReleasePerson: 0,
            consolidatedLoanReleaseAmount: 0,
            collectionTargetDaily: 0,
            collectionAdvancePaymentDaily: 0,
            collectionActualDaily: 0,
            collectionTargetWeekly: 0,
            collectionAdvancePaymentWeekly: 0,
            collectionActualWeekly: 0,
            consolidatedCollection: 0,
            fullPaymentDailyPerson: 0,
            fullPaymentDailyAmount: 0,
            fullPaymentWeeklyPerson: 0,
            fullPaymentWeeklyAmount: 0,
            consolidatedFullPaymentPerson: 0,
            consolidatedFullPaymentAmount: 0
        });

        // Separate API data by transaction type
        const forwardedData = apiData.find(item => item.txn_type === 'FORWARDED');
        const dailyData = apiData.filter(item => item.txn_type === 'DAILY');
        const weeklyData = apiData.filter(item => item.txn_type === 'WEEKLY');
        const monthlyData = apiData.find(item => item.txn_type === 'MONTHLY');
        const cumulativeData = apiData.find(item => item.txn_type === 'COMMULATIVE');

        // Create maps for quick lookup
        const dailyMap = {};
        dailyData.forEach(item => {
            dailyMap[item.period] = item;
        });

        const weeklyMap = {};
        weeklyData.forEach(item => {
            weeklyMap[item.period] = item;
        });

        // 1. Add Forward Balance row
        const forwardedRow = forwardedData || createEmptyRow(previousMonthEnd.format('YYYY-MM-DD'), 'FORWARDED');
        rows.push(forwardedRow);

        // 2. Generate weekdays for the month
        let currentDate = startOfMonth.clone();
        
        // Find first weekday of the month
        while (currentDate.month() === startOfMonth.month() && (currentDate.day() === 0 || currentDate.day() === 6)) {
            currentDate.add(1, 'day');
        }

        while (currentDate.month() === startOfMonth.month() && currentDate.isSameOrBefore(endOfMonth, 'day')) {
            // Skip weekends
            if (currentDate.day() !== 0 && currentDate.day() !== 6) {
                const dateStr = currentDate.format('YYYY-MM-DD');
                
                // Add daily row (from API or empty)
                const dailyRow = dailyMap[dateStr] || createEmptyRow(dateStr, 'DAILY');
                rows.push(dailyRow);

                // Check if there's a weekly entry for the next day (or same day)
                const nextDay = currentDate.clone().add(1, 'day').format('YYYY-MM-DD');
                const weeklyForToday = weeklyMap[dateStr];
                const weeklyForNextDay = weeklyMap[nextDay];
                
                // Add weekly row if it exists for today or next day
                if (weeklyForToday) {
                    rows.push(weeklyForToday);
                } else if (weeklyForNextDay) {
                    rows.push(weeklyForNextDay);
                } else if (currentDate.day() === 5) {
                    // If it's Friday and no API weekly data, add empty weekly total
                    const weeklyRow = createEmptyRow(dateStr, 'WEEKLY');
                    rows.push(weeklyRow);
                }
            }
            currentDate.add(1, 'day');
        }

        // 3. Add Monthly Total
        const monthlyRow = monthlyData || createEmptyRow(endOfMonth.format('YYYY-MM-DD'), 'MONTHLY');
        rows.push(monthlyRow);

        // 4. Add Cumulative
        const cumulativeRow = cumulativeData || createEmptyRow(endOfMonth.format('YYYY-MM-DD'), 'COMMULATIVE');
        rows.push(cumulativeRow);

        return rows;
    };

    const formatDateColumn = (item) => {
        switch (item.txn_type) {
            case 'DAILY':
                return item.period; // Show the actual date for daily entries
            case 'WEEKLY':
                return 'Weekly Total';
            case 'MONTHLY':
                return 'Monthly Total';
            case 'COMMULATIVE':
                return 'Cumulative';
            case 'FORWARDED':
                return 'F/Balance';
            default:
                return item.period;
        }
    };

    // Helper function to calculate TOC (transferClients - transferredClients)
    const calculateTOC = (item) => {
        const transferClients = item.transferClients || 0;
        const transferredClients = item.transferredClients || 0;
        const result = transferClients - transferredClients;
        return result === 0 ? '-' : result;
    };

    // Helper function to format currency or return dash
    const formatCurrency = (value) => {
        return value > 0 ? formatPricePhp(value) : '-';
    };

    // Helper function to get row styling based on transaction type
    const getRowStyling = (item, index) => {
        let rowStyles = 'hover:bg-gray-50 transition-colors duration-150';
        let textStyles = '';

        // Style based on transaction type
        switch (item.txn_type) {
            case 'FORWARDED':
                rowStyles = 'bg-gray-50 hover:bg-gray-100 transition-colors duration-150';
                textStyles = 'font-semibold';
                break;
            case 'WEEKLY':
            case 'MONTHLY':
            case 'COMMULATIVE':
                rowStyles = 'bg-blue-50 hover:bg-blue-100 transition-colors duration-150';
                textStyles = 'text-blue-700 font-semibold';
                break;
            case 'DAILY':
            default:
                // Alternate row colors for daily entries
                rowStyles = `${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-gray-100 transition-colors duration-150`;
                textStyles = '';
                break;
        }

        return { rowStyles, textStyles };
    };

    // Render table headers based on user role
    const renderTableHeaders = () => {
        if (isBranchManagerView) {
            // Branch Manager Headers (role.rep = 3)
            return (
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-left">Date</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">TOC</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">NM</th>
                        <th colSpan={6} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">MCBU</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Act. Clie.</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">MCBU Bal.</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Curr. Loan Rel. w/SC (Regular Loan Daily)</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Curr. Loan Rel. w/SC (Other Loan Weekly)</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Pers.</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Consol. Total Loan Release w/SC</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">ACT LOAN RELEASE W/ Serv. Charge</th>
                        <th colSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">COLLECTION (w/SC) REG. LOAN (Daily)</th>
                        <th colSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">COLLECTION (w/SC) OTHER LOAN (Weekly)</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Consol. Total Act. Collection</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Pastdue</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">FULL PAYMENT (w/SC Daily)</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">FULL PAYMENT (w/SC Weekly)</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Consol. FULL PAYMENT</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Act. Bwr.</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Loan Balance</th>
                    </tr>
                    <tr>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Target Deposit</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Actual Deposit</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">WD</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Int.</th>
                        <th colSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">MCBU Return</th>
                        <th colSpan={3} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">REG. LOAN (Daily)</th>
                        <th colSpan={3} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">OTHER LOAN (Weekly)</th>
                    </tr>
                    <tr>
                        {/* MCBU Return */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* Loan Release Daily */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* Loan Release Weekly */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* ACTIVE LOAN RELEASE W/ Service Charge */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* REGULAR LOAN (Daily) */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Target</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Adv. Pmt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Actl</th>
                        {/* OTHER LOAN (Weekly) */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Target</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Adv. Pmt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Actl</th>
                        {/* PAST DUE */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* FULL PAYMENT (w/SC Daily) */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* FULL PAYMENT (w/SC Weekly) */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        {/* Consolidated FULL PAYMENT (w/SC) */}
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                    </tr>
                </thead>
            );
        } else {
            // Loan Officer Headers (role.rep = 4) - Original structure
            return (
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                    <tr>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-left">Date</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">TOC</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">NM</th>
                        <th colSpan={6} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">MCBU</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Act. Clie.</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">MCBU Bal.</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Curr. Loan Rel. with Serv. Charge</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">ACT LOAN RELEASE W/ Serv. Charge</th>
                        <th colSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">COLLECTION (w/ serv. charge)</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Pastdue</th>
                        <th rowSpan={2} colSpan={2} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">FULL PAYMENT</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Act. Bwr.</th>
                        <th rowSpan={3} className="sticky top-0 bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 font-semibold uppercase tracking-wider text-center">Loan Balance</th>
                    </tr>
                    <tr>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Target Deposit</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Actual Deposit</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">WD</th>
                        <th rowSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Int.</th>
                        <th colSpan={2} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">MCBU Return</th>
                        <th colSpan={3} className="sticky top-[2.8rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">REGULAR LOAN</th>
                    </tr>
                    <tr>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Target</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Adv. Payment</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Actual</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Pers.</th>
                        <th className="sticky top-[5.6rem] bg-gray-50 border-b-2 border-gray-200 px-4 py-3 text-gray-600 uppercase text-center">Amt</th>
                    </tr>
                </thead>
            );
        }
    };

    // Render table cells based on user role
    const renderTableCells = (item, index) => {
        const { rowStyles, textStyles } = getRowStyling(item, index);

        if (isBranchManagerView) {
            // Branch Manager Cells (role.rep = 3)
            return (
                <tr key={`${item.period}_${item.txn_type}_${index}`} className={`${rowStyles} ${textStyles} hover:shadow-sm transition-all duration-200`}>
                    {/* Date with Transaction Type */}
                    <td className="px-4 py-3 text-left whitespace-nowrap border-r border-gray-100">
                        {formatDateColumn(item)}
                    </td>
                    
                    {/* TOC (transferClients - transferredClients) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {calculateTOC(item)}
                    </td>
                    
                    {/* NM (Mispayment) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.mispay || 0}
                    </td>
                    
                    {/* MCBU Target Deposit - from API mcbuTarget field */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuTarget)}
                    </td>
                    
                    {/* MCBU Actual Deposit */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuCollection)}
                    </td>
                    
                    {/* MCBU Withdrawal */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuWithdrawal)}
                    </td>
                    
                    {/* MCBU Interest */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        -
                    </td>
                    
                    {/* MCBU Return Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.mcbuReturnNo || 0}
                    </td>
                    
                    {/* MCBU Return Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuReturn)}
                    </td>
                    
                    {/* Active Clients */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.activeClients || 0}
                    </td>
                    
                    {/* MCBU Balance - from API mcbu field */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbu)}
                    </td>
                    
                    {/* Daily Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.loanReleaseDailyPerson || (item.currentReleasePerson_New || 0)}
                    </td>
                    
                    {/* Daily Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.loanReleaseDailyAmount || item.currentReleaseAmount)}
                    </td>
                    
                    {/* Weekly Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.loanReleaseWeeklyPerson || (item.currentReleasePerson_Rel || 0)}
                    </td>
                    
                    {/* Weekly Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.loanReleaseWeeklyAmount)}
                    </td>
                    
                    {/* Consolidated Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.consolidatedLoanReleasePerson || ((item.currentReleasePerson_New || 0) + (item.currentReleasePerson_Rel || 0))}
                    </td>
                    
                    {/* Consolidated Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.consolidatedLoanReleaseAmount)}
                    </td>
                    
                    {/* Active Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {(item.currentReleasePerson_New || 0) + (item.currentReleasePerson_Rel || 0)}
                    </td>
                    
                    {/* Active Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.totalLoanRelease)}
                    </td>
                    
                    {/* Daily Collection Target */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionTargetDaily || item.targetLoanCollection)}
                    </td>
                    
                    {/* Daily Collection Advance Payment */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionAdvancePaymentDaily || item.excess)}
                    </td>
                    
                    {/* Daily Collection Actual */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionActualDaily || item.actualLoanCollection)}
                    </td>
                    
                    {/* Weekly Collection Target */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionTargetWeekly)}
                    </td>
                    
                    {/* Weekly Collection Advance Payment */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionAdvancePaymentWeekly)}
                    </td>
                    
                    {/* Weekly Collection Actual */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.collectionActualWeekly)}
                    </td>
                    
                    {/* Consolidated Collection */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.consolidatedCollection || item.actualLoanCollection)}
                    </td>
                    
                    {/* Past Due Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.pastDueNo || 0}
                    </td>
                    
                    {/* Past Due Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.pastDueAmount)}
                    </td>
                    
                    {/* Daily Full Payment Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.fullPaymentDailyPerson || item.fullPaymentPerson || 0}
                    </td>
                    
                    {/* Daily Full Payment Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.fullPaymentDailyAmount || item.fullPaymentAmount)}
                    </td>
                    
                    {/* Weekly Full Payment Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.fullPaymentWeeklyPerson || 0}
                    </td>
                    
                    {/* Weekly Full Payment Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.fullPaymentWeeklyAmount)}
                    </td>
                    
                    {/* Consolidated Full Payment Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.consolidatedFullPaymentPerson || item.fullPaymentPerson || 0}
                    </td>
                    
                    {/* Consolidated Full Payment Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.consolidatedFullPaymentAmount || item.fullPaymentAmount)}
                    </td>
                    
                    {/* Active Borrowers */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.activeBorrowers || 0}
                    </td>
                    
                    {/* Loan Balance */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.totalLoanBalance)}
                    </td>
                </tr>
            );
        } else {
            // Loan Officer Cells (role.rep = 4) - Original structure
            return (
                <tr key={`${item.period}_${item.txn_type}_${index}`} className={`${rowStyles} ${textStyles} hover:shadow-sm transition-all duration-200`}>
                    {/* Date with Transaction Type */}
                    <td className="px-4 py-3 text-left whitespace-nowrap border-r border-gray-100">
                        {formatDateColumn(item)}
                    </td>
                    
                    {/* TOC (transferClients - transferredClients) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {calculateTOC(item)}
                    </td>
                    
                    {/* NM (Mispayment) */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.mispay || 0}
                    </td>
                    
                    {/* MCBU Target Deposit - from API mcbuTarget field */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuTarget)}
                    </td>
                    
                    {/* MCBU Actual Deposit */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuCollection)}
                    </td>
                    
                    {/* MCBU Withdrawal */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuWithdrawal)}
                    </td>
                    
                    {/* MCBU Interest */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        -
                    </td>
                    
                    {/* MCBU Return Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.mcbuReturnNo || 0}
                    </td>
                    
                    {/* MCBU Return Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbuReturn)}
                    </td>
                    
                    {/* Active Clients */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.activeClients || 0}
                    </td>
                    
                    {/* MCBU Balance - from API mcbu field */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.mcbu)}
                    </td>
                    
                    {/* Current Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {(item.currentReleasePerson_New || 0) + (item.currentReleasePerson_Rel || 0)}
                    </td>
                    
                    {/* Current Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.currentReleaseAmount)}
                    </td>
                    
                    {/* Act Loan Release Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {(item.currentReleasePerson_New || 0) + (item.currentReleasePerson_Rel || 0)}
                    </td>
                    
                    {/* Act Loan Release Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.totalLoanRelease)}
                    </td>
                    
                    {/* Collection Target */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.targetLoanCollection)}
                    </td>
                    
                    {/* Collection Advance Payment */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.excess)}
                    </td>
                    
                    {/* Collection Actual */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.actualLoanCollection)}
                    </td>
                    
                    {/* Past Due Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.pastDueNo || 0}
                    </td>
                    
                    {/* Past Due Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.pastDueAmount)}
                    </td>
                    
                    {/* Full Payment Person */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.fullPaymentPerson || 0}
                    </td>
                    
                    {/* Full Payment Amount */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.fullPaymentAmount)}
                    </td>
                    
                    {/* Active Borrowers */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {item.activeBorrowers || 0}
                    </td>
                    
                    {/* Loan Balance */}
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                        {formatCurrency(item.totalLoanBalance)}
                    </td>
                </tr>
            );
        }
    };

    return (
        <Layout header={false} noPad={false} hScroll={false} noVScrollBody={false} vScroll={false}>
            {loading ? (
                <Spinner />
            ) : (
                <div className="flex flex-col">
                    <LOSHeader 
                        page={1} 
                        pageTitle={isBranchManagerView ? "Branch Manager Summary" : "Loan Officers Summary"}
                        selectedBranch={selectedBranch || { _id: currentUser?.designatedBranchId, name: currentUser?.designatedBranchName }}
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
                    {/* Fixed container with proper height calculation */}
                    <div className="flex flex-col mt-48">
                        <div className="mb-6">
                            <div className="shadow-lg rounded-lg bg-white border border-gray-200">
                                {/* Table with proper scrolling */}
                                <div 
                                    className="block rounded-xl overflow-auto" 
                                    style={{ 
                                        height: 'calc(100vh - 260px)', // Adjusted for header + padding
                                        minHeight: '400px' // Minimum height for usability
                                    }}
                                >
                                    <table className="w-full table-auto border-collapse text-sm">
                                        {renderTableHeaders()}
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {summaryData && summaryData.length > 0 ? (
                                                summaryData.map((item, index) => renderTableCells(item, index))
                                            ) : (
                                                <tr>
                                                    <td colSpan={isBranchManagerView ? "30" : "21"} className="px-4 py-12 text-center text-gray-500 bg-gray-50">
                                                        <div className="flex flex-col items-center">
                                                            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                                                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                                                </svg>
                                                            </div>
                                                            <span className="text-lg font-medium">Loading transaction summary...</span>
                                                            <span className="text-sm text-gray-400 mt-1">Please wait while we fetch your data</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                        <tfoot className="bg-gray-50">
                                            <tr>
                                                <td colSpan={isBranchManagerView ? "30" : "21"} className="px-4 py-3 text-center text-gray-500"></td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    )
}

export default TransactionSummary;