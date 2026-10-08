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
import { Doughnut, Bar } from 'react-chartjs-2';
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

    const [performanceView, setPerformanceView] = useState('branches');
    const [performanceData, setPerformanceData] = useState([]);
    const [performanceLoading, setPerformanceLoading] = useState(false);

    const performanceViews = [
        { value: 'branches', label: 'Branches' },
        { value: 'daily', label: 'Daily' },
        { value: 'weekly_accelerated', label: 'Weekly Accelerated' },
        { value: 'consolidated', label: 'Consolidated' },
        { value: 'area', label: 'Area' },
        { value: 'region', label: 'Region' },
        { value: 'division', label: 'Division' },
    ];

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

    const fetchSummaries = () => {
        if (!currentDate || !dateFilter) return;
        clearTimeout(fetchTimeoutRef.current);
        fetchTimeoutRef.current = setTimeout(() => {
            setLoading(true);
            let selectedDate = null;
            switch(timeFilter) {
                case 'weekly':    selectedDate = { value: moment(selectedFilter?.value ?? currentDate).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'monthly':   selectedDate = { value: moment(selectedYear+'-'+(selectedFilter?.value??'01')+'-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'quarterly': selectedDate = { value: moment(selectedYear+'-01-01').quarter(selectedFilter?.value??1).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'yearly':    selectedDate = { value: moment(selectedYear+'-12-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                default:          selectedDate = { value: moment(dateFilter).format('YYYY-MM-DD'), field: 'date_added' }; break;
            }
            const queries = [
                selectedDate,
                { value: moment(currentDate).format('YYYY-MM-DD'), field: 'currentDate' },
                { value: timeFilter,        field: 'filter' },
                { value: divisionFilter,    field: 'divisionId' },
                { value: regionFilter,      field: 'regionId' },
                { value: areaFilter,        field: 'areaId' },
                { value: branchFilter,      field: 'branchId' },
                { value: selectedYear,      field: 'year' },
                { value: loanOfficerFilter, field: 'loId' },
            ].filter(a => a.value !== 'all' && !!a.value).map(a => `${a.field}=${a.value}`).join('&');

            setSummaryData({});
            fetchWrapper.get(getApiBaseUrl() + '/dashboard?' + queries + '&type=summary')
                .then(resp => { setSummaryData(resp.data?.[0] ?? {}); })
                .catch(error => { console.log(error); })
                .finally(() => { setLoading(false); });
        }, 400);
    };

    const fetchPerformanceData = async () => {
        if (!currentDate || !dateFilter) return;

        try {
            setPerformanceLoading(true);

            let selectedDate;

            switch (timeFilter) {
                case 'weekly':
                    selectedDate = moment(
                        selectedFilter?.value ?? currentDate
                    ).format('YYYY-MM-DD');
                    break;

                case 'monthly':
                    selectedDate = moment(
                        selectedYear +
                        '-' +
                        (selectedFilter?.value ?? '01') +
                        '-01'
                    )
                        .endOf('month')
                        .format('YYYY-MM-DD');
                    break;

                case 'quarterly':
                    selectedDate = moment(
                        selectedYear + '-01-01'
                    )
                        .quarter(selectedFilter?.value ?? 1)
                        .format('YYYY-MM-DD');
                    break;

                case 'yearly':
                    selectedDate = moment(
                        selectedYear + '-12-01'
                    )
                        .endOf('month')
                        .format('YYYY-MM-DD');
                    break;

                default:
                    selectedDate = moment(dateFilter)
                        .format('YYYY-MM-DD');
                    break;
            }

            const queries = [
                {
                    field: 'type',
                    value: 'performance'
                },
                {
                    field: 'view',
                    value: performanceView
                },
                {
                    field: 'date_added',
                    value: selectedDate
                },
                {
                    field: 'currentDate',
                    value: moment(currentDate).format('YYYY-MM-DD')
                },
                {
                    field: 'filter',
                    value: timeFilter
                },
                {
                    field: 'divisionId',
                    value: divisionFilter
                },
                {
                    field: 'regionId',
                    value: regionFilter
                },
                {
                    field: 'areaId',
                    value: areaFilter
                },
                {
                    field: 'branchId',
                    value: branchFilter
                },
                {
                    field: 'loId',
                    value: loanOfficerFilter
                },
                {
                    field: 'year',
                    value: selectedYear
                }
            ]
                .filter(
                    q =>
                        q.value !== 'all' &&
                        q.value !== undefined &&
                        q.value !== null &&
                        q.value !== ''
                )
                .map(
                    q =>
                        `${q.field}=${encodeURIComponent(q.value)}`
                )
                .join('&');

            const resp = await fetchWrapper.get(
                getApiBaseUrl() +
                '/dashboard?' +
                queries
            );

            setPerformanceData(
                Array.isArray(resp?.data)
                    ? resp.data
                    : []
            );

        } catch (error) {
            console.error(
                'fetchPerformanceData:',
                error
            );

            setPerformanceData([]);
        } finally {
            setPerformanceLoading(false);
        }
    };

    useEffect(() => {
        fetchPerformanceData();
    }, [
        performanceView,
        divisionFilter,
        regionFilter,
        areaFilter,
        branchFilter,
        loanOfficerFilter,
        timeFilter,
        dateFilter,
        selectedFilter,
        selectedYear,
        currentDate
    ]);

    const fetchBranches     = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/branches').then(r => setBranches([{_id:'all',name:'All',code:''},...r.data])).catch(console.log);
    const fetchRegions      = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/regions').then(r => setRegions([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchAreas        = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/areas').then(r => setAreas([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchDivisions    = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/divisions').then(r => setDivisions([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchLoanOfficers = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/loan-officers').then(r => setLoanOfficers([{_id:'all',firstName:'All',lastName:''},...r.data])).catch(console.log);
    const handleDateFilter  = (selected) => setDateFilter(selected.target.value);

    useEffect(() => {
        fetchBranches();
        fetchRegions();
        fetchAreas();
        fetchDivisions();
        fetchLoanOfficers();
        fetchSummaries();
    }, []);

    const timeFilterOptions     = [{value:'daily',label:'Daily'},{value:'weekly',label:'Weekly'},{value:'monthly',label:'Monthly'},{value:'quarterly',label:'Quarterly'},{value:'yearly',label:'Yearly'}];
    const branchOptions         = branches.map(b => ({value:b._id, label:`${b.code} ${b.name}`.trim()}));
    const regionOptions         = regions.map(r => ({value:r._id, label:r.name}));
    const areaOptions           = areas.map(a => ({value:a._id, label:a.name}));
    const divisionOptions       = divisions.map(d => ({value:d._id, label:d.name}));
    const loanOfficerOptions    = loanOfficers.map(lo => ({value:lo._id, label:`${lo.firstName} ${lo.lastName}`.trim()}));
    const yearOptions           = yearList.map(y => ({value:y.value, label:y.label}));
    const timeFilterListOptions = timeFilterList.map((item,index) => ({value:index, label:item.label}));

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

        // Payment Collection
        const paymentCollectionChartData = {
            labels: [
                'Loan Collection',
                'MCBU',
                'CSF'
            ],
            datasets: [
                {
                    data: [
                        Number(summaryData.loanCollectionDaily || 0),
                        Number(summaryData.mcbuCollection || 0),
                        Number(summaryData.csfCollection || 0)
                    ],
                    backgroundColor: [
                        '#22C55E',
                        '#3B82F6',
                        '#8B5CF6'
                    ],
                    borderWidth: 0,
                    borderRadius: 6
                }
            ]
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
    const totalReleasePerson     = (summaryData.currentReleasePerson_New||0) + (summaryData.currentReleasePerson_Rel||0);
    const filterLabel            = timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1);

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
                            {divisions.length > 2    && <CustomSelect value={divisionFilter}    onChange={setDivisionFilter}    options={divisionOptions}    placeholder="Select Division"     className="w-40" />}
                            {regions.length > 2      && <CustomSelect value={regionFilter}      onChange={setRegionFilter}      options={regionOptions}      placeholder="Select Region"       className="w-40" />}
                            {areas.length > 2        && <CustomSelect value={areaFilter}        onChange={setAreaFilter}        options={areaOptions}        placeholder="Select Area"         className="w-40" />}
                            {branchList.length > 2   && <CustomSelect value={branchFilter}      onChange={setBranchFilter}      options={branchOptions}      placeholder="Select Branch"       className="w-48" />}
                            {loanOfficerList.length > 2 && <CustomSelect value={loanOfficerFilter} onChange={setLoanOfficerFilter} options={loanOfficerOptions} placeholder="Select Loan Officer" className="w-48" />}
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
                                <div className="flex items-center gap-2 mb-4">
                                    <Banknote className="w-5 h-5 text-green-500" />
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Payment Collection Chart
                                        </h2>
                                        <p className="text-xs text-gray-400">
                                            Today&apos;s collection
                                        </p>
                                    </div>
                                </div>

                                <div className="h-[250px]">
                                    <Bar
                                        data={paymentCollectionChartData}
                                        options={miniBarOptions}
                                    />
                                </div>
                            </div>


                            {/* 2 — LOAN PORTFOLIO STATUS */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Scale className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Loan Portfolio Status
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

                        {/* ── PERFORMANCE SUMMARY TABLE ── */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">

                            {/* HEADER */}
                            <div className="px-5 py-4 border-b border-gray-200">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-800">
                                            Performance Summary
                                        </h2>
                                        <p className="text-xs text-gray-400 mt-1">
                                            Branch and organizational performance monitoring
                                        </p>
                                    </div>
                                </div>

                                {/* VIEW TABS */}
                                <div className="flex flex-wrap gap-2 mt-4">
                                    {performanceViews.map((item) => (
                                        <button
                                            key={item.value}
                                            type="button"
                                            onClick={() => setPerformanceView(item.value)}
                                            className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                                performanceView === item.value
                                                    ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                                            }`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* TABLE */}
                            <div className="overflow-auto max-h-[500px]">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                                #
                                            </th>

                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">
                                                {performanceView === 'area'
                                                    ? 'Area'
                                                    : performanceView === 'region'
                                                    ? 'Region'
                                                    : performanceView === 'division'
                                                    ? 'Division'
                                                    : 'Branch'}
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Active Clients
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Collection
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Release Person
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Release Amount
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Loan Balance
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                Past Due
                                            </th>

                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500">
                                                PAR %
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody className="divide-y divide-gray-100">
                                        {performanceLoading ? (
                                            <tr>
                                                <td
                                                    colSpan="9"
                                                    className="px-4 py-10 text-center text-gray-400"
                                                >
                                                    Loading performance data...
                                                </td>
                                            </tr>
                                        ) : performanceData.length === 0 ? (
                                            <tr>
                                                <td
                                                    colSpan="9"
                                                    className="px-4 py-10 text-center text-gray-400"
                                                >
                                                    No performance data available.
                                                </td>
                                            </tr>
                                        ) : (
                                            performanceData.map((row, index) => (
                                                <tr
                                                    key={row._id || row.id || index}
                                                    className="hover:bg-gray-50 transition-colors"
                                                >
                                                    <td className="px-4 py-3 text-gray-400">
                                                        {index + 1}
                                                    </td>

                                                    <td className="px-4 py-3 font-semibold text-gray-800">
                                                        {row.name || row.branchName || '-'}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.activeClients || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.collection || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.releasePerson || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.releaseAmount || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.loanBalance || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right">
                                                        {formatNumber(row.pastDueAmount || 0)}
                                                    </td>

                                                    <td className="px-4 py-3 text-right font-semibold">
                                                        {Number(row.par || 0).toFixed(2)}%
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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