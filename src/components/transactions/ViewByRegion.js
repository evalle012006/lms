import React from "react";
import { useState } from "react";
import Spinner from "../Spinner";
import { useEffect } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useSelector } from "react-redux";
import moment from 'moment';
import TableComponent from '@/lib/table';
import { useMemo } from "react";

const ViewByRegionPage = ({dateFilter, type, selectedBranchGroup, viewMode}) => {
    const [loading, setLoading] = useState(true);
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [regionCollectionData, setRegionCollectionData] = useState([]);

    const columns = useMemo(() => [
        {
            Header: "Region Name",
            accessor: 'name',
            width: 'w-2/6'
        },
        {
            Header: "Active Clients", // total number of clients per group
            accessor: 'activeClients'
        },
        {
            Header: "MCBU",
            accessor: 'mcbuStr'
        },
        {
            Header: "Total Loan Releases",
            accessor: 'totalReleasesStr'
        },
        {
            Header: "Active Borrowers", // with balance
            accessor: 'activeBorrowers'
        },
        {
            Header: "Total Loan Balance",
            accessor: 'totalLoanBalanceStr'
        },
        {
            Header: "Current Release Person",
            accessor: 'noCurrentReleaseStr'
        },
        {
            Header: "Current Release Amount",
            accessor: 'currentReleaseAmountStr'
        },
        {
            Header: "MCBU Collection",
            accessor: 'mcbuColStr'
        },
        {
            Header: "Target Loan Collection",
            accessor: 'loanTargetStr'
        },
        {
            Header: "Excess",
            accessor: 'excessStr'
        },
        {
            Header: "Actual Loan Collection",
            accessor: 'totalStr'
        },
        {
            Header: "MCBU Withdrawal",
            accessor: 'mcbuWithdrawalStr'
        },
        // {
        //     Header: "MCBU Withdrawal",
        //     accessor: 'mcbuDailyWithdrawalStr'
        // },
        {
            Header: "# MCBU Return",
            accessor: 'noMcbuReturn'
        },
        {
            Header: "MCBU Return",
            accessor: 'mcbuReturnAmtStr'
        },
        {
            Header: "Full Payment Person",
            accessor: 'noOfFullPayment'
        },
        {
            Header: "Full Payment Amount",
            accessor: 'fullPaymentAmountStr'
        },
        {
            Header: "Mispay",
            accessor: 'mispayment'
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
    ]);

    // const handleRowClick = (selected) => {
    //     if (!selected?.totalData) {
    //         router.push(`/transactions/branch-manager/cash-collection/users/${selected._id}`);
    //         localStorage.setItem('selectedBranch', selected._id);
    //     }
    // };

    const getCollectionData = async (date) => {
        const filter = date ? true : false;

        const response = await fetchWrapper.get(process.env.NEXT_PUBLIC_API_URL + 
                            'transactions/cash-collections/get-all-loans-per-region?' 
                            + new URLSearchParams({ date: date ? date : currentDate, currentUserId: currentUser._id, selectedBranchGroup: selectedBranchGroup, dayName: dayName, currentDate: currentDate }));
        if (response.success) {
            const collectionData = response.data.map(data => {
                let temp = {...data};;
                if (!filter && (isWeekend || isHoliday)) {
                    temp.groupStatus = 'close';
                }

                return temp;
            });

            setRegionCollectionData(collectionData);
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;
        setLoading(true);
        if (dateFilter) {
            const date = moment(dateFilter).format('YYYY-MM-DD');
            if (date !== currentDate) {
                mounted && getCollectionData(date);
            } else {
                mounted && getCollectionData();
            }
        } else {
            mounted && getCollectionData();
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
                ) : <TableComponent columns={columns} data={regionCollectionData} hasActionButtons={false} rowActionButtons={false} showFilters={false} showPagination={false} pageSize={100} />}
        </React.Fragment>
    )
}

export default ViewByRegionPage;