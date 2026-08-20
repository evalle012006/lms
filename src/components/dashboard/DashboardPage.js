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
import ColorDot            from './ColorDot';
import CollapsiblePanel    from './CollapsiblePanel';
import CustomSelect        from './CustomSelect';
import CardItem, { formatNumber } from './CardItem';
import CompanyActivitiesSlider, { ACTIVITY_SLIDES } from './CompanyActivitiesSlider';
import DelinquentAlertsModal from './DelinquentAlertsModal';
import { compressImage } from '@/lib/image-compress';

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

    const regions      = useMemo(() => regionList.filter(r => divisionFilter === 'all' || r._id === 'all' || r.divisionId === divisionFilter), [regionList, divisionFilter]);
    const areas        = useMemo(() => areaList.filter(a => regionFilter === 'all' || a._id === 'all' || a.regionId === regionFilter), [regionFilter, areaList]);
    const branches     = useMemo(() => branchList.filter(b => areaFilter === 'all' || b._id === 'all' || b.areaId === areaFilter), [areaFilter, branchList]);
    const loanOfficers = useMemo(() => loanOfficerList.filter(l => branchFilter === 'all' || l._id === 'all' || l.designatedBranchId === branchFilter), [branchFilter, loanOfficerList]);

    const [isMobile, setIsMobile] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [dateFilter, setDateFilter] = useState(null);
    const [activitySlides, setActivitySlides]       = useState([]);
    const [uploadingActivity, setUploadingActivity] = useState(false);
    const [deletingActivity,  setDeletingActivity]  = useState(false);
    const activityFileInputRef = useRef(null);

    const [statusData, setStatusData] = useState({
        closedBranches: 0, totalBranches: 0, activeUsers: 0,
        cashOnHand: 0, bankBalance: 0, managementExpenses: 0,
        staleBranchesCount: 0, staleBranches: [],
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

    const fetchActivityImages = useCallback(async () => {
        try {
            const resp = await fetchWrapper.get(getApiBaseUrl() + '/dashboard/activity-images');
            if (resp.success && resp.images?.length > 0) {
                setActivitySlides(resp.images.map(img => ({ src: img.url, caption: '', key: img.key })));
            } else { setActivitySlides([]); }
        } catch (e) { console.error('fetchActivityImages', e); }
    }, []);

    const handleActivityUpload = async (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setUploadingActivity(true);
        try {
            for (let i = 0; i < files.length; i++) {
                const compressed = await compressImage(files[i]);
                const formData = new FormData();
                formData.append('file', compressed);
                formData.append('origin', 'dashboard-activities');
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
            const resp = await fetchWrapper.post(getApiBaseUrl() + '/dashboard/activity-images', { key });
            if (resp.success) { await fetchActivityImages(); toast.success('Image deleted successfully.');
            } else { toast.error(resp.message || 'Failed to delete image.'); }
        } catch (err) { console.error('Activity delete error:', err); toast.error('Failed to delete image. Please try again.');
        } finally { setDeletingActivity(false); }
    };

    const [clientsCollectionData, setClientsCollectionData] = useState({
        labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
        datasets: [{ data: [0,0,0,0], backgroundColor: ['#BBF7D0','#FEF08A','#FECDD3','#E9D5FF'], borderWidth: 0, cutout: '70%' }]
    });

    const [keyMetricsChartData, setKeyMetricsChartData] = useState({
        labels: ['MCBU', 'CSF', 'Total Loan Release', 'Total Loan Balance'],
        datasets: [{ label: 'Current', data: [0,0,0,0], backgroundColor: ['#BFDBFE','#DDD6FE','#FED7AA','#FEF08A'], borderRadius: 8, borderWidth: 0 }]
    });

    useEffect(() => { fetchSummaries(); }, [divisionFilter, regionFilter, areaFilter, branchFilter, loanOfficerFilter, timeFilter, timeFilterList, dateFilter, selectedFilter, currentDate]);

    useEffect(() => {
        switch(timeFilter) {
            case 'weekly':    { const weeks    = getWeeks(selectedYear).map(o => ({ ...o, field: 'week' }));     setTimeFilterList(weeks);    setSelectedFilter(weeks[0]?.value); break; }
            case 'monthly':   { const months   = getMonths(selectedYear).map(o => ({ ...o, field: 'month' }));  setTimeFilterList(months);   setSelectedFilter(months[0]);        break; }
            case 'quarterly': { const quarters = getQuarters().map(o => ({ ...o, field: 'quarter' }));          setSelectedFilter(quarters[0]); setTimeFilterList(quarters);      break; }
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

    const fetchBranches     = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/branches').then(r => setBranches([{_id:'all',name:'All',code:''},...r.data])).catch(console.log);
    const fetchRegions      = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/regions').then(r => setRegions([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchAreas        = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/areas').then(r => setAreas([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchDivisions    = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/divisions').then(r => setDivisions([{_id:'all',name:'All'},...r.data])).catch(console.log);
    const fetchLoanOfficers = () => fetchWrapper.get(getApiBaseUrl()+'/dashboard/loan-officers').then(r => setLoanOfficers([{_id:'all',firstName:'All',lastName:''},...r.data])).catch(console.log);
    const handleDateFilter  = (selected) => setDateFilter(selected.target.value);

    useEffect(() => { fetchBranches(); fetchRegions(); fetchAreas(); fetchDivisions(); fetchLoanOfficers(); fetchSummaries(); fetchActivityImages(); }, []);

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
        responsive:true, maintainAspectRatio:false, indexAxis:'y',
        plugins:{ legend:{display:false}, datalabels:{display:false} },
        scales:{ x:{display:false}, y:{display:true, ticks:{font:{size:9}, color:'#64748b'}} }
    };

    // ── derived values ─────────────────────────────────
    const totalReleasePerson     = (summaryData.currentReleasePerson_New||0) + (summaryData.currentReleasePerson_Rel||0);
    const prevTotalReleasePerson = (summaryData.prev_currentReleasePerson_New||0) + (summaryData.prev_currentReleasePerson_Rel||0);
    const newMemberAmount        = summaryData.newMemberAmount ?? ((summaryData.currentReleaseAmount||0) - (summaryData.renewalsAmount||0));
    const prevNewMemberAmount    = summaryData.prev_newMemberAmount ?? ((summaryData.prev_currentReleaseAmount||0) - (summaryData.prev_renewalsAmount||0));
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

                        {/* ── TOP ROW ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                            {/* ━━━ 1 — Pending Loan for Approval (Principal) ━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">
                                        Pending Loan for Approval
                                        <span className="text-gray-400 font-normal text-xs block">(Principal)</span>
                                    </h3>
                                    <InfoRow label="Persons"          value={(summaryData.currentReleasePerson_New||0)+(summaryData.currentReleasePerson_Rel||0)} />
                                    <InfoRow label="Amount"           value={summaryData.currentReleaseAmount} />
                                    <InfoRow label="Reloaner Persons" value={summaryData.currentReleasePerson_Rel} />
                                    <InfoRow label="Amount"           value={summaryData.currentReleaseAmount} />
                                    <InfoRow label="New Member"       value={summaryData.currentReleasePerson_New} />
                                    <InfoRow label="Amount"           value={(summaryData.currentReleaseAmount||0)-(summaryData.renewalsAmount||0)} />
                                    <div className="mt-3 pt-3 border-t-2 border-gray-200">
                                        <p className="text-xs font-bold text-gray-700 mb-2">Weekly Transaction</p>
                                        <InfoRow label="Reloaner Person" value={summaryData.currentReleasePerson_Rel_Weekly} />
                                        <InfoRow label="Amount"          value={summaryData.currentReleaseAmount_Rel_Weekly} />
                                        <InfoRow label="New Member"      value={summaryData.currentReleasePerson_New_Weekly} />
                                        <InfoRow label="Amount"          value={summaryData.currentReleaseAmount_New_Weekly} />
                                    </div>
                                </div>
                            </div>

                            {/* ━━━ 2 — Loan Approved (With Service Charge) ━━━ */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">
                                        Loan Approved
                                        <span className="text-gray-400 font-normal text-xs block">(With Service Charge)</span>
                                    </h3>
                                    <InfoRow label="New Member Persons" value={summaryData.currentReleasePerson_New} />
                                    <InfoRow label="Amount"             value={summaryData.newMemberAmount} />
                                    <InfoRow label="Reloaner Persons"   value={summaryData.currentReleasePerson_Rel} />
                                    <InfoRow label="Amount"             value={summaryData.renewalsAmountWithSC} />
                                    <InfoRow label="New Member"         value={summaryData.newMember} />
                                    <InfoRow label="Amount"             value={summaryData.amount} />
                                    <div className="mt-3 pt-3 border-t-2 border-gray-200">
                                        <p className="text-xs font-bold text-gray-700 mb-2">Weekly Transaction (Approved)</p>
                                        <InfoRow label="Reloaner Person" value={summaryData.currentReleasePerson_Rel_Weekly} />
                                        <InfoRow label="Amount"          value={summaryData.currentReleaseAmount_Rel_Weekly} />
                                        <InfoRow label="New Member"      value={summaryData.currentReleasePerson_New_Weekly} />
                                        <InfoRow label="Amount"          value={summaryData.currentReleaseAmount_New_Weekly} />
                                    </div>
                                </div>
                            </div>

                            {/* 3 — MIS Payment Category */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3 text-center">MIS PAYMENT CATEGORY</h3>
                                    {(() => {
                                        const delinquent=summaryData.delinquent||0, delinquentMcbu=summaryData.delinquentMcbu||0, delinquentLoan=summaryData.delinquentLoan||0;
                                        const calamity=summaryData.excusedPerson||0, hosp=summaryData.hospitalization||0, death=summaryData.death||0, maturedPD=summaryData.pastDuePerson||0;
                                        const total=delinquent+delinquentMcbu+delinquentLoan+calamity+hosp+death+maturedPD;
                                        return (
                                            <div className="space-y-1.5">
                                                {[
                                                    {color:'blue',   label:'Delinquent',                                   value:delinquent},
                                                    {color:'blue',   label:'Delinquent for MCBU',                           value:delinquentMcbu},
                                                    {color:'blue',   label:'Delinquent Loan Collection',                    value:delinquentLoan},
                                                    {color:'orange', label:'Excused Due to Calamity',                       value:calamity},
                                                    {color:'dark',   label:'Excused Due to Hospitalization',                value:hosp},
                                                    {color:'sky',    label:'Excused Due to Death Clients / Family Members', value:death},
                                                    {color:'red',    label:'Matured Past Due',                              value:maturedPD},
                                                    {color:'green',  label:'Total',                                         value:total},
                                                ].map((item,i)=>(
                                                    <div key={i} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                        <div className="flex items-center space-x-2"><ColorDot color={item.color}/><span className="text-xs text-gray-700 leading-tight">{item.label}</span></div>
                                                        <span className="text-xs font-bold text-gray-800 shrink-0 ml-2">{formatNumber(item.value)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>

                            {/* 4 — Client Categories */}
                            <div className="lg:col-span-2">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <h3 className="text-sm font-bold text-gray-800 mb-3">Client Categories</h3>
                                    <div className="space-y-1.5">
                                        {[
                                            {color:'orange',label:'Active Clients'},{color:'blue',label:'Active Borrowers'},
                                            {color:'green',label:'Good Clients'},{color:'red',label:'All Delinquent Clients'},
                                            {color:'pink',label:'Mis Payment Clients'},{color:'violet',label:'Past Due Clients'},
                                            {color:'lime',label:'ACP Agents'},{color:'yellow',label:'Terminated Agents'},
                                        ].map((item,i)=>(
                                            <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                                                <ColorDot color={item.color}/><span className="text-xs text-gray-700">{item.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* 5 — Branch Status + Performance */}
                            <div className="lg:col-span-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    {currentUser?.role?.rep <= 2 ? (
                                        <div className="flex flex-col gap-3">
                                            <h3 className="text-sm font-bold text-gray-800">Status</h3>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Branch Status Closing</p>
                                                <p className="text-base font-bold text-gray-800">{statusData.closedBranches} / {statusData.totalBranches}</p>
                                                {statusData.staleBranchesCount > 0 && (
                                                    <p className="text-xs font-semibold text-amber-600 mt-1">
                                                        {statusData.staleBranchesCount} closed branch{statusData.staleBranchesCount > 1 ? 'es' : ''} need{statusData.staleBranchesCount === 1 ? 's' : ''} re-check
                                                    </p>
                                                )}
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                <p className="text-xs font-bold text-gray-700 mb-1">Available Fund</p>
                                                <div className="flex justify-between items-center"><span className="text-xs text-gray-500">Cash On Hand:</span><span className="text-xs font-bold text-gray-800">{formatNumber(statusData.cashOnHand)}</span></div>
                                                <div className="flex justify-between items-center mt-1"><span className="text-xs text-gray-500">Bank Balance:</span><span className="text-xs font-bold text-gray-800">{formatNumber(statusData.bankBalance)}</span></div>
                                            </div>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100"><p className="text-xs font-bold text-gray-700 mb-1">Active Users</p><div className="flex justify-between items-center"><span className="text-xs text-gray-500">Active:</span><span className="text-xs font-bold text-gray-800">{formatNumber(statusData.activeUsers)}</span></div></div>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-100"><p className="text-xs font-bold text-gray-700 mb-1">Management Expenses:</p><p className="text-base font-bold text-gray-800">{formatNumber(statusData.managementExpenses)}</p></div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 gap-4 h-full">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <h3 className="text-sm font-bold text-gray-800 text-center">BRANCH STATUS:</h3>
                                                {summaryData.branchApprovalStatus === 'closed' ? (
                                                    summaryData.documentsStale ? (
                                                        <><div className="w-20 h-20 rounded-full bg-amber-500 flex items-center justify-center"><AlertTriangle className="w-12 h-12 text-white"/></div><p className="text-sm font-bold text-gray-800 text-center">Closed — Needs Re-check</p></>
                                                    ) : (
                                                        <><div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center"><CheckCircle2 className="w-12 h-12 text-white"/></div><p className="text-sm font-bold text-gray-800 text-center">Branch Already Closed</p></>
                                                    )
                                                    ) : (
                                                        <><div className="w-20 h-20 rounded-full bg-yellow-400 flex items-center justify-center"><XOctagon className="w-12 h-12 text-white"/></div><p className="text-sm font-bold text-gray-800 text-center">Branch Not Closed</p></>
                                                )}
                                            </div>
                                            <div>
                                                <div className="text-center mb-2"><h2 className="text-sm font-bold text-gray-800">PERFORMANCE</h2><p className="text-xs text-gray-600 capitalize">{timeFilter}</p></div>
                                                <div className="w-full" style={{height:'150px',position:'relative'}}>
                                                    <Doughnut data={clientsCollectionData} options={donutChartOptions}/>
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="text-center">
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Collection</div>
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Rate</div>
                                                            <div className="text-sm font-bold text-gray-800 mt-1">
                                                                {summaryData.activeClients ? (((summaryData.activeClients-(summaryData.pendingClients||0)-(summaryData.mispaymentPerson||0)-(summaryData.pastDuePerson||0))/summaryData.activeClients)*100).toFixed(1) : '0.0'}%
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-2 space-y-1">
                                                    {[
                                                        {label:'Good Clients',color:'#BBF7D0',value:summaryData.activeClients?summaryData.activeClients-(summaryData.pendingClients||0)-(summaryData.mispaymentPerson||0)-(summaryData.pastDuePerson||0):0},
                                                        {label:'Late Clients',color:'#FEF08A',value:summaryData.pendingClients||0},
                                                        {label:'Mis Payment',color:'#FECDD3',value:summaryData.mispaymentPerson||0},
                                                        {label:'Past Due',color:'#E9D5FF',value:summaryData.pastDuePerson||0},
                                                    ].map((item,i)=>(
                                                        <div key={i} className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2"><div className="w-3 h-3 rounded-sm border border-gray-200" style={{backgroundColor:item.color}}/><span className="text-xs text-gray-700">{item.label}</span></div>
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

                        {/* ── COMPANY ACTIVITIES + CHART ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                            <div className="lg:col-span-8">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
                                    <div className="flex items-center gap-2 mb-3"><Activity size={15} className="text-blue-500"/><h3 className="text-sm font-bold text-gray-800">Company Activities:</h3></div>
                                    <input ref={activityFileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleActivityUpload}/>
                                    <CompanyActivitiesSlider slides={activitySlides.length>0?activitySlides:ACTIVITY_SLIDES} isAdmin={currentUser?.role?.rep===1} onUploadClick={()=>activityFileInputRef.current?.click()} uploading={uploadingActivity} onDeleteCurrent={handleActivityDelete} deleting={deletingActivity}/>
                                </div>
                            </div>
                            <div className="lg:col-span-4">
                                <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 h-full">
                                    <div className="flex items-center gap-2 mb-3"><BarChart2 size={15} className="text-indigo-500"/><h2 className="text-sm font-bold text-gray-800">Chart Dashboard</h2></div>
                                    <div style={{height:'300px'}}><Bar data={keyMetricsChartData} options={miniBarOptions}/></div>
                                </div>
                            </div>
                        </div>

                        {/* ═══ BOTTOM ROW ═══ */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                            {/* CONSOLIDATED SUMMARY */}
                            <div className="lg:col-span-3">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="Consolidated Summary" subtitle={filterLabel}>
                                        <div>
                                            <CardItem title="Active Clients"     value={summaryData.activeClients}    prevValue={summaryData.prev_activeClients}    Icon={Users}         bgColor="bg-blue-50"/>
                                            <CardItem title="MCBU"              value={summaryData.mcbu}             prevValue={summaryData.prev_mcbu}             Icon={Wallet}        bgColor="bg-green-50"/>
                                            <CardItem title="CSF"               value={summaryData.csf}              prevValue={summaryData.prev_csf}              Icon={Banknote}      bgColor="bg-purple-50"/>
                                            <CardItem title="Active Loan"       value={summaryData.totalLoanRelease} prevValue={summaryData.prev_totalLoanRelease} Icon={Banknote}      bgColor="bg-indigo-50"/>
                                            <CardItem title="Active Borrowers"  value={summaryData.activeBorrowers}  prevValue={summaryData.prev_activeBorrowers}  Icon={Users}         bgColor="bg-cyan-50"/>
                                            <CardItem title="Loan Balance"      value={summaryData.totalLoanBalance} prevValue={summaryData.prev_totalLoanBalance} Icon={Scale}         bgColor="bg-yellow-50"/>
                                            <CardItem title="Past Due Person"   value={summaryData.pastDuePerson}   prevValue={summaryData.prev_pastDuePerson}   Icon={AlertCircle}   bgColor="bg-red-50"/>
                                            <CardItem title="Past Due Amount"   value={summaryData.pastDueAmount}   prevValue={summaryData.prev_pastDueAmount}   Icon={AlertCircle}   bgColor="bg-red-50"/>
                                            <CardItem title="Net Risk"          value={summaryData.pdNetRisk}       prevValue={summaryData.prev_pdNetRisk}       Icon={AlertTriangle} bgColor="bg-orange-50"/>
                                            <CardItem title="Mis Payment Person" value={summaryData.mispaymentPerson} prevValue={summaryData.prev_mispaymentPerson} Icon={XCircle}    bgColor="bg-pink-50"/>
                                            <CardItem title="Net Loan Balance"  value={summaryData.excusedLoanBalance} prevValue={summaryData.prev_excusedLoanBalance} Icon={DollarSign} bgColor="bg-gray-50"/>
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* PROGRESS */}
                            <div className="lg:col-span-5">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="PROGRESS" subtitle={filterLabel}>
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 pb-1 mb-1 border-b border-gray-100">Daily</p>

                                            <CardItem title="Total Loan Release Person" value={totalReleasePerson}                   prevValue={prevTotalReleasePerson}                    Icon={Users}         bgColor="bg-blue-50"/>
                                            <CardItem title="Amount"                   value={summaryData.currentReleaseAmount}       prevValue={summaryData.prev_currentReleaseAmount}      Icon={DollarSign}    bgColor="bg-blue-50"/>
                                            <CardItem title="New Member Person"        value={summaryData.currentReleasePerson_New}  prevValue={summaryData.prev_currentReleasePerson_New}  Icon={UserPlus}      bgColor="bg-green-50"/>
                                            <CardItem title="New Member Amount"        value={newMemberAmount}                       prevValue={prevNewMemberAmount}                       Icon={DollarSign}    bgColor="bg-green-50"/>
                                            <CardItem title="Renewal Person"           value={summaryData.currentReleasePerson_Rel}  prevValue={summaryData.prev_currentReleasePerson_Rel}  Icon={RotateCcw}     bgColor="bg-yellow-50"/>
                                            <CardItem title="Renewal Amount"           value={summaryData.currentReleaseAmount}       prevValue={summaryData.prev_currentReleaseAmount}      Icon={DollarSign}    bgColor="bg-yellow-50"/>
                                            <CardItem title="Offset Person"            value={summaryData.offsetPerson}              prevValue={summaryData.prev_offsetPerson}              Icon={MinusCircle}   bgColor="bg-orange-50"/>
                                            <CardItem title="Full Payment Person"      value={summaryData.fullPayment}               prevValue={summaryData.prev_fullPayment}              Icon={CheckCircle2}  bgColor="bg-emerald-50"/>
                                            <CardItem title="Full Payment Amount"      value={summaryData.fullPaymentAmount}         prevValue={summaryData.prev_fullPaymentAmount}        Icon={DollarSign}    bgColor="bg-emerald-50"/>
                                            <CardItem title="Transfer of Clients"      value={summaryData.transferClients}           prevValue={summaryData.prev_transferClients}          Icon={ArrowLeftRight} bgColor="bg-purple-50"/>

                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider px-1 pb-1 mt-3 mb-1 border-b border-gray-100">Weekly</p>

                                            <CardItem title="Loan Collection Weekly"  value={summaryData.loanCollectionWeekly}      prevValue={summaryData.prev_loanCollectionWeekly}     Icon={Banknote}      bgColor="bg-blue-50"/>
                                            <CardItem title="Pending Clients"         value={summaryData.pendingClients}            prevValue={summaryData.prev_pendingClients}           Icon={Clock}         bgColor="bg-gray-50"/>
                                            <CardItem title="Mispayment Person"       value={summaryData.mispaymentPerson}          prevValue={summaryData.prev_mispaymentPerson}         Icon={XCircle}       bgColor="bg-pink-50"/>
                                            <CardItem title="Past Due Person"         value={summaryData.pastDuePerson}             prevValue={summaryData.prev_pastDuePerson}            Icon={AlertCircle}   bgColor="bg-red-50"/>
                                            <CardItem title="Past Due Amount"         value={summaryData.pastDueAmount}             prevValue={summaryData.prev_pastDueAmount}            Icon={AlertCircle}   bgColor="bg-red-50"/>
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                            {/* COLLECTION DETAILS */}
                            <div className="lg:col-span-4">
                                <div className="sticky top-4">
                                    <CollapsiblePanel title="Collection Details" subtitle={filterLabel}>
                                        <div>
                                            <CardItem title="MCBU"                    value={summaryData.mcbuCollection}           Icon={Wallet}         bgColor="bg-orange-50"/>
                                            <CardItem title="CSF"                     value={summaryData.csfCollection}            Icon={Banknote}       bgColor="bg-blue-50"/>
                                            <CardItem title="Loan Collection Daily"   value={summaryData.loanCollectionDaily}      Icon={Banknote}       bgColor="bg-green-50"/>
                                            <CardItem title="Loan Collection Weekly"  value={summaryData.loanCollectionWeekly}     Icon={Banknote}       bgColor="bg-red-50"/>
                                            <CardItem title="MCBU Withdrawals"        value={summaryData.mcbuWithdrawal}           Icon={Wallet}         bgColor="bg-pink-50"/>
                                            <CardItem title="CSF Withdrawals"         value={summaryData.csfWithdrawal}            Icon={Banknote}       bgColor="bg-violet-50"/>
                                            <CardItem title="MCBU/CSF Refund"         value={summaryData.mcbuReturn??summaryData.clientMcbuReturn} Icon={RotateCcw} bgColor="bg-lime-50"/>
                                            <CardItem title="LRF Collection"          value={summaryData.lrfCollection}            Icon={Banknote}       bgColor="bg-yellow-50"/>
                                            <CardItem title="CBHB Collection"         value={summaryData.cbhbCollection}           Icon={Banknote}       bgColor="bg-sky-50"/>
                                            <CardItem title="Admin Fees"              value={summaryData.admissionCollection}      Icon={DollarSign}     bgColor="bg-orange-50"/>
                                            <CardItem title="Staff CBU Collection"    value={summaryData.staffCbuCollection}       Icon={Users}          bgColor="bg-blue-50"/>
                                            <CardItem title="Staff Loan Collection"   value={summaryData.staffLoanCollection}      Icon={Banknote}       bgColor="bg-green-50"/>
                                            <CardItem title="Add. Hospitalization"    value={summaryData.addHospitalization}       Icon={Heart}          bgColor="bg-pink-50"/>
                                            <CardItem title="Other Income (Passbook)" value={summaryData.otherPassbookCollection}  Icon={DollarSign}     bgColor="bg-red-50"/>
                                            <CardItem title="Other Income"            value={summaryData.otherCollection}          Icon={DollarSign}     bgColor="bg-violet-50"/>
                                            <CardItem title="Other Receipts"          value={summaryData.otherReceipts}            Icon={DollarSign}     bgColor="bg-lime-50"/>
                                            <CardItem title="Fund Transfer (In)"      value={summaryData.fundTransferReceipts}     Icon={ArrowLeftRight} bgColor="bg-purple-50"/>
                                            <CardItem title="Bank Withdrawal"         value={summaryData.bankWithdrawal}           Icon={Banknote}       bgColor="bg-sky-50"/>
                                            <CardItem title="Total Receipts"          value={summaryData.totalReceipts}            Icon={DollarSign}     bgColor="bg-green-100"/>
                                        </div>
                                    </CollapsiblePanel>
                                </div>
                            </div>

                        </div>{/* end bottom row */}
                    </div>
                )}
            </div>
        </div>
    );
};

export default DashboardPage;