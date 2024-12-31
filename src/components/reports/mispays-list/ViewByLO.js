import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import { getApiBaseUrl } from '@/lib/constants';

const ViewByLOPage = ({ dateFilter, remarks }) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const [list, setList] = useState([]);

    const { uuid } = router.query;

    const [columns, setColumns] = useState([
        {
            Header: "Loan Officer",
            accessor: 'loName'
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
            localStorage.setItem('pageNo', uuid ? 3 : 2);
            router.push(`/reports/mispay-list/group/${selected._id}`);
        }
    }

    const getList = async (branchId) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'reports/get-all-mispays?' + new URLSearchParams({ branchId: currentUser.role.rep == 3 ? currentUser.designatedBranchId : branchId, date: dateFilter, remarks: remarks});
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const responseData = response.data;
            setList(responseData);
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        if (uuid) {
            mounted && getList(uuid);
        } else {
            mounted && getList();
        }

        return (() => {
            mounted = false;
        });
    }, [uuid, dateFilter, remarks]);

    return (
        <React.Fragment>
            {loading ? (
                // <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                // </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <TableComponent columns={columns} data={list} showPagination={false} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
                </div>
            )}
        </React.Fragment>
    )
}

export default ViewByLOPage;