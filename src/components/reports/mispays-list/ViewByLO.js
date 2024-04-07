import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";

const ViewByLOPage = ({ amount, amountOperator, noOfPayments, noOfPaymentsOperator }) => {
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
            Header: "# of Clients",
            accessor: 'noOfClients'
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
        const amountOption = JSON.stringify({ amount: amount, operator: amountOperator });
        const noOfPaymentsOption = JSON.stringify({ noOfPayments: noOfPayments, operator: noOfPaymentsOperator });
        let url = process.env.NEXT_PUBLIC_API_URL + 'reports/get-all-mispays?' + new URLSearchParams({ branchId: currentUser.role.rep == 3 ? currentUser.designatedBranchId : branchId, amountOption: amountOption, noOfPaymentsOption: noOfPaymentsOption });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const responseData = [];
            response.data.map(lo => {
                let temp = {
                    _id: lo._id,
                    loName: `${lo.firstName} ${lo.lastName}`
                }
                lo.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfClients: loan.totalClients,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU),
                        totalNet: loan.totalNetLoanBalance,
                        totalNetStr: formatPricePhp(loan.totalNetLoanBalance)
                    };
                });
                responseData.push(temp);
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
    }, [uuid, amount, amountOperator, noOfPayments, noOfPaymentsOperator]);

    return (
        <React.Fragment>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <TableComponent columns={columns} data={list} showPagination={false} showFilters={false} hasActionButtons={false} rowClick={handleRowClick} />
                </div>
            )}
        </React.Fragment>
    )
}

export default ViewByLOPage;