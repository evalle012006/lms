// src/pages/settings/users/add.js
import React from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import AddUpdateUserPage from '@/components/settings/users/AddUpdateUserPage';

const AddUserPage = () => {
    const router = useRouter();

    return (
        <Layout header={false} noPad={true}>
            <AddUpdateUserPage
                mode="add"
                onBack={() => router.push('/settings/users')}
                onSuccess={() => router.push('/settings/users')}
            />
        </Layout>
    );
};

export default AddUserPage;