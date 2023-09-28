import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from "@/components/Layout";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setSystemSettings } from '@/redux/actions/systemActions';
import moment from 'moment';
import { useState } from 'react';
import DashboardPage from '@/components/dashboard/DashboardPage';

const Index = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentUser = useSelector(state => state.user.data);

    useEffect(() => {
        let mounted = true;

        const getSystemSettings = async () => {
            const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setSystemSettings(response.system));
            }
        }

        // const updateCCData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/cash-collections/update-cc-data`);
        // }

        // const updateLoanData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/loans/update-loan-data`);
        // }

        // const updateGroupClients = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}groups/update-group-clients`);
        // }

        // const updateLOSData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/cash-collection-summary/update-los-data`);
        // }

        // const updateLoanCoMaker = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-loan-comaker`);
        // }

        // const getLoans = async () => {
        //     await fetchWrapper.get(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/get-all-loan-specific-data/`);
        // }

        // const updateClients = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-clients`, {});
        // }

        // const updateGroupData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-group-data`, {});
        // }

        mounted && getSystemSettings();
        // mounted && updateGroupData();
        // mounted && updateClients();
        // mounted && getLoans();
        // mounted && updateLoanCoMaker();
        // mounted && getTransactionSettings();
        // mounted && getListHoliday();
        // mounted && updateGroupClients();
        // mounted && updateLoanData();
        // mounted && updateCCData();
        // mounted && updateLOSData();

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