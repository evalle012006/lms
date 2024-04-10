import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import TableComponent from "@/lib/table";
import { useRouter } from "node_modules/next/router";
import { formatPricePhp } from "@/lib/utils";
import { useDispatch, useSelector } from "react-redux";
import { setBranchList } from "@/redux/actions/branchActions";

const ViewLowBalanceByBranchPage = ({ amount, amountOperator, noOfPayments, noOfPaymentsOperator }) => {
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
        }
    ]);

    const handleRowClick = (selected) => {
        if (selected) {
            localStorage.setItem('selectedBranch', selected._id);
            router.push(`/reports/low-loan-balance/user/${selected._id}`);
        }
    }

    const getList = async () => {
        setLoading(true);
        const amountOption = JSON.stringify({ amount: amount, operator: amountOperator });
        const noOfPaymentsOption = JSON.stringify({ noOfPayments: noOfPayments, operator: noOfPaymentsOperator });
        let url = process.env.NEXT_PUBLIC_API_URL + 'reports/get-all-low-loan-balance';
        if (currentUser.role.rep == 2 && branchList.length > 0) {
            // const branchIds = branchList.filter(branch => currentUser.designatedBranch.includes(branch.code)).map(branch => branch._id);
            // url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds), amountOption: amountOption, noOfPaymentsOption: noOfPaymentsOption });
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id, amountOption: amountOption, noOfPaymentsOption: noOfPaymentsOption });
        } else {
            url = url + '?' + new URLSearchParams({ amountOption: amountOption, noOfPaymentsOption: noOfPaymentsOption });
        }
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const responseData = [];
            response.data.map(branch => {
                let temp = {
                    _id: branch._id,
                    code: branch.code,
                    name: branch.name,
                    noOfClients: 0,
                    totalAmountRelease: 0,
                    totalAmountReleaseStr: '-',
                    totalLoanBalance: 0,
                    totalLoanBalanceStr: '-',
                    totalMCBU: 0,
                    totalMCBUStr: '-'
                }
                branch.loans.map(loan => {
                    temp = {
                        ...temp,
                        noOfClients: loan.totalClients,
                        totalAmountRelease: loan.totalAmountRelease,
                        totalAmountReleaseStr: formatPricePhp(loan.totalAmountRelease),
                        totalLoanBalance: loan.totalLoanBalance,
                        totalLoanBalanceStr: formatPricePhp(loan.totalLoanBalance),
                        totalMCBU: loan.totalMCBU,
                        totalMCBUStr: formatPricePhp(loan.totalMCBU)
                    }
                });

                responseData.push(temp);
            });

            responseData.sort((a, b) => {
                if (a.code < b.code) {
                    return -1;
                }

                if (b.code < b.code) {
                    return 1;
                }

                return 0;
            } );
            setList(responseData);
            setLoading(false);
        }
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        
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

        setLoading(false);
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
    }, [branchList, amount, amountOperator, noOfPayments, noOfPaymentsOperator]);

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

export default ViewLowBalanceByBranchPage;