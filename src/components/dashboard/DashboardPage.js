import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { 
  UserPlusIcon, 
  WalletIcon, 
  BanknotesIcon, 
  ScaleIcon, 
  ExclamationCircleIcon, 
  XCircleIcon, 
  UserMinusIcon, 
  ShareIcon, 
  LockClosedIcon, 
  TruckIcon, 
  ExclamationTriangleIcon, 
  HeartIcon, 
  XMarkIcon, 
  CurrencyDollarIcon,
  QuestionMarkCircleIcon,
  MinusCircleIcon,
  ArrowsRightLeftIcon,
  ArrowPathRoundedSquareIcon,
  UserGroupIcon,
  ClockIcon,
  PencilSquareIcon
} from '@heroicons/react/24/outline';
import ClientSearchTool from './ClientSearchTool';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import Avatar from '@/lib/avatar';
import { useRouter } from 'node_modules/next/router';
import { getApiBaseUrl } from '@/lib/constants';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useMemo } from 'react';

ChartJS.register(...registerables, ChartDataLabels);

const DashboardPage = () => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branch = useSelector(state => state.branch.data);
    const [timeFilter, setTimeFilter] = useState('all');
    const [branchFilter, setBranchFilter] = useState('all');
    const [areaFilter, setAreaFilter] = useState('all');
    const [regionFilter, setRegionFilter] = useState('all');
    const [divisionFilter, setDivisionFilter] = useState('all');
    const [loanOfficerFilter, setLoanOfficerFilter] = useState('all');
    const [summaryData, setSummaryData] = useState({});

    const [mcbuData, setMcbuData] = useState({ labels: [], datasets: [] });
    const [personData, setPersonData] = useState({ labels: [], datasets: [] });
    const [loanCollectionData, setLoanCollectionData] = useState({ labels: [], datasets: [] });
    const [misPastDueData, setMisPastDueData] = useState({ labels: [], datasets: [] });

    const [branchList, setBranches] = useState([]);
    const [regionList, setRegions] = useState([]);
    const [areaList, setAreas] = useState([]);
    const [divisions, setDivisions] = useState([]);
    const [loanOfficerList, setLoanOfficers] = useState([]);

    const regions = useMemo(() => regionList.filter(r => divisionFilter === 'all' || r._id === 'all' || r.divisionId === divisionFilter), [regionList, divisionFilter]);
    const areas = useMemo(() => areaList.filter(a => regionFilter === 'all' || a._id === 'all' || a.regionId === regionFilter ), [regionFilter, areaList]);
    const branches = useMemo(() => branchList.filter(b => areaFilter === 'all' || b._id === 'all' || b.areaId === areaFilter ), [areaFilter, branchList]);
    const loanOfficers = useMemo(() =>loanOfficerList.filter(l => branchFilter === 'all' || l._id === 'all' || l.designatedBranchId === branchFilter), [branchFilter, loanOfficerList]);

    const [coh, setCoh] = useState(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(Math.floor(Math.random() * 1000000)));
    const [bankBalance, setBankBalance] = useState(new Intl.NumberFormat('en-US', { style: 'currency', currency: 'PHP' }).format(Math.floor(Math.random() * 1000000)));

    useEffect(() => {
        fetchSummaries();
    }, [divisionFilter, regionFilter, areaFilter, branchFilter, loanOfficerFilter]);

    /*
    const summaryData = {
        activeClients: 51019,
        mcbu: 16378730,
        totalLoanRelease: 373893600,
        activeBorrowers: 50886,
        totalLoanBalance: 200264700,
        pastDuePerson: 1500,
        pastDueAmount: 5000000,
        pdActiveLoan: 2000,
        pdLoanBalance: 7000000,
        pdNetRisk: 3000000,
        excusedPerson: 500,
        excusedActiveLoan: 700,
        excusedLoanBalance: 2000000,
        excusedNetRiskBalance: 1000000,
        runawayClients: 50,
        missingClients: 30,
        dummyAccounts: 10,
        loanShare: 0.75,
        imprisonment: 5,
        movingExcuses: 100,
        delinquent: 200,
        hospitalization: 20,
        death: 5,
        bankruptcy: 2,
        totalRelease: 1000000,
        amount: 500000,
        newMember: 100,
        transferClients: 50,
        renewals: 200,
        offset: 75,
        fullPaymentPerson: 150,
        fullPaymentAmount: 300000,
        pastDueCollection: 50000,
        pending: 25
    };
    */

    const loLabels = ['LO1', 'LO2', 'LO3', 'LO4', 'LO5', 'LO6', 'LO7', 'LO8', 'LO9', 'LO10'];

    const generateRandomData = (categories) => {
        return loLabels.map(lo => ({
            lo: lo,
            data: categories.map(category => ({
                category: category,
                current: Math.floor(Math.random() * 10000),
                previous: Math.floor(Math.random() * 10000)
            }))
        }));
    };

    const generateDatasets = (categories) => {
        const data = generateRandomData(categories);
        return [
            {
                label: 'Current',
                data: data.map(item => ({
                    x: item.lo,
                    y: item.data[0].current,
                    category: item.data[0].category
                })),
                borderColor: 'rgb(53, 162, 235)',
                backgroundColor: 'rgba(53, 162, 235, 0.5)',
            },
            {
                label: 'Previous',
                data: data.map(item => ({
                    x: item.lo,
                    y: item.data[0].previous,
                    category: item.data[0].category
                })),
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
            }
        ];
    };

    const mcbuCategories = ['Active Clients', 'MCBU', 'MCBU Withdrawals', 'MCBU Return'];
    const personCategories = ['Prospect Clients', 'New Member', 'Releases', 'Offset', 'Pending', 'Excuses'];
    const loanCollectionCategories = ['Active Borrowers', 'Releases', 'Actual Collection', 'Full Payments'];
    const misPastDueCategories = ['Person', 'Active Loan', 'Loan Balance', 'Net Risk', 'Past Due Person', 'Past Due Amount'];

    const generateRandomMcbuData = () => {
        setMcbuData({
            labels: loLabels,
            datasets: generateDatasets(mcbuCategories)
        });
    };

    const generateRandomPersonData = () => {
        setPersonData({
            labels: loLabels,
            datasets: generateDatasets(personCategories)
        });
    };

    const generateRandomLoanCollectionData = () => {
        setLoanCollectionData({
            labels: loLabels,
            datasets: generateDatasets(loanCollectionCategories)
        });
    };

    const generateRandomMisPastDueData = () => {
        setMisPastDueData({
            labels: loLabels,
            datasets: generateDatasets(misPastDueCategories)
        });
    };

    const chartOptions = {
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
    };

    const mcbuOptions = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'MCBU',
            },
        },
    };

    const personOptions = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Person Performance',
            },
        },
    };

    const loanCollectionOptions = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Loan Collection and Releases',
            },
        },
    };

    const misPastDueOptions = {
        ...chartOptions,
        plugins: {
            ...chartOptions.plugins,
            title: {
                ...chartOptions.plugins.title,
                text: 'Mis Payment and Past Due',
            },
        },
    };

    const formatNumber = (num) => {
        if (num === undefined || num === null) {
            return 'N/A';
        }
        if (typeof num === 'number') {
            return num.toLocaleString('en-US');
        }
        return num; // If it's already a string, return as is
    };

    // const branches = ['All Branches', 'Branch A', 'Branch B', 'Branch C']; // Add your actual branch list here

    const fetchSummaries = () => {
        const queries = [
            { value: divisionFilter, field: 'divisionId'},
            { value: regionFilter, field: 'regionId' }, 
            { value: areaFilter, field: 'areaId' }, 
            { value: branchFilter, field: 'branchId' }, 
            { value: loanOfficerFilter, field: 'loId' }].filter(a => a.value !== 'all' && !!a.value)
                            .map(a => `${a.field}=${a.value}`).join('&');
        const apiUrl = getApiBaseUrl() + '/dashboard?' + queries;
        
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setSummaryData(resp.data);
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchBranches = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/branches';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setBranches([ { _id: 'all', name: '-', code: '' }, ... resp.data]);
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchRegions = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/regions';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setRegions([ { _id: 'all', name: '-' }, ... resp.data]);
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchAreas = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/areas';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setAreas([ { _id: 'all', name: '-' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchDivisions = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/divisions';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setDivisions([ { _id: 'all', name: '-' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    const fetchLoanOfficers = () => {
        const apiUrl = getApiBaseUrl() + '/dashboard/loan-officers';
        fetchWrapper.get(apiUrl)
            .then(resp => {
                setLoanOfficers([ { _id: 'all', firstName: '-', lastName: '' }, ... resp.data])
            }).catch(error => {
                console.log(error)
            });
    };

    useEffect(() => {
        fetchBranches();
        fetchRegions();
        fetchAreas();
        fetchDivisions();
        fetchLoanOfficers();
        fetchSummaries();

        /*
        generateRandomMcbuData();
        generateRandomPersonData();
        generateRandomLoanCollectionData();
        generateRandomMisPastDueData();
        */
    }, []);

    const CardItem = ({ title, value, Icon }) => {
        const IconComponent = Icon || QuestionMarkCircleIcon;
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
            <div className="flex-grow p-4 flex flex-col">
            <div className="flex items-center justify-between pb-6 border-b">
                    <div className='flex flex-col'>
                        <div className="flex items-center">
                            <div className='group relative'>
                                <span className="hidden group-hover:block absolute right-2 pt-1 cursor-pointer" onClick={() => router.push(`/settings/users/${currentUser._id}`)}>
                                    <PencilSquareIcon className="w-4 h-4" />
                                </span>
                                <Avatar name={currentUser.firstName + " " + currentUser.lastName} src={currentUser.profile ? currentUser.profile : ""} className={`${currentUser.profile ? '' : 'p-6'} `} />
                            </div>
                            <h1 className="text-2xl font-semibold whitespace-nowrap">
                                Welcome, {`${currentUser.firstName} ${currentUser.lastName}`}!
                            </h1>
                        </div>
                        {/* { (currentUser?.role?.rep > 2 && branch) && (
                            <h1 className="text-lg font-semibold whitespace-nowrap">
                                Branch: {`${branch?.code} - ${branch?.name}`}
                            </h1>
                        ) } */}
                    </div>
                    <div className="flex flex-col items-end">
                        <p className="text-sm font-semibold">Cash On Hand: {formatNumber(coh)}</p>
                        <p className="text-sm font-semibold">Bank Balance: {formatNumber(bankBalance)}</p>
                    </div>
                </div>
                <div className="flex items-center justify-between pb-2 border-b">
                    {/* 
                    <div className="w-10">
                        <ClientSearchTool />
                    </div>
                    */}
                    <div className="flex mb-2 mt-4 gap-2">
                        <select 
                            value={timeFilter} 
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            <option value="overall">Overall</option>
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                            <option value="quarterly">Quarterly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        <select 
                            onChange={(e) => setDivisionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {divisions.map((division, index) => (
                                <option key={index} value={division._id}>{division.name}</option>
                            ))}
                        </select>
                        <select 
                            onChange={(e) => setRegionFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {regions.map((region, index) => (
                                <option key={index} value={region._id}>{region.name}</option>
                            ))}
                        </select>
                        <select 
                            onChange={(e) => setAreaFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {areas.map((area, index) => (
                                <option key={index} value={area._id}>{area.name}</option>
                            ))}
                        </select>
                        <select 
                            value={branchFilter} 
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {branches.map((branch, index) => (
                                <option key={index} value={branch._id}>{branch.code} {branch.name}</option>
                            ))}
                        </select>
                        <select 
                            value={loanOfficerFilter} 
                            onChange={(e) => setLoanOfficerFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {loanOfficers.map((lo, index) => (
                                <option key={index} value={lo._id}>{lo.firstName} {lo.lastName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-grow grid grid-cols-6 gap-4 mt-4">
                    {/* Summary Column */}
                    <div className="col-span-1 flex flex-col">
                        <h2 className="text-lg font-semibold mb-2">Summary</h2>
                        <div className="space-y-2">
                            <CardItem title="Active Clients" value={summaryData.activeClients} Icon={UserPlusIcon} />
                            <CardItem title="MCBU" value={summaryData.mcbu} Icon={WalletIcon} />
                            <CardItem title="Total Loan Release" value={summaryData.totalLoanRelease} Icon={BanknotesIcon} />
                            <CardItem title="Active Borrowers" value={summaryData.activeBorrowers} Icon={ScaleIcon} />
                            <CardItem title="Total Loan Balance" value={summaryData.totalLoanBalance} Icon={CurrencyDollarIcon} />
                            <CardItem title="Past Due Person" value={summaryData.pastDuePerson} Icon={ExclamationCircleIcon} />
                            <CardItem title="Past Due Amount" value={summaryData.pastDueAmount} Icon={ExclamationCircleIcon} />
                            <CardItem title="PD Active Loan" value={summaryData.pdActiveLoan} Icon={ExclamationCircleIcon} />
                            <CardItem title="PD Loan Balance" value={summaryData.pdLoanBalance} Icon={ExclamationCircleIcon} />
                            <CardItem title="PD Net Risk" value={summaryData.pdNetRisk} Icon={ExclamationCircleIcon} />
                            <CardItem title="Excused Person" value={summaryData.excusedPerson} Icon={XCircleIcon} />
                            <CardItem title="Excused Active Loan" value={summaryData.excusedActiveLoan} Icon={XCircleIcon} />
                            <CardItem title="Excused Loan Balance" value={summaryData.excusedLoanBalance} Icon={XCircleIcon} />
                            <CardItem title="Excused Net Risk Balance" value={summaryData.excusedNetRiskBalance} Icon={XCircleIcon} />
                            <CardItem title="Runaway Clients" value={summaryData.runawayClients} Icon={UserMinusIcon} />
                            <CardItem title="Missing Clients" value={summaryData.missingClients} Icon={UserMinusIcon} />
                            <CardItem title="Dummy Accounts" value={summaryData.dummyAccounts} Icon={UserMinusIcon} />
                            <CardItem title="Loan Share" value={summaryData.loanShare} Icon={ShareIcon} />
                            <CardItem title="Imprisonment" value={summaryData.imprisonment} Icon={LockClosedIcon} />
                            <CardItem title="Moving Excuses" value={summaryData.movingExcuses} Icon={TruckIcon} />
                            <CardItem title="Delinquent" value={summaryData.delinquent} Icon={ExclamationTriangleIcon} />
                            <CardItem title="Hospitalization" value={summaryData.hospitalization} Icon={HeartIcon} />
                            <CardItem title="Death" value={summaryData.death} Icon={XMarkIcon} />
                            <CardItem title="Bankruptcy" value={summaryData.bankruptcy} Icon={CurrencyDollarIcon} />
                        </div>
                    </div>

                    {/* Daily Progress Column */}
                    <div className="col-span-1 flex flex-col">
                        <h2 className="text-lg font-semibold mb-2">Daily Progress</h2>
                        <div className="space-y-2">
                            <CardItem title="Total Release" value={summaryData.totalRelease} Icon={BanknotesIcon} />
                            <CardItem title="Amount" value={summaryData.amount} Icon={CurrencyDollarIcon} />
                            <CardItem title="New Member" value={summaryData.newMember} Icon={UserPlusIcon} />
                            <CardItem title="Transfer Clients" value={summaryData.transferClients} Icon={ArrowsRightLeftIcon} />
                            <CardItem title="Renewals" value={summaryData.renewals} Icon={ArrowPathRoundedSquareIcon} />
                            <CardItem title="Offset" value={summaryData.offset} Icon={MinusCircleIcon} />
                            <CardItem title="Full Payment Person" value={summaryData.fullPaymentPerson} Icon={UserGroupIcon} />
                            <CardItem title="Full Payment Amount" value={summaryData.fullPaymentAmount} Icon={CurrencyDollarIcon} />
                            <div className="h-12"></div> {/* This creates the 3/4 height gap */}
                            <CardItem title="Past Due Collection" value={summaryData.pastDueCollection} Icon={ExclamationCircleIcon} />
                            <CardItem title="Pending" value={summaryData.pending} Icon={ClockIcon} />
                        </div>
                    </div>

                    <div className="col-span-4 flex flex-col">
                        <h2 className="text-lg font-semibold mb-2">Performance</h2>
                        <div className="bg-white p-4 rounded-lg shadow mb-4 w-full">
                            <div className="h-[400px]">
                                <Line data={mcbuData} options={mcbuOptions} />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow mb-4 w-full">
                            <div className="h-[400px]">
                                <Line data={personData} options={personOptions} />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow mb-4 w-full">
                            <div className="h-[400px]">
                                <Line data={loanCollectionData} options={loanCollectionOptions} />
                            </div>
                        </div>
                        <div className="bg-white p-4 rounded-lg shadow w-full">
                            <div className="h-[400px]">
                                <Line data={misPastDueData} options={misPastDueOptions} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage;