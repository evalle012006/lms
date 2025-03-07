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
    PencilLine
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
import { getMonths, getQuarters, getWeeks, getYears } from '@/lib/utils';

ChartJS.register(...registerables, ChartDataLabels);

const DashboardPage = () => {
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
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

    useEffect(() => {
        if(graphData.length) {

            const dates = graphData.map(o => o.group).reverse()
            const activeClients = graphData.map(o => o.activeClients).reverse()
            const newMembers = graphData.map(o => o.newMember).reverse();

            const mcbus = graphData.map(o => o.mcbu).reverse();
            const mcbuWithdrawals = graphData.map(o => o.clientMcbuWithdrawals).reverse();

            const loanCollections = graphData.map(o => o.loanCollection ?? 0).reverse();
            const loanReleases = graphData.map(o => o.loanRelease ?? 0).reverse();

            const mispayments = graphData.map(o => o.mispaymentPerson ?? 0).reverse();
            const pastDues = graphData.map(o => o.pastDuePerson ?? 0).reverse();

            setMisPastDueData({
                labels: dates,
                datasets: [
                    {
                        label: 'MIS Payment',
                        data: mispayments,
                        borderColor: 'rgb(53, 162, 235)',
                        tension: 0.1
                    },
                    {
                        label: 'Past Due',
                        data: pastDues,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }
                ]
            });

            setLoanCollectionData({
                labels: dates,
                datasets: [
                    {
                        label: 'Collections',
                        data: loanCollections,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    },
                    {
                        label: 'Releases',
                        data: loanReleases,
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
                        data: activeClients,
                        borderColor: 'rgb(53, 162, 235)',
                        tension: 0.1
                    },
                    {
                        label: 'New Members',
                        data: newMembers,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    }
                ]
            });

            setMcbuData({
                labels: dates,
                datasets: [
                    {
                        label: 'Collections',
                        data: mcbus,
                        borderColor: 'rgb(75, 192, 192)',
                        tension: 0.1
                    },
                    {
                        label: 'Withdrawals',
                        data: mcbuWithdrawals,
                        borderColor: 'rgb(255, 99, 132)',
                        tension: 0.1
                    }
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

        // Person Performance Data
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

        // Loan Collection Data
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

        // MIS Past Due Data
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

    // Create specific chart options using the state
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
        return num; // If it's already a string, return as is
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
            
            const summaryPromise = fetchWrapper.get(summaryUrl)
                .then(resp => {
                    setSummaryData(resp.data?.[0] ?? {});
                }).catch(error => {
                    console.log(error)
                });

            const graphPromise = fetchWrapper.get(graphUrl)
                .then(resp => {
                    setGraphData(resp.data);
                }).catch(error => {
                    console.log(error)
                });
            
            Promise.all([summaryPromise, graphPromise]).finally(() => {
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

    // Update chart options to show currency format for MCBU and Loan Collection
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

    const CardItem = ({ title, value, Icon }) => {
        const IconComponent = Icon || HelpCircle;
        return (
            <div className="bg-white p-3 rounded-lg shadow relative overflow-hidden mb-2">
                <IconComponent className="absolute right-2 bottom-2 h-12 w-12 text-gray-200 transform translate-x-2 translate-y-2" />
                <h3 className="text-xs font-semibold text-gray-700 truncate">{title}</h3>
                <p className="text-sm font-bold text-blue-600 truncate">{formatNumber(value)}</p>
            </div>
        );
    };

    return (
       
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <div className="flex-grow p-4 flex flex-col overflow-x-auto">
                <div className="flex items-center justify-between pb-6 border-b min-w-[1400px]">
                    <div className='flex flex-col'>
                        <div className="flex items-center">
                            <div className='group relative'>
                                <span className="hidden group-hover:block absolute right-2 pt-1 cursor-pointer" onClick={() => router.push(`/settings/users/${currentUser._id}`)}>
                                    <PencilLine className="w-4 h-4" />
                                </span>
                                <Avatar name={currentUser.firstName + " " + currentUser.lastName} src={currentUser.profile ? currentUser.profile : ""} className={`${currentUser.profile ? '' : 'p-6'} `} />
                            </div>
                            <h1 className="text-2xl font-semibold whitespace-nowrap">
                                Welcome, {`${currentUser.firstName} ${currentUser.lastName}`}!
                            </h1>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        {/* <p className="text-sm font-semibold">Cash On Hand: {formatNumber(coh)}</p> */}
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

                        
                        {
                            divisions.length > 2 ?  <select 
                            onChange={(e) => setDivisionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {divisions.map((division, index) => (
                                <option key={index} value={division._id}>{division.name}</option>
                            ))}
                        </select> : null
                        }
                        {
                            regions.length > 2 ? <select 
                            onChange={(e) => setRegionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {regions.map((region, index) => (
                                <option key={index} value={region._id}>{region.name}</option>
                            ))}
                        </select> : null
                        }
                        {
                            areas.length > 2 ? <select 
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {areas.map((area, index) => (
                                <option key={index} value={area._id}>{area.name}</option>
                            ))}
                        </select> : null
                        }
                        {
                            branchList.length > 2 ?  <select 
                            value={branchFilter} 
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {branches.map((branch, index) => (
                                <option key={index} value={branch._id}>{branch.code} {branch.name}</option>
                            ))}
                        </select> : null
                        }
                       

                        {
                            loanOfficerFilter.length > 2 ? <select 
                            value={loanOfficerFilter} 
                            onChange={(e) => setLoanOfficerFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {loanOfficers.map((lo, index) => (
                                <option key={index} value={lo._id}>{lo.firstName} {lo.lastName}</option>
                            ))}
                        </select> :  null
                        }

                        
                    </div>
                </div>
            

                 { loading ? <Spinner></Spinner> : ( 
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
                                        <CardItem title="Active Clients" value={summaryData.activeClients} Icon={UserPlus} />
                                        <CardItem title="MCBU" value={summaryData.mcbu} Icon={Wallet} />
                                        <CardItem title="Total Loan Release" value={summaryData.totalLoanRelease} Icon={Banknote} />
                                        <CardItem title="Active Borrowers" value={summaryData.activeBorrowers} Icon={Scale} />
                                        <CardItem title="Total Loan Balance" value={summaryData.totalLoanBalance} Icon={DollarSign} />
                                        <CardItem title="Past Due Person" value={summaryData.pastDuePerson} Icon={AlertCircle} />
                                        <CardItem title="Past Due Amount" value={summaryData.pastDueAmount} Icon={AlertCircle} />
                                        <CardItem title="PD Active Loan" value={summaryData.pdActiveLoan} Icon={AlertCircle} />
                                        <CardItem title="PD Loan Balance" value={summaryData.pdLoanBalance} Icon={AlertCircle} />
                                        <CardItem title="PD Net Risk" value={summaryData.pdNetRisk} Icon={AlertCircle} />
                                        <CardItem title="Excused Person" value={summaryData.excusedPerson} Icon={XCircle} />
                                        <CardItem title="Excused Active Loan" value={summaryData.excusedActiveLoan} Icon={XCircle} />
                                        <CardItem title="Excused Loan Balance" value={summaryData.excusedLoanBalance} Icon={XCircle} />
                                        <CardItem title="Excused Net Risk Balance" value={summaryData.excusedNetRiskBalance} Icon={XCircle} />
                                        <CardItem title="Runaway Clients" value={summaryData.runawayClients} Icon={UserMinus} />
                                        <CardItem title="Missing Clients" value={summaryData.missingClients} Icon={UserMinus} />
                                        <CardItem title="Dummy Accounts" value={summaryData.dummyAccounts} Icon={UserMinus} />
                                        <CardItem title="Loan Share" value={summaryData.loanShare} Icon={Share2} />
                                        <CardItem title="Imprisonment" value={summaryData.imprisonment} Icon={Lock} />
                                        <CardItem title="Moving Excuses" value={summaryData.movingExcuses} Icon={Truck} />
                                        <CardItem title="Delinquent" value={summaryData.delinquent} Icon={AlertTriangle} />
                                        <CardItem title="Hospitalization" value={summaryData.hospitalization} Icon={Heart} />
                                        <CardItem title="Death" value={summaryData.death} Icon={X} />
                                        <CardItem title="Bankruptcy" value={summaryData.bankruptcy} Icon={DollarSign} />
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
                                        <CardItem title="Total Release:" value={summaryData.totalRelease || '0.00'} Icon={Banknote} />
                                        <CardItem title="Amount:" value={summaryData.amount || '0.00'} Icon={DollarSign} />
                                        <CardItem title="New Member:" value={summaryData.newMember || '0.00'} Icon={UserPlus} />
                                        <CardItem title="Transfer Clients:" value={summaryData.transferClients || '0.00'} Icon={ArrowLeftRight} />
                                        <CardItem title="Renewals:" value={summaryData.renewals || '0.00'} Icon={RotateCcw} />
                                        <CardItem title="Offset:" value={summaryData.offset || '0.00'} Icon={MinusCircle} />
                                        <CardItem title="Full Payment" value={summaryData.fullPayment || '0.00'} Icon={Users} />
                                        <CardItem title="Full Payment Amount:" value={summaryData.fullPaymentAmount || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Past Due Collection:" value={summaryData.pastDueCollection || '0.00'} Icon={AlertCircle} />
                                        <CardItem title="Pending:" value={summaryData.pending || '0.00'} Icon={Clock} />
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
                                        <CardItem title="Beginning Balance:" value={summaryData.beginningBalance || '0.00'} Icon={DollarSign} />
                                        <CardItem title="MCBU Collection:" value={summaryData.mcbuCollection || '0.00'} Icon={Wallet} />
                                        <CardItem title="Loan Collection Daily:" value={summaryData.loanCollectionDaily || '0.00'} Icon={Banknote} />
                                        <CardItem title="Loan Collection Weekly:" value={summaryData.loanCollectionWeekly || '0.00'} Icon={Banknote} />
                                        <CardItem title="Staff CBU Collection:" value={summaryData.staffCbuCollection || '0.00'} Icon={Users} />
                                        <CardItem title="Staff Loan Collection:" value={summaryData.staffLoanCollection || '0.00'} Icon={Banknote} />
                                        <CardItem title="Admin Fees:" value={summaryData.adminFees || '0.00'} Icon={DollarSign} />
                                        <CardItem title="L R F Collection:" value={summaryData.lrfCollection || '0.00'} Icon={Banknote} />
                                        <CardItem title="C H B Collection:" value={summaryData.chbCollection || '0.00'} Icon={Banknote} />
                                        <CardItem title="Add. Hospitalization:" value={summaryData.addHospitalization || '0.00'} Icon={Heart} />
                                        <CardItem title="W/Tax, EE&ER:" value={summaryData.wtaxEeEr || '0.00'} Icon={DollarSign} />
                                        <CardItem title="MCBU Unclaimed (N):" value={summaryData.mcbuUnclaimedN || '0.00'} Icon={AlertCircle} />
                                        <CardItem title="Other Income (Passbook):" value={summaryData.otherIncomePassbook || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Other Income:" value={summaryData.otherIncome || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Other Receipts (Picture):" value={summaryData.otherReceiptsPicture || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Other Receipts:" value={summaryData.otherReceipts || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Fund Transfer:" value={summaryData.fundTransferReceipts || '0.00'} Icon={ArrowLeftRight} />
                                        <CardItem title="Bank Withdrawal:" value={summaryData.bankWithdrawal || '0.00'} Icon={Banknote} />
                                        <CardItem title="Total Receipts:" value={summaryData.totalReceipts || '0.00'} Icon={DollarSign} />
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
                                        <CardItem title="Client Loan Release:" value={summaryData.clientLoanRelease || '0.00'} Icon={Banknote} />
                                        <CardItem title="Client MCBU Withdrawals:" value={summaryData.clientMcbuWithdrawals || '0.00'} Icon={Wallet} />
                                        <CardItem title="Client MCBU Return:" value={summaryData.clientMcbuReturn || '0.00'} Icon={RotateCcw} />
                                        <CardItem title="Staff Loan Release:" value={summaryData.staffLoanRelease || '0.00'} Icon={Users} />
                                        <CardItem title="Staff CBU Withdrawals:" value={summaryData.staffCbuWithdrawals || '0.00'} Icon={Wallet} />
                                        <CardItem title="Management Expenses:" value={summaryData.managementExpenses || '0.00'} Icon={DollarSign} />
                                        <CardItem title="CBHB Disbursed:" value={summaryData.cbhbDisbursed || '0.00'} Icon={Banknote} />
                                        <CardItem title="MCBU Unclaimed (Out):" value={summaryData.mcbuUnclaimedOut || '0.00'} Icon={AlertCircle} />
                                        <CardItem title="Rebates:" value={summaryData.rebates || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Other Payment:" value={summaryData.otherPayment || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Fund Transfer:" value={summaryData.fundTransferPayments || '0.00'} Icon={ArrowLeftRight} />
                                        <CardItem title="Bank Deposit:" value={summaryData.bankDeposit || '0.00'} Icon={Banknote} />
                                        <CardItem title="Total Payment:" value={summaryData.totalPayment || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Closing Balance:" value={summaryData.closingBalance || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Cash On Hand:" value={summaryData.cashOnHand || '0.00'} Icon={DollarSign} />
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
                                        <CardItem title="Prospect:" value={summaryData.prospect || '0.00'} Icon={Users} />
                                        <CardItem title="Amount:" value={summaryData.prospectAmount || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Renewals:" value={summaryData.tomorrowRenewals || '0.00'} Icon={RotateCcw} />
                                        <CardItem title="Amount:" value={summaryData.renewalsAmount || '0.00'} Icon={DollarSign} />
                                        <CardItem title="Total Amount of Releases:" value={summaryData.totalAmountReleases || '0.00'} Icon={Banknote} />
                                        <CardItem title="Target Collection for Tomorrow:" value={summaryData.targetCollectionTomorrow || '0.00'} Icon={AlertCircle} />
                                        <CardItem title="Target Expenses for Tomorrow:" value={summaryData.targetExpensesTomorrow || '0.00'} Icon={DollarSign} />
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
                ) }
            </div>
        </div>
    )
}

export default DashboardPage;