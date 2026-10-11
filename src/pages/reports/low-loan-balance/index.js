// src/pages/reports/low-loan-balance/index.js
// The whole report lives in one config + the shared drill-down engine; filters, drill-down and paging are in the URL.
import React from 'react';
import Layout from '@/components/Layout';
import LowLoanBalanceReport from '@/components/reports/low-loan-balance/LowLoanBalanceReport';

const LowLoanBalancePage = () => (
    <Layout header={false} noPad={true}>
        <LowLoanBalanceReport />
    </Layout>
);

export default LowLoanBalancePage;