import React from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Layout from '@/components/Layout';
import AddLoanPage from '@/components/transactions/loan-application/AddLoanPage';

const EditLoanApplicationPage = () => {
    const router      = useRouter();
    const currentUser = useSelector(state => state.user.data);

    // router.query is empty on first SSR render — wait for hydration
    if (!router.isReady) return null;

    const { uuid } = router.query;
    if (!uuid) return null;

    return (
        <Layout header={false} noPad={true}>
            <AddLoanPage
                mode="edit"
                loanId={uuid}
                onBack={() => router.push('/transactions/loan-applications')}
                onSuccess={() => router.push('/transactions/loan-applications')}
            />
        </Layout>
    );
};

export default EditLoanApplicationPage;