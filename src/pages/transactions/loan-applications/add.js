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
                key={router.asPath}
                onBack={() => router.push('/transactions/loan-applications')}
                onSuccess={() => router.push('/transactions/loan-applications')}
                // NEW: "Save & Add More" — pushes to the bare add route with no
                // query params. Combined with key={router.asPath} above, this
                // forces a full remount of AddLoanPage, which is what actually
                // clears all internal state (25+ useState values) rather than
                // trying to manually reset each one. router.push (not replace)
                // is deliberate — keeps the just-saved loan's URL in history in
                // case the person needs to go back to it.
                onSaveAndAddMore={() => router.push('/transactions/loan-applications/add')}
                initialClientId={q.clientId    || null}
                initialGroupId={q.groupId      || null}
                initialLoId={q.loId            || null}
                initialClientType={q.clientType || null}
                initialGroupName={q.groupName   || null}
                initialLoName={q.loName         || null}
                initialFirstName={q.firstName   || null}
                initialLastName={q.lastName     || null}
                initialMiddleName={q.middleName || null}
                initialBirthdate={q.birthdate   || null}
                initialPhotoUrl={q.photoUrl ? decodeURIComponent(q.photoUrl) : null}
                initialContact={q.contactNumber || null}
                initialAddress={q.address       || null}
                initialSlotNo={q.slotNo         || null}
                initialLoanCycle={q.loanCycle      || null}
                initialCiName={q.ciName         || null}
                initialGuarantorFN={q.gFN       || null}
                initialGuarantorLN={q.gLN       || null}
                initialGuarantorRel={q.gRel     || null}
                initialGuarantorContact={q.gContact || null}
                initialGuarantorBD={q.gBD       || null}
                initialGuarantorCS={q.gCS       || null}
                initialGuarantorBiz={q.gBiz     || null}
                initialGuarantorDI={q.gDI       || null}
                initialGuarantorAddress={q.gAddr || null}
                initialCiApprovedDate={q.ciApprovedDate || null}
                initialCiReferenceCode={q.ciReferenceCode || null}
            />
        </Layout>
    );
};

export default AddLoanApplicationPage;