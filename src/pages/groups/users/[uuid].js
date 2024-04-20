import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import { setBranch } from '@/redux/actions/branchActions';
import DetailsHeaderGroupMain from '@/components/groups/DetailsHeaderMain';
import ViewGroupsByLoanOfficerPage from '@/components/groups/ViewGroupsByLoanOfficer';
import { getApiBaseUrl } from '@/lib/constants';

const GroupUsersPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const branch = useSelector(state => state.branch.data);
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        let mounted = true;

        const getCurrentBranch = async () => {
            const apiUrl = `${getApiBaseUrl()}branches?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                dispatch(setBranch(response.branch));
                setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentBranch(uuid);

        return () => {
            mounted = false;
        };
    }, [uuid]);

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {branch && <DetailsHeaderGroupMain page={'users'} />}
                    <div className="p-2 mt-[6rem]">
                        <ViewGroupsByLoanOfficerPage />
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default GroupUsersPage;