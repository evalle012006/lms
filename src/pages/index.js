import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Layout from "@/components/Layout";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { setSystemSettings } from '@/redux/actions/systemActions';

const Index = () => {
    const dispatch = useDispatch();

    useEffect(() => {
        let mounted = true;

        const getSystemSettings = async () => {
            const apiURL = `${process.env.NEXT_PUBLIC_API_URL}settings/system`;
            const response = await fetchWrapper.get(apiURL);
            if (response.success) {
                dispatch(setSystemSettings(response.system));
            }
        }

        const updateLoanData = async () => {
            await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}transactions/loans/update-loan-data`);
        }


        // const updateGroupClients = async () => {
        //     await fetchWrapper.post(`${process.env.NEXT_PUBLIC_API_URL}groups/update-group-clients`);
        // }

        mounted && getSystemSettings();
        // mounted && updateGroupClients();
        mounted && updateLoanData();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <Layout>
            <div className="flex space-x-4 m-4">
                
            </div>
        </Layout>
    );
}

export default Index;