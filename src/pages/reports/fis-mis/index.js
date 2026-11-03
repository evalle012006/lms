import React from 'react';
import Layout from '@/components/Layout';
import FisReport from '@/components/reports/fis-mis/FisReport';

const FisMisPage = () => (
    <Layout header={false} noPad={true}>
        <FisReport />
    </Layout>
);

export default FisMisPage;