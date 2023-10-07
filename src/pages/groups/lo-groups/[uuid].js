import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import DetailsHeaderGroupMain from '@/components/groups/DetailsHeaderMain';
import { setSelectedLO } from '@/redux/actions/userActions';
import ViewByGroupsPage from '@/components/groups/ViewByGroups';

const GroupGroupsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const selectedLO = useSelector(state => state.user.selectedLO);
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        let mounted = true;

        const getCurrentUser = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}users?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                dispatch(setSelectedLO(response.user));
                setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentUser(uuid);

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
                    {selectedLO && <DetailsHeaderGroupMain page={'groups'} />}
                    <div className="mt-[6rem]">
                        <ViewByGroupsPage />
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default GroupGroupsPage;