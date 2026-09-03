// src/pages/settings/users/edit/[uuid].js
import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AddUpdateUserPage from '@/components/settings/users/AddUpdateUserPage';

const EditUserPage = () => {
    const router = useRouter();

    if (!router.isReady) return null;

    const { uuid } = router.query;
    if (!uuid) return null;

    return (
        <Layout header={false} noPad={true}>
            <AddUpdateUserPage
                key={uuid}
                mode="edit"
                userId={uuid}
                onBack={() => router.push('/settings/users')}
                onSuccess={() => router.push('/settings/users')}
            />
        </Layout>
    );
};

export default EditUserPage;