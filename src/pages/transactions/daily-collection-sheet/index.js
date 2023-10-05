import React,  { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from "react-toastify";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";

const DailyCollectionSheetPage = () => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);

    const fetchData = () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/cash-collection-summary';
        if (currentUser?.role.rep === 3) {
            
        }
    }

    useEffect(() => {
        if ((currentUser?.role?.rep < 3)) {
            router.push('/');
        }
    }, []);

    useEffect(() => {
        let mounted = true;

        mounted && setLoading(false);

        return (() => {
            mounted = false;
        });
    }, []);

    return (
        <Layout>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="flex flex-col">
                    <h1 className='mx-auto'>PAGE UNDERCONSTRUCTION</h1>
                </div>
            )}
        </Layout>
    )
}

export default DailyCollectionSheetPage;