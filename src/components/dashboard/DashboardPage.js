import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
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
    ChevronDown
} from 'lucide-react';
import ClientSearchTool from './ClientSearchTool';
import { Doughnut } from 'react-chartjs-2';
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

ChartJS.register(...registerables, ChartDataLabels);

const DashboardPage = () => {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
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

    // New state for search visibility and filters
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);

    const regions = useMemo(() => regionList.filter(r => divisionFilter === 'all' || r._id === 'all' || r.divisionId === divisionFilter), [regionList, divisionFilter]);
    const areas = useMemo(() => areaList.filter(a => regionFilter === 'all' || a._id === 'all' || a.regionId === regionFilter ), [regionFilter, areaList]);
    const branches = useMemo(() => branchList.filter(b => areaFilter === 'all' || b._id === 'all' || b.areaId === areaFilter ), [areaFilter, branchList]);
    const loanOfficers = useMemo(() =>loanOfficerList.filter(l => branchFilter === 'all' || l._id === 'all' || l.designatedBranchId === branchFilter), [branchFilter, loanOfficerList]);

    const [coh, setCoh] = useState(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(Math.floor(Math.random() * 1000000)));
    const [bankBalance, setBankBalance] = useState('₱535,892.00');

    const [isMobile, setIsMobile] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [dateFilter, setDateFilter] = useState(currentDate);

    // Donut chart data for Clients Collection Rate
    const [clientsCollectionData, setClientsCollectionData] = useState({
        labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
        datasets: [{
            data: [0, 0, 0, 0],
            backgroundColor: [
                '#4B5563', // Dark gray for Good Clients
                '#14B8A6', // Teal for Late Clients  
                '#60A5FA', // Light blue for Mis Payment Clients
                '#A855F7'  // Purple for Past Due Clients
            ],
            borderWidth: 0,
            cutout: '70%'
        }]
    });

    // Helper function to calculate percentage change and trend
    const calculateTrend = (current, previous) => {
        const currentValue = current || 0;
        const previousValue = previous || 0;
        
        if (previousValue === 0) {
            if (currentValue === 0) {
                return { change: 0, trend: 'neutral', percentage: 0 };
            }
            return { 
                change: currentValue, 
                trend: currentValue > 0 ? 'up' : 'down', 
                percentage: 100 
            };
        }
        
        const change = currentValue - previousValue;
        const percentage = ((change / Math.abs(previousValue)) * 100);
        const trend = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
        
        return { change, trend, percentage: Math.abs(percentage) };
    };

    // Enhanced CardItem component with trend indicators
    const CardItem = ({ title, value, prevValue, Icon }) => {
        const IconComponent = Icon || HelpCircle;
        const trend = calculateTrend(value, prevValue);
        
        const getTrendIcon = () => {
            switch (trend.trend) {
                case 'up':
                    return <TrendingUp className="h-4 w-4" />;
                case 'down':
                    return <TrendingDown className="h-4 w-4" />;
                default:
                    return <Minus className="h-4 w-4" />;
            }
        };
        
        const getTrendColor = () => {
            switch (trend.trend) {
                case 'up':
                    return 'text-green-600';
                case 'down':
                    return 'text-red-600';
                default:
                    return 'text-gray-500';
            }
        };
        
        return (
            <div className="bg-white p-3 rounded-lg shadow relative overflow-hidden mb-2">
                <IconComponent className="absolute right-1 bottom-1 h-10 w-10 text-gray-200" />
                <div className="relative z-10">
                    <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-semibold text-gray-700 truncate">{title}</h3>
                        {prevValue !== undefined && (
                            <div className={`flex items-center space-x-1 ${getTrendColor()} shrink-0`}>
                                {getTrendIcon()}
                                <span className="text-xs font-medium">
                                    {trend.percentage.toFixed(1)}%
                                </span>
                            </div>
                        )}
                    </div>
                    <p className="text-base font-bold text-blue-600 truncate">{formatNumber(value || 0)}</p>
                    {prevValue !== undefined && trend.trend !== 'neutral' && (
                        <div className={`text-xs mt-1 ${getTrendColor()}`}>
                            {trend.trend === 'up' ? '+' : ''}{formatNumber(trend.change)}
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // Custom Select Component
    const CustomSelect = ({ value, onChange, options, placeholder, className = "", icon: Icon }) => {
        const [isOpen, setIsOpen] = useState(false);
        const selectedOption = options.find(opt => opt.value === value);

        return (
            <div className={`relative ${className}`}>
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-2.5 text-left shadow-sm hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                            <span className="text-sm font-medium text-gray-700">
                                {selectedOption ? selectedOption.label : placeholder}
                            </span>
                        </div>
                        <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                </button>
                
                {isOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {options.map((option, index) => (
                            <button
                                key={index}
                                type="button"
                                onClick={() => {
                                    onChange(option.value);
                                    setIsOpen(false);
                                }}
                                className="w-full px-4 py-2 text-left text-sm hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:bg-blue-50"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    };

    useEffect(() => {
        fetchSummaries();
    }, [divisionFilter, regionFilter, areaFilter, branchFilter, loanOfficerFilter, timeFilter, timeFilterList, dateFilter, selectedFilter]);

    useEffect(() => {
        switch(timeFilter) {
            case 'weekly': {
                const weeks = getWeeks(selectedYear).map(o => ({
                    ... o,
                    field: 'week'
                }));

                setTimeFilterList(weeks); 
                setSelectedFilter(weeks[0]?.value);
                break;
            }
            case 'monthly': {
                const months = getMonths(selectedYear).map(o => ({
                    ... o,
                    field: 'month'
                }));

                setTimeFilterList(months); 
                setSelectedFilter(months[0]);
                break;
            }
            case 'quarterly': {
                const quarters = getQuarters().map(o => ({
                    ... o,
                    field: 'quarter'
                }));

                setSelectedFilter(quarters[0]);
                setTimeFilterList(quarters);
                break;
            }
            default:  break;
        }

    }, [timeFilter, selectedYear]);

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            setWindowWidth(width);
            setIsMobile(width < 768);
            if (width >= 768) {
                setIsNavVisible(true);
            }
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
    
    const toggleNav = () => {
        setIsNavVisible(!isNavVisible);
    };

    // Update donut chart data when summaryData changes
    useEffect(() => {
        if (summaryData.activeClients) {
            const activeClients = summaryData.activeClients || 0;
            const pendingClients = summaryData.pendingClients || 0;
            const mispaymentPerson = summaryData.mispaymentPerson || 0;
            const pastDuePerson = summaryData.pastDuePerson || 0;
            
            // Calculate good clients (active clients minus problematic ones)
            const goodClients = Math.max(0, activeClients - pendingClients - mispaymentPerson - pastDuePerson);
            
            setClientsCollectionData({
                labels: ['Good Clients', 'Late Clients', 'Mis Payment Clients', 'Past Due Clients'],
                datasets: [{
                    data: [goodClients, pendingClients, mispaymentPerson, pastDuePerson],
                    backgroundColor: [
                        '#4B5563', // Dark gray for Good Clients
                        '#14B8A6', // Teal for Late Clients  
                        '#60A5FA', // Light blue for Mis Payment Clients
                        '#A855F7'  // Purple for Past Due Clients
                    ],
                    borderWidth: 0,
                    cutout: '70%'
                }]
            });
        }
    }, [summaryData]);

    const formatNumber = (num) => {
        if (num === undefined || num === null) {
            return 'N/A';
        }
        if (typeof num === 'number') {
            return num.toLocaleString('en-US');
        }
        return num;
    };

    let fetchTimeout;

    useEffect(() => {
        if(!loading) {
            clearTimeout(fetchTimeout);
        }
    }, [loading])

    const fetchSummaries = async () => {
        if (loading) {
            return;
        }

        fetchTimeout = setTimeout(() => {
            setLoading(true);
            let selectedDate = null;
            switch(timeFilter) {
                case 'weekly': selectedDate = { value: moment(selectedFilter?.value ?? new Date()).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'monthly': selectedDate = { value: moment(selectedYear + '-' + (selectedFilter?.value ?? '01')  + '-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'quarterly': selectedDate = { value: moment(selectedYear + '-01-01').quarter(selectedFilter?.value ?? 1).format('YYYY-MM-DD'), field: 'date_added' }; break;
                case 'yearly': selectedDate = { value: moment(selectedYear + '-12-01').endOf('month').format('YYYY-MM-DD'), field: 'date_added' }; break;
                default: selectedDate = { value: moment(dateFilter).format('YYYY-MM-DD'), field: 'date_added' }; break;
            }

            const queries = [
                selectedDate,
                { value: moment(currentDate ?? selectedDate).format('YYYY-MM-DD'), field: 'currentDate' },
                { value: timeFilter, field: 'filter' },
                { value: divisionFilter, field: 'divisionId'},
                { value: regionFilter, field: 'regionId' }, 
                { value: areaFilter, field: 'areaId' }, 
                { value: branchFilter, field: 'branchId' }, 
                { value: selectedYear, field: 'year' },
                { value: loanOfficerFilter, field: 'loId' },
            ].filter(a => a.value !== 'all' && !!a.value)
                                .map(a => `${a.field}=${a.value}`).join('&');

            const summaryUrl = getApiBaseUrl() + '/dashboard?' + queries + '&type=summary';
            
            setSummaryData({});
            const summaryPromise = fetchWrapper.get(summaryUrl)
                .then(resp => {
                    setSummaryData(resp.data?.[0] ?? {});
                }).catch(error => {
                    console.log(error)
                });
            
            Promise.all([summaryPromise]).finally(() => {
                setLoading(false);
            });
        }, 400);
    };

    const fetchBranches = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/branches';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setBranches([ { _id: 'all', name: 'All', code: '' }, ... resp.data]);
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchRegions = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/regions';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setRegions([ { _id: 'all', name: 'All' }, ... resp.data]);
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchAreas = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/areas';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setAreas([ { _id: 'all', name: 'All' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchDivisions = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/divisions';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setDivisions([ { _id: 'all', name: 'All' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchLoanOfficers = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/loan-officers';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setLoanOfficers([ { _id: 'all', firstName: 'All', lastName: '' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setDateFilter(filteredDate);
    }

    useEffect(() => {
        fetchBranches();
        fetchRegions();
        fetchAreas();
        fetchDivisions();
        fetchLoanOfficers();
        fetchSummaries();
    }, []);

    // Prepare filter options
    const timeFilterOptions = [
        { value: 'daily', label: 'Daily' },
        { value: 'weekly', label: 'Weekly' },
        { value: 'monthly', label: 'Monthly' },
        { value: 'quarterly', label: 'Quarterly' },
        { value: 'yearly', label: 'Yearly' }
    ];

    const branchOptions = branches.map(branch => ({
        value: branch._id,
        label: `${branch.code} ${branch.name}`.trim()
    }));

    const regionOptions = regions.map(region => ({
        value: region._id,
        label: region.name
    }));

    const areaOptions = areas.map(area => ({
        value: area._id,
        label: area.name
    }));

    const divisionOptions = divisions.map(division => ({
        value: division._id,
        label: division.name
    }));

    const loanOfficerOptions = loanOfficers.map(lo => ({
        value: lo._id,
        label: `${lo.firstName} ${lo.lastName}`.trim()
    }));

    const yearOptions = yearList.map(year => ({
        value: year.value,
        label: year.label
    }));

    const timeFilterListOptions = timeFilterList.map((item, index) => ({
        value: index,
        label: item.label
    }));

    // Donut chart options
    const donutChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right',
                labels: {
                    usePointStyle: true,
                    pointStyle: 'rect',
                    padding: 20,
                    font: {
                        size: 14,
                        weight: '500'
                    }
                }
            },
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
            datalabels: {
                display: false
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <div className="flex-grow p-4 flex flex-col overflow-x-auto">
                {/* Header Section - Swapped layout */}
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pb-6 border-b border-gray-200 gap-4">
                    {/* Left side - Filters and Search (was right side) */}
                    <div className="flex flex-col space-y-4">
                        {/* Filter Controls */}
                        <div className="flex flex-wrap gap-3">
                            {/* Time Filter */}
                            <CustomSelect
                                value={timeFilter}
                                onChange={setTimeFilter}
                                options={timeFilterOptions}
                                placeholder="Select Time Period"
                                icon={Calendar}
                                className="w-40"
                            />

                            {/* Date Filter for Daily */}
                            {timeFilter === 'daily' && (
                                <div className="w-40">
                                    <DatePicker 
                                        name="dateFilter" 
                                        value={moment(dateFilter).format('YYYY-MM-DD')} 
                                        maxDate={currentDate} 
                                        onChange={handleDateFilter}
                                        height="h-[42px]"
                                    />
                                </div>
                            )}

                            {/* Year Filter for non-daily */}
                            {timeFilter !== 'daily' && (
                                <CustomSelect
                                    value={selectedYear}
                                    onChange={setSelectedYear}
                                    options={yearOptions}
                                    placeholder="Select Year"
                                    className="w-32"
                                />
                            )}

                            {/* Period Filter for non-yearly and non-daily */}
                            {timeFilter !== 'yearly' && timeFilter !== 'daily' && (
                                <CustomSelect
                                    value={timeFilterList.findIndex(item => item === selectedFilter)}
                                    onChange={(index) => setSelectedFilter(timeFilterList[index])}
                                    options={timeFilterListOptions}
                                    placeholder={`Select ${timeFilter.charAt(0).toUpperCase() + timeFilter.slice(1)}`}
                                    className="w-40"
                                />
                            )}

                            {/* Toggle for more filters */}
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

                            {/* Search Toggle Button */}
                            <button
                                onClick={() => setIsSearchVisible(!isSearchVisible)}
                                className="flex items-center space-x-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200"
                            >
                                <Search className="w-4 h-4" />
                                <span className="text-sm font-medium">
                                    {isSearchVisible ? 'Hide Search' : 'Search Client'}
                                </span>
                            </button>
                        </div>

                        {/* Expanded Filters */}
                        {isFiltersExpanded && (
                            <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg border">
                                {divisions.length > 2 && (
                                    <CustomSelect
                                        value={divisionFilter}
                                        onChange={setDivisionFilter}
                                        options={divisionOptions}
                                        placeholder="Select Division"
                                        className="w-40"
                                    />
                                )}

                                {regions.length > 2 && (
                                    <CustomSelect
                                        value={regionFilter}
                                        onChange={setRegionFilter}
                                        options={regionOptions}
                                        placeholder="Select Region"
                                        className="w-40"
                                    />
                                )}

                                {areas.length > 2 && (
                                    <CustomSelect
                                        value={areaFilter}
                                        onChange={setAreaFilter}
                                        options={areaOptions}
                                        placeholder="Select Area"
                                        className="w-40"
                                    />
                                )}

                                {branchList.length > 2 && (
                                    <CustomSelect
                                        value={branchFilter}
                                        onChange={setBranchFilter}
                                        options={branchOptions}
                                        placeholder="Select Branch"
                                        className="w-48"
                                    />
                                )}

                                {loanOfficerList.length > 2 && (
                                    <CustomSelect
                                        value={loanOfficerFilter}
                                        onChange={setLoanOfficerFilter}
                                        options={loanOfficerOptions}
                                        placeholder="Select Loan Officer"
                                        className="w-48"
                                    />
                                )}
                            </div>
                        )}

                        {/* Client Search Tool */}
                        {isSearchVisible && (
                            <div className="p-4 bg-white rounded-lg border shadow-sm">
                                <ClientSearchTool />
                            </div>
                        )}
                    </div>

                    {/* Right side - Bank Balance (was left side) */}
                    <div className="flex flex-col items-end">
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-lg shadow-lg">
                            <p className="text-sm font-medium opacity-90">Bank Balance</p>
                            <p className="text-2xl font-bold">{bankBalance}</p>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Spinner />
                    </div>
                ) : ( 
                    <div className="flex flex-col gap-4 mt-4 min-w-[1400px]">
                        {/* Performance Section - Compact Layout */}
                        <div className="w-full mb-8">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Left: Chart */}
                                <div className="lg:col-span-1">
                                    <div className="bg-white p-6 rounded-lg shadow h-full">
                                        <div className="text-center mb-4">
                                            <h2 className="text-lg font-bold text-gray-800">PERFORMANCE</h2>
                                            <p className="text-sm text-gray-600 capitalize">{timeFilter}</p>
                                        </div>
                                        <div className="relative">
                                            <div className="h-[200px] flex items-center justify-center">
                                                <div className="w-[200px] h-[200px] relative">
                                                    <Doughnut data={clientsCollectionData} options={{
                                                        ...donutChartOptions,
                                                        plugins: {
                                                            ...donutChartOptions.plugins,
                                                            legend: {
                                                                display: false
                                                            }
                                                        }
                                                    }} />
                                                    {/* Center text - properly positioned */}
                                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                        <div className="text-center">
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Clients Collection</div>
                                                            <div className="text-xs font-medium text-gray-600 leading-tight">Rate</div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle: Key Performance Metrics */}
                                <div className="lg:col-span-1">
                                    <div className="bg-white p-6 rounded-lg shadow h-full">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Key Metrics</h3>
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                                                <span className="text-sm font-medium text-gray-700">Collection Rate</span>
                                                <span className="text-lg font-bold text-blue-600">
                                                    {summaryData.activeClients ? 
                                                        (((summaryData.activeClients - (summaryData.pendingClients || 0) - (summaryData.mispaymentPerson || 0) - (summaryData.pastDuePerson || 0)) / summaryData.activeClients) * 100).toFixed(1) 
                                                        : '0.0'}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                                                <span className="text-sm font-medium text-gray-700">Active Clients</span>
                                                <span className="text-lg font-bold text-green-600">{formatNumber(summaryData.activeClients || 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                                                <span className="text-sm font-medium text-gray-700">Late Clients</span>
                                                <span className="text-lg font-bold text-yellow-600">{formatNumber(summaryData.pendingClients || 0)}</span>
                                            </div>
                                            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                                                <span className="text-sm font-medium text-gray-700">Problem Clients</span>
                                                <span className="text-lg font-bold text-red-600">
                                                    {formatNumber((summaryData.mispaymentPerson || 0) + (summaryData.pastDuePerson || 0))}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Legend */}
                                <div className="lg:col-span-1">
                                    <div className="bg-white p-6 rounded-lg shadow h-full">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Client Categories</h3>
                                        <div className="space-y-3">
                                            {[
                                                { label: 'Good Clients', color: '#4B5563', value: summaryData.activeClients ? summaryData.activeClients - (summaryData.pendingClients || 0) - (summaryData.mispaymentPerson || 0) - (summaryData.pastDuePerson || 0) : 0 },
                                                { label: 'Late Clients', color: '#14B8A6', value: summaryData.pendingClients || 0 },
                                                { label: 'Mis Payment Clients', color: '#60A5FA', value: summaryData.mispaymentPerson || 0 },
                                                { label: 'Past Due Clients', color: '#A855F7', value: summaryData.pastDuePerson || 0 }
                                            ].map((item, index) => (
                                                <div key={index} className="flex items-center justify-between p-2 rounded">
                                                    <div className="flex items-center space-x-3">
                                                        <div 
                                                            className="w-4 h-4 rounded-sm" 
                                                            style={{ backgroundColor: item.color }}
                                                        ></div>
                                                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-900">{formatNumber(item.value)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Grid - Responsive */}
                        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                            {/* Summary Column */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">SUMMARY</h2>
                                        <p className="text-sm text-gray-600 capitalize">{timeFilter}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <CardItem title="Active Clients" value={summaryData.activeClients} prevValue={summaryData.prev_activeClients} Icon={UserPlus} />
                                        <CardItem title="MCBU" value={summaryData.mcbu} prevValue={summaryData.prev_mcbu} Icon={Wallet} />
                                        <CardItem title="Total Loan Release" value={summaryData.totalLoanRelease} prevValue={summaryData.prev_totalLoanRelease} Icon={Banknote} />
                                        <CardItem title="Active Borrowers" value={summaryData.activeBorrowers} prevValue={summaryData.prev_activeBorrowers} Icon={Scale} />
                                        <CardItem title="Total Loan Balance" value={summaryData.totalLoanBalance} prevValue={summaryData.prev_totalLoanBalance} Icon={DollarSign} />
                                        <CardItem title="Past Due Person" value={summaryData.pastDuePerson} prevValue={summaryData.prev_pastDuePerson} Icon={AlertCircle} />
                                        <CardItem title="Past Due Amount" value={summaryData.pastDueAmount} prevValue={summaryData.prev_pastDueAmount} Icon={AlertCircle} />
                                        <CardItem title="PD Active Loan" value={summaryData.pdActiveLoan} prevValue={summaryData.prev_pdActiveLoan} Icon={AlertCircle} />
                                        <CardItem title="PD Loan Balance" value={summaryData.pdLoanBalance} prevValue={summaryData.prev_pdLoanBalance} Icon={AlertCircle} />
                                        <CardItem title="PD Net Risk" value={summaryData.pdNetRisk} prevValue={summaryData.prev_pdNetRisk} Icon={AlertCircle} />
                                        <CardItem title="Excused Person" value={summaryData.excusedPerson} prevValue={summaryData.prev_excusedPerson} Icon={XCircle} />
                                        <CardItem title="Excused Active Loan" value={summaryData.excusedActiveLoan} prevValue={summaryData.prev_excusedActiveLoan} Icon={XCircle} />
                                        <CardItem title="Excused Loan Balance" value={summaryData.excusedLoanBalance} prevValue={summaryData.prev_excusedLoanBalance} Icon={XCircle} />
                                        <CardItem title="Excused Net Risk Balance" value={summaryData.excusedNetRiskBalance} prevValue={summaryData.prev_excusedNetRiskBalance} Icon={XCircle} />
                                        <CardItem title="Runaway Clients" value={summaryData.runawayClients} prevValue={summaryData.prev_runawayClients} Icon={UserMinus} />
                                        <CardItem title="Missing Clients" value={summaryData.missingClients} prevValue={summaryData.prev_missingClients} Icon={UserMinus} />
                                        <CardItem title="Dummy Accounts" value={summaryData.dummyAccounts} prevValue={summaryData.prev_dummyAccounts} Icon={UserMinus} />
                                        <CardItem title="Loan Share" value={summaryData.loanShare} prevValue={summaryData.prev_loanShare} Icon={Share2} />
                                        <CardItem title="Imprisonment" value={summaryData.imprisonment} prevValue={summaryData.prev_imprisonment} Icon={Lock} />
                                        <CardItem title="Moving Excuses" value={summaryData.movingExcuses} prevValue={summaryData.prev_movingExcuses} Icon={Truck} />
                                        <CardItem title="Delinquent" value={summaryData.delinquent} prevValue={summaryData.prev_delinquent} Icon={AlertTriangle} />
                                        <CardItem title="Hospitalization" value={summaryData.hospitalization} prevValue={summaryData.prev_hospitalization} Icon={Heart} />
                                        <CardItem title="Death" value={summaryData.death} prevValue={summaryData.prev_death} Icon={X} />
                                        <CardItem title="Bankruptcy" value={summaryData.bankruptcy} prevValue={summaryData.prev_bankruptcy} Icon={DollarSign} />
                                    </div>
                                </div>
                            </div>

                            {/* Progress Column */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">PROGRESS</h2>
                                        <p className="text-sm text-gray-600 capitalize">{timeFilter}</p>
                                    </div>
                                    <div className="space-y-2">
                                        <CardItem title="Total Release:" value={summaryData.totalLoanRelease} prevValue={summaryData.prev_totalLoanRelease} Icon={Banknote} />
                                        <CardItem title="Amount:" value={summaryData.amount} prevValue={summaryData.prev_amount} Icon={DollarSign} />
                                        <CardItem title="New Member:" value={summaryData.newMember} prevValue={summaryData.prev_newMember} Icon={UserPlus} />
                                        <CardItem title="Transfer Clients:" value={summaryData.transferClients} prevValue={summaryData.prev_transferClients} Icon={ArrowLeftRight} />
                                        <CardItem title="Renewals:" value={summaryData.renewals} prevValue={summaryData.prev_renewals} Icon={RotateCcw} />
                                        <CardItem title="Offset:" value={summaryData.offset} prevValue={summaryData.prev_offset} Icon={MinusCircle} />
                                        <CardItem title="Full Payment" value={summaryData.fullPayment} prevValue={summaryData.prev_fullPayment} Icon={Users} />
                                        <CardItem title="Full Payment Amount:" value={summaryData.fullPaymentAmount} prevValue={summaryData.prev_fullPaymentAmount} Icon={DollarSign} />
                                        <CardItem title="Past Due Collection:" value={summaryData.pastDueCollection} prevValue={summaryData.prev_pastDueCollection} Icon={AlertCircle} />
                                        <CardItem title="Pending:" value={summaryData.pending} prevValue={summaryData.prev_pending} Icon={Clock} />
                                    </div>
                                </div>
                            </div>  

                            {/* Daily Cash Collection - Receipts */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">DAILY CASH COLLECTION</h2>
                                        <p className="text-sm text-gray-600">RECEIPTS</p>
                                    </div>
                                    <div className="space-y-2">
                                        <CardItem title="Beginning Balance:" value={summaryData.beginningBalance} prevValue={summaryData.prev_beginningBalance} Icon={DollarSign} />
                                        <CardItem title="MCBU Collection:" value={summaryData.mcbuCollection} prevValue={summaryData.prev_mcbuCollection} Icon={Wallet} />
                                        <CardItem title="Loan Collection Daily:" value={summaryData.loanCollectionDaily} prevValue={summaryData.prev_loanCollectionDaily} Icon={Banknote} />
                                        <CardItem title="Loan Collection Weekly:" value={summaryData.loanCollectionWeekly} prevValue={summaryData.prev_loanCollectionWeekly} Icon={Banknote} />
                                        <CardItem title="Staff CBU Collection:" value={summaryData.staffCbuCollection} prevValue={summaryData.prev_staffCbuCollection} Icon={Users} />
                                        <CardItem title="Staff Loan Collection:" value={summaryData.staffLoanCollection} prevValue={summaryData.prev_staffLoanCollection} Icon={Banknote} />
                                        <CardItem title="Admin Fees:" value={summaryData.adminFees} prevValue={summaryData.prev_adminFees} Icon={DollarSign} />
                                        <CardItem title="L R F Collection:" value={summaryData.lrfCollection} prevValue={summaryData.prev_lrfCollection} Icon={Banknote} />
                                        <CardItem title="C H B Collection:" value={summaryData.chbCollection} prevValue={summaryData.prev_chbCollection} Icon={Banknote} />
                                        <CardItem title="Add. Hospitalization:" value={summaryData.addHospitalization} prevValue={summaryData.prev_addHospitalization} Icon={Heart} />
                                        <CardItem title="W/Tax, EE&ER:" value={summaryData.wtaxEeEr} prevValue={summaryData.prev_wtaxEeEr} Icon={DollarSign} />
                                        <CardItem title="MCBU Unclaimed (N):" value={summaryData.mcbuUnclaimedN} prevValue={summaryData.prev_mcbuUnclaimedN} Icon={AlertCircle} />
                                        <CardItem title="Other Income (Passbook):" value={summaryData.otherIncomePassbook} prevValue={summaryData.prev_otherIncomePassbook} Icon={DollarSign} />
                                        <CardItem title="Other Income:" value={summaryData.otherIncome} prevValue={summaryData.prev_otherIncome} Icon={DollarSign} />
                                        <CardItem title="Other Receipts (Picture):" value={summaryData.otherReceiptsPicture} prevValue={summaryData.prev_otherReceiptsPicture} Icon={DollarSign} />
                                        <CardItem title="Other Receipts:" value={summaryData.otherReceipts} prevValue={summaryData.prev_otherReceipts} Icon={DollarSign} />
                                        <CardItem title="Fund Transfer:" value={summaryData.fundTransferReceipts} prevValue={summaryData.prev_fundTransferReceipts} Icon={ArrowLeftRight} />
                                        <CardItem title="Bank Withdrawal:" value={summaryData.bankWithdrawal} prevValue={summaryData.prev_bankWithdrawal} Icon={Banknote} />
                                        <CardItem title="Total Receipts:" value={summaryData.totalReceipts} prevValue={summaryData.prev_totalReceipts} Icon={DollarSign} />
                                    </div>
                                </div>
                            </div>

                            {/* Daily Cash Collection - Payments */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">DAILY CASH COLLECTION</h2>
                                        <p className="text-sm text-gray-600">PAYMENTS</p>
                                    </div>
                                    <div className="space-y-2">
                                        <CardItem title="Client Loan Release:" value={summaryData.clientLoanRelease} prevValue={summaryData.prev_clientLoanRelease} Icon={Banknote} />
                                        <CardItem title="Client MCBU Withdrawals:" value={summaryData.clientMcbuWithdrawals} prevValue={summaryData.prev_clientMcbuWithdrawals} Icon={Wallet} />
                                        <CardItem title="Client MCBU Return:" value={summaryData.clientMcbuReturn} prevValue={summaryData.prev_clientMcbuReturn} Icon={RotateCcw} />
                                        <CardItem title="Staff Loan Release:" value={summaryData.staffLoanRelease} prevValue={summaryData.prev_staffLoanRelease} Icon={Users} />
                                        <CardItem title="Staff CBU Withdrawals:" value={summaryData.staffCbuWithdrawals} prevValue={summaryData.prev_staffCbuWithdrawals} Icon={Wallet} />
                                        <CardItem title="Management Expenses:" value={summaryData.managementExpenses} prevValue={summaryData.prev_managementExpenses} Icon={DollarSign} />
                                        <CardItem title="CBHB Disbursed:" value={summaryData.cbhbDisbursed} prevValue={summaryData.prev_cbhbDisbursed} Icon={Banknote} />
                                        <CardItem title="MCBU Unclaimed (Out):" value={summaryData.mcbuUnclaimedOut} prevValue={summaryData.prev_mcbuUnclaimedOut} Icon={AlertCircle} />
                                        <CardItem title="Rebates:" value={summaryData.rebates} prevValue={summaryData.prev_rebates} Icon={DollarSign} />
                                        <CardItem title="Other Payment:" value={summaryData.otherPayment} prevValue={summaryData.prev_otherPayment} Icon={DollarSign} />
                                        <CardItem title="Fund Transfer:" value={summaryData.fundTransferPayments} prevValue={summaryData.prev_fundTransferPayments} Icon={ArrowLeftRight} />
                                        <CardItem title="Bank Deposit:" value={summaryData.bankDeposit} prevValue={summaryData.prev_bankDeposit} Icon={Banknote} />
                                        <CardItem title="Total Payment:" value={summaryData.totalPayment} prevValue={summaryData.prev_totalPayment} Icon={DollarSign} />
                                        <CardItem title="Closing Balance:" value={summaryData.closingBalance} prevValue={summaryData.prev_closingBalance} Icon={DollarSign} />
                                        <CardItem title="Cash On Hand:" value={summaryData.cashOnHand} prevValue={summaryData.prev_cashOnHand} Icon={DollarSign} />
                                    </div>
                                </div>
                            </div>

                            {/* Cash Flow for Tomorrow */}
                            <div className="col-span-1">
                                <div className="sticky top-4">
                                    <div className="mb-4">
                                        <h2 className="text-lg font-semibold">CASH FLOW FOR TOMORROW</h2>
                                        <p className="text-sm text-gray-600">Target/Collection</p>
                                    </div>
                                    <div className="space-y-2">
                                        <CardItem title="Prospect:" value={summaryData.prospect} prevValue={summaryData.prev_prospect} Icon={Users} />
                                        <CardItem title="Amount:" value={summaryData.prospectAmount} prevValue={summaryData.prev_prospectAmount} Icon={DollarSign} />
                                        <CardItem title="Renewals:" value={summaryData.tomorrowRenewals} prevValue={summaryData.prev_tomorrowRenewals} Icon={RotateCcw} />
                                        <CardItem title="Amount:" value={summaryData.renewalsAmount} prevValue={summaryData.prev_renewalsAmount} Icon={DollarSign} />
                                        <CardItem title="Total Amount of Releases:" value={summaryData.totalAmountReleases} prevValue={summaryData.prev_totalAmountReleases} Icon={Banknote} />
                                        <CardItem title="Target Collection for Tomorrow:" value={summaryData.targetCollectionTomorrow} prevValue={summaryData.prev_targetCollectionTomorrow} Icon={AlertCircle} />
                                        <CardItem title="Target Expenses for Tomorrow:" value={summaryData.targetExpensesTomorrow} prevValue={summaryData.prev_targetExpensesTomorrow} Icon={DollarSign} />
                                    </div>
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