import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { UserPlusIcon, WalletIcon, BanknotesIcon, ScaleIcon, ReceiptRefundIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import ClientSearchTool from './ClientSearchTool';
import BranchNotCloseTool from './BranchNotCloseReport';
import { Bar, Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import ChartDataLabels from 'chartjs-plugin-datalabels';

ChartJS.register(...registerables, ChartDataLabels);

const DashboardPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const [timeFilter, setTimeFilter] = useState('overall');
    const [branchFilter, setBranchFilter] = useState('all');

    const overallData = {
        activeClients: 51019,
        mcbu: 16378730,
        totalLoanRelease: 373893600,
        activeBorrowers: 50886,
        totalLoanBalance: 200264700,
        pastDueClients: {
        per: 13,
        mcbu: 3200,
        totalLoanRelease: 1232131,
        totalLoanBalance: 1232131,
        netBalance: 43234
        },
        totalCurrentRelease: {
        per: 5255,
        amount: 37948800,
        nm: 2531,
        transferClient: 0,
        offset: 1183,
        renewals: 2724,
        fullPaymentPerson: 3898,
        fullPaymentAmount: 29035200
        },
        mispayClients: {
        per: 12,
        mcbu: 3214213,
        totalRelease: 123213,
        totalLoanBalance: 123213,
        netBalance: 123213
        },
        pending: 1231,
        growth: {
        mcbu: 384180,
        recruitment: 1368,
        loanRelease: 8913600,
        portfolio: 6594170
        }
    };

    const dailyData = {
        activeClients: 2123,
        mcbu: 163730,
        totalLoanRelease: 893600,
        activeBorrowers: 5286,
        totalLoanBalance: 2004700,
        pastDueClients: {
        per: 1,
        mcbu: 300,
        totalLoanRelease: 12131,
        totalLoanBalance: 12131,
        netBalance: 43222
        },
        totalCurrentRelease: {
        per: 52,
        amount: 37800,
        nm: 251,
        transferClient: 12,
        offset: 11,
        renewals: 272,
        fullPaymentPerson: 38,
        fullPaymentAmount: 25200
        },
        mispayClients: {
        per: 11,
        mcbu: 3214,
        totalRelease: 1232,
        totalLoanBalance: 1232,
        netBalance: 1232
        },
        pending: 12,
        growth: {
        mcbu: 3841,
        recruitment: 136,
        loanRelease: 83600,
        portfolio: 64170
        }
    };

    // Simulated previous data (you should replace this with actual previous data)
    const previousData = {
        pastDueClients: {
            per: 10,
            mcbu: 2500,
            totalLoanRelease: 1000000,
            totalLoanBalance: 1000000,
            netBalance: 40000
        },
        totalCurrentRelease: {
            per: 5000,
            amount: 35000000,
            nm: 2400,
            transferClient: 0,
            offset: 1100,
            renewals: 2600,
            fullPaymentPerson: 3700,
            fullPaymentAmount: 27000000
        },
        mispayClients: {
            per: 10,
            mcbu: 3000000,
            totalRelease: 100000,
            totalLoanBalance: 100000,
            netBalance: 100000
        },
        growth: {
            mcbu: 350000,
            recruitment: 1300,
            loanRelease: 8000000,
            portfolio: 6000000
        }
    };

    const getFilteredData = () => {
        return timeFilter === 'daily' ? dailyData : overallData;
    };

    const filteredData = getFilteredData();

    const formatNumber = (num) => {
        return num.toLocaleString('en-US');
    };

    const formatCompactNumber = (number) => {
        const formatter = Intl.NumberFormat('en', { notation: 'compact' });
        return formatter.format(number);
    };

    const branches = ['All Branches', 'Branch A', 'Branch B', 'Branch C']; // Add your actual branch list here

    const CardItem = ({ title, value, Icon }) => (
        <div className="bg-white p-3 rounded-lg shadow relative overflow-hidden">
            <Icon className="absolute right-2 bottom-2 h-16 w-16 text-gray-200 transform translate-x-2 translate-y-2" />
            <h3 className="text-sm font-semibold text-gray-700 truncate">{title}</h3>
            <p className="text-lg font-bold text-blue-600 truncate">{formatNumber(value)}</p>
        </div>
    );

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return `${context.dataset.label}: ${formatNumber(context.raw)}`;
                    }
                }
            },
            datalabels: {
                display: true,
                color: (context) => {
                    const value = context.dataset.data[context.dataIndex];
                    const maxValue = Math.max(...context.dataset.data);
                    return value > maxValue * 0.75 ? '#000' : '#000';
                },
                font: {
                    weight: 'bold',
                    size: 10
                },
                formatter: (value) => formatCompactNumber(value),
                anchor: (context) => {
                    const value = context.dataset.data[context.dataIndex];
                    const maxValue = Math.max(...context.dataset.data);
                    return value > maxValue * 0.75 ? 'center' : 'end';
                },
                align: (context) => {
                    const value = context.dataset.data[context.dataIndex];
                    const maxValue = Math.max(...context.dataset.data);
                    return value > maxValue * 0.75 ? 'center' : 'top';
                },
                offset: (context) => {
                    const value = context.dataset.data[context.dataIndex];
                    const maxValue = Math.max(...context.dataset.data);
                    return value > maxValue * 0.75 ? 0 : 4;
                }
            }
        },
        scales: {
            x: {
                stacked: false,
            },
            y: {
                stacked: false,
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return formatCompactNumber(value);
                    }
                }
            }
        }
    };

    // Update chart data to include both current and previous data
    const pastDueChart = {
        labels: ['PD Per', 'MCBU', 'Total Loan Release', 'Total Loan Balance', 'Net Balance'],
        datasets: [
            {
                label: 'Current',
                data: [
                    filteredData.pastDueClients.per,
                    filteredData.pastDueClients.mcbu,
                    filteredData.pastDueClients.totalLoanRelease,
                    filteredData.pastDueClients.totalLoanBalance,
                    filteredData.pastDueClients.netBalance
                ],
                backgroundColor: '#36A2EB',
            },
            {
                label: 'Previous',
                data: [
                    previousData.pastDueClients.per,
                    previousData.pastDueClients.mcbu,
                    previousData.pastDueClients.totalLoanRelease,
                    previousData.pastDueClients.totalLoanBalance,
                    previousData.pastDueClients.netBalance
                ],
                backgroundColor: '#C1E1C1',
            }
        ],
    };

    const currentReleaseChart = {
        labels: ['Per', 'Amount', 'NM', 'Transfer Client', 'Offset', 'Renewals', 'Full Payment Person', 'Full Payment Amount'],
        datasets: [
            {
                label: 'Current',
                data: [
                    filteredData.totalCurrentRelease.per,
                    filteredData.totalCurrentRelease.amount,
                    filteredData.totalCurrentRelease.nm,
                    filteredData.totalCurrentRelease.transferClient,
                    filteredData.totalCurrentRelease.offset,
                    filteredData.totalCurrentRelease.renewals,
                    filteredData.totalCurrentRelease.fullPaymentPerson,
                    filteredData.totalCurrentRelease.fullPaymentAmount
                ],
                backgroundColor: '#36A2EB',
            },
            {
                label: 'Previous',
                data: [
                    previousData.totalCurrentRelease.per,
                    previousData.totalCurrentRelease.amount,
                    previousData.totalCurrentRelease.nm,
                    previousData.totalCurrentRelease.transferClient,
                    previousData.totalCurrentRelease.offset,
                    previousData.totalCurrentRelease.renewals,
                    previousData.totalCurrentRelease.fullPaymentPerson,
                    previousData.totalCurrentRelease.fullPaymentAmount
                ],
                backgroundColor: '#C1E1C1',
            }
        ],
    };

    const mispayChart = {
        labels: ['Per', 'MCBU', 'Total Release', 'Total Loan Balance', 'Net Balance'],
        datasets: [
            {
                label: 'Current',
                data: [
                    filteredData.mispayClients.per,
                    filteredData.mispayClients.mcbu,
                    filteredData.mispayClients.totalRelease,
                    filteredData.mispayClients.totalLoanBalance,
                    filteredData.mispayClients.netBalance
                ],
                backgroundColor: '#36A2EB',
            },
            {
                label: 'Previous',
                data: [
                    previousData.mispayClients.per,
                    previousData.mispayClients.mcbu,
                    previousData.mispayClients.totalRelease,
                    previousData.mispayClients.totalLoanBalance,
                    previousData.mispayClients.netBalance
                ],
                backgroundColor: '#C1E1C1',
            }
        ],
    };

    const growthChart = {
        labels: ['MCBU', 'Recruitment', 'Loan Release', 'Portfolio'],
        datasets: [
            {
                label: 'Current Growth',
                data: Object.values(filteredData.growth),
                backgroundColor: '#36A2EB',
            },
            {
                label: 'Previous Growth',
                data: Object.values(previousData.growth),
                backgroundColor: '#C1E1C1',
            }
        ],
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            <div className="flex-grow p-4 flex flex-col">
                <div className="flex items-center justify-between pb-6 border-b">
                    <h1 className="text-2xl font-semibold whitespace-nowrap">Welcome, {`${currentUser.firstName} ${currentUser.lastName}`}!</h1>
                </div>
                <div className="flex items-center justify-between pb-2 border-b">
                    <div className="w-64">
                        <ClientSearchTool />
                    </div>
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
                            value={branchFilter} 
                            onChange={(e) => setBranchFilter(e.target.value)}
                            className="block pl-3 pr-10 py-1 text-sm border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                        >
                            {branches.map((branch, index) => (
                                <option key={index} value={branch.toLowerCase().replace(' ', '-')}>{branch}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-none grid grid-cols-5 gap-2 mb-2">
                    <CardItem title="Active Clients" value={filteredData.activeClients} Icon={UserPlusIcon} />
                    <CardItem title="MCBU" value={filteredData.mcbu} Icon={WalletIcon} />
                    <CardItem title="Total Loan Release" value={filteredData.totalLoanRelease} Icon={BanknotesIcon} />
                    <CardItem title="Active Borrowers" value={filteredData.activeBorrowers} Icon={ScaleIcon} />
                    <CardItem title="Total Loan Balance" value={filteredData.totalLoanBalance} Icon={CurrencyDollarIcon} />
                </div>

                <div className="flex-grow grid grid-cols-2 grid-rows-2 gap-4">
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2">Past Due Clients</h2>
                        <div className="h-64">
                            <Bar data={pastDueChart} options={chartOptions} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2">Total Current Release</h2>
                        <div className="h-64">
                            <Bar data={currentReleaseChart} options={chartOptions} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2">Mispay Clients</h2>
                        <div className="h-64">
                            <Bar data={mispayChart} options={chartOptions} />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg shadow">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2">Pending</h2>
                        <div className="h-64">
                            <Doughnut 
                                data={{
                                    labels: ['Pending', 'Other'],
                                    datasets: [{
                                        data: [filteredData.pending, filteredData.activeClients - filteredData.pending],
                                        backgroundColor: ['#36A2EB', '#C1E1C1'], // Updated colors
                                    }],
                                }} 
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { display: true, position: 'bottom' },
                                        tooltip: {
                                            callbacks: {
                                                label: function(context) {
                                                    return `${context.label}: ${formatNumber(context.raw)}`;
                                                }
                                            }
                                        },
                                        datalabels: {
                                            color: '#000',
                                            font: { weight: 'bold' },
                                            formatter: (value, ctx) => {
                                                let sum = 0;
                                                let dataArr = ctx.chart.data.datasets[0].data;
                                                dataArr.map(data => { sum += data; });
                                                let percentage = (value * 100 / sum).toFixed(2) + "%";
                                                return percentage;
                                            },
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </div>
                
                <div className="flex-none flex gap-4 mt-4">
                    <div className="flex-grow w-1/2 bg-white p-4 rounded-lg shadow">
                        <h2 className="text-sm font-semibold text-gray-700 mb-2">Growth</h2>
                        <div className="h-80">
                            <Bar data={growthChart} options={chartOptions} />
                        </div>
                    </div>
                    <div className="flex-grow w-1/2 bg-white p-4 rounded-lg shadow">
                        <BranchNotCloseTool />
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardPage;