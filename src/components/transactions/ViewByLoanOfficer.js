import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { useRouter } from "node_modules/next/router";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import moment from 'moment';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { UppercaseFirstLetter } from "@/lib/utils";
import { toast } from "react-toastify";
import { BehaviorSubject } from 'rxjs';
import { setBmSummary, setCashCollectionLo } from "@/redux/actions/cashCollectionActions";
import { setUserList } from "@/redux/actions/userActions";
import { getApiBaseUrl } from "@/lib/constants";
import { useMemo } from "react";

const ViewByLoanOfficerPage = ({ pageNo, dateFilter, type, selectedLoGroup }) => {
    const dispatch = useDispatch();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const currentTime = useSelector(state => state.systemSettings.currentTime);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const currentBranch = useSelector(state => state.branch.data);
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [userLOList, setUserLOList] = useState([]);
    const [loading, setLoading] = useState(true);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const [selectedLOIds, setSelectedLOIds] = useState([]);
   
    const router = useRouter();

    const handleRowClick = (selected) => {
        if (!selected?.totalData) {
            localStorage.setItem('selectedLO', selected._id);
            router.push(`/transactions/${selected.transactionType}-cash-collection/group/${selected._id}`);
        }
    };

    const getGroupCashCollections = async (date) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'transactions/cash-collections/get-all-loans-per-lo-v2?' + new URLSearchParams({ 
            date: date ? date : currentDate, 
            loIds: JSON.stringify(selectedLOIds), 
            dayName: dayName, 
            currentDate: currentDate 
        });
        
        try {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const processedData = response.data;
                
                // Find totals in the processed data
                const totalsRow = processedData.find(row => row.name === 'GRAND TOTALS');
                if (totalsRow) {
                    const dailyLos = { ...totalsRow, losType: "daily" };
                    dispatch(setBmSummary(dailyLos));
                }

                // Find LOS summary if available
                const losSummary = processedData.find(row => row.losType === 'daily');
                if (losSummary) {
                    dispatch(setBmSummary(losSummary));
                }
                
                setUserLOList(processedData);
                dispatch(setCashCollectionLo(processedData));
                setLoading(false);
            } else {
                setLoading(false);
                toast.error('Error retrieving loan officer data.');
            }
        } catch (error) {
            setLoading(false);
            console.error('Error fetching loan officer collections:', error);
            toast.error('Error retrieving loan officer data.');
        }
    }
    
    const handleOpen = async (row) => {
        if (row.original.activeClients > 0 && !row.original.hasOwnProperty("allNew")) {
            setLoading(true);

            let data = { loId: row.original._id, mode: 'open', currentDate: currentDate, transactionType: row.original.transactionType };

            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/update-group-transaction-status', data);
            
            if (response.success) {
                toast.success(`${data.name} groups transactions are now open!`);
                window.location.reload();
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else if (row.original.hasOwnProperty("allNew")) {
            toast.error("All transactions are current releases no need to changed the group's status.");
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const handleClose = async (row) => {
        if (row.original.activeClients > 0 && !row.original.hasOwnProperty("allNew")) {
            setLoading(true);

            let data = { loId: row.original._id, mode: 'close', currentDate: currentDate, currentTime: currentTime, transactionType: row.original.transactionType };

            const response = await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/update-group-transaction-status', data);
            if (response.success) {
                toast.success(`Selected loan officer groups are now closed!`);
                window.location.reload();
            } else if (response.error) {
                toast.error(response.message);
            } else {
                toast.error('Error updating group summary.');
            }

            setLoading(false);
        } else if (row.original.hasOwnProperty("allNew")) {
            toast.error("All transactions are current releases no need to changed the group's status.");
        } else {
            toast.error('No transaction detected for this Loan Officer!');
        }
    }

    const [rowActionButtons, setRowActionButtons] = useState();

    useEffect(() => {
        const getListUser = async () => {
            let url = getApiBaseUrl() + 'users/list?' + new URLSearchParams({ loOnly: true, branchCode: currentBranch.code, selectedLoGroup: selectedLoGroup });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push({
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    });
                });
                userList.sort((a, b) => { return a.loNo - b.loNo; });
                setSelectedLOIds(userList.map(lo => lo._id));
                dispatch(setUserList(userList));
            } else {
                toast.error('Error retrieving user list.');
            }
        }

        if (currentBranch && selectedLoGroup) {
            getListUser();
        }
    }, [selectedLoGroup, currentBranch]);

    useEffect(() => {
        let mounted = true;

        if (currentUser.role.rep === 3) {
            mounted && setRowActionButtons([
                { label: 'Close', action: handleClose},
                { label: 'Open', action: handleOpen}
            ]);
        }

        if (selectedLOIds.length > 0) {
            if (dateFilter) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getGroupCashCollections(date);
                } else {
                    mounted && getGroupCashCollections();
                }
            } else {
                mounted && getGroupCashCollections();
            }
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter, selectedLOIds]);

    const columns = useMemo(() => [
        {
            Header: "Loan Officer",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes',
            width: 'w-2/6'
        },
        {
            Header: "Type",
            accessor: 'transactionType',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Active Clients",
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
            Header: "CSF",
            accessor: 'csfStr',
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
            Header: "Active Borrowers",
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
            Header: "CSF Collection",
            accessor: 'csfCollectionStr',
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
            Header: "Admission Fee",
            accessor: 'admissionCollectionStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "LRF",
            accessor: 'lrfCollectionStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "C.B.H.B Collection",
            accessor: 'cbhbCollectionStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Other Income",
            accessor: 'otherIncomeStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "MCBU Withdrawal",
            accessor: 'mcbuWithdrawalStr',
        },
        {
            Header: "CSF Withdrawal",
            accessor: 'csfWithdrawalStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "MCBU Interest",
            accessor: 'mcbuInterestStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
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
            Header: "CSF Return Amount",
            accessor: 'csfReturnAmtStr',
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
            Header: "Total Net Collection",
            accessor: 'totalNetCollectionStr',
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
            accessor: 'transferStr'
        }
    ]);

    return (
        <React.Fragment>
            {loading ? (
                <Spinner />
            ) : (
                <TableComponent 
                    columns={columns} 
                    data={userLOList} 
                    showPagination={false} 
                    showFilters={false} 
                    hasActionButtons={true} 
                    rowActionButtons={rowActionButtons} 
                    rowClick={handleRowClick} 
                />
            )}
        </React.Fragment>
    );
}

export default ViewByLoanOfficerPage;