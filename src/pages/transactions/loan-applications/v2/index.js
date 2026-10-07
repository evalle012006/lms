// src/pages/transactions/loan-applications/v2/index.js
// Old bookmark for the new page. Both versions now live at
// /transactions/loan-applications; this selects the new one for the signed-in user
// and sends them there.

import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { storeLoanApplicationView } from '@/hooks/useLoanApplicationView';
import {
    isEligibleForLoanApplicationV2,
    LOAN_APPLICATION_HOME_PATH,
} from '@/lib/loan-application-v2-gate';

export default function LoanApplicationV2Redirect() {
    const router = useRouter();
    const currentUser = useSelector((state) => state.user.data);

    useEffect(() => {
        if (!currentUser?._id) return;
        if (isEligibleForLoanApplicationV2(currentUser)) {
            storeLoanApplicationView(currentUser._id, 'v2');
        }
        router.replace(LOAN_APPLICATION_HOME_PATH);
    }, [currentUser, router]);

    return <Layout><Spinner /></Layout>;
}