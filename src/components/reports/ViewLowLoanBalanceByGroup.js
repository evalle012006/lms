import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";

const ViewLowBalanceByGroupsPage = ({ amount }) => {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const [list, setList] = useState([]);

    const { uuid } = router.query;

    const [columns, setColumns] = useState([
        {
            Header: "Group",
            accessor: 'groupName'
        },
        {
            Header: "Slot #",
            accessor: 'slotNo'
        },
        {
            Header: "Client Name",
            accessor: 'clientName'
        },
        {
            Header: "Loan Cycle",
            accessor: 'loanCycle'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "MCBU",
            accessor: 'mcbuStr'
        },
    ]);

    const getList = async (loId) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'reports/get-all-low-loan-balance?' + new URLSearchParams({ loId: currentUser.role.rep == 4 ? currentUser._id : loId, amount: amount });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const responseData = [];
            response.data.map(group => {
                group.loans.map(loan => {
                    responseData.push({
                        groupId: group._id,
                        groupName: group.name,
                        slotNo: loan.slotNo,
                        clientName: loan.clientName,
                        loanCycle: loan.loanCycle,
                        amountRelease: loan.amountRelease,
                        amountReleaseStr: formatPricePhp(loan.amountRelease),
                        loanBalance: loan.loanBalance,
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        mcbu: loan.mcbu,
                        mcbuStr: formatPricePhp(loan.mcbu)
                    });
                });
            });

            responseData.sort((a, b) => { return a.loanBalance - b.loanBalance });
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
    }, [uuid, amount]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <TableComponent columns={columns} data={list} pageSize={1000} showPagination={false} showFilters={false} hasActionButtons={false} />
                </div>
            )}
        </React.Fragment>
    )
}

export default ViewLowBalanceByGroupsPage;