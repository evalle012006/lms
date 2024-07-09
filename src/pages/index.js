import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from "@/components/Layout";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setSystemSettings } from '@/redux/actions/systemActions';
import { useState } from 'react';
import DashboardPage from '@/components/dashboard/DashboardPage';
import { getApiBaseUrl } from '@/lib/constants';
import { autoHealClients } from '@/lib/sync-jobs';

const Index = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const currentUser = useSelector(state => state.user.data);

    useEffect(() => {
        let mounted = true;

        const getSystemSettings = async () => {
            const apiURL = `${getApiBaseUrl()}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setSystemSettings(response.system));
            }
        }

        const updateGroupClients = async () => {
            await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}groups/update-group-clients`);
        }

        // const updateCCData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/cash-collections/update-cc-data`);
        // }

        // const updateLoanData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-loan-data`);
        // }

        // const updateLOData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-lo-data`);
        // }

        // const updateLoanMaturedData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-loan-matured-past-due`);
        // }

        // const updateLOSData = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-los-data`);
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

        // const testQuery = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/aaa-test`, {});
        // }

        const updateClientData = async () => {
            await autoHealClients();;
        }

        mounted && getSystemSettings();
        // mounted && testQuery();

        if (currentTime) {
            const timeArgs = currentTime.split(" ");
            const hourMinArgs = timeArgs[0].split(':');
            if (currentUser?.root && 
                ((timeArgs[1] == 'AM' && timeArgs[0].startsWith('10')) 
                    || (timeArgs[1] == 'PM' && timeArgs[0].startsWith('2'))
                    || (timeArgs[1] == 'PM' && hourMinArgs[0] == '9' && (hourMinArgs[1] == '00' || hourMinArgs[1] == '10')))) {
                mounted && updateGroupClients();
            }

            // if (currentUser?.root &&
            //     ((timeArgs[1] == 'AM' && timeArgs[0].startsWith('8'))
            //         || (timeArgs[1] == 'PM' && timeArgs[0].startsWith('3'))
            //         || (timeArgs[1] == 'PM' && hourMinArgs[0] == '1' && (hourMinArgs[1] == '00' || hourMinArgs[1] == '10')))) {
            //     mounted && updateClientData();
            // }
        }
        // mounted && updateLOData();
        // mounted && updateGroupData();
        // mounted && updateClients();
        // mounted && getLoans();
        // mounted && updateLoanCoMaker();
        // mounted && getTransactionSettings();
        // mounted && getListHoliday();
        // mounted && updateLoanData();
        // mounted && updateClientData();
        // mounted && updateCCData();
        // mounted && updateLOSData();
        // mounted && updateLoanMaturedData();

        return () => {
            mounted = false;
        };
    }, [currentTime]);

    // useEffect(() => {
    //     const updateCCData = async () => {
    //         await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}aahandy-scripts/update-cc-data`);
    //     }

    //     updateCCData();
    // }, []);

    return (
        <Layout header={false} noPad={true}>
            <DashboardPage />
        </Layout>
    );
}

export default Index;