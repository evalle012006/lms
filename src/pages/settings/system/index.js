import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { TabPanel, useTabs } from 'react-headless-tabs';
import ProfileSettingsPage from './profile';
import HolidaysSettingsPage from './holidays';
import TransactionsSettingsPage from './transactions';
import {
  BuildingOfficeIcon,
  BanknotesIcon,
  CalendarDaysIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import AuditLogsPage from './audit-logs';

const ModernTabSelector = ({ isActive, onClick, children, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center px-8 py-4 text-sm font-medium border-b-2 transition-all duration-200
      ${isActive 
        ? 'border-blue-500 text-blue-600 bg-blue-50' 
        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
      }
    `}
  >
    <Icon className={`h-5 w-5 mr-2 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
    {children}
  </button>
);

const SettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useTabs([
        'profile',
        'transactions',
        'holidays',
        'audit',
    ]);

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;
        setLoading(false);

        return () => {
            mounted = false;
        };
    }, []);

    if (loading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="py-6 border-b border-gray-100">
                            <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
                            <p className="text-gray-600 mt-2">Manage your system configuration and preferences</p>
                        </div>
                        
                        {/* Modern Tab Navigation */}
                        <nav className="flex space-x-0">
                            <ModernTabSelector
                                isActive={selectedTab === "profile"}
                                onClick={() => setSelectedTab("profile")}
                                icon={BuildingOfficeIcon}
                            >
                                Company Profile
                            </ModernTabSelector>
                            <ModernTabSelector
                                isActive={selectedTab === "transactions"}
                                onClick={() => setSelectedTab("transactions")}
                                icon={BanknotesIcon}
                            >
                                Transaction Settings
                            </ModernTabSelector>
                            <ModernTabSelector
                                isActive={selectedTab === "holidays"}
                                onClick={() => setSelectedTab("holidays")}
                                icon={CalendarDaysIcon}
                            >
                                Holiday Management
                            </ModernTabSelector>
                            {/* Audit Logs — admin/area+ only */}
                            {currentUser?.role?.rep <= 2 && (
                                <ModernTabSelector
                                    isActive={selectedTab === "audit"}
                                    onClick={() => setSelectedTab("audit")}
                                    icon={ClipboardDocumentListIcon}
                                >
                                    Audit Logs
                                </ModernTabSelector>
                            )}
                        </nav>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="max-w-7xl mx-auto">
                    <TabPanel hidden={selectedTab !== 'profile'}>
                        <ProfileSettingsPage />
                    </TabPanel>
                    <TabPanel hidden={selectedTab !== 'transactions'}>
                        <TransactionsSettingsPage />
                    </TabPanel>
                    <TabPanel hidden={selectedTab !== 'holidays'}>
                        <HolidaysSettingsPage />
                    </TabPanel>
                    {currentUser?.role?.rep <= 2 && (
                        <TabPanel hidden={selectedTab !== 'audit'}>
                            <div className="p-6">
                                <AuditLogsPage />
                            </div>
                        </TabPanel>
                    )}
                </div>
            </div>
        </Layout>
    );
}

export default SettingsPage;