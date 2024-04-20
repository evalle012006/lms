import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import { useDispatch, useSelector } from "react-redux";
import { setBranchList } from "@/redux/actions/branchActions";
import { getApiBaseUrl } from "@/lib/constants";

const ViewByBranchPage = ({ dateFilter, remarks }) => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState([]);

    const [columns, setColumns] = useState([
        {
            Header: "Branch Code",
            accessor: 'code'
        },
        {
            Header: "Branch",
            accessor: 'name'
        },
        {
            Header: "# of Mispays",
            accessor: 'noOfMispays'
        },
        {
            Header: "Total Amount Release",
            accessor: 'totalAmountReleaseStr'
        },
        {
            Header: "Total Loan Balance",
            accessor: 'totalLoanBalanceStr'
        },
        {
            Header: "Total MCBU",
            accessor: 'totalMCBUStr'
        },
        {
            Header: "Total Net Loan Balance",
            accessor: 'totalNetStr'
        }
    ]);

    const handleRowClick = (selected) => {
        if (selected) {
            localStorage.setItem('selectedBranch', selected._id);
            router.push(`/reports/mispay-list/user/${selected._id}`);
        }
    }

    const getList = async () => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'reports/get-all-mispays';
        if (currentUser.role.rep == 2 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id, date: dateFilter, remarks: remarks });
        } else {
            url = url + '?' + new URLSearchParams({ date: dateFilter, remarks: remarks });
        }
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const responseData = response.data;
            setList(responseData);
            setLoading(false);
        }
    }

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch
                    }
                );
            });
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }
    }

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep == 2) {
            mounted && getListBranch();
        }

        return (() => {
            mounted = false;
        });
    }, [currentUser]);

    useEffect(() => {
        let mounted = true;

        mounted && getList();

        return (() => {
            mounted = false;
        });
    }, [branchList, dateFilter, remarks]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <TableComponent columns={columns} data={list} pageSize={100} showPagination={false} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
                </div>
            )}
        </React.Fragment>
    )
}

export default ViewByBranchPage;