import React, { useEffect, useState } from "react";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import { UppercaseFirstLetter } from "@/lib/utils";
import moment from 'moment';
import { setCashCollectionList, setGroupSummaryTotals, setLoSummary } from "@/redux/actions/cashCollectionActions";
import TableComponent, { SelectColumnFilter, StatusPill } from "@/lib/table";
import { BehaviorSubject } from 'rxjs';
import { setGroupList } from "@/redux/actions/groupActions";
import { getApiBaseUrl } from "@/lib/constants";
import { useMemo } from "react";

const ViewCashCollectionPage = ({ pageNo, dateFilter, type }) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const selectedLOSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedLO'));
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const cashCollectionList = useSelector(state => state.cashCollection.main);
    const [loading, setLoading] = useState(true);
    const dayName = moment(dateFilter ? dateFilter : currentDate).format('dddd').toLowerCase();
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const [selectedGroupIds, setSelectedGroupIds] = useState([]);

    const getCashCollections = async (dateFilter) => {
        setLoading(true);
        const filter = dateFilter ? true : false;
        let url = getApiBaseUrl() + 
            'transactions/cash-collections/get-all-loans-per-group-v2?' 
            + new URLSearchParams({ 
                    date: dateFilter ? dateFilter : currentDate,
                    mode: type, 
                    groupIds: JSON.stringify(selectedGroupIds),
                    dayName: dayName,
                    currentDate: currentDate
                });

        try {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const processedData = response.data;
                
                // Find totals in the processed data
                const totalsRow = processedData.find(row => row.group === 'GRAND TOTALS');
                if (totalsRow) {
                    dispatch(setGroupSummaryTotals(totalsRow));
                }

                // Find LOS summary if available
                const losSummary = processedData.find(row => row.losType === 'daily');
                if (losSummary) {
                    dispatch(setLoSummary(losSummary));
                }

                // Set the cash collection list
                dispatch(setCashCollectionList(processedData));
                
                setLoading(false);
            } else {
                setLoading(false);
                toast.error('Error retrieving cash collections data.');
            }
        } catch (error) {
            setLoading(false);
            console.error('Error fetching cash collections:', error);
            toast.error('Error retrieving cash collections data.');
        }
    }

    const handleRowClick = (selected) => {
        if (!selected.totalData) {
            if (pageNo === 1) {
                router.push(`./${type}-cash-collection/client/${selected.groupId}`);
            } else if (pageNo === 2) {
                router.push(`/transactions/${type}-cash-collection/client/${selected.groupId}`);
            }
            
            localStorage.setItem('cashCollectionDateFilter', dateFilter);
        } else {
            if (selected.group !== 'TOTALS') {
                toast.error('No loans on this group yet.')
            }
        }
    };

    const columns = useMemo(() => [
        {
            Header: "Group",
            accessor: 'group',
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
            accessor: 'collectionStr',
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
            Filter: SelectColumnFilter,
            filter: 'includes'
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
            Header: "MCBU Return Person",
            accessor: 'noMcbuReturn',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "MCBU Return Amount",
            accessor: 'mcbuReturnAmtStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        // {
        //     Header: "CSF Return Amount",
        //     accessor: 'csfReturnAmtStr',
        //     Filter: SelectColumnFilter,
        //     filter: 'includes'
        // },
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
            accessor: 'mispayment',
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
        },
        {
            Header: "Save Status",
            accessor: 'status',
            Cell: StatusPill,
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    useEffect(() => {
        const getListGroup = async (loId) => {
            let url = getApiBaseUrl() + 'groups/list-by-group-occurence?' + new URLSearchParams({ mode: "filter", occurence: type, loId: loId });

            const response = await fetchWrapper.get(url);
            if (response.success) {
                let groups = [];
                await response.groups && response.groups.map(group => {
                    groups.push({
                        ...group,
                        day: UppercaseFirstLetter(group.day),
                        value: group._id,
                        label: group.name
                    });
                });
                setSelectedGroupIds(groups.map(group => group._id));
                dispatch(setGroupList(groups));
            } else if (response.error) {
                toast.error(response.message);
            }
        }

        if (type) {
            if (currentUser.role.rep == 4) {
                getListGroup(currentUser._id);
            } else if (selectedLOSubject.value && selectedLOSubject.value.length > 0) {
                getListGroup(selectedLOSubject.value);
            }
        }
    }, [type]);

    useEffect(() => {
        let mounted = true;
        localStorage.removeItem('cashCollectionDateFilter');
        
        if (selectedGroupIds.length > 0) {
            if (dateFilter) {
                const date = moment(dateFilter).format('YYYY-MM-DD');
                if (date !== currentDate) {
                    mounted && getCashCollections(date);
                } else {
                    mounted && getCashCollections();
                }
            } else {
                getCashCollections();
            }
        }

        return () => {
            mounted = false;
        };
    }, [dateFilter, selectedGroupIds]);

    useEffect(() => {
        if (type === 'weekly' && !isHoliday && !isWeekend && currentDate) {
            const preSaveCollections = async () => {
                const data = {
                    loId: currentUser.role.rep === 4 ? currentUser._id : selectedLOSubject.value.length > 0 && selectedLOSubject.value,
                    currentDate: currentDate,
                    currentUser: currentUser._id
                };
    
                await fetchWrapper.post(getApiBaseUrl() + 'transactions/cash-collections/pre-save-collections', data);
            }

            setTimeout(() => {
                preSaveCollections();
            }, 1000);
        }
    }, [type, isHoliday, isWeekend, currentDate]);

    return (
        <React.Fragment>
            {loading ? (
                <Spinner />
            ) : (
                <TableComponent 
                    columns={columns} 
                    data={cashCollectionList} 
                    showPagination={false} 
                    showFilters={false} 
                    hasActionButtons={false} 
                    rowClick={handleRowClick} 
                />
            )}
        </React.Fragment>
    );
}

export default ViewCashCollectionPage;