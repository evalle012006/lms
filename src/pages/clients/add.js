import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AddUpdateClientPage from '@/components/clients/AddUpdateClientPage';

const AddClientPage = () => {
    const router = useRouter();
    // Read ciCode from URL — populated either manually or when user selects from panel
    const { ciCode } = router.query;

    const handleBack = () => {
        router.push('/clients?status=pending');
    };

    const handleSuccess = () => {
        router.push('/clients?status=pending');
    };

    return (
        <Layout header={false} noPad={true}>
            <AddUpdateClientPage
                mode="add"
                ciCode={ciCode || null}
                onBack={handleBack}
                onSuccess={handleSuccess}
            />
        </Layout>
    );
};

export default AddClientPage;