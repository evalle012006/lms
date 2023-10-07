import Layout from '@/components/Layout';
import RadioButton from '@/lib/ui/radio-button';
import React, { useEffect } from 'react';
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from "react-toastify";
import moment from 'moment';
import Select from 'react-select';
import { DropdownIndicator, borderStyles, borderStylesDynamic } from "@/styles/select";
import { UppercaseFirstLetter, getLastWeekdayOfTheMonth, formatPricePhp, getMonths, getYears, getDaysOfMonth } from '@/lib/utils';
import DatePicker from '@/lib/ui/DatePicker';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import Spinner from '@/components/Spinner';
import { setBranchList } from '@/redux/actions/branchActions';
import TableComponent, { SelectColumnFilter } from '@/lib/table';
import { LOR_DAILY_REMARKS, LOR_WEEKLY_REMARKS } from '@/lib/constants';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { setUserList } from '@/redux/actions/userActions';
import { setGroupList } from '@/redux/actions/groupActions';

const TransactionRemarksPage = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const holidayList = useSelector(state => state.holidays.list);
    const currentUser = useSelector(state => state.user.data);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const lastDate = useSelector(state => state.systemSettings.lastDay);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const [list, setList] = useState([]);
    const [dateFilterBy, setDateFilterBy] = useState('monthly');
    const [occurence, setOccurence] = useState('daily');
    const months = getMonths();
    const years = getYears();
    const [showCalendar, setShowCalendar] = useState(false);
    const [selectedFilterBranch, setSelectedFilterBranch] = useState();
    const [selectedFilterUser, setSelectedFilterUser] = useState();
    const [selectedFilterGroup, setSelectedFilterGroup] = useState();
    const [selectedLastDate, setSelectedLastDate] = useState(lastDate);
    const [selectedDateFilter, setSelectedDateFilter] = useState();
    const [selectedFilterMonth, setSelectedFilterMonth] = useState();
    const [selectedFilterYear, setSelectedFilterYear] = useState();
    const [remarksList, setRemarksList] = useState(LOR_DAILY_REMARKS);
    const [selectedFilterRemarks, setSelectedFilterRemarks] = useState();

    const handleMonthChange = (selected) => {
        setSelectedFilterMonth(selected.value);
    }

    const handleYearChange = (selected) => {
        setSelectedFilterYear(parseInt(selected.value));
    }

    const handleBranchChange = (selected) => {
        setSelectedFilterBranch(selected.value);
        getListUser(selected.code);
    }

    const handleUserChange = (selected) => {
        setSelectedFilterUser(selected.value);
        getListGroup(selected.value);
        setOccurence(selected.transactionType);

        if (occurence !== selected.transactionType) {
            setSelectedFilterRemarks(null);
        }
    }

    const handleGroupChange = (selected) => {
        setSelectedFilterGroup(selected.value);
    }

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleDateFilter = (selected) => {
        const filteredDate = selected.target.value;
        setSelectedDateFilter(filteredDate);
    }

    const handleRemarksChange = (selected) => {
        setSelectedFilterRemarks(selected.value);
    }

    const defaultColumns = [
        {
            Header: "Group",
            accessor: 'groupName'
        },
        {
            Header: "Slot #",
            accessor: 'slotNo'
        },
        {
            Header: "Name",
            accessor: 'name'
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        }
    ];

    const [columns, setColumns] = useState([]);

    const setApplyFilter = async () => {
        if (selectedFilterRemarks) {
            setList([]);
            let url = process.env.NEXT_PUBLIC_API_URL + 'reports/remarks?';

            if (dateFilterBy === 'date') {
                url = url + new URLSearchParams({ remarks: selectedFilterRemarks, occurence: occurence, date: selectedDateFilter, branchId: selectedFilterBranch, loId: selectedFilterUser, groupId: selectedFilterGroup });

                const response = await fetchWrapper.get(url);
                if (response.success) {
                    parseData(response.data);
                }
            } else {
                const startDate = `${selectedFilterYear}-${selectedFilterMonth}-01`;
                const endDate = selectedLastDate;
                url = url + new URLSearchParams({ remarks: selectedFilterRemarks, occurence: occurence, startDate: startDate, endDate: endDate, branchId: selectedFilterBranch, loId: selectedFilterUser, groupId: selectedFilterGroup });

                const response = await fetchWrapper.get(url);
                if (response.success) {
                    parseData(response.data);
                }
            }
        }
    }

    const parseData = (responseData) => {
        const result = [];

        responseData.map(data => {
            let amountRelease = data.amountRelease;
            let loanBalance = data.loan[0].loanBalance;

            if (data.status === 'completed' || data.status === 'closed' || data.status === 'tomorrow') {
                amountRelease = data?.history?.amountRelease;
            }

            let temp = {
                _id: data._id,
                groupName: data.group.length > 0 ? data.group[0].name : '',
                slotNo: data.slotNo,
                name: data.client.length > 0 ? data.client[0].firstName + ' ' + data.client[0].lastName : '',
                amountReleaseStr: formatPricePhp(amountRelease),
                loanBalanceStr: formatPricePhp(loanBalance)
            };

            if (data.remarks && (data?.remarks?.value == 'advance payment' || data?.remarks?.value == 'excused advance payment') ) {
                temp = {
                    ...temp,
                    excess: data.excess,
                    excessStr: formatPricePhp(data.excess),
                    advanceDays: data.advanceDays
                }
            } else if (data.remarks && (data?.remarks?.value == 'reloaner-cont') || data?.remarks?.value == 'reloaner') {
                temp = {
                    ...temp,
                    mcbu: data.mcbu,
                    mcbuStr: formatPricePhp(data.mcbu)
                }
            } else if (data.remarks && data?.remarks?.value == 'reloaner-wd') {
                temp = {
                    ...temp,
                    mcbuWithdrawal: data.mcbuWithdrawal,
                    mcbuWithdrawalStr: formatPricePhp(data.mcbuWithdrawal)
                }
            } else if (data.remarks && (data?.remarks?.value == 'offset-good' || data?.remarks?.value == 'offset-delinquent')) {
                temp = {
                    ...temp,
                    mcbuReturnAmt: data.mcbuReturnAmt,
                    mcbuReturnAmtStr: formatPricePhp(data.mcbuReturnAmt)
                }
            } else if (data.remarks && (data?.remarks?.value == 'past due' || data?.remarks?.value == 'past due collection')) {
                const netLoanBalance = (data.loan.loanBalance - data.mcbu);
                const pastDueCollection = (data.paymentCollection - data.activeLoan);
                temp = {
                    ...temp,
                    mcbu: data.loan.mcbu,
                    mcbuStr: formatPricePhp(data.loan.mcbu),
                    pastDue: data.pastDue,
                    pastDueStr: formatPricePhp(data.pastDue),
                    netLoanBalance: netLoanBalance,
                    netLoanBalanceStr: formatPricePhp(netLoanBalance),
                    pastDueCollection: pastDueCollection,
                    pastDueCollectionStr: formatPricePhp(pastDueCollection),
                    noPastDue: data.loan.noPastDue,
                    totalMispayment: data.loan.mispayment
                }
            } else if (data.remarks && (data?.remarks?.value == 'delinquent' || data?.remarks?.value == 'delinquent-offset' 
                            || data?.remarks?.value == 'excused-calamity' || data?.remarks?.value == 'excused-hospital' || data?.remarks?.value == 'excused-death')) {
                const netLoanBalance = (data.loan.loanBalance - data.mcbu);
                temp = {
                    ...temp,
                    mcbu: data.loan.mcbu,
                    mcbuStr: formatPricePhp(data.loan.mcbu),
                    totalMispayment: data.loan.mispayment,
                    netLoanBalance: netLoanBalance,
                    netLoanBalanceStr: formatPricePhp(netLoanBalance)
                }
            } else if (data.remarks && data?.remarks?.value == 'offset-unclaimed') {
                const unclaimedMcbu = data?.mcbuReturnAmt - data?.history?.loanBalance;
                temp = {
                    ...temp,
                    dateOfOffset: data.fullPaymentDate,
                    unclaimedMcbu: unclaimedMcbu,
                    unclaimedMcbuStr: formatPricePhp(unclaimedMcbu)
                }
            }

            result.push(temp);
        });

        setList(result);
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        const branches = [];
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });
                
                dispatch(setBranchList(branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });
                
                dispatch(setBranchList(branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                response.branches.map(branch => {
                    branches.push({
                        ...branch,
                        value: branch._id,
                        label: branch.name
                    });
                });

                dispatch(setBranchList(branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListUser = async (branchCode) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list?' + new URLSearchParams({ branchCode: branchCode });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let userList = [];
            response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                const name = `${u.firstName} ${u.lastName}`;
                userList.push(
                    {
                        ...u,
                        name: name,
                        label: name,
                        value: u._id
                    }
                );
            });
            userList.sort((a, b) => { return a.loNo - b.loNo; });

            if (currentUser.role.rep === 4) {
                const name = `${currentUser.firstName} ${currentUser.lastName}`;
                userList = [];
                userList.push({
                    ...currentUser,
                    name: name,
                    label: name,
                    value: currentUser._id
                });
            }

            dispatch(setUserList(userList));

            if (currentUser.role.rep === 4) {
                setSelectedFilterUser(currentUser._id);
            }
        } else {
            toast.error('Error retrieving user list.');
        }
    }

    const getListGroup = async (selectedLO) => {
        if (selectedFilterBranch) {
            let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ branchId: selectedFilterBranch, occurence: occurence, loId: selectedLO });

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
                dispatch(setGroupList(groups));
            } else if (response.error) {
                toast.error(response.message);
            }
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return (() => {
            mounted = false;
        });
    }, []);

    useEffect(() => {
        if (currentDate) {
            const dateArr = currentDate.split('-');
            setSelectedFilterMonth(dateArr[1]);
            setSelectedFilterYear(parseInt(dateArr[0]));
        }
    }, [currentDate]);

    useEffect(() => {
        if (selectedFilterMonth && selectedFilterYear) {
            const days = getDaysOfMonth(selectedFilterYear, selectedFilterMonth);
            const dateArr = days.filter(day => {
                const dayName = moment(day).format('dddd');
        
                const dateArr = day.split('-');
                const dateStr = dateArr[1] + "-" + dateArr[2];
                if (dayName !== 'Saturday' && dayName !== 'Sunday' && (holidayList && !holidayList.includes(dateStr))) {
                    return day;
                }
            });

            setSelectedLastDate(dateArr[dateArr.length - 1]);
        }
    }, [selectedFilterMonth, selectedFilterYear]);

    useEffect(() => {
        let remarksList = [{ label: 'Pending', value: 'pending' }];
        remarksList.push.apply(remarksList, occurence === 'daily' ? LOR_DAILY_REMARKS : LOR_WEEKLY_REMARKS);
        remarksList = remarksList.filter(rm => rm.label !== 'Remarks');
        setRemarksList(remarksList);
    }, [occurence]);

    useEffect(() => {
        const updateCols = [...defaultColumns];
        switch(selectedFilterRemarks) {
            case 'advance payment': case 'excused advance payment':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "Advanced Payment",
                        accessor: 'excessStr'
                    }
                ]);
                break;
            case 'reloaner-cont': case 'reloaner':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU",
                        accessor: 'mcbuStr'
                    }
                ]);
                break;
            case 'reloaner-wd':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU Refund Amount",
                        accessor: 'mcbuWithdrawalStr'
                    }
                ]);
                break;
            case 'offset-good': case 'offset-delinquent':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU Return Amount",
                        accessor: 'mcbuReturnAmtStr'
                    }
                ]);
                break;
            case 'offset-unclaimed':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "Date of Offset",
                        accessor: 'dateOfOffset'
                    },
                    {
                        Header: "Unclaimed Amount",
                        accessor: 'unclaimedMcbuStr'
                    }
                ]);
                break;
            case 'past due':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU",
                        accessor: 'mcbuStr'
                    }, 
                    {
                        Header: "Past Due",
                        accessor: 'pastDueStr'
                    },
                    {
                        Header: "# of Mispay",
                        accessor: 'totalMispayment'
                    },
                    {
                        Header: "Net Loan Balance",
                        accessor: 'netLoanBalanceStr'
                    }
                ]);
                break;
            case 'past due collection':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU",
                        accessor: 'mcbuStr'
                    }, 
                    {
                        Header: "Past Due",
                        accessor: 'pastDueStr'
                    },
                    {
                        Header: "Past Due Collection",
                        accessor: 'pastDueCollectionStr'
                    },
                    {
                        Header: "Net Loan Balance",
                        accessor: 'netLoanBalanceStr'
                    }
                ]);
                break;
            case 'delinquent': case 'delinquent-offset': case 'excused-calamity': case 'excused-hospital': case 'excused-death':
                updateCols.push.apply(updateCols, [
                    {
                        Header: "MCBU",
                        accessor: 'mcbuStr'
                    },
                    {
                        Header: "# of Mispayment",
                        accessor: 'totalMispayment'
                    },
                    {
                        Header: "Net Loan Balance",
                        accessor: 'netLoanBalanceStr'
                    }
                ]);
                break;
            default:
                break;
        }

        setColumns(updateCols);
    }, [selectedFilterRemarks]);

    useEffect(() => {
        if (currentUser.role.rep === 3 || currentUser.role.rep === 4 && branchList.length > 0) {
            setSelectedFilterBranch(branchList[0]?.value);
            getListUser(branchList[0]?.code);
        }

        if (currentUser.role.rep === 4) {
            setOccurence(currentUser.transactionType);
        }
    }, [currentUser, branchList]);

    return (
        <Layout>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <div className='flex flex-col mt-2 p-4'>
                    <div className='bg-white rounded-lg p-4 flex flex-col'>
                        <div className='flex flex-row justify-between'>
                            <div className='flex flex-row mb-4'>
                                <div className='flex flex-row'>
                                    <span className='text-zinc-400 mr-4'>Type of Remarks:</span>
                                    <Select 
                                        options={remarksList}
                                        value={remarksList && remarksList.find(remark => { return remark.value === selectedFilterRemarks } )}
                                        styles={borderStyles}
                                        components={{ DropdownIndicator }}
                                        onChange={handleRemarksChange}
                                        isSearchable={true}
                                        closeMenuOnSelect={true}
                                        placeholder={'Remarks Filter'}/>
                                </div>
                                {currentUser.role.rep !== 4 && (
                                    <div className='flex flex-row ml-4'>
                                        <span className='text-zinc-400'>Occurence:</span>
                                        <div className="flex flex-row ml-4 -mt-2 mb-2">
                                            <RadioButton id={"radio_daily"} name="radio-occurence" label={"Daily"} checked={occurence === 'daily'} value="daily" onChange={() => setOccurence('daily')} />
                                            <RadioButton id={"radio_weekly"} name="radio-occurence" label={"Weekly"} checked={occurence === 'weekly'} value="weekly" onChange={() => setOccurence('weekly')} />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className='mr-8'>
                                <ButtonSolid label="Apply Filter" onClick={setApplyFilter} />
                            </div>
                        </div>
                        <div className='flex flex-row'>
                            <div className='flex flex-row'>
                                <span className='text-zinc-300'>Date:</span>
                                <div className='flex flex-col'>
                                    <div className="flex flex-row ml-4 -mt-2 mb-2">
                                        <RadioButton id={"radio_monthly"} name="radio-date-filter" label={"By Monthly"} checked={dateFilterBy === 'monthly'} value="monthly" onChange={() => setDateFilterBy('monthly')} />
                                        <RadioButton id={"radio_day"} name="radio-date-filter" label={"By Date"} checked={dateFilterBy === 'date'} value="date" onChange={() => setDateFilterBy('date')} />
                                    </div>
                                    {dateFilterBy === 'monthly' ? (
                                        <div className='flex flex-row'>
                                            <div className='mr-4'>
                                            <Select
                                                options={months}
                                                value={months && months.find(month => { return month.value === selectedFilterMonth } )}
                                                styles={borderStylesDynamic}
                                                components={{ DropdownIndicator }}
                                                onChange={handleMonthChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Month Filter'}/>
                                            </div>
                                            <Select 
                                                options={years}
                                                value={years && years.find(year => { return year.value === selectedFilterYear } )}
                                                styles={borderStylesDynamic}
                                                components={{ DropdownIndicator }}
                                                onChange={handleYearChange}
                                                isSearchable={true}
                                                closeMenuOnSelect={true}
                                                placeholder={'Year Filter'}/>
                                        </div>
                                    ) : (
                                        <React.Fragment>
                                            <div className="ml-6 flex w-44">
                                                <div className="relative w-full" onClick={openCalendar}>
                                                    <DatePicker name="dateFilter" value={moment(selectedDateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    )}
                                </div>
                            </div>
                            <div className='flex flex-col ml-4'>
                                <span className='text-zinc-400 mb-1'>Branch:</span>
                                <Select 
                                    options={branchList}
                                    value={branchList && branchList.find(branch => { return branch.value === selectedFilterBranch } )}
                                    styles={borderStyles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleBranchChange}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'Branch Filter'}/>
                            </div>
                            <div className='flex flex-col ml-4'>
                                <span className='text-zinc-400 mb-1'>Loan Officer:</span>
                                <Select 
                                    options={userList}
                                    value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                    styles={borderStyles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleUserChange}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'LO Filter'}/>
                            </div>
                            <div className='flex flex-col ml-4'>
                                <span className='text-zinc-400 mb-1'>Group:</span>
                                <Select 
                                    options={groupList}
                                    value={groupList && groupList.find(group => { return group.value === selectedFilterGroup } )}
                                    styles={borderStyles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleGroupChange}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'Group Filter'}/>
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-col my-6 rounded-lg bg-white p-4 min-h-screen'>
                        <TableComponent columns={columns} data={list} showPagination={false} showFilters={false} hasActionButtons={false} />
                    </div>
                </div>   
            )}
        </Layout>
    )
}

export default TransactionRemarksPage;