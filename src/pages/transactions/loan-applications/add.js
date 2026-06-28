// src/pages/transactions/loan-applications/add.js
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

    if (!router.isReady) return null;

    const q = router.query;

    return (
        <Layout header={false} noPad={true}>
            <AddLoanPage
                onBack={() => router.push('/clients')}
                onSuccess={() => router.push('/clients')}
                initialClientId={q.clientId    || null}
                initialGroupId={q.groupId      || null}
                initialLoId={q.loId            || null}
                initialClientType={q.clientType || null}
                initialGroupName={q.groupName   || null}
                initialLoName={q.loName         || null}
                initialFirstName={q.firstName   || null}
                initialLastName={q.lastName     || null}
                initialMiddleName={q.middleName || null}
                initialContact={q.contactNumber || null}
                initialAddress={q.address       || null}
                initialSlotNo={q.slotNo         || null}
                initialCiName={q.ciName         || null}
                initialGuarantorFN={q.gFN       || null}
                initialGuarantorLN={q.gLN       || null}
                initialGuarantorRel={q.gRel     || null}
                initialGuarantorContact={q.gContact || null}
                initialGuarantorBD={q.gBD       || null}
                initialGuarantorCS={q.gCS       || null}
                initialGuarantorBiz={q.gBiz     || null}
                initialGuarantorDI={q.gDI       || null}
            />
        </Layout>
    );
};

export default AddLoanApplicationPage;