import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { 
    UserPlus,
    Wallet,
    Banknote,
    Scale,
    AlertCircle,
    XCircle,
    UserMinus,
    Share2,
    Lock,
    Truck,
    AlertTriangle,
    Heart,
    X,
    DollarSign,
    HelpCircle,
    MinusCircle,
    ArrowLeftRight,
    RotateCcw,
    Users,
    Clock,
    PencilLine,
    TrendingUp,
    TrendingDown,
    Minus,
    Search,
    Filter,
    Calendar,
    ChevronDown,
    CheckCircle2,
    XOctagon,
    ChevronLeft,
    ChevronRight,
    Activity,
    BarChart2,
    Upload,
} from 'lucide-react';
import ClientSearchTool from './ClientSearchTool';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Avatar from '@/lib/avatar';
import { useRouter } from 'next/router';
import { getApiBaseUrl } from '@/lib/constants';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useMemo } from 'react';
import DatePicker from "@/lib/ui/DatePicker";
import moment from 'moment';
import Spinner from "../Spinner";
import { getMonths, getQuarters, getWeeks, getYears } from '@/lib/date-utils';

import ColorDot            from './ColorDot';
import CollapsiblePanel    from './CollapsiblePanel';
import CustomSelect        from './CustomSelect';
import CardItem, { formatNumber } from './CardItem';
import CompanyActivitiesSlider, { ACTIVITY_SLIDES } from './CompanyActivitiesSlider';

ChartJS.register(...registerables, ChartDataLabels);

/**
 * Walk backwards day-by-day from `date` until we land on a working day.
 * A working day is neither a Saturday/Sunday nor a holiday in `holidayList`.
 *
 * Holidays are stored in Redux as `{ date: "MM-DD", ... }` (no year).
 * We match against the MM-DD portion of the candidate date.
 *
 * @param {string} date        – YYYY-MM-DD
 * @param {Array}  holidays    – Redux state.holidays.list
 * @returns {string}           – YYYY-MM-DD of the last working day
 */
const getEffectiveDate = (date, holidays = []) => {
    // Build a Set of "MM-DD" strings for O(1) lookup
    const holidaySet = new Set(holidays.map(h => h.date));
 
    let candidate = moment(date);
    // Walk back at most 14 days (safety valve — handles long holiday stretches)
    for (let i = 0; i < 14; i++) {
        const dayOfWeek = candidate.day(); // 0 = Sun, 6 = Sat
        const monthDay  = candidate.format('MM-DD');
 
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
        const isHolidayDay = holidaySet.has(monthDay);
 
        if (!isWeekendDay && !isHolidayDay) {
            return candidate.format('YYYY-MM-DD'); // found a working day
        }
        candidate = candidate.subtract(1, 'day');
    }
 
    // Fallback: return the original date if no working day found in range
    return date;
};

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

    // Search/filter visibility
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

    const regions      = useMemo(() => regionList.filter(r => divisionFilter === 'all' || r._id === 'all' || r.divisionId === divisionFilter), [regionList, divisionFilter]);
    const areas        = useMemo(() => areaList.filter(a => regionFilter === 'all' || a._id === 'all' || a.regionId === regionFilter), [regionFilter, areaList]);
    const branches     = useMemo(() => branchList.filter(b => areaFilter === 'all' || b._id === 'all' || b.areaId === areaFilter), [areaFilter, branchList]);
    const loanOfficers = useMemo(() => loanOfficerList.filter(l => branchFilter === 'all' || l._id === 'all' || l.designatedBranchId === branchFilter), [branchFilter, loanOfficerList]);

    const [isMobile, setIsMobile] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [dateFilter, setDateFilter] = useState(null);

    const [activitySlides, setActivitySlides]     = useState([]);
    const [uploadingActivity, setUploadingActivity] = useState(false);
    const [deletingActivity,  setDeletingActivity]  = useState(false); 
    const activityFileInputRef = useRef(null);

    const [statusData, setStatusData] = useState({
        closedBranches: 0,
        totalBranches: 0,
        activeUsers: 0,
        cashOnHand: 0,
        bankBalance: 0,
        managementExpenses: 0,
    });

    const fetchActivityImages = useCallback(async () => {
        try {
            const resp = await fetchWrapper.get(getApiBaseUrl() + '/dashboard/activity-images');
            if (resp.success && resp.images?.length > 0) {
                setActivitySlides(
                    resp.images.map(img => ({
                        src:     img.url,
                        caption: '',
                        key:     img.key,
                    }))
                );
            } else {
                setActivitySlides([]);
            }
        } catch (e) {
            console.error('fetchActivityImages', e);
        }
    }, []);
 
    const handleActivityUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingActivity(true);
        try {
            // Upload files one-by-one (multer.single handles one per request)
            for (let i = 0; i < files.length; i++) {
                const formData = new FormData();
                formData.append('file', files[i]);
                formData.append('origin', 'dashboard-activities');
                // unique uuid per image so the upload API doesn't delete previous ones
                formData.append('uuid', `${Date.now()}-${i}`);
                const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
                if (!uploadRes.ok) throw new Error(`Upload failed for file ${i + 1}`);
            }
            await fetchActivityImages();
            toast.success(`${files.length} image${files.length > 1 ? 's' : ''} uploaded successfully.`);
        } catch (err) {
            console.error('Activity upload error:', err);
            toast.error('Upload failed. Please try again.');
        } finally {
            setUploadingActivity(false);
            if (activityFileInputRef.current) activityFileInputRef.current.value = '';
        }
    };

    const handleActivityDelete = async (key) => {
        if (!key) return;
        setDeletingActivity(true);
        try {
            const resp = await fetchWrapper.post(
                getApiBaseUrl() + '/dashboard/activity-images',
                { key }
            );
            if (resp.success) {
                await fetchActivityImages();
                toast.success('Image deleted successfully.');
            } else {
                toast.error(resp.message || 'Failed to delete image.');
            }
        } catch (err) {
            console.error('Activity delete error:', err);
            toast.error('Failed to delete image. Please try again.');
        } finally {
            setDeletingActivity(false);
        }
    };

    // Donut chart data
    const [clientsCollectionData, setClientsCollectionData] = useState({
        labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
        datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: ['#BBF7D0', '#FEF08A', '#FECDD3', '#E9D5FF'],
            borderWidth: 0,
            cutout: '70%'
        }]
    });

    // Key Metrics Chart Data
    const [keyMetricsChartData, setKeyMetricsChartData] = useState({
        labels: ['MCBU', 'CSF', 'Total Loan Release', 'Total Loan Balance'],
        datasets: [{
            label: 'Current',
            data: [0, 0, 0, 0],
            backgroundColor: ['#BFDBFE', '#DDD6FE', '#FED7AA', '#FEF08A'],
            borderRadius: 8,
            borderWidth: 0
        }]
    });

    useEffect(() => {
        fetchSummaries();
    }, [divisionFilter, regionFilter, areaFilter, branchFilter, loanOfficerFilter, timeFilter, timeFilterList, dateFilter, selectedFilter, currentDate]);

    useEffect(() => {
        switch(timeFilter) {
            case 'weekly': {
                const weeks = getWeeks(selectedYear).map(o => ({ ...o, field: 'week' }));
                setTimeFilterList(weeks);
                setSelectedFilter(weeks[0]?.value);
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
        const handleResize = () => {
            const width = window.innerWidth;
            setWindowWidth(width);
            setIsMobile(width < 768);
            if (width >= 768) setIsNavVisible(true);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getCardColumns = () => {
        if (windowWidth < 640) return 1;
        if (windowWidth < 1024) return 2;
        return 3;
    };

    const toggleNav = () => setIsNavVisible(!isNavVisible);

    const lastStatusDateRef = useRef(null);

    // Fetch status panel data for role 1/2
    const fetchDashboardStatus = useCallback(() => {
        if (!currentDate || !currentUser) return;
        const date = moment(dateFilter ?? currentDate).format('YYYY-MM-DD');

        // Skip if we already fetched for this exact date
        if (lastStatusDateRef.current === date) return;
        lastStatusDateRef.current = date;

        fetchWrapper.get(getApiBaseUrl() + '/dashboard/status?date=' + date)
            .then(resp => { if (resp.success) setStatusData(resp.data); })
            .catch(err => console.error('fetchDashboardStatus', err));
    }, [currentDate, dateFilter, currentUser]);
    
    useEffect(() => {
        if (currentUser?.role?.rep <= 2) fetchDashboardStatus();
    }, [fetchDashboardStatus]);

    // Update charts when summaryData changes
    useEffect(() => {
        if (summaryData.activeClients) {
            const activeClients = summaryData.activeClients || 0;
            const pendingClients = summaryData.pendingClients || 0;
            const mispaymentPerson = summaryData.mispaymentPerson || 0;
            const pastDuePerson = summaryData.pastDuePerson || 0;
            const goodClients = Math.max(0, activeClients - pendingClients - mispaymentPerson - pastDuePerson);
            setClientsCollectionData({
                labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
                datasets: [{
                    data: [goodClients, pendingClients, mispaymentPerson, pastDuePerson],
                    backgroundColor: ['#BBF7D0', '#FEF08A', '#FECDD3', '#E9D5FF'],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            });
        }
        setKeyMetricsChartData({
            labels: ['MCBU', 'CSF', 'Total Loan Release', 'Total Loan Balance'],
            datasets: [{
                label: 'Current',
                data: [
                    summaryData.mcbu || 0,
                    summaryData.csf || 0,
                    summaryData.totalLoanRelease || 0,
                    summaryData.totalLoanBalance || 0,
                ],
                backgroundColor: ['#BFDBFE', '#DDD6FE', '#FED7AA', '#FEF08A'],
                borderRadius: 8,
                borderWidth: 0
            }]
        });
    }, [summaryData]);

    // Wait for BOTH currentDate and holidayList to be confirmed loaded before
    // computing the effective date. holidayList === null means "still loading"
    // (Redux initial state). We never set dateFilter until we have the complete
    // picture, so fetchSummaries never fires with a wrong date.
    useEffect(() => {
        if (!currentDate || !Array.isArray(holidayList)) return;
        const effective = getEffectiveDate(currentDate, holidayList);
        setDateFilter(prev => (prev === null ? effective : prev));
    }, [currentDate, holidayList]);

    const formatNumber = (num) => {
        if (num === undefined || num === null) return 'N/A';
        if (typeof num === 'number') return num.toLocaleString('en-US');
        return num;
    };

    const fetchSummaries = () => {
        if (!currentDate || !dateFilter) return;

        clearTimeout(fetchTimeoutRef.current); 

        fetchTimeoutRef.current = setTimeout(() => {
            setLoading(true);
            let selectedDate = null;
            switch(timeFilter) {
                case 'weekly':    selectedDate = { value: moment(selectedFilter?.value ?? currentDate).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'monthly':   selectedDate = { value: moment(selectedYear + '-' + (selectedFilter?.value ?? '01') + '-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'quarterly': selectedDate = { value: moment(selectedYear + '-01-01').quarter(selectedFilter?.value ?? 1).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'yearly':    selectedDate = { value: moment(selectedYear + '-12-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                default:          selectedDate = { value: moment(dateFilter).format('YYYY-MM-DD'), field: 'date_added' }; break;
            }

            const queries = [
                selectedDate,
                { value: moment(currentDate).format('YYYY-MM-DD'), field: 'currentDate' },
                { value: timeFilter,       field: 'filter' },
                { value: divisionFilter,   field: 'divisionId' },
                { value: regionFilter,     field: 'regionId' },
                { value: areaFilter,       field: 'areaId' },
                { value: branchFilter,     field: 'branchId' },
                { value: selectedYear,     field: 'year' },
                { value: loanOfficerFilter, field: 'loId' },
            ].filter(a => a.value !== 'all' && !!a.value)
            .map(a => `${a.field}=${a.value}`).join('&');

            const summaryUrl = getApiBaseUrl() + '/dashboard?' + queries + '&type=summary';

            setSummaryData({});
            fetchWrapper.get(summaryUrl)
                .then(resp => { setSummaryData(resp.data?.[0] ?? {}); })
                .catch(error => { console.log(error); })
                .finally(() => { setLoading(false); });

        }, 400);
    };

    // ── fetch helpers (original — unchanged) ──────────
    const fetchBranches = () => {
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/branches')
            .then(resp => { setBranches([{ _id: 'all', name: 'All', code: '' }, ...resp.data]); })
            .catch(error => { console.log(error); });
    };

    const fetchRegions = () => {
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/regions')
            .then(resp => { setRegions([{ _id: 'all', name: 'All' }, ...resp.data]); })
            .catch(error => { console.log(error); });
    };

    const fetchAreas = () => {
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/areas')
            .then(resp => { setAreas([{ _id: 'all', name: 'All' }, ...resp.data]); })
            .catch(error => { console.log(error); });
    };

    const fetchDivisions = () => {
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/divisions')
            .then(resp => { setDivisions([{ _id: 'all', name: 'All' }, ...resp.data]); })
            .catch(error => { console.log(error); });
    };

    const fetchLoanOfficers = () => {
        fetchWrapper.get(getApiBaseUrl() + '/dashboard/loan-officers')
            .then(resp => { setLoanOfficers([{ _id: 'all', firstName: 'All', lastName: '' }, ...resp.data]); })
            .catch(error => { console.log(error); });
    };

    const handleDateFilter = (selected) => setDateFilter(selected.target.value);

    useEffect(() => {
        fetchBranches();
        fetchRegions();
        fetchAreas();
        fetchDivisions();
        fetchLoanOfficers();
        fetchSummaries();
        fetchActivityImages();
    }, []);

    // ── filter options ────────────────────────────────
    const timeFilterOptions = [
        { value: 'daily',     label: 'Daily' },
        { value: 'weekly',    label: 'Weekly' },
        { value: 'monthly',   label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly',    label: 'Yearly' }
    ];

    const branchOptions       = branches.map(b  => ({ value: b._id,  label: `${b.code} ${b.name}`.trim() }));
    const regionOptions       = regions.map(r   => ({ value: r._id,  label: r.name }));
    const areaOptions         = areas.map(a     => ({ value: a._id,  label: a.name }));
    const divisionOptions     = divisions.map(d => ({ value: d._id,  label: d.name }));
    const loanOfficerOptions  = loanOfficers.map(lo => ({ value: lo._id, label: `${lo.firstName} ${lo.lastName}`.trim() }));
    const yearOptions         = yearList.map(y  => ({ value: y.value, label: y.label }));
    const timeFilterListOptions = timeFilterList.map((item, index) => ({ value: index, label: item.label }));

    // ── chart options ─────────────────────────────────
    const donutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value.toLocaleString()} (${percentage}%)`;
                    }
                }
            },
            datalabels: { display: false }
        }
    };

    const barChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.label}: ${context.parsed.x.toLocaleString()}`;
                    }
                }
            },
            datalabels: { display: false }
        },
        scales: {
            x: {
                beginAtZero: true,
                grid: { display: true, color: 'rgba(0,0,0,0.05)' },
                ticks: {
                    callback: function(value) {
                        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
                        if (value >= 1000)    return (value / 1000).toFixed(0) + 'K';
                        return value;
                    }
                }
            },
            y: { grid: { display: false } }
        }
    };

    // Compact bar options for the chart panel
    const miniBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: {
            x: { display: false },
            y: { display: true, ticks: { font: { size: 9 }, color: '#64748b' } }
        }
    };

    // ═══════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="flex-grow p-4 flex flex-col overflow-x-auto">

                {/* ── FILTER TOOLBAR ── */}
                <div className="flex flex-col pb-4 border-b border-gray-200 gap-3 mb-4">
                    <div className="flex flex-wrap gap-3 items-center">
                        <CustomSelect
                            value={timeFilter}
                            onChange={setTimeFilter}
                            options={timeFilterOptions}
                            placeholder="Select Time Period"
                            icon={Calendar}
                            className="w-40"
                        />

                        {/* Guard on currentDate so the picker renders as soon as the system
                            date is available. dateFilter may still be null while holidays load. */}
                        {timeFilter === 'daily' && currentDate && (
                            <div className="w-40">
                                <DatePicker
                                    name="dateFilter"
                                    value={dateFilter ? moment(dateFilter).format('YYYY-MM-DD') : ''}
                                    maxDate={currentDate}
                                    onChange={handleDateFilter}
                                    height="h-[42px]"
                                />
                            </div>
                        )}

                        {timeFilter !== 'daily' && (
                            <CustomSelect
                                value={selectedYear}
                                onChange={setSelectedYear}
                                options={yearOptions}
                                placeholder="Select Year"
                                className="w-32"
                            />
                        )}

                        {timeFilter !== 'yearly' && timeFilter !== 'daily' && (
                            <CustomSelect
                                value={timeFilterList.findIndex(item => item === selectedFilter)}
                                onChange={(index) => setSelectedFilter(timeFilterList[index])}
                                options={timeFilterListOptions}
                                placeholder={`Select ${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}`}
                                className="w-40"
                            />
                        )}

                        <button
                            onClick={() => setIsFiltersExpanded(!isFiltersExpanded)}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                        >
                            <Filter className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">
                                {isFiltersExpanded ? 'Less Filters' : 'More Filters'}
                            </span>
                            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isFiltersExpanded ? 'rotate-180' : ''}`} />
                        </button>

                        <button
                            onClick={() => setIsSearchVisible(!isSearchVisible)}
                            className="flex items-center space-x-2 px-4 py-2.5 bg-blue-500 text-white rounded-lg shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                        >
                            <Search className="w-4 h-4" />
                            <span className="text-sm font-medium">
                                {isSearchVisible ? 'Hide Search' : 'Search Client'}
                            </span>
                        </button>
                    </div>

                    {isFiltersExpanded && (
                        <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border">
                            {divisions.length > 2 && (
                                <CustomSelect value={divisionFilter} onChange={setDivisionFilter} options={divisionOptions} placeholder="Select Division" className="w-40" />
                            )}
                            {regions.length > 2 && (
                                <CustomSelect value={regionFilter} onChange={setRegionFilter} options={regionOptions} placeholder="Select Region" className="w-40" />
                            )}
                            {areas.length > 2 && (
                                <CustomSelect value={areaFilter} onChange={setAreaFilter} options={areaOptions} placeholder="Select Area" className="w-40" />
                            )}
                            {branchList.length > 2 && (
                                <CustomSelect value={branchFilter} onChange={setBranchFilter} options={branchOptions} placeholder="Select Branch" className="w-48" />
                            )}
                            {loanOfficerList.length > 2 && (
                                <CustomSelect value={loanOfficerFilter} onChange={setLoanOfficerFilter} options={loanOfficerOptions} placeholder="Select Loan Officer" className="w-48" />
                            )}
                        </div>
                    )}

                    {isSearchVisible && (
                        <div className="p-4 bg-white rounded-lg border shadow-sm">
                            <ClientSearchTool />
                        </div>
                    )}
                </div>

                {/* ── LOADING ── */}
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 min-w-[1400px]">

                        {/* ── TOP ROW ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
 
                            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                1 — Pending Loan for Approval (Principal)
                                Total persons  = new members + reloaners
                                Amount         = current release amount (principal)
                                Reloaner rows  = currentReleasePerson_Rel / renewals
                                New Member rows= currentReleasePerson_New / newMember
                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">
                                        Pending Loan for Approval
                                        <span className="text-gray-400 font-normal text-xs block">(Principal)</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {/* Total persons = new + reloaner */}
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Persons</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(
                                                    (summaryData.currentReleasePerson_New || 0) +
                                                    (summaryData.currentReleasePerson_Rel || 0)
                                                )}
                                            </p>
                                        </div>
                                        {/* Total principal amount */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.currentReleaseAmount || 0)}
                                            </p>
                                        </div>
                                        {/* Reloaner persons */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Reloaner Persons</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.currentReleasePerson_Rel || 0)}
                                            </p>
                                        </div>
                                        {/* Reloaner amount */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.renewalsAmount || 0)}
                                            </p>
                                        </div>
                                        {/* New member persons */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">New Member</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.currentReleasePerson_New || 0)}
                                            </p>
                                        </div>
                                        {/* New member amount = total principal − reloaner amount */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(
                                                    (summaryData.currentReleaseAmount || 0) -
                                                    (summaryData.renewalsAmount || 0)
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
 
                            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                2 — Loan Approved (With Service Charge)
                                Uses totalLoanRelease for total approved amount.
                                Person counts same as card 1.
                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">
                                        Loan Approved
                                        <span className="text-gray-400 font-normal text-xs block">(With Service Charge)</span>
                                    </h3>
                                    <div className="space-y-3">
                                        {/* New member persons */}
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">New Member Persons</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.currentReleasePerson_New || 0)}
                                            </p>
                                        </div>
                                        {/* New member approved amount (with SC) */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.newMemberAmount || 0)}
                                            </p>
                                        </div>
                                        {/* Reloaner persons */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Reloaner Persons</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.currentReleasePerson_Rel || 0)}
                                            </p>
                                        </div>
                                        {/* Reloaner approved amount (with SC) */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.renewalsAmountWithSC || 0)}
                                            </p>
                                        </div>
                                        {/* New member count */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">New Member</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.newMember || 0)}
                                            </p>
                                        </div>
                                        {/* Total approved amount (with SC) */}
                                        <div className="border-t border-gray-100 pt-3">
                                            <p className="text-xs text-gray-500 mb-0.5">Amount</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {formatNumber(summaryData.amount || 0)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
 
                            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                3 — MIS Payment Category
                                Labels match constants.js remark values exactly.
                                Total is computed from all sub-categories.
                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3 text-center">MIS PAYMENT CATEGORY</h3>
                                    {(() => {
                                        const delinquent     = summaryData.delinquent         || 0;
                                        const delinquentMcbu = summaryData.delinquentMcbu      || 0; // remark: delinquent-mcbu
                                        const delinquentLoan = summaryData.delinquentLoan      || 0; // remark: delinquent-offset
                                        const calamity       = summaryData.excusedPerson       || 0; // remark: excused-calamity
                                        const hosp           = summaryData.hospitalization     || 0; // remark: excused-hospital
                                        const death          = summaryData.death               || 0; // remark: excused-death
                                        const maturedPD      = summaryData.pastDuePerson       || 0;
                                        const total          = delinquent + delinquentMcbu + delinquentLoan +
                                                               calamity + hosp + death + maturedPD;
 
                                        const rows = [
                                            { color: 'blue',   label: 'Delinquent',                                   value: delinquent     },
                                            { color: 'blue',   label: 'Delinquent for MCBU',                           value: delinquentMcbu },
                                            { color: 'blue',   label: 'Delinquent Loan Collection',                    value: delinquentLoan },
                                            { color: 'orange', label: 'Excused Due to Calamity',                       value: calamity       },
                                            { color: 'dark',   label: 'Excused Due to Hospitalization',                value: hosp           },
                                            { color: 'sky',    label: 'Excused Due to Death Clients / Family Members', value: death          },
                                            { color: 'red',    label: 'Matured Past Due',                              value: maturedPD      },
                                            { color: 'green',  label: 'Total',                                         value: total          },
                                        ];
 
                                        return (
                                            <div className="space-y-1.5">
                                                {rows.map((item, i) => (
                                                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                        <div className="flex items-center space-x-2">
                                                            <ColorDot color={item.color} />
                                                            <span className="text-xs text-gray-700 leading-tight">{item.label}</span>
                                                        </div>
                                                        <span className="text-xs font-bold text-gray-800 shrink-0 ml-2">
                                                            {formatNumber(item.value)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
 
                            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                                4 — Client Categories  (legend only, no values)
                                Colors corrected to match screenshot:
                                  Active Clients   → orange  (was blue)
                                  Active Borrowers → blue    (was orange)
                            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Client Categories</h3>
                                    <div className="space-y-1.5">
                                        {[
                                            { color: 'orange', label: 'Active Clients'        },
                                            { color: 'blue',   label: 'Active Borrowers'       },
                                            { color: 'green',  label: 'Good Clients'           },
                                            { color: 'red',    label: 'All Delinquent Clients' },
                                            { color: 'pink',   label: 'Mis Payment Clients'    },
                                            { color: 'violet', label: 'Past Due Clients'       },
                                            { color: 'lime',   label: 'ACP Agents'             },
                                            { color: 'yellow', label: 'Terminated Agents'      },
                                        ].map((item, i) => (
                                            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                <ColorDot color={item.color} />
                                                <span className="text-xs text-gray-700">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 5 — Branch Status + Performance */}
                            <div className="lg:col-span-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                            
                                    {currentUser?.role?.rep <= 2 ? (
                                        /* ── Role 1 / 2 → Status summary panel ── */
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-bold text-gray-800">Status</h3>
                            
                                            {/* Branch Status Closing */}
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Branch Status Closing</p>
                                                <p className="text-base font-bold text-gray-800">
                                                    {statusData.closedBranches} / {statusData.totalBranches}
                                                </p>
                                            </div>
                            
                                            {/* Available Fund */}
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Available Fund</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Cash On Hand:</span>
                                                    <span className="text-xs font-bold text-gray-800">
                                                        {formatNumber(statusData.cashOnHand)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center mt-1">
                                                    <span className="text-xs text-gray-500">Bank Balance:</span>
                                                    <span className="text-xs font-bold text-gray-800">
                                                        {formatNumber(statusData.bankBalance)}
                                                    </span>
                                                </div>
                                            </div>
                            
                                            {/* Active Users */}
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Active Users</p>
                                                <div className="flex justify-between items-center">
                                                    <span className="text-xs text-gray-500">Active:</span>
                                                    <span className="text-xs font-bold text-gray-800">
                                                        {formatNumber(statusData.activeUsers)}
                                                    </span>
                                                </div>
                                            </div>
                            
                                            {/* Management Expenses */}
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Management Expenses:</p>
                                                <p className="text-base font-bold text-gray-800">
                                                    {formatNumber(statusData.managementExpenses)}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        /* ── Role 3 / 4 → existing Branch Status + Performance donut ── */
                                        <div className="grid grid-cols-2 gap-4 h-full">
                                            {/* Branch Status */}
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <h3 className="text-sm font-bold text-gray-800 text-center">BRANCH STATUS:</h3>
                                                {summaryData.branchApprovalStatus === 'closed' ? (
                                                    <>
                                                        <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center">
                                                            <CheckCircle2 className="w-12 h-12 text-white" />
                                                        </div>
                                                        <p className="text-sm font-bold text-gray-800 text-center">Branch Already Closed</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center">
                                                            <XOctagon className="w-12 h-12 text-white" />
                                                        </div>
                                                        <p className="text-sm font-bold text-gray-800 text-center">Branch Not Closed</p>
                                                    </>
                                                )}
                                            </div>
                                            {/* Performance Donut */}
                                            <div>
                                                <div className="text-center mb-2">
                                                    <h2 className="text-sm font-bold text-gray-800">PERFORMANCE</h2>
                                                    <p className="text-xs text-gray-600 capitalize">{timeFilter}</p>
                                                </div>
                                                <div className="w-full" style={{ height: '150px', position: 'relative' }}>
                                                    <Doughnut data={clientsCollectionData} options={donutChartOptions} />
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="text-center">
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Collection</div>
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Rate</div>
                                                            <div className="text-sm font-bold text-gray-800 mt-1">
                                                                {summaryData.activeClients
                                                                    ? (((summaryData.activeClients - (summaryData.pendingClients || 0) - (summaryData.mispaymentPerson || 0) - (summaryData.pastDuePerson || 0)) / summaryData.activeClients) * 100).toFixed(1)
                                                                    : '0.0'}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-2 space-y-1">
                                                    {[
                                                        { label: 'Good Clients', color: '#BBF7D0', value: summaryData.activeClients ? summaryData.activeClients - (summaryData.pendingClients || 0) - (summaryData.mispaymentPerson || 0) - (summaryData.pastDuePerson || 0) : 0 },
                                                        { label: 'Late Clients',  color: '#FEF08A', value: summaryData.pendingClients  || 0 },
                                                        { label: 'Mis Payment',   color: '#FECDD3', value: summaryData.mispaymentPerson || 0 },
                                                        { label: 'Past Due',      color: '#E9D5FF', value: summaryData.pastDuePerson   || 0 },
                                                    ].map((item, i) => (
                                                        <div key={i} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <div className="w-3 h-3 rounded-sm border border-gray-200" style={{ backgroundColor: item.color }} />
                                                                <span className="text-xs text-gray-700">{item.label}</span>
                                                            </div>
                                                            <span className="text-xs font-bold text-gray-800">{formatNumber(item.value)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                            
                                </div>
                            </div>
                        </div>

                        {/* ── COMPANY ACTIVITIES + CHART DASHBOARD ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
 
                            {/* Company Activities Slideshow */}
                            <div className="lg:col-span-8">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Activity size={15} className="text-blue-500" />
                                        <h3 className="text-sm font-bold text-gray-800">Company Activities:</h3>
                                    </div>
                                    {/* Hidden multi-file input — triggered by the slider's Upload button */}
                                    <input
                                        ref={activityFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        onChange={handleActivityUpload}
                                    />
                                    <CompanyActivitiesSlider
                                        slides={activitySlides.length > 0 ? activitySlides : ACTIVITY_SLIDES}
                                        isAdmin={currentUser?.role?.rep === 1}
                                        onUploadClick={() => activityFileInputRef.current?.click()}
                                        uploading={uploadingActivity}
                                        onDeleteCurrent={handleActivityDelete}
                                        deleting={deletingActivity}
                                    />
                                </div>
                            </div>
 
                            {/* Chart Dashboard */}
                            <div className="lg:col-span-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <div className="flex items-center gap-2 mb-3">
                                        <BarChart2 size={15} className="text-indigo-500" />
                                        <h2 className="text-sm font-bold text-gray-800">Chart Dashboard</h2>
                                    </div>
                                    <div style={{ height: '300px' }}>
                                        <Bar data={keyMetricsChartData} options={miniBarOptions} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── KEY METRICS BAR CHART (full width) ── */}
                        {/* <div className="w-full">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
                                <h2 className="text-lg font-bold text-gray-800 mb-4">Key Metrics Overview</h2>
                                <div style={{ height: '300px' }}>
                                    <Bar data={keyMetricsChartData} options={barChartOptions} />
                                </div>
                            </div>
                        </div> */}

                        {/* ── SUMMARY / PROGRESS / DCC / CASH FLOW (5 cols) ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

                            {/* Summary */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="SUMMARY" subtitle={timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}>
                                        <div>
                                            <CardItem title="Past Due Person"          value={summaryData.pastDuePerson}         prevValue={summaryData.prev_pastDuePerson}         Icon={AlertCircle}   bgColor="bg-red-50" />
                                            <CardItem title="Past Due Amount"          value={summaryData.pastDueAmount}         prevValue={summaryData.prev_pastDueAmount}         Icon={AlertCircle}   bgColor="bg-red-50" />
                                            <CardItem title="PD Active Loan"           value={summaryData.pdActiveLoan}          prevValue={summaryData.prev_pdActiveLoan}          Icon={AlertCircle}   bgColor="bg-red-50" />
                                            <CardItem title="PD Loan Balance"          value={summaryData.pdLoanBalance}         prevValue={summaryData.prev_pdLoanBalance}         Icon={AlertCircle}   bgColor="bg-red-50" />
                                            <CardItem title="PD Net Risk"              value={summaryData.pdNetRisk}             prevValue={summaryData.prev_pdNetRisk}             Icon={AlertCircle}   bgColor="bg-red-50" />
                                            <CardItem title="Excused Person"           value={summaryData.excusedPerson}         prevValue={summaryData.prev_excusedPerson}         Icon={XCircle}       bgColor="bg-orange-50" />
                                            <CardItem title="Excused Active Loan"      value={summaryData.excusedActiveLoan}     prevValue={summaryData.prev_excusedActiveLoan}     Icon={XCircle}       bgColor="bg-orange-50" />
                                            <CardItem title="Excused Loan Balance"     value={summaryData.excusedLoanBalance}    prevValue={summaryData.prev_excusedLoanBalance}    Icon={XCircle}       bgColor="bg-orange-50" />
                                            <CardItem title="Excused Net Risk Balance" value={summaryData.excusedNetRiskBalance} prevValue={summaryData.prev_excusedNetRiskBalance} Icon={XCircle}       bgColor="bg-orange-50" />
                                            <CardItem title="Runaway Clients"          value={summaryData.runawayClients}        prevValue={summaryData.prev_runawayClients}        Icon={UserMinus}     bgColor="bg-purple-50" />
                                            <CardItem title="Missing Clients"          value={summaryData.missingClients}        prevValue={summaryData.prev_missingClients}        Icon={UserMinus}     bgColor="bg-purple-50" />
                                            <CardItem title="Dummy Accounts"           value={summaryData.dummyAccounts}         prevValue={summaryData.prev_dummyAccounts}         Icon={UserMinus}     bgColor="bg-purple-50" />
                                            <CardItem title="Loan Share"               value={summaryData.loanShare}             prevValue={summaryData.prev_loanShare}             Icon={Share2}        bgColor="bg-blue-50" />
                                            <CardItem title="Imprisonment"             value={summaryData.imprisonment}          prevValue={summaryData.prev_imprisonment}          Icon={Lock}          bgColor="bg-gray-50" />
                                            <CardItem title="Moving Excuses"           value={summaryData.movingExcuses}         prevValue={summaryData.prev_movingExcuses}         Icon={Truck}         bgColor="bg-yellow-50" />
                                            <CardItem title="Delinquent"               value={summaryData.delinquent}            prevValue={summaryData.prev_delinquent}            Icon={AlertTriangle} bgColor="bg-red-50" />
                                            <CardItem title="Hospitalization"          value={summaryData.hospitalization}       prevValue={summaryData.prev_hospitalization}       Icon={Heart}         bgColor="bg-pink-50" />
                                            <CardItem title="Death"                    value={summaryData.death}                 prevValue={summaryData.prev_death}                Icon={X}             bgColor="bg-gray-50" />
                                            <CardItem title="Bankruptcy"               value={summaryData.bankruptcy}            prevValue={summaryData.prev_bankruptcy}            Icon={DollarSign}    bgColor="bg-red-50" />
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="PROGRESS" subtitle={timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}>
                                        <div>
                                            <CardItem title="Total Release:"         value={summaryData.totalLoanRelease}  prevValue={summaryData.prev_totalLoanRelease}  Icon={Banknote}       bgColor="bg-green-50" />
                                            <CardItem title="Amount:"                value={summaryData.amount}            prevValue={summaryData.prev_amount}            Icon={DollarSign}     bgColor="bg-blue-50" />
                                            <CardItem title="Transfer Clients:"      value={summaryData.transferClients}   prevValue={summaryData.prev_transferClients}   Icon={ArrowLeftRight} bgColor="bg-purple-50" />
                                            <CardItem title="Offset:"                value={summaryData.offset}            prevValue={summaryData.prev_offset}            Icon={MinusCircle}    bgColor="bg-orange-50" />
                                            <CardItem title="Full Payment"           value={summaryData.fullPayment}       prevValue={summaryData.prev_fullPayment}       Icon={Users}          bgColor="bg-green-50" />
                                            <CardItem title="Full Payment Amount:"   value={summaryData.fullPaymentAmount} prevValue={summaryData.prev_fullPaymentAmount} Icon={DollarSign}     bgColor="bg-green-50" />
                                            <CardItem title="Past Due Collection:"   value={summaryData.pastDueCollection} prevValue={summaryData.prev_pastDueCollection} Icon={AlertCircle}    bgColor="bg-yellow-50" />
                                            <CardItem title="Pending:"               value={summaryData.pending}           prevValue={summaryData.prev_pending}           Icon={Clock}          bgColor="bg-gray-50" />
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* DCC Receipts */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="DAILY CASH COLLECTION" subtitle="RECEIPTS">
                                        <div>
                                            <CardItem title="Beginning Balance:"        value={summaryData.beginningBalance}     prevValue={summaryData.prev_beginningBalance}     Icon={DollarSign}    bgColor="bg-blue-50" />
                                            <CardItem title="MCBU Collection:"          value={summaryData.mcbuCollection}       prevValue={summaryData.prev_mcbuCollection}       Icon={Wallet}        bgColor="bg-green-50" />
                                            <CardItem title="Loan Collection Daily:"    value={summaryData.loanCollectionDaily}  prevValue={summaryData.prev_loanCollectionDaily}  Icon={Banknote}      bgColor="bg-green-50" />
                                            <CardItem title="Loan Collection Weekly:"   value={summaryData.loanCollectionWeekly} prevValue={summaryData.prev_loanCollectionWeekly} Icon={Banknote}      bgColor="bg-green-50" />
                                            <CardItem title="Staff CBU Collection:"     value={summaryData.staffCbuCollection}   prevValue={summaryData.prev_staffCbuCollection}   Icon={Users}         bgColor="bg-purple-50" />
                                            <CardItem title="Staff Loan Collection:"    value={summaryData.staffLoanCollection}  prevValue={summaryData.prev_staffLoanCollection}  Icon={Banknote}      bgColor="bg-purple-50" />
                                            <CardItem title="Admin Fees:"               value={summaryData.admissionCollection}  prevValue={summaryData.prev_admissionCollection}  Icon={DollarSign}    bgColor="bg-orange-50" />
                                            <CardItem title="L R F Collection:"         value={summaryData.lrfCollection}        prevValue={summaryData.prev_lrfCollection}        Icon={Banknote}      bgColor="bg-blue-50" />
                                            <CardItem title="C B H B Collection:"       value={summaryData.cbhbCollection}       prevValue={summaryData.prev_cbhbCollection}       Icon={Banknote}      bgColor="bg-blue-50" />
                                            <CardItem title="CSF Collection:"           value={summaryData.csfCollection}        prevValue={summaryData.prev_csfCollection}        Icon={Banknote}      bgColor="bg-blue-50" />
                                            <CardItem title="Add. Hospitalization:"     value={summaryData.addHospitalization}   prevValue={summaryData.prev_addHospitalization}   Icon={Heart}         bgColor="bg-pink-50" />
                                            <CardItem title="W/Tax, EE&ER:"             value={summaryData.wtaxEeEr}             prevValue={summaryData.prev_wtaxEeEr}             Icon={DollarSign}    bgColor="bg-gray-50" />
                                            <CardItem title="MCBU Unclaimed (N):"       value={summaryData.mcbuUnclaimedN}       prevValue={summaryData.prev_mcbuUnclaimedN}       Icon={AlertCircle}   bgColor="bg-yellow-50" />
                                            <CardItem title="Other Income (Passbook):"  value={summaryData.otherIncomePassbook}  prevValue={summaryData.prev_otherIncomePassbook}  Icon={DollarSign}    bgColor="bg-green-50" />
                                            <CardItem title="Other Income:"             value={summaryData.otherCollection}      prevValue={summaryData.prev_otherCollection}      Icon={DollarSign}    bgColor="bg-green-50" />
                                            <CardItem title="Other Receipts (Picture):" value={summaryData.otherReceiptsPicture} prevValue={summaryData.prev_otherReceiptsPicture} Icon={DollarSign}    bgColor="bg-blue-50" />
                                            <CardItem title="Other Receipts:"           value={summaryData.otherReceipts}        prevValue={summaryData.prev_otherReceipts}        Icon={DollarSign}    bgColor="bg-blue-50" />
                                            <CardItem title="Fund Transfer:"            value={summaryData.fundTransferReceipts} prevValue={summaryData.prev_fundTransferReceipts} Icon={ArrowLeftRight} bgColor="bg-purple-50" />
                                            <CardItem title="Bank Withdrawal:"          value={summaryData.bankWithdrawal}       prevValue={summaryData.prev_bankWithdrawal}       Icon={Banknote}      bgColor="bg-green-50" />
                                            <CardItem title="Total Receipts:"           value={summaryData.totalReceipts}        prevValue={summaryData.prev_totalReceipts}        Icon={DollarSign}    bgColor="bg-green-100" />
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* DCC Payments */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="DAILY CASH COLLECTION" subtitle="PAYMENTS">
                                        <div>
                                            <CardItem title="Client Loan Release:"       value={summaryData.clientLoanRelease}     prevValue={summaryData.prev_clientLoanRelease}     Icon={Banknote}       bgColor="bg-red-50" />
                                            <CardItem title="Client MCBU Withdrawals:"  value={summaryData.clientMcbuWithdrawals}  prevValue={summaryData.prev_clientMcbuWithdrawals}  Icon={Wallet}        bgColor="bg-red-50" />
                                            <CardItem title="Client MCBU Return:"       value={summaryData.clientMcbuReturn}      prevValue={summaryData.prev_clientMcbuReturn}      Icon={RotateCcw}      bgColor="bg-orange-50" />
                                            <CardItem title="Staff Loan Release:"       value={summaryData.staffLoanRelease}      prevValue={summaryData.prev_staffLoanRelease}      Icon={Users}          bgColor="bg-purple-50" />
                                            <CardItem title="Staff CBU Withdrawals:"    value={summaryData.staffCbuWithdrawals}   prevValue={summaryData.prev_staffCbuWithdrawals}   Icon={Wallet}         bgColor="bg-purple-50" />
                                            <CardItem title="Management Expenses:"      value={summaryData.managementExpenses}    prevValue={summaryData.prev_managementExpenses}    Icon={DollarSign}     bgColor="bg-red-50" />
                                            <CardItem title="CBHB Disbursed:"           value={summaryData.cbhbDisbursed}         prevValue={summaryData.prev_cbhbDisbursed}         Icon={Banknote}       bgColor="bg-orange-50" />
                                            <CardItem title="MCBU Unclaimed (Out):"     value={summaryData.mcbuUnclaimedOut}      prevValue={summaryData.prev_mcbuUnclaimedOut}      Icon={AlertCircle}    bgColor="bg-yellow-50" />
                                            <CardItem title="Rebates:"                  value={summaryData.rebates}               prevValue={summaryData.prev_rebates}               Icon={DollarSign}     bgColor="bg-green-50" />
                                            <CardItem title="Other Payment:"            value={summaryData.otherPayment}          prevValue={summaryData.prev_otherPayment}          Icon={DollarSign}     bgColor="bg-gray-50" />
                                            <CardItem title="Fund Transfer:"            value={summaryData.fundTransferPayments}  prevValue={summaryData.prev_fundTransferPayments}  Icon={ArrowLeftRight} bgColor="bg-purple-50" />
                                            <CardItem title="Bank Deposit:"             value={summaryData.bankDeposit}           prevValue={summaryData.prev_bankDeposit}           Icon={Banknote}       bgColor="bg-blue-50" />
                                            <CardItem title="Total Payment:"            value={summaryData.totalPayment}          prevValue={summaryData.prev_totalPayment}          Icon={DollarSign}     bgColor="bg-red-100" />
                                            {/* Closing Summary inset */}
                                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 mt-2">
                                                <h4 className="text-xs font-bold text-gray-700 mb-2">Closing Summary</h4>
                                                <div className="space-y-2">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600">Closing Balance:</span>
                                                        <span className="text-sm font-bold text-gray-800">{formatNumber(summaryData.closingBalance || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600">Full Payment Person:</span>
                                                        <span className="text-sm font-bold text-gray-800">{formatNumber(summaryData.fullPayment || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600">Bank Balance:</span>
                                                        <span className="text-sm font-bold text-blue-600">₱535,892.00</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-gray-600">COH:</span>
                                                        <span className="text-sm font-bold text-gray-800">{formatNumber(summaryData.cashOnHand || 0)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* Cash Flow for Tomorrow */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="CASH FLOW FOR TOMORROW" subtitle="Target/Collection">
                                        <div>
                                            <CardItem title="Prospect:"                        value={summaryData.prospect}                prevValue={summaryData.prev_prospect}                Icon={Users}       bgColor="bg-blue-50" />
                                            <CardItem title="Amount:"                          value={summaryData.prospectAmount}          prevValue={summaryData.prev_prospectAmount}          Icon={DollarSign}  bgColor="bg-blue-50" />
                                            <CardItem title="Renewals:"                        value={summaryData.tomorrowRenewals}        prevValue={summaryData.prev_tomorrowRenewals}        Icon={RotateCcw}   bgColor="bg-green-50" />
                                            <CardItem title="Amount:"                          value={summaryData.renewalsAmount}          prevValue={summaryData.prev_renewalsAmount}          Icon={DollarSign}  bgColor="bg-green-50" />
                                            <CardItem title="Total Amount of Releases:"        value={summaryData.totalAmountReleases}     prevValue={summaryData.prev_totalAmountReleases}     Icon={Banknote}    bgColor="bg-purple-50" />
                                            <CardItem title="Target Collection for Tomorrow:"  value={summaryData.targetCollectionTomorrow} prevValue={summaryData.prev_targetCollectionTomorrow} Icon={AlertCircle} bgColor="bg-yellow-50" />
                                            <CardItem title="Target Expenses for Tomorrow:"    value={summaryData.targetExpensesTomorrow}  prevValue={summaryData.prev_targetExpensesTomorrow}  Icon={DollarSign}  bgColor="bg-orange-50" />
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;