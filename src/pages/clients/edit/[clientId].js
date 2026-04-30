import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AddUpdateClientPage from '@/components/clients/AddUpdateClientPage';

const EditClientPage = () => {
    const router = useRouter();

    // Wait for router hydration before rendering
    if (!router.isReady) return null;

    const { clientId } = router.query;
    if (!clientId) return null;

    return (
        <Layout header={false} noPad={true}>
            <AddUpdateClientPage
                mode="edit"
                clientId={clientId}
                onBack={() => router.back()}
                onSuccess={() => router.back()}
            />
        </Layout>
    );
};

export default EditClientPage;