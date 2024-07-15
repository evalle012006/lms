import React, { useEffect, useState } from "react";
import TableComponent, { SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import moment from 'moment';
import { setCashCollectionBranch } from "@/redux/actions/cashCollectionActions";

const ViewByBranchPage = ({dateFilter, type, selectedBranchGroup, viewMode}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [loading, setLoading] = useState(true);
    const branchCollectionData = useSelector(state => state.cashCollection.branch);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [selectedBranches, setSelectedBranches] = useState([]);

    const router = useRouter();
    // check group status if there is pending change row color to orange/yellow else white
    const getBranchCashCollections = async (date) => {
        setLoading(true);
        const filter = date ? true : false;

        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 
                            'transactions/cash-collections/get-all-loans-per-branch-v2?' 
                            + new URLSearchParams({ date: date ? date : currentDate, currentUserId: currentUser._id, selectedBranchGroup: selectedBranchGroup, dayName: dayName, currentDate: currentDate }));
        if (response.success) {
            const collectionData = response.data.map(data => {
                let temp = {...data};;
                if (!filter && (isWeekend || isHoliday)) {
                    temp.groupStatus = 'close';
                }

                return temp;
            });
            
            dispatch(setCashCollectionBranch(collectionData));
            setLoading(false);
        } else {
            setLoading(false);
            toast.error('Error retrieving branches list.');
        }
    }

    const [columns, setColumns] = useState();

    const handleRowClick = (selected) => {
        if (!selected?.totalData) {
            router.push(`/transactions/branch-manager/cash-collection/users/${selected._id}`);
            localStorage.setItem('selectedBranch', selected._id);
        }
    };

    useEffect(() => {
        let cols = [];
        if (type === 'daily') {
            cols = [
                {
                    Header: "Branch Name",
                    accessor: 'name',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Active Clients", // total number of clients per group
                    accessor: 'activeClients',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Total Loan Releases",
                    accessor: 'totalReleasesStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Active Borrowers", // with balance
                    accessor: 'activeBorrowers',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Total Loan Balance",
                    accessor: 'totalLoanBalanceStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Current Release Person",
                    accessor: 'noCurrentReleaseStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Current Release Amount",
                    accessor: 'currentReleaseAmountStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Target Loan Collection",
                    accessor: 'loanTargetStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Excess",
                    accessor: 'excessStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Actual Loan Collection",
                    accessor: 'totalStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Full Payment Person",
                    accessor: 'noOfFullPayment',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Full Payment Amount",
                    accessor: 'fullPaymentAmountStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Mispay",
                    accessor: 'mispaymentStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "PD #",
                    accessor: 'noPastDue'
                },
                {
                    Header: "PD Amount",
                    accessor: 'pastDueStr'
                },
                {
                    Header: "PND",
                    accessor: 'pendingClients'
                }
            ];
        } else {
            cols = [
                {
                    Header: "Branch Name",
                    accessor: 'name',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Active Clients", // total number of clients per group
                    accessor: 'activeClients',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "MCBU",
                    accessor: 'mcbuStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Total Loan Releases",
                    accessor: 'totalReleasesStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Active Borrowers", // with balance
                    accessor: 'activeBorrowers',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Total Loan Balance",
                    accessor: 'totalLoanBalanceStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Current Release Person",
                    accessor: 'noCurrentReleaseStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Current Release Amount",
                    accessor: 'currentReleaseAmountStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "MCBU Collection",
                    accessor: 'mcbuColStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Target Loan Collection",
                    accessor: 'loanTargetStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Excess",
                    accessor: 'excessStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Actual Loan Collection",
                    accessor: 'totalStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "MCBU Withdrawal",
                    accessor: 'mcbuWithdrawalStr',
                },
                // {
                //     Header: "MCBU Withdrawal",
                //     accessor: 'mcbuDailyWithdrawalStr'
                // },
                {
                    Header: "# MCBU Return",
                    accessor: 'noMcbuReturn',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "MCBU Return",
                    accessor: 'mcbuReturnAmtStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Full Payment Person",
                    accessor: 'noOfFullPayment',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Full Payment Amount",
                    accessor: 'fullPaymentAmountStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Mispay",
                    accessor: 'mispaymentStr',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "PD #",
                    accessor: 'noPastDue'
                },
                {
                    Header: "PD Amount",
                    accessor: 'pastDueStr'
                },
                {
                    Header: "PND",
                    accessor: 'pendingClients'
                },
                {
                    Header: "TOC",
                    accessor: 'transfer'
                },
                {
                    Header: "COH",
                    accessor: 'cohStr'
                }
            ];
        }

        setColumns(cols);
    }, []);

    useEffect(() => {
        let mounted = true;

        if (dateFilter) {
            const date = moment(dateFilter).format('YYYY-MM-DD');
            if (date !== currentDate) {
                mounted && getBranchCashCollections(date);
            } else {
                mounted && getBranchCashCollections();
            }
        } else {
            mounted && getBranchCashCollections();
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter, selectedBranchGroup, viewMode]);
    

    return (
        <React.Fragment>
            {loading ?
                (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : <TableComponent columns={columns} data={branchCollectionData} hasActionButtons={false} rowActionButtons={false} showFilters={false} showPagination={false} pageSize={100} rowClick={handleRowClick} />}
        </React.Fragment>
    );
}

export default ViewByBranchPage;