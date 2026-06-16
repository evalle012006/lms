import React from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Layout from '@/components/Layout';
import AddLoanPage from '@/components/transactions/loan-application/AddLoanPage';

const AddLoanApplicationPage = () => {
    const router      = useRouter();
    const currentUser = useSelector(state => state.user.data);
 
    if (currentUser && currentUser.role?.rep !== 3 && currentUser.role?.rep !== 4) {
        router.replace('/transactions/loan-applications');
        return null;
    }
 
    // FIX: wait for router hydration before rendering so query params are available
    if (!router.isReady) return null;
 
    return (
        <Layout header={false} noPad={true}>
            <AddLoanPage
                // FIX: pass query params for pre-filling from PromotedClientBanner
                initialClientId={router.query.clientId || null}
                initialGroupId={router.query.groupId   || null}
                initialLoId={router.query.loId         || null}
                initialClientType={router.query.clientType || null}
                onBack={() => router.push('/transactions/loan-applications')}
                onSuccess={() => router.push('/transactions/loan-applications')}
            />
        </Layout>
    );
};

export default AddLoanApplicationPage;