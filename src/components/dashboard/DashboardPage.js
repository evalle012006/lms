import { formatPricePhp } from '@/lib/utils';
import React from 'react';
import { useSelector } from 'react-redux';
import { UserPlusIcon, WalletIcon, BanknotesIcon, ScaleIcon, ReceiptRefundIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

const DashboardPage = () => {
    const currentUser = useSelector(state => state.user.data);
    const cardData = [
        {label: 'Total Loan Releases', total: 100221, icon: <BanknotesIcon className="text-gray-800 w-12 h-12" /> },
        {label: 'Total Loan Balances', total: 100221, icon: <ScaleIcon className="text-gray-800 w-12 h-12" /> },
        {label: 'Total MCBU', total: 100221, icon: <CurrencyDollarIcon className="text-gray-800 w-12 h-12" /> },
        {label: 'Total Collection', total: 100221, icon: <WalletIcon className="text-gray-800 w-12 h-12" /> },
        {label: 'Total New Clients', total: 100221, icon: <UserPlusIcon className="text-gray-800 w-12 h-12" /> },
        {label: 'Total Reloan Clients', total: 100221, icon: <ReceiptRefundIcon className="text-gray-800 w-12 h-12" /> }
    ]

    return (
        <div>
            <div className="flex h-screen overflow-y-hidden bg-white">
                <main className="flex-1 max-h-full p-5 overflow-hidden overflow-y-scroll">
                    <div className="flex flex-col items-start justify-between pb-6 space-y-4 border-b lg:items-center lg:space-y-0 lg:flex-row">
                        <h1 className="text-2xl font-semibold whitespace-nowrap">Welcome, {`${currentUser.firstName} ${currentUser.lastName}`}!</h1>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-4">
                        {cardData.map((cd, i) => {
                            return (
                                <div key={i} className="p-4 transition-shadow border rounded-lg shadow-sm hover:shadow-lg">
                                    <div className="flex items-start justify-between">
                                        <div className="flex flex-col space-y-2">
                                            <span className="text-gray-400">{ cd.label }</span>
                                            <span className="text-lg font-semibold">{ formatPricePhp(cd.total) }</span>
                                        </div>
                                        { cd.icon }
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </main>
            </div>
        </div>
    )
}

export default DashboardPage;