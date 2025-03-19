import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from "@/components/Layout";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setSystemSettings } from '@/redux/actions/systemActions';
import { useState } from 'react';
import DashboardPage from '@/components/dashboard/DashboardPage';
import { getApiBaseUrl } from '@/lib/constants';

const Index = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        let mounted = true;

        const getSystemSettings = async () => {
            const apiURL = `${getApiBaseUrl()}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setSystemSettings(response.system));
            }
        }
        

        mounted && getSystemSettings();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <Layout header={false} noPad={true}>
            <DashboardPage />
        </Layout>
    );
}

export default Index;