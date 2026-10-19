import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { 
    UserPlus, Wallet, Banknote, Scale, AlertCircle, XCircle, UserMinus,
    Share2, Lock, Truck, AlertTriangle, Heart, X, DollarSign, HelpCircle,
    MinusCircle, ArrowLeftRight, RotateCcw, Users, Clock, PencilLine,
    TrendingUp, TrendingDown, Minus, Search, Filter, Calendar, ChevronDown,
    CheckCircle2, XOctagon, ChevronLeft, ChevronRight, Activity, BarChart2, Upload,
    ShieldAlert,
} from 'lucide-react';
import ClientSearchTool from './ClientSearchTool';
import { Doughnut, Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useRouter } from 'next/router';
import { getApiBaseUrl } from '@/lib/constants';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useMemo } from 'react';
import DatePicker from "@/lib/ui/DatePicker";
import moment from 'moment';
import Spinner from "../Spinner";
import { getMonths, getQuarters, getWeeks, getYears } from '@/lib/date-utils';
import CustomSelect from './CustomSelect';
import DelinquentAlertsModal from './DelinquentAlertsModal';

ChartJS.register(...registerables, ChartDataLabels);

const getEffectiveDate = (date, holidays = []) => {
    const holidaySet = new Set(holidays.map(h => h.date));
    let candidate = moment(date);
    for (let i = 0; i < 14; i++) {
        const dayOfWeek = candidate.day();
        const monthDay  = candidate.format('MM-DD');
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidaySet.has(monthDay)) return candidate.format('YYYY-MM-DD');
        candidate = candidate.subtract(1, 'day');
    }
    return date;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN DASHBOARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const DashboardPage = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const holidayList = useSelector(state => state.holidays.list);
    const branch = useSelector(state => state.branch.data);

    const [timeFilter, setTimeFilter] = useState('daily');
    const [branchFilter, setBranchFilter] = useState('all');
    const [areaFilter, setAreaFilter] = useState('all');
    const [regionFilter, setRegionFilter] = useState('all');
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [loanOfficerFilter, setLoanOfficerFilter] = useState('all');
    const [summaryData, setSummaryData] = useState({});

    // ── PAYMENT PERFORMANCE CHART ──────────────────────────────
    const paymentMetrics = [
        { value: 'newMember', label: 'New Member', type: 'number' },
        { value: 'totalReloaner', label: 'Total Reloaner', type: 'number' },
        { value: 'mcbuWithdrawals', label: 'MCBU Withdrawals', type: 'currency' },
        { value: 'csfWithdrawals', label: 'CSF Withdrawals', type: 'currency' },
        { value: 'mcbuReturnPerson', label: 'No. of MCBU Return Person', type: 'number' },
        { value: 'mcbuCsfReturnAmount', label: 'MCBU / CSF Return Amount', type: 'currency' },
        { value: 'mcbuInterest', label: 'MCBU Interest', type: 'currency' },
        { value: 'fullPaymentPerson', label: 'Full Payment Person', type: 'number' },
        { value: 'fullPaymentAmount', label: 'Full Payment Amount', type: 'currency' }
    ];

    const [paymentPeriod, setPaymentPeriod] = useState('week');
    const [paymentCustomStart, setPaymentCustomStart] = useState('');
    const [paymentCustomEnd, setPaymentCustomEnd] = useState('');
    const [paymentChartRows, setPaymentChartRows] = useState([]);
    const [paymentChartLoading, setPaymentChartLoading] = useState(false);
    const [paymentChartError, setPaymentChartError] = useState('');

    // ============================================================
    // PAYMENT COLLECTION CHART - FETCH DATA
    // ============================================================

    useEffect(() => {
        if (!currentDate) return;

        if (
            paymentPeriod === 'custom' &&
            (!paymentCustomStart || !paymentCustomEnd)
        ) {
            setPaymentChartRows([]);
            setPaymentChartError('');
            return;
        }

        const fetchPaymentChart = async () => {
            setPaymentChartLoading(true);
            setPaymentChartError('');

            try {
                const selectedDate = moment(
                    dateFilter || currentDate
                );

                let startDate;
                let endDate;

                switch (paymentPeriod) {
                    case 'day':
                        startDate = selectedDate.format('YYYY-MM-DD');
                        endDate = selectedDate.format('YYYY-MM-DD');
                        break;

                    case 'week':
                        startDate = selectedDate
                            .clone()
                            .startOf('isoWeek')
                            .format('YYYY-MM-DD');

                        endDate = selectedDate
                            .clone()
                            .endOf('isoWeek')
                            .format('YYYY-MM-DD');
                        break;

                    case 'month':
                        startDate = selectedDate
                            .clone()
                            .startOf('month')
                            .format('YYYY-MM-DD');

                        endDate = selectedDate
                            .clone()
                            .endOf('month')
                            .format('YYYY-MM-DD');
                        break;

                    case 'year':
                        startDate = selectedDate
                            .clone()
                            .startOf('year')
                            .format('YYYY-MM-DD');

                        endDate = selectedDate
                            .clone()
                            .endOf('year')
                            .format('YYYY-MM-DD');
                        break;

                    case 'custom':
                        startDate = paymentCustomStart;
                        endDate = paymentCustomEnd;
                        break;

                    default:
                        return;
                }

                if (startDate > endDate) {
                    throw new Error(
                        'Start date cannot be later than end date.'
                    );
                }

                const params = new URLSearchParams({
                    startDate,
                    endDate
                });

                if (divisionFilter !== 'all') {
                    params.set('divisionId', divisionFilter);
                }

                if (regionFilter !== 'all') {
                    params.set('regionId', regionFilter);
                }

                if (areaFilter !== 'all') {
                    params.set('areaId', areaFilter);
                }

                if (branchFilter !== 'all') {
                    params.set('branchId', branchFilter);
                }

                if (loanOfficerFilter !== 'all') {
                    params.set('loId', loanOfficerFilter);
                }

                const response = await fetchWrapper.get(
                    getApiBaseUrl() +
                    '/dashboard/payment-collection-chart?' +
                    params.toString()
                );

                if (!response?.success) {
                    throw new Error(
                        response?.message ||
                        'Failed to load payment chart.'
                    );
                }

                const rows = Array.isArray(response.data)
                    ? response.data
                    : [];

                const normalizedRows = rows
                    .map(row => ({
                        ...row,
                        date: row.reportDate
                    }))
                    .sort((a, b) =>
                        String(a.date).localeCompare(String(b.date))
                    );

                setPaymentChartRows(normalizedRows);

                console.log(
                    'PAYMENT CHART DATA:',
                    normalizedRows
                );

            } catch (error) {
                console.error(
                    'Payment Chart Error:',
                    error
                );

                setPaymentChartError(
                    error.message || 'Unable to load chart.'
                );

                setPaymentChartRows([]);

            } finally {
                setPaymentChartLoading(false);
            }
        };

        fetchPaymentChart();

    }, [
        currentDate,
        dateFilter,
        paymentPeriod,
        paymentCustomStart,
        paymentCustomEnd,
        divisionFilter,
        regionFilter,
        areaFilter,
        branchFilter,
        loanOfficerFilter
    ]);

    const [branchList, setBranches] = useState([]);
    const [regionList, setRegions] = useState([]);
    const [areaList, setAreas] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [loanOfficerList, setLoanOfficers] = useState([]);
    const [timeFilterList, setTimeFilterList] = useState(getYears());
    const [selectedFilter, setSelectedFilter] = useState();
    const [selectedYear, setSelectedYear] = useState(moment(currentDate).year());
    const [yearList] = useState(getYears);
    const fetchTimeoutRef = useRef(null);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

    // ── LOWER REPORT FILTER ─────────────────────────────────────────
    const [reportTimeFilter, setReportTimeFilter] = useState('daily');
    const [reportDate, setReportDate] = useState(null);
    const [reportYear, setReportYear] = useState(moment(currentDate).year());
    const [reportPeriodList, setReportPeriodList] = useState([]);
    const [reportSelectedPeriod, setReportSelectedPeriod] = useState(null);

    const [reportDivision, setReportDivision] = useState('all');
    const [reportRegion, setReportRegion] = useState('all');
    const [reportArea, setReportArea] = useState('all');
    const [reportBranch, setReportBranch] = useState('all');

    const [reportMoreFilters, setReportMoreFilters] = useState(false);
    const [reportData, setReportData] = useState({});
    const [reportLoading, setReportLoading] = useState(false);

    useEffect(() => {
        if (currentDate && !reportDate) {
            setReportDate(
                moment(currentDate).format('YYYY-MM-DD')
            );
        }
    }, [currentDate]);

    useEffect(() => {
        let list = [];

        switch (reportTimeFilter) {
            case 'weekly':
                list = getWeeks(reportYear).map(item => ({
                    ...item,
                    field: 'week'
                }));
                break;

            case 'monthly':
                list = getMonths(reportYear).map(item => ({
                    ...item,
                    field: 'month'
                }));
                break;

            case 'quarterly':
                list = getQuarters().map(item => ({
                    ...item,
                    field: 'quarter'
                }));
                break;

            default:
                list = [];
                break;
        }

        setReportPeriodList(list);
        setReportSelectedPeriod(list.length > 0 ? list[0] : null);

    }, [reportTimeFilter, reportYear]);

    const regions = useMemo(() => 
        regionList.filter(
            r => divisionFilter === 'all' || 
            r._id === 'all' || 
            r.divisionId === divisionFilter), 
            [regionList, divisionFilter]
        );

    const areas = useMemo(() => 
        areaList.filter(
            a => regionFilter === 'all' || 
            a._id === 'all' || 
            a.regionId === regionFilter), 
            [regionFilter, areaList]
        );

    const branches = useMemo(() => 
        branchList.filter(
            b => areaFilter === 'all' || 
            b._id === 'all' || 
            b.areaId === areaFilter), 
            [areaFilter, branchList]
        );

    const loanOfficers = useMemo(() => 
        loanOfficerList.filter(
            l => branchFilter === 'all' || 
            l._id === 'all' || 
            l.designatedBranchId === branchFilter), 
            [branchFilter, loanOfficerList]
        );

    const [isMobile, setIsMobile] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [dateFilter, setDateFilter] = useState(null);

    const [statusData, setStatusData] = useState({
        closedBranches: 0,
        totalBranches: 0,
        activeUsers: 0,
        cashOnHand: 0,
        bankBalance: 0,
        managementExpenses: 0,
        staleBranchesCount: 0,
        staleBranches: [],
    });

    // ── DELINQUENT ALERTS STATE ───────────────────────────────────────────────
    const [delinquentAlerts, setDelinquentAlerts] = useState([]);
    const [delinquentAlertsLoading, setDelinquentAlertsLoading] = useState(false);
    const [showDelinquentModal, setShowDelinquentModal] = useState(false);

    const delinquentAlertCount = delinquentAlerts.filter(a => !a.is_read).length;
    const totalAlertCount      = delinquentAlerts.length;

    // Only show the button for BM (rep=3) and above (rep <= 3)
    const canSeeDelinquentAlerts = currentUser?.role?.rep <= 3;

    const fetchDelinquentAlerts = async () => {
        setDelinquentAlertsLoading(true);
        try {
            const today = moment(currentDate).format('YYYY-MM-DD');
            const res = await fetchWrapper.get(
                getApiBaseUrl() + 
                `notifications/list?limit=50&offset=0&types=successive_delinquent_transaction,delinquent_client_as_reloaner&date=${today}`
            );
            if (res.success) {
                setDelinquentAlerts(res.notifications || []);
            }
        } catch (e) {
            console.error('Failed to fetch delinquent alerts:', e);
        } finally {
            setDelinquentAlertsLoading(false);
        }
    };

    useEffect(() => {
        if (canSeeDelinquentAlerts && currentDate) {
            fetchDelinquentAlerts();
        }
    }, [currentUser, currentDate]);

    const handleDelinquentNavigate = (alert) => {
        return;
        // setShowDelinquentModal(false);
        // if (alert.client_id) {
        //     router.push(`/clients/${alert.client_id}`);
        // }
    };
    // ─────────────────────────────────────────────────────────────────────────

    const [clientsCollectionData, setClientsCollectionData] = useState({
        labels: [
            'Good Clients', 
            'Late Clients', 
            'Mis Payment Clients', 
            'Past Due Clients'
        ],        
        datasets: [
            { data: [0,0,0,0], 
                backgroundColor: [
                    '#BBF7D0',
                    '#FEF08A',
                    '#FECDD3',
                    '#E9D5FF'
                ], 
                
                borderWidth: 0, 
                cutout: '70%' 
            }
        ]
    });

    const [keyMetricsChartData, setKeyMetricsChartData] = useState({
        labels: [
            'MCBU', 
            'CSF', 
            'Total Loan Release', 
            'Total Loan Balance'
        ],
        datasets: [
            { label: 
                'Current', 
                    data: [0,0,0,0], 
                    backgroundColor: [
                        '#BFDBFE',
                        '#DDD6FE',
                        '#FED7AA',
                        '#FEF08A'
                    ], 
                    borderRadius: 8, 
                    borderWidth: 0 
            }
        ]
    });

    useEffect(() => { 
        fetchSummaries(); 
    }, [
        divisionFilter, 
        regionFilter, 
        areaFilter, 
        branchFilter, 
        loanOfficerFilter, 
        timeFilter, 
        timeFilterList, 
        dateFilter, 
        selectedFilter, 
        currentDate
    ]);

    useEffect(() => {
        switch(timeFilter) {
            case 'weekly': { 
                const weeks = getWeeks(selectedYear).map(o => ({ ...o, field: 'week' }));
                    setTimeFilterList(weeks);
                    setSelectedFilter(weeks[0]); 
                break; 
            }

            case 'monthly': {
                const months = getMonths(selectedYear).map(o => ({ ...o, field: 'month' }));
                    setTimeFilterList(months);
                    setSelectedFilter(months[0]);
                break;
            }

            case 'quarterly': {
                const quarters = getQuarters().map(o => ({ ...o, field: 'quarter' }));
                    setSelectedFilter(quarters[0]);
                    setTimeFilterList(quarters);
                break; 
            }

            default: break;
        }
    }, [timeFilter, selectedYear]);

    useEffect(() => {
        const handleResize = () => { const width = window.innerWidth; setWindowWidth(width); setIsMobile(width < 768); if (width >= 768) setIsNavVisible(true); };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const toggleNav = () => setIsNavVisible(!isNavVisible);
    const lastStatusDateRef = useRef(null);

    const fetchDashboardStatus = useCallback(() => {
        if (!currentDate || !currentUser) return;
        const date = moment(dateFilter ?? currentDate).format('YYYY-MM-DD');
        if (lastStatusDateRef.current === date) return;
        lastStatusDateRef.current = date;
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/status?date=' + date)
            .then(resp => { if (resp.success) setStatusData(resp.data); })
            .catch(err => console.error('fetchDashboardStatus', err));
    }, [currentDate, dateFilter, currentUser]);

    useEffect(() => { if (currentUser?.role?.rep <= 2) fetchDashboardStatus(); }, [fetchDashboardStatus]);

    useEffect(() => {
        if (summaryData.activeClients) {
            const ac = summaryData.activeClients || 0, pc = summaryData.pendingClients || 0;
            const mp = summaryData.mispaymentPerson || 0, pd = summaryData.pastDuePerson || 0;
            setClientsCollectionData({
                labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
                datasets: [{ data: [Math.max(0,ac-pc-mp-pd), pc, mp, pd], backgroundColor: ['#BBF7D0','#FEF08A','#FECDD3','#E9D5FF'], borderWidth: 0, cutout: '70%' }]
            });
        }
        setKeyMetricsChartData({
            labels: ['MCBU', 'CSF', 'Total Loan Release', 'Total Loan Balance'],
            datasets: [{ label: 'Current', data: [summaryData.mcbu||0, summaryData.csf||0, summaryData.totalLoanRelease||0, summaryData.totalLoanBalance||0], backgroundColor: ['#BFDBFE','#DDD6FE','#FED7AA','#FEF08A'], borderRadius: 8, borderWidth: 0 }]
        });
    }, [summaryData]);

    useEffect(() => {
        if (!currentDate || !Array.isArray(holidayList)) return;
        const effective = getEffectiveDate(currentDate, holidayList);
        setDateFilter(prev => (prev === null ? effective : prev));
    }, [currentDate, holidayList]);

    const formatNumber = (num) => { if (num === undefined || num === null) return 'N/A'; if (typeof num === 'number') return num.toLocaleString('en-US'); return num; };
    const formatCurrency = (num) => {
        const value = Number(num || 0);

        return `₱${value.toLocaleString('en-US')}`;
    };

    // ============================================================
    // DCS TABLE VALUE HELPER
    // ============================================================

    const getDcsValue = (label, category) => {
        const fieldMap = {
            'Active Clients': 'activeClients',
            'MCBU Balance': 'mcbu',
            'CSF Balance': 'csf',
            'Total loan Release': 'totalLoanRelease',
            'Active Borrower': 'activeBorrowers',
            'Total Loan Balance': 'totalLoanBalance',
            'Past Due Person': 'pastDuePerson',
            'Past Due MCBU Balance': 'pastDueMcbu',
            'Past Due Loan Release': 'pastDueLoanRelease',
            'Past Due Loan Balance': 'pastDueLoanBalance',
            'Past Due Net Risk': 'pastDueNetRisk',
            'No. Of Excuses': 'noOfExcuses',
            'Excuses MCBU Balance': 'excusesMcbu',
            'Excuses Loan Release': 'excusesLoanRelease',
            'Excuses Loan Balance': 'excusesLoanBalance',
            'Net Loan Balance': 'netLoanBalance'
        };

        const field = fieldMap[label];

        if (!field) {
            return '-';
        }

        const capitalizedField =
            field.charAt(0).toUpperCase() +
            field.slice(1);

        let dataKey = field;

        if (category === 'weekly') {
            dataKey = `weekly${capitalizedField}`;
        }

        if (category === 'accelerated') {
            dataKey = `accelerated${capitalizedField}`;
        }

        if (category === 'consolidated') {
            dataKey = `consolidated${capitalizedField}`;
        }

        // No result should not be displayed as a real zero.
        if (
            reportData[dataKey] === undefined ||
            reportData[dataKey] === null
        ) {
            return '-';
        }

        const value = Number(reportData[dataKey]);

        if (!Number.isFinite(value)) {
            return '-';
        }

        const numberFields = [
            'activeClients',
            'activeBorrowers',
            'pastDuePerson',
            'noOfExcuses'
        ];

        if (numberFields.includes(field)) {
            return formatNumber(value);
        }

        return formatCurrency(value);
    };

    const fetchSummaries = () => {
        if (!currentDate || !dateFilter) return;
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
            setLoading(true);
            let selectedDate = null;
            switch(timeFilter) {
                case 'weekly': selectedDate = { value: moment(selectedFilter?.value ?? currentDate).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'monthly': selectedDate = { value: moment(selectedYear+'-'+(selectedFilter?.value??'01')+'-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'quarterly': selectedDate = { value: moment(selectedYear+'-01-01').quarter(selectedFilter?.value??1).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'yearly': selectedDate = { value: moment(selectedYear+'-12-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                default: selectedDate = { value: moment(dateFilter).format('YYYY-MM-DD'), field: 'date_added' }; break;
            }
            const queries = [
                selectedDate,
                { value: moment(currentDate).format('YYYY-MM-DD'), field: 'currentDate' },
                { value: timeFilter, field: 'filter' },
                { value: divisionFilter, field: 'divisionId' },
                { value: regionFilter, field: 'regionId' },
                { value: areaFilter, field: 'areaId' },
                { value: branchFilter, field: 'branchId' },
                { value: selectedYear, field: 'year' },
                { value: loanOfficerFilter, field: 'loId' },
            ].filter(a => a.value !== 'all' && !!a.value).map(a => `${a.field}=${a.value}`).join('&');

            setSummaryData({});
            fetchWrapper.get(getApiBaseUrl() + '/dashboard?' + queries + '&type=summary')
                .then(resp => { setSummaryData(resp.data?.[0] ?? {}); })
                .catch(error => { console.log(error); })
                .finally(() => { setLoading(false); });
        }, 400);
    };

    const fetchBranches = () =>
        fetchWrapper.get(getApiBaseUrl()+'/dashboard/branches').then(r =>
            setBranches([{_id:'all',name:'All',code:''},...r.data])).catch(console.log);

    const fetchRegions = () =>
        fetchWrapper.get(getApiBaseUrl()+'/dashboard/regions').then(r =>
            setRegions([{_id:'all',name:'All'},...r.data])).catch(console.log);

    const fetchAreas = () =>
        fetchWrapper.get(getApiBaseUrl()+'/dashboard/areas').then(r =>
            setAreas([{_id:'all',name:'All'},...r.data])).catch(console.log);

    const fetchDivisions = () =>
        fetchWrapper.get(getApiBaseUrl()+'/dashboard/divisions').then(r =>
            setDivisions([{_id:'all',name:'All'},...r.data])).catch(console.log);

    const fetchLoanOfficers = () =>
        fetchWrapper.get(getApiBaseUrl()+'/dashboard/loan-officers').then(r =>
            setLoanOfficers([{_id:'all',firstName:'All',lastName:''},...r.data])).catch(console.log);
            
    const handleDateFilter = (selected) =>
        setDateFilter(selected.target.value);

    useEffect(() => {
        fetchBranches();
        fetchRegions();
        fetchAreas();
        fetchDivisions();
        fetchLoanOfficers();
        fetchSummaries();
    }, []);

    const timeFilterOptions = [
        {value:'daily',label:'Daily'},
        {value:'weekly',label:'Weekly'},
        {value:'monthly',label:'Monthly'},
        {value:'quarterly',label:'Quarterly'},
        {value:'yearly',label:'Yearly'}
    ];
    
    const branchOptions = branches.map(b => ({value:b._id, label:`${b.code} ${b.name}`.trim()}));
    const regionOptions = regions.map(r => ({value:r._id, label:r.name}));
    const areaOptions = areas.map(a => ({value:a._id, label:a.name}));
    const divisionOptions = divisions.map(d => ({value:d._id, label:d.name}));
    const loanOfficerOptions = loanOfficers.map(lo => ({value:lo._id, label:`${lo.firstName} ${lo.lastName}`.trim()}));
    const yearOptions = yearList.map(y => ({value:y.value, label:y.label}));
    const timeFilterListOptions = timeFilterList.map((item,index) => ({value:index, label:item.label}));

    // ── DCS REPORT FILTER OPTIONS ────────────────────────────────
    const reportRegionOptions = regionList
        .filter(item =>
            reportDivision === 'all' ||
            item._id === 'all' ||
            item.divisionId === reportDivision
        )
        .map(item => ({
            value: item._id,
            label: item.name
        }));

    const reportAreaOptions = areaList
        .filter(item =>
            reportRegion === 'all' ||
            item._id === 'all' ||
            item.regionId === reportRegion
        )
        .map(item => ({
            value: item._id,
            label: item.name
        }));

    const reportBranchOptions = branchList
        .filter(item =>
            reportArea === 'all' ||
            item._id === 'all' ||
            item.areaId === reportArea
        )
        .map(item => ({
            value: item._id,
            label: `${item.code || ''} ${item.name || ''}`.trim()
        }));

    const reportPeriodOptions = reportPeriodList.map((item, index) => ({
        value: index,
        label: item.label
    }));

    // ============================================================
    // DCS PERFORMANCE REPORT
    // Daily             = 60 days
    // Weekly Standard   = 24 weeks
    // Weekly Accelerated = 12 weeks
    // Consolidated      = Daily + Weekly + Accelerated
    // ============================================================

    const handleReportSearch = async () => {
        setReportLoading(true);
        setReportData({});

        try {
            // Determine the selected reporting date
            let selectedReportDate = moment(
                reportDate || currentDate
            ).format('YYYY-MM-DD');

            if (reportTimeFilter === 'weekly') {
                if (!reportSelectedPeriod?.value) {
                    throw new Error('Please select a week.');
                }

                selectedReportDate = moment(
                    reportSelectedPeriod.value
                ).format('YYYY-MM-DD');
            }

            if (reportTimeFilter === 'monthly') {
                const month = Number(reportSelectedPeriod?.value);

                if (!month || month < 1 || month > 12) {
                    throw new Error('Please select a valid month.');
                }

                selectedReportDate = moment(
                    `${reportYear}-${String(month).padStart(2, '0')}-01`
                )
                    .endOf('month')
                    .format('YYYY-MM-DD');
            }

            if (reportTimeFilter === 'quarterly') {
                const quarter = Number(reportSelectedPeriod?.value);

                if (!quarter || quarter < 1 || quarter > 4) {
                    throw new Error('Please select a valid quarter.');
                }

                selectedReportDate = moment(
                    `${reportYear}-01-01`
                )
                    .quarter(quarter)
                    .endOf('quarter')
                    .format('YYYY-MM-DD');
            }

            if (reportTimeFilter === 'yearly') {
                selectedReportDate = `${reportYear}-12-31`;
            }

            // Build parameters for the new DCS API
            const params = new URLSearchParams({
                date: selectedReportDate
            });

            if (reportDivision !== 'all') {
                params.set('divisionId', reportDivision);
            }

            if (reportRegion !== 'all') {
                params.set('regionId', reportRegion);
            }

            if (reportArea !== 'all') {
                params.set('areaId', reportArea);
            }

            if (reportBranch !== 'all') {
                params.set('branchId', reportBranch);
            }

            // NEW API — uses fn_get_dcs_performance_report
            const response = await fetchWrapper.get(
                getApiBaseUrl() +
                '/dashboard/dcs-performance?' +
                params.toString()
            );

            if (response?.success === false) {
                throw new Error(
                    response.message || 'Unable to load DCS report.'
                );
            }

            const rows = Array.isArray(response?.data)
                ? response.data
                : [];

            console.log('DCS PERFORMANCE RESPONSE:', rows);

            if (!rows.length) {
                throw new Error('No DCS performance data was returned.');
            }

            // The SQL function returns four categorized rows.
            const categories = {
                daily: rows.find(
                    row => row.category === 'daily'
                ),
                weekly: rows.find(
                    row => row.category === 'weekly'
                ),
                accelerated: rows.find(
                    row => row.category === 'accelerated'
                ),
                consolidated: rows.find(
                    row => row.category === 'consolidated'
                )
            };

            const fields = [
                'activeClients',
                'mcbu',
                'csf',
                'totalLoanRelease',
                'activeBorrowers',
                'totalLoanBalance',
                'pastDuePerson',
                'pastDueMcbu',
                'pastDueLoanRelease',
                'pastDueLoanBalance',
                'pastDueNetRisk',
                'noOfExcuses',
                'excusesMcbu',
                'excusesLoanRelease',
                'excusesLoanBalance',
                'netLoanBalance'
            ];

            const result = {};

            fields.forEach(field => {
                const capitalizedField =
                    field.charAt(0).toUpperCase() +
                    field.slice(1);

                // Daily
                result[field] =
                    categories.daily?.[field] ?? null;

                // Weekly Standard
                result[`weekly${capitalizedField}`] =
                    categories.weekly?.[field] ?? null;

                // Weekly Accelerated
                result[`accelerated${capitalizedField}`] =
                    categories.accelerated?.[field] ?? null;

                // Consolidated — use actual SQL result
                result[`consolidated${capitalizedField}`] =
                    categories.consolidated?.[field] ?? null;
            });

            console.log('DCS PERFORMANCE DATA:', result);

            setReportData(result);

        } catch (error) {
            console.error('DCS PERFORMANCE ERROR:', error);

            toast.error(
                error.message || 'Unable to load DCS performance.'
            );

            setReportData({});

        } finally {
            setReportLoading(false);
        }
    };

    const donutChartOptions = {
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>{ const v=ctx.parsed,t=ctx.dataset.data.reduce((a,b)=>a+b,0); return `${ctx.label}: ${v.toLocaleString()} (${((v/t)*100).toFixed(1)}%)`; }}}, datalabels:{display:false} }
    };
        const miniBarOptions = {
            responsive:true,
            maintainAspectRatio:false,
            indexAxis:'y',
            plugins:{
                legend:{display:false},
                datalabels:{display:false}
            },
            scales:{
                x:{display:false},
                y:{
                    display:true,
                    ticks:{font:{size:9}, color:'#64748b'}
                }
            }
        };

        const dashboardDonutOptions = {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        padding: 14,
                        font: {
                            size: 10
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            }
        };

        // ── PAYMENT COLLECTION LINE CHART ─────────────────────────

        const paymentChartColors = [
            '#F5B700', // New Member
            '#2563EB', // Total Reloaner
            '#16A34A', // MCBU Withdrawals
            '#9333EA', // CSF Withdrawals
            '#EA580C', // MCBU Return Person
            '#0891B2', // MCBU / CSF Return Amount
            '#DB2777', // MCBU Interest
            '#64748B', // Full Payment Person
            '#DC2626'  // Full Payment Amount
        ];

        const paymentChartData = {
            labels: paymentChartRows.map(row =>
                moment(row.date).format(
                    paymentPeriod === 'year'
                        ? 'MMM'
                        : 'MMM D'
                )
            ),

            datasets: paymentMetrics.map((metric, index) => ({
                label: metric.label,

                data: paymentChartRows.map(row => {
                    const value = row[metric.value];

                    return value === null || value === undefined
                        ? null
                        : Number(value);
                }),

                borderColor: paymentChartColors[index],
                backgroundColor: paymentChartColors[index],

                yAxisID:
                    metric.type === 'currency'
                        ? 'yCurrency'
                        : 'yPerson',

                fill: false,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBorderWidth: 2,
                pointHoverBorderColor: '#FFFFFF',
                spanGaps: false
            }))
        };

        const paymentChartOptions = {
            responsive: true,
            maintainAspectRatio: false,

            interaction: {
                mode: 'index',
                intersect: false
            },

            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',

                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 12,

                        color: '#475569',

                        font: {
                            size: 10
                        }
                    }
                },

                datalabels: {
                    display: false
                },

                tooltip: {
                    mode: 'index',
                    intersect: false,

                    backgroundColor: '#FFFFFF',
                    titleColor: '#334155',
                    bodyColor: '#334155',
                    borderColor: '#E2E8F0',
                    borderWidth: 1,
                    padding: 12,

                    callbacks: {
                        label: (context) => {
                            const metric = paymentMetrics[context.datasetIndex];

                            const value = context.parsed.y;

                            if (value === null) {
                                return `${metric.label}: No data`;
                            }

                            const formatted =
                                metric.type === 'currency'
                                    ? `₱${value.toLocaleString('en-PH')}`
                                    : value.toLocaleString('en-PH');

                            return `${metric.label}: ${formatted}`;
                        }
                    }
                }
            },

            scales: {
                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: '#94A3B8',
                        font: {
                            size: 10
                        }
                    }
                },

                yPerson: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: 'Persons'
                    },

                    grid: {
                        color: '#F1F5F9'
                    },

                    ticks: {
                        precision: 0
                    }
                },

                yCurrency: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    beginAtZero: true,

                    title: {
                        display: true,
                        text: 'Amount (₱)'
                    },

                    grid: {
                        drawOnChartArea: false
                    },

                    ticks: {
                        callback: value =>
                            '₱' + Number(value).toLocaleString('en-PH')
                    }
                }
            }
        };

        // Loan Portfolio Status
        const loanPortfolioChartData = {
            labels: [
                'Performing',
                'Past Due',
                'Excused'
            ],
            datasets: [
                {
                    data: [
                        Math.max(
                            0,
                            Number(summaryData.totalLoanBalance || 0) -
                            Number(summaryData.pastDueAmount || 0) -
                            Number(summaryData.excusedLoanBalance || 0)
                        ),
                        Number(summaryData.pastDueAmount || 0),
                        Number(summaryData.excusedLoanBalance || 0)
                    ],
                    backgroundColor: [
                        '#22C55E',
                        '#EF4444',
                        '#F59E0B'
                    ],
                    borderWidth: 0
                }
            ]
        };

        // Risk Indicator
        const riskIndicatorChartData = {
            labels: [
                'Good',
                'Mis Payment',
                'Past Due'
            ],
            datasets: [
                {
                    data: [
                        Math.max(
                            0,
                            Number(summaryData.activeClients || 0) -
                            Number(summaryData.mispaymentPerson || 0) -
                            Number(summaryData.pastDuePerson || 0)
                        ),
                        Number(summaryData.mispaymentPerson || 0),
                        Number(summaryData.pastDuePerson || 0)
                    ],
                    backgroundColor: [
                        '#22C55E',
                        '#F59E0B',
                        '#EF4444'
                    ],
                    borderWidth: 0
                }
            ]
        };

    // ── derived values ─────────────────────────────────
    const totalReleasePerson = (summaryData.currentReleasePerson_New||0) + (summaryData.currentReleasePerson_Rel||0);
    const filterLabel = timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1);

    // ── Reusable row for top cards (no trend indicator needed) ────────
    const InfoRow = ({ label, value }) => (
        <div className="flex items-center justify-between py-1.5 border-b border-gray-100 last:border-0">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-sm font-bold text-gray-800">{formatNumber(value || 0)}</p>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* DELINQUENT ALERTS MODAL */}
            {showDelinquentModal && (
                <DelinquentAlertsModal
                    alerts={delinquentAlerts}
                    loading={delinquentAlertsLoading}
                    onClose={() => setShowDelinquentModal(false)}
                    onNavigate={handleDelinquentNavigate}
                />
            )}

            <div className="flex-grow p-4 flex flex-col overflow-x-auto">

                {/* ── FILTER TOOLBAR ── */}
                <div className="flex flex-col pb-4 border-b border-gray-200 gap-3 mb-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <CustomSelect value={timeFilter} onChange={setTimeFilter} options={timeFilterOptions} placeholder="Select Time Period" icon={Calendar} className="w-40" />
                        {timeFilter === 'daily' && currentDate && (
                            <div className="w-40">
                                <DatePicker name="dateFilter" value={dateFilter ? moment(dateFilter).format('YYYY-MM-DD') : ''} maxDate={currentDate} onChange={handleDateFilter} height="h-[42px]" />
                            </div>
                        )}
                        {timeFilter !== 'daily' && <CustomSelect value={selectedYear} onChange={setSelectedYear} options={yearOptions} placeholder="Select Year" className="w-32" />}
                        {timeFilter !== 'yearly' && timeFilter !== 'daily' && (
                            <CustomSelect value={timeFilterList.findIndex(item=>item===selectedFilter)} onChange={index=>setSelectedFilter(timeFilterList[index])} options={timeFilterListOptions} placeholder={`Select ${filterLabel}`} className="w-40" />
                        )}
                        <button onClick={() => setIsFiltersExpanded(!isFiltersExpanded)} className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200">
                            <Filter className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">{isFiltersExpanded ? 'Less Filters' : 'More Filters'}</span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        <button onClick={() => setIsSearchVisible(!isSearchVisible)} className="flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200">
                            <Search className="w-4 h-4" />
                            <span className="text-sm font-medium">{isSearchVisible ? 'Hide Search' : 'Search Client'}</span>
                        </button>

                        {/* ── DELINQUENT ALERTS BUTTON — rightmost ── */}
                        {canSeeDelinquentAlerts && (
                            <button
                                onClick={() => setShowDelinquentModal(true)}
                                className={`relative ml-auto flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-sm border font-medium text-sm transition-all duration-200
                                    ${totalAlertCount > 0
                                        ? 'bg-red-50 border-red-300 text-red-700 hover:bg-red-100'
                                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                                    }`}
                            >
                                <ShieldAlert className={`w-4 h-4 ${totalAlertCount > 0 ? 'text-red-500' : 'text-gray-400'}`} />
                                <span>Delinquent Alerts</span>

                                {/* Single badge — unread count if any, else total */}
                                {totalAlertCount > 0 && (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold text-white
                                        ${delinquentAlertCount > 0 ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}>
                                        {delinquentAlertCount > 0 ? delinquentAlertCount : totalAlertCount}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>
                    {isFiltersExpanded && (
                        <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border">
                            {divisions.length > 2 && 
                                <CustomSelect 
                                    value={divisionFilter}
                                    onChange={(value) => {
                                        setDivisionFilter(value);
                                        setRegionFilter('all');
                                        setAreaFilter('all');
                                        setBranchFilter('all');
                                        setLoanOfficerFilter('all');
                                    }}
                                    options={divisionOptions}
                                    placeholder="Select Division" className="w-40" 
                                />
                            }

                            {regions.length > 2 && 
                                <CustomSelect value={regionFilter}
                                    onChange={(value) => {
                                        setRegionFilter(value);
                                        setAreaFilter('all');
                                        setBranchFilter('all');
                                        setLoanOfficerFilter('all');
                                    }}
                                    options={regionOptions}
                                    placeholder="Select Region" className="w-40" 
                                />
                            }

                            {areas.length > 2 && 
                                <CustomSelect 
                                    value={areaFilter}
                                    onChange={(value) => {
                                        setAreaFilter(value);
                                        setBranchFilter('all');
                                        setLoanOfficerFilter('all');
                                    }}
                                    options={areaOptions}
                                    placeholder="Select Area"
                                    className="w-40" 
                                />
                            }

                            {branchList.length > 2 && 
                                <CustomSelect 
                                    value={branchFilter}
                                    onChange={(value) => {
                                        setBranchFilter(value);
                                        setLoanOfficerFilter('all');
                                    }}
                                    options={branchOptions}
                                    placeholder="Select Branch" className="w-48" 
                                />
                            }
                            
                            {loanOfficerList.length > 2 &&
                                <CustomSelect 
                                    value={loanOfficerFilter} 
                                    onChange={setLoanOfficerFilter} 
                                    options={loanOfficerOptions} 
                                    placeholder="Select Loan Officer" className="w-48" 
                                />
                            }
                        </div>
                    )}
                    {isSearchVisible && <div className="p-4 bg-white rounded-lg border shadow-sm"><ClientSearchTool /></div>}
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64"><Spinner /></div>
                ) : (
                    <div className="flex flex-col gap-4 min-w-[1400px]">

                        {/* ── TOP SUMMARY CARDS ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                                {/* 1 — Total Prospect Client */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total Prospect Client
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(summaryData.activeClients || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                                            <Users className="w-6 h-6 text-blue-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 2 — Total Cash on Hand */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total Cash on Hand
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(statusData.cashOnHand || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center">
                                            <Wallet className="w-6 h-6 text-green-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 3 — Bank Balance */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Bank Balance
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(statusData.bankBalance || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-purple-50 flex items-center justify-center">
                                            <Banknote className="w-6 h-6 text-purple-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 4 — Total User / Staff */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total User / Staff
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(statusData.activeUsers || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                                            <UserPlus className="w-6 h-6 text-orange-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ── SECOND SUMMARY ROW ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                                {/* 1 — Target Release */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Target Release
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-indigo-50 flex items-center justify-center">
                                            <TrendingUp className="w-6 h-6 text-indigo-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 2 — Total Collection Today */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total Collection (Today)
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(summaryData.loanCollectionDaily || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center">
                                            <Banknote className="w-6 h-6 text-emerald-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 3 — Total Release Person */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total Release (Person)
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(totalReleasePerson || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-cyan-50 flex items-center justify-center">
                                            <Users className="w-6 h-6 text-cyan-500" />
                                        </div>
                                    </div>
                                </div>

                                {/* 4 — Total Release Amount */}
                                <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500 mb-2">
                                                Total Release (Amount)
                                            </p>

                                            <p className="text-2xl font-bold text-gray-900">
                                                {formatNumber(summaryData.currentReleaseAmount || 0)}
                                            </p>
                                        </div>

                                        <div className="w-12 h-12 rounded-lg bg-orange-50 flex items-center justify-center">
                                            <DollarSign className="w-6 h-6 text-orange-500" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                        {/* ── DASHBOARD ANALYTICS ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                        {/* 1 — PAYMENT COLLECTION CHART */}
                        <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                            {/* REVIEW CHART HEADER */}
                            <div className="flex items-center justify-between gap-3 mb-4">

                                {/* LEFT — CHART TITLE */}
                                <div className="flex items-center gap-2">
                                    <TrendingUp className="w-5 h-5 text-yellow-500" />

                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Review Chart
                                        </h2>

                                        <p className="text-xs text-gray-400">
                                            Lending performance trends
                                        </p>
                                    </div>
                                </div>

                                {/* RIGHT — PERIOD DROPDOWN */}
                                <div className="w-36 flex-shrink-0">
                                    <CustomSelect
                                        value={paymentPeriod}
                                        onChange={setPaymentPeriod}
                                        options={[
                                            { value: 'day', label: 'Daily' },
                                            { value: 'week', label: 'Weekly' },
                                            { value: 'month', label: 'Monthly' },
                                            { value: 'year', label: 'Yearly' },
                                            { value: 'custom', label: 'Custom Date Range' }
                                        ]}
                                        placeholder="Select Period"
                                        icon={Calendar}
                                        className="w-full"
                                    />
                                </div>

                            </div>

                            {/* CUSTOM DATE RANGE */}
                            {paymentPeriod === 'custom' && (
                                <div className="flex gap-2 mb-4">
                                    <input
                                        type="date"
                                        value={paymentCustomStart}
                                        onChange={(e) =>
                                            setPaymentCustomStart(e.target.value)
                                        }
                                        className="w-1/2 px-2 py-2 text-xs border rounded-lg"
                                    />

                                    <input
                                        type="date"
                                        value={paymentCustomEnd}
                                        onChange={(e) =>
                                            setPaymentCustomEnd(e.target.value)
                                        }
                                        className="w-1/2 px-2 py-2 text-xs border rounded-lg"
                                    />
                                </div>
                            )}

                            {/* GRAPH */}
                            <div className="h-[320px] relative">
                                {paymentChartLoading ? (
                                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                                        Loading chart...
                                    </div>
                                ) : paymentChartError ? (
                                    <div className="h-full flex items-center justify-center text-xs text-red-500 text-center">
                                        {paymentChartError}
                                    </div>
                                ) : paymentChartRows.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-xs text-gray-400">
                                        No chart data available
                                    </div>
                                ) : (
                                    <Line
                                        data={paymentChartData}
                                        options={paymentChartOptions}
                                    />
                                )}
                            </div>
                        </div>


                            {/* 2 — LOAN PORTFOLIO STATUS */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Scale className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Portfolio Status
                                        </h2>
                                        <p className="text-xs text-gray-400">
                                            Current loan balance distribution
                                        </p>
                                    </div>
                                </div>

                                <div className="h-[250px]">
                                    <Doughnut
                                        data={loanPortfolioChartData}
                                        options={dashboardDonutOptions}
                                    />
                                </div>
                            </div>


                            {/* 3 — RISK INDICATOR */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Risk Indicator
                                        </h2>
                                        <p className="text-xs text-gray-400">
                                            Client risk distribution
                                        </p>
                                    </div>
                                </div>

                                <div className="h-[250px]">
                                    <Doughnut
                                        data={riskIndicatorChartData}
                                        options={dashboardDonutOptions}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ── DCS REPORT FILTER ───────────────────────────────────── */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
                            <div className="p-4 flex flex-col gap-3">
                                <div className="flex flex-wrap items-center gap-3">

                                    {/* TIME FILTER */}
                                    <CustomSelect
                                        value={reportTimeFilter}
                                        onChange={setReportTimeFilter}
                                        options={timeFilterOptions}
                                        placeholder="Select Time Period"
                                        icon={Calendar}
                                        className="w-40"
                                    />

                                    {/* DAILY DATE */}
                                    {reportTimeFilter === 'daily' && currentDate && (
                                        <div className="w-40">
                                            <DatePicker
                                                name="reportDate"
                                                value={
                                                    reportDate
                                                        ? moment(reportDate).format('YYYY-MM-DD')
                                                        : ''
                                                }
                                                maxDate={currentDate}
                                                onChange={(e) =>
                                                    setReportDate(e.target.value)
                                                }
                                                height="h-[42px]"
                                            />
                                        </div>
                                    )}

                                    {/* YEAR */}
                                    {reportTimeFilter !== 'daily' && (
                                        <CustomSelect
                                            value={reportYear}
                                            onChange={setReportYear}
                                            options={yearOptions}
                                            placeholder="Select Year"
                                            className="w-32"
                                        />
                                    )}

                                    {/* WEEK / MONTH / QUARTER */}
                                    {reportTimeFilter !== 'daily' &&
                                    reportTimeFilter !== 'yearly' && (
                                        <CustomSelect
                                            value={
                                                reportSelectedPeriod
                                                    ? reportPeriodList.indexOf(reportSelectedPeriod)
                                                    : 0
                                            }
                                            onChange={(index) =>
                                                setReportSelectedPeriod(
                                                    reportPeriodList[index]
                                                )
                                            }
                                            options={reportPeriodOptions}
                                            placeholder={
                                                reportTimeFilter === 'weekly'
                                                    ? 'Select Week'
                                                    : reportTimeFilter === 'monthly'
                                                    ? 'Select Month'
                                                    : 'Select Quarter'
                                            }
                                            className="w-40"
                                        />
                                    )}

                                    {/* MORE FILTERS */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setReportMoreFilters(prev => !prev)
                                        }
                                        className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-300
                                            rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2
                                            focus:ring-blue-500 transition-all duration-200"
                                    >
                                        <Filter className="w-4 h-4 text-gray-500" />

                                        <span className="text-sm font-medium text-gray-700">
                                            {reportMoreFilters
                                                ? 'Less Filters'
                                                : 'More Filters'}
                                        </span>

                                        <ChevronDown
                                            className={`w-4 h-4 text-gray-500 transition-transform ${
                                                reportMoreFilters ? 'rotate-180' : ''
                                            }`}
                                        />
                                    </button>

                                    {/* SEARCH */}
                                    <button
                                        type="button"
                                        onClick={handleReportSearch}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 text-white rounded-lg
                                            shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500
                                            transition-all duration-200">
                                        
                                        <Search className="w-4 h-4" />

                                        <span className="text-sm font-medium">
                                            Search
                                        </span>
                                    </button>

                                </div>

                                {/* EXPANDED FILTERS */}
                                {reportMoreFilters && (
                                    <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">

                                        {/* DIVISION */}
                                        <CustomSelect
                                            value={reportDivision}
                                            onChange={(value) => {
                                                setReportDivision(value);
                                                setReportRegion('all');
                                                setReportArea('all');
                                                setReportBranch('all');
                                            }}
                                            options={divisionOptions}
                                            placeholder="Select Division"
                                            className="w-48"
                                        />

                                        {/* REGION */}
                                        <CustomSelect
                                            value={reportRegion}
                                            onChange={(value) => {
                                                setReportRegion(value);
                                                setReportArea('all');
                                                setReportBranch('all');
                                            }}
                                            options={reportRegionOptions}
                                            placeholder="Select Region"
                                            className="w-48"
                                        />

                                        {/* AREA */}
                                        <CustomSelect
                                            value={reportArea}
                                            onChange={(value) => {
                                                setReportArea(value);
                                                setReportBranch('all');
                                            }}
                                            options={reportAreaOptions}
                                            placeholder="Select Area"
                                            className="w-48"
                                        />

                                        {/* BRANCH */}
                                        <CustomSelect
                                            value={reportBranch}
                                            onChange={setReportBranch}
                                            options={reportBranchOptions}
                                            placeholder="Select Branch"
                                            className="w-48"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ============================================================
                            DCS PERFORMANCE TABLE
                            ============================================================ */}

                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
                            <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
                                <table className="w-full min-w-[1100px] text-sm">

                                    {/* TABLE HEADER */}
                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-semibold text-gray-700 border-r border-gray-200 min-w-[220px]">
                                                Particulars
                                            </th>

                                            <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200 min-w-[140px]">
                                                Daily (60 Days)
                                            </th>

                                            <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200 min-w-[170px]">
                                                Weekly (24 Weeks)
                                            </th>

                                            <th className="px-4 py-3 text-center font-semibold text-gray-700 border-r border-gray-200 min-w-[180px]">
                                                Weekly Accelerated (12 Weeks)
                                            </th>

                                            <th className="px-4 py-3 text-center font-semibold text-gray-700 min-w-[160px]">
                                                Consolidated
                                            </th>
                                        </tr>
                                    </thead>

                                    {/* TABLE BODY */}
                                    <tbody className="divide-y divide-gray-200">
                                        {[
                                            'Active Clients',
                                            'MCBU Balance',
                                            'CSF Balance',
                                            'Total loan Release',
                                            'Active Borrower',
                                            'Total Loan Balance',
                                            'Past Due Person',
                                            'Past Due MCBU Balance',
                                            'Past Due Loan Release',
                                            'Past Due Loan Balance',
                                            'Past Due Net Risk',
                                            'No. Of Excuses',
                                            'Excuses MCBU Balance',
                                            'Excuses Loan Release',
                                            'Excuses Loan Balance',
                                            'Net Loan Balance'
                                        ].map((label, index) => (

                                            <tr
                                                key={`${label}-${index}`}
                                                className="hover:bg-gray-50"
                                            >

                                                {/* PARTICULARS */}
                                                <td className="px-4 py-2 text-sm font-medium text-gray-700 border-r border-gray-200">
                                                    {label}
                                                </td>

                                                {/* DAILY */}
                                                <td className="px-4 py-2 text-center text-sm text-gray-700 border-r border-gray-200">
                                                    {reportLoading
                                                        ? '...'
                                                        : getDcsValue(label, 'daily')
                                                    }
                                                </td>

                                                {/* WEEKLY STANDARD */}
                                                <td className="px-4 py-2 text-center text-sm text-gray-700 border-r border-gray-200">
                                                    {reportLoading
                                                        ? '...'
                                                        : getDcsValue(label, 'weekly')
                                                    }
                                                </td>

                                                {/* WEEKLY ACCELERATED */}
                                                <td className="px-4 py-2 text-center text-sm text-gray-700 border-r border-gray-200">
                                                    {reportLoading
                                                        ? '...'
                                                        : getDcsValue(label, 'accelerated')
                                                    }
                                                </td>

                                                {/* CONSOLIDATED */}
                                                <td className="px-4 py-2 text-center text-sm font-bold text-gray-900">
                                                    {reportLoading
                                                        ? '...'
                                                        : getDcsValue(label, 'consolidated')
                                                    }
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;