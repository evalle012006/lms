import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { toast } from "react-toastify";
import DetailsHeader from '@/components/groups/DetailsHeader';
import { setGroup } from '@/redux/actions/groupActions';
import ViewClientsByGroupPage from '@/components/clients/ViewClientsByGroup';

const GroupsDetailsPage = () => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const group = useSelector(state => state.group.data);
    const { uuid } = router.query;
    const [loading, setLoading] = useState(true);
    const [branchId, setBranchId] = useState();


    useEffect(() => {
        let mounted = true;

        const getCurrentGroup = async () => {
            const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}groups?`;
            const params = { _id: uuid };
            const response = await fetchWrapper.get(apiUrl + new URLSearchParams(params));
            if (response.success) {
                await dispatch(setGroup(response.group));
                await setLoading(false);
            } else {
                toast.error('Error while loading data');
            }
        }

        mounted && uuid && getCurrentGroup(uuid);

        return () => {
            mounted = false;
        };
    }, [uuid]);

    useEffect(() => {
        if (currentUser.root !== true && (currentUser.role.rep === 4 || currentUser.role.rep === 3) && branchList.length > 0) {
            const branch = branchList.find(b => b.code === currentUser.designatedBranch);
            setBranchId(branch._id);
        }
    }, [branchList])

    return (
        <Layout header={false} noPad={true}>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    {group && <DetailsHeader page={'group'} />}
                    <div className="p-2 mt-[6rem]">
                        <ViewClientsByGroupPage groupId={group && group._id} status="active" />
                    </div>
                </div>
            )}
        </Layout>
    );
}

export default GroupsDetailsPage;