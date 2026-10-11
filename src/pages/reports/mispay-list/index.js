// src/pages/reports/mispay-list/index.js
// The whole report lives in one component; filters, drill-down and paging are all in the URL.
import React from 'react';
import Layout from '@/components/Layout';
import MispayListReport from '@/components/reports/mispays-list/MispayListReport';

const MispayListPage = () => (
    <Layout header={false} noPad={true}>
        <MispayListReport />
    </Layout>
);

export default MispayListPage;