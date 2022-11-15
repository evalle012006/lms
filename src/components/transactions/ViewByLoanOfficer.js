import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import { setBranchList } from "@/redux/actions/branchActions";
import { setUserList } from "@/redux/actions/userActions";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";

const ViewByLoanOfficerPage = () => {
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const [userLOList, setUserLOList] = useState([]);
    const [loading, setLoading] = useState(true);
   
    const router = useRouter();

    const handleRowClick = (selected) => {
        if (selected) {
            localStorage.setItem('selectedLO', selected._id);
            router.push('./daily-cash-collection/group/' + selected._id);
        }
    };

    const columns = [
        {
            Header: "Loan Officer Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Branch",
            accessor: 'branch',
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
        }
    ];


    useEffect(() => {
        let mounted = true;

        if (userList && branchList) {
            const loUsers = userList.filter(u => u.role.rep === 4).map(u => {
                let temp = {...u};

                temp.name = `${temp.firstName} ${temp.lastName}`;
                temp.branch = branchList && branchList.find(b => b.code === u.designatedBranch).name;

                return temp;
            });
            mounted && setUserLOList(loUsers);
            setLoading(false);
        }

        return () => {
            mounted = false;
        };
    }, [userList, branchList]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={userLOList} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;