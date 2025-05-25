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
    Minus
} from 'lucide-react';
import ClientSearchTool from './ClientSearchTool';
import { Line } from 'react-chartjs-2';
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
    const [graphData, setGraphData] = useState([]);

    const [mcbuData, setMcbuData] = useState({ labels: [], datasets: [] });
    const [personData, setPersonData] = useState({ labels: [], datasets: [] });
    const [loanCollectionData, setLoanCollectionData] = useState({ labels: [], datasets: [] });
    const [misPastDueData, setMisPastDueData] = useState({ labels: [], datasets: [] });

    const [branchList, setBranches] = useState([]);
    const [regionList, setRegions] = useState([]);
    const [areaList, setAreas] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [loanOfficerList, setLoanOfficers] = useState([]);
    const [timeFilterList, setTimeFilterList] = useState(getYears());
    const [selectedFilter, setSelectedFilter] = useState();
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
    const [yearList] = useState(getYears);

    const regions = useMemo(() => regionList.filter(r => divisionFilter === 'all' || r._id === 'all' || r.divisionId === divisionFilter), [regionList, divisionFilter]);
    const areas = useMemo(() => areaList.filter(a => regionFilter === 'all' || a._id === 'all' || a.regionId === regionFilter ), [regionFilter, areaList]);
    const branches = useMemo(() => branchList.filter(b => areaFilter === 'all' || b._id === 'all' || b.areaId === areaFilter ), [areaFilter, branchList]);
    const loanOfficers = useMemo(() =>loanOfficerList.filter(l => branchFilter === 'all' || l._id === 'all' || l.designatedBranchId === branchFilter), [branchFilter, loanOfficerList]);

    const [coh, setCoh] = useState(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(Math.floor(Math.random() * 1000000)));
    const [bankBalance, setBankBalance] = useState(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(Math.floor(Math.random() * 1000000)));

    const [isMobile, setIsMobile] = useState(false);
    const [isNavVisible, setIsNavVisible] = useState(true);
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);
    const [dateFilter, setDateFilter] = useState(new Date());

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
                setSelectedFilter(weeks[0].value);
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

    // Function to generate sample dates for last 12 months
    const generateDates = () => {
        const dates = [];
        for (let i = 11; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            dates.push(date.toLocaleString('default', { month: 'short', year: '2-digit' }));
        }
        return dates;
    };

    // Function to generate random data
    const generateRandomData = (min, max, count) => {
        return Array.from({ length: count }, () => 
            Math.floor(Math.random() * (max - min + 1)) + min
        );
    };

    // Enhanced chart data processing with trend colors
    useEffect(() => {
        if(graphData.length) {
            const dates = graphData.map(o => o.group).reverse();
            const activeClients = graphData.map(o => o.activeClients || 0).reverse();
            const newMembers = graphData.map(o => o.newMember || 0).reverse();
            const mcbus = graphData.map(o => o.mcbu || 0).reverse();
            const mcbuWithdrawals = graphData.map(o => o.clientMcbuWithdrawals || 0).reverse();
            const loanCollections = graphData.map(o => ((o.loanCollectionDaily || 0) + (o.loanCollectionWeekly || 0))).reverse();
            const loanReleases = graphData.map(o => o.totalLoanRelease || 0).reverse();
            const mispayments = graphData.map(o => o.mispaymentPerson || 0).reverse();
            const pastDues = graphData.map(o => o.pastDuePerson || 0).reverse();

            // Create trend-aware datasets with dynamic colors
            const createTrendDataset = (data, baseColor, label) => {
                const colors = data.map((value, index) => {
                    if (index === 0) return baseColor;
                    const prev = data[index - 1];
                    if (value > prev) return '#10B981'; // green
                    if (value < prev) return '#EF4444'; // red
                    return '#6B7280'; // gray for no change
                });

                return {
                    label,
                    data,
                    borderColor: baseColor,
                    backgroundColor: colors.map(color => color + '20'), // 20% opacity
                    pointBackgroundColor: colors,
                    pointBorderColor: colors,
                    tension: 0.1
                };
            };

            setMisPastDueData({
                labels: dates,
                datasets: [
                    createTrendDataset(mispayments, 'rgb(53, 162, 235)', 'MIS Payment'),
                    createTrendDataset(pastDues, 'rgb(255, 99, 132)', 'Past Due')
                ]
            });

            setLoanCollectionData({
                labels: dates,
                datasets: [
                    createTrendDataset(loanCollections, 'rgb(75, 192, 192)', 'Collections'),
                    createTrendDataset(loanReleases, 'rgb(255, 99, 132)', 'Releases')
                ]
            });

            setPersonData({
                labels: dates,
                datasets: [
                    createTrendDataset(activeClients, 'rgb(53, 162, 235)', 'Active Clients'),
                    createTrendDataset(newMembers, 'rgb(75, 192, 192)', 'New Members')
                ]
            });

            setMcbuData({
                labels: dates,
                datasets: [
                    createTrendDataset(mcbus, 'rgb(75, 192, 192)', 'Collections'),
                    createTrendDataset(mcbuWithdrawals, 'rgb(255, 99, 132)', 'Withdrawals')
                ]
            });
        }
    }, [graphData]);

    useEffect(() => {
        const dates = generateDates();
        
        // MCBU Data
        setMcbuData({
            labels: dates,
            datasets: [
                {
                    label: 'Collections',
                    data: generateRandomData(50000, 150000, 12),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                },
                {
                    label: 'Withdrawals',
                    data: generateRandomData(30000, 100000, 12),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }
            ]
        });

        setPersonData({
            labels: dates,
            datasets: [
                {
                    label: 'Active Clients',
                    data: generateRandomData(1000, 2000, 12),
                    borderColor: 'rgb(53, 162, 235)',
                    tension: 0.1
                },
                {
                    label: 'New Members',
                    data: generateRandomData(50, 200, 12),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }
            ]
        });

        setLoanCollectionData({
            labels: dates,
            datasets: [
                {
                    label: 'Collections',
                    data: generateRandomData(200000, 500000, 12),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                },
                {
                    label: 'Releases',
                    data: generateRandomData(150000, 450000, 12),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }
            ]
        });

        setMisPastDueData({
            labels: dates,
            datasets: [
                {
                    label: 'MIS Payment',
                    data: generateRandomData(5000, 15000, 12),
                    borderColor: 'rgb(53, 162, 235)',
                    tension: 0.1
                },
                {
                    label: 'Past Due',
                    data: generateRandomData(2000, 8000, 12),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }
            ]
        });
    }, []);

    const [chartOptions, setChartOptions] = useState({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
            },
            title: {
                display: true,
                text: 'Chart Title',
                font: {
                    size: 16,
                    weight: 'bold'
                },
                padding: {
                    top: 10,
                    bottom: 30
                }
            },
            tooltip: {
                callbacks: {
                    title: function(context) {
                        return `${context[0].raw.x} - ${context[0].raw.category}`;
                    },
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        if (context.parsed.y !== null) {
                            label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(context.parsed.y);
                        }
                        return label;
                    }
                }
            },
            datalabels: {
                display: false
            }
        },
        scales: {
            x: {
                grid: {
                    display: false
                },
                ticks: {
                    font: {
                        size: 12
                    }
                }
            },
            y: {
                grid: {
                    color: 'rgba(0, 0, 0, 0.1)',
                },
                ticks: {
                    font: {
                        size: 12
                    },
                    callback: function(value) {
                        return value.toLocaleString();
                    }
                },
                beginAtZero: true
            }
        },
    });

    const mcbuOptions = useMemo(() => ({
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'MCBU',
            },
        },
    }), [chartOptions]);

    const personOptions = useMemo(() => ({
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Person Performance',
            },
        },
    }), [chartOptions]);

    const loanCollectionOptions = useMemo(() => ({
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Loan Collection and Releases',
            },
        },
    }), [chartOptions]);

    const misPastDueOptions = useMemo(() => ({
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Mis Payment and Past Due',
            },
        },
    }), [chartOptions]);

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
            const graphUrl = getApiBaseUrl() + '/dashboard?' + queries + '&type=graph';
            
            setSummaryData({});
            setGraphData([]);
            const summaryPromise = fetchWrapper.get(summaryUrl)
                .then(resp => {
                    setSummaryData(resp.data?.[0] ?? {});
                }).catch(error => {
                    console.log(error)
                });

            fetchWrapper.get(graphUrl)
                .then(resp => {
                    console.log(resp.data);
                    setGraphData(resp.data);
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

    useEffect(() => {
        const currencyFormatter = (value) => 
            new Intl.NumberFormat('en-PH', { 
                style: 'currency', 
                currency: 'PHP',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(value);

        setChartOptions(prev => ({
            ...prev,
            plugins: {
                ...prev.plugins,
                tooltip: {
                    ...prev.plugins.tooltip,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += currencyFormatter(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                ...prev.scales,
                y: {
                    ...prev.scales.y,
                    ticks: {
                        callback: function(value) {
                            return currencyFormatter(value);
                        }
                    }
                }
            }
        }));
    }, []);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <div className="flex-grow p-4 flex flex-col overflow-x-auto">
                <div className="flex items-center justify-end pb-6 border-b min-w-[1200px]">
                    <div className="flex flex-col items-end">
                        <p className="text-sm font-semibold">Bank Balance: {formatNumber(bankBalance)}</p>
                    </div>
                </div>
                
                <div className="flex flex-col justify-between pb-2 border-b">
                    <div className={`${isMobile ? 'order-2' : 'order-1'} hidden lg:flex lg:justify-between lg:place-items-start`}>
                        <ClientSearchTool />
                    </div>
                    <div className="flex mb-2 mt-4 gap-2">
                        <select 
                            value={timeFilter} 
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        {
                            timeFilter === 'daily' ? <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} /> : null
                        }

                        {
                            timeFilter !== 'daily' ? <select 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {yearList.map((w, index) => (
                                <option key={index} value={w.value}>{w.label}</option>
                            ))}
                        </select> : null
                        }

                        {
                                timeFilter !== 'yearly' && timeFilter !== 'daily' ?
                                    <select 
                                    onChange={(e) => setSelectedFilter(timeFilterList[e.target.value])}
                                    className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                                >
                                    {timeFilterList.map((w, index) => (
                                        <option key={index} value={index}>{w.label}</option>
                                    ))}
                                </select> : null
                        }

                        {divisions.length > 2 ?  <select 
                            onChange={(e) => setDivisionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {divisions.map((division, index) => (
                                <option key={index} value={division._id}>{division.name}</option>
                            ))}
                        </select> : null}

                        {regions.length > 2 ? <select 
                            onChange={(e) => setRegionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {regions.map((region, index) => (
                                <option key={index} value={region._id}>{region.name}</option>
                            ))}
                        </select> : null}

                        {areas.length > 2 ? <select 
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {areas.map((area, index) => (
                                <option key={index} value={area._id}>{area.name}</option>
                            ))}
                        </select> : null}

                        {branchList.length > 2 ?  <select 
                            value={branchFilter} 
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {branches.map((branch, index) => (
                                <option key={index} value={branch._id}>{branch.code} {branch.name}</option>
                            ))}
                        </select> : null}

                        {loanOfficerFilter.length > 2 ? <select 
                            value={loanOfficerFilter} 
                            onChange={(e) => setLoanOfficerFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {loanOfficers.map((lo, index) => (
                                <option key={index} value={lo._id}>{lo.firstName} {lo.lastName}</option>
                            ))}
                        </select> :  null}
                    </div>
                </div>
            
                {loading ? <Spinner></Spinner> : ( 
                    <div className="flex flex-col gap-4 mt-4 min-w-[1400px]">
                        <div className="grid grid-cols-5 gap-4">
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

                        {/* Performance Section - Full width, 2 columns */}
                        <div className="w-full mt-8 border-t pt-8">
                            <h2 className="text-lg font-semibold mb-4">Performance</h2>
                            <div className="grid grid-cols-2 gap-8">
                                {/* Left Column */}
                                <div className="space-y-8">
                                    {/* MCBU Chart */}
                                    <div className="bg-white p-6 rounded-lg shadow">
                                        <div className="h-[400px]">
                                            <Line data={mcbuData} options={mcbuOptions} />
                                        </div>
                                    </div>
                                    {/* Person Chart */}
                                    <div className="bg-white p-6 rounded-lg shadow">
                                        <div className="h-[400px]">
                                            <Line data={personData} options={personOptions} />
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-8">
                                    {/* Loan Collection Chart */}
                                    <div className="bg-white p-6 rounded-lg shadow">
                                        <div className="h-[400px]">
                                            <Line data={loanCollectionData} options={loanCollectionOptions} />
                                        </div>
                                    </div>
                                    {/* MIS Past Due Chart */}
                                    <div className="bg-white p-6 rounded-lg shadow">
                                        <div className="h-[400px]">
                                            <Line data={misPastDueData} options={misPastDueOptions} />
                                        </div>
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