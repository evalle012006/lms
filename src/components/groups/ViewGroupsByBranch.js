import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { setBranchList } from "@/redux/actions/branchActions";

const ViewGroupsByBranchPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);

    const router = useRouter();

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Code",
            accessor: 'code',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Phone Number",
            accessor: 'phoneNumber',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Address",
            accessor: 'address',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Email",
            accessor: 'email',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleRowClick = (selected) => {
        router.push('./groups/users/' + selected._id);
    };

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            {loading ?
                (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : <TableComponent columns={columns} data={list} hasActionButtons={false} rowActionButtons={false} showFilters={false} rowClick={handleRowClick} />}
        </React.Fragment>
    );
}

export default ViewGroupsByBranchPage;