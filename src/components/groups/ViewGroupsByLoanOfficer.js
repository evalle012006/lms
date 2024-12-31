import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import { setUserList } from "@/redux/actions/userActions";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { getApiBaseUrl } from "@/lib/constants";

const ViewGroupsByLoanOfficerPage = () => {
    const dispatch = useDispatch();
    const userList = useSelector(state => state.user.list);
    const branch = useSelector(state => state.branch.data);
    const [loading, setLoading] = useState(true);
   
    const router = useRouter();

    const handleRowClick = (selected) => {
        if (selected && selected.hasOwnProperty('_id')) {
            router.push('/groups/lo-groups/' + selected._id);
        }
    };

    const getListUsers = async () => {
        if (branch) {
            let url = getApiBaseUrl() + 'users/list-with-group-count?branchCode=' + branch.code;

            const response = await fetchWrapper.get(url);
            let users = [];
            response.users && response.users.filter(u => u.role.rep === 4).map((user) => {
                users.push({
                    _id: user._id,
                    name: user.firstName + ' ' + user.lastName,
                    email: user.email,
                    number: user.number,
                    groupCount: user.groupCount.length > 0 ? user.groupCount[0].count : 0
                });
            });

            dispatch(setUserList(users));
            setLoading(false);
        }
    }

    const columns = [
        {
            Header: "Loan Officer Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Email Address",
            accessor: 'email',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Phone Number",
            accessor: 'number',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Group Count",
            accessor: 'groupCount',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ];


    useEffect(() => {
        let mounted = true;

        branch && getListUsers();

        return () => {
            mounted = false;
        };
    }, [branch]);

    return (
        <React.Fragment>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <TableComponent columns={columns} data={userList} showPagination={true} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewGroupsByLoanOfficerPage;