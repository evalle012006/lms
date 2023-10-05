import { Formik } from 'formik';
import * as yup from 'yup';
import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { TabSelector } from '@/lib/ui/tabSelector';
import { TabPanel, useTabs } from 'node_modules/react-headless-tabs/dist/react-headless-tabs';
import SystemSettingsPage from './system';
import HolidaysSettingsPage from './holidays';
import TransactionsSettingsPage from './transactions';

const SettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const [selectedTab, setSelectedTab] = useTabs([
        'system',
        'transactions',
        'holidays'
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

    return (
        <Layout>
            <div className="mt-5">
                {loading ? (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : (
                        <React.Fragment>
                            <nav className="flex pl-10 bg-white border-b border-gray-300">
                                <TabSelector
                                    isActive={selectedTab === "system"}
                                    onClick={() => setSelectedTab("system")}>
                                    System
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "transactions"}
                                    onClick={() => setSelectedTab("transactions")}>
                                    Transactions
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "holidays"}
                                    onClick={() => setSelectedTab("holidays")}>
                                    Holidays
                                </TabSelector>
                            </nav>
                            <div className='mt-6 ml-6'>
                                <TabPanel hidden={selectedTab !== 'system'}>
                                    <SystemSettingsPage />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'transactions'}>
                                    <TransactionsSettingsPage />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'holidays'}>
                                    <HolidaysSettingsPage />
                                </TabPanel>
                            </div>
                        </React.Fragment>
                    )
                }
            </div>
        </Layout>
    );
}

export default SettingsPage;