import React from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Layout from '@/components/Layout';
import AddLoanPage from '@/components/transactions/loan-application/AddLoanPage';

const AddLoanApplicationPage = () => {
    const router      = useRouter();
    const currentUser = useSelector(state => state.user.data);

    // Only rep 3 (BM) and rep 4 (LO) can access
    if (currentUser && currentUser.role?.rep !== 3 && currentUser.role?.rep !== 4) {
        router.replace('/transactions/loan-applications');
        return null;
    }

    return (
        <Layout header={false} noPad={true}>
            <AddLoanPage
                onBack={() => router.push('/transactions/loan-applications')}
                onSuccess={() => router.push('/transactions/loan-applications')}
            />
        </Layout>
    );
};

export default AddLoanApplicationPage;