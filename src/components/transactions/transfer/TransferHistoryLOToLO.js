import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import { formatPricePhp, getMonths, getYears } from "@/lib/utils";
import moment from 'moment';
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { setUserList } from "@/redux/actions/userActions";

const TransferTable = ({ data }) => {
    return (
        <div className="flex flex-col min-h-[55rem] mt-10 pl-6 pr-2 overflow-y-auto">
            <div className="block rounded-xl overflow-auto border border-gray-300">
                <table className="relative w-full table-auto border-collapse text-sm bg-white" style={{ marginBottom: "14em" }}>
                    <thead className="">
                        <tr>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-l-0 border-t-0  px-2 py-2 text-gray-500 uppercase">LO #</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Name of LO (Giver)</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Name of LO Transferred To (Receiver)</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase"># Act. Clients Trans.</th> 
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">MCBU Amt</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 text-gray-500 uppercase"># Act. Borrowers</th> 
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Active Loan Balance</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-4 text-gray-500 uppercase">Actual Collection</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 py-4 text-gray-500 uppercase">Loan Balance</th>
                            <th colSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-r-0 border-t-0 px-2 py-2 text-gray-500 uppercase">Past Due Amount</th>
                        </tr>
                        <tr>
                            <th className="sticky top-[0.1rem] bg-white  border border-gray-300 text-gray-500 uppercase"># OF PD CLIENT</th>
                            <th className="sticky top-[0.1rem] bg-white  border border-gray-300 text-gray-500 uppercase">AMOUNT</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {data && data.map((transfer, index) => {
                            return (
                                <tr key={index} className="even:bg-gray-100">
                                    <td className="px-2 py-4 text-center border border-gray-300 border-l-0">{ transfer.ctr }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.giverName }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.receiverName }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.activeClients }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.mcbuStr }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.activeBorrowers }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.activeLoanBalanceStr }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.actualCollectionStr }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.loanBalanceStr }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300">{ transfer.noPastDue }</td>
                                    <td className="px-2 py-4 text-center border border-gray-300 border-r-0">{ transfer.pastDueStr }</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const TransferHistoryDetails = ({ type }) => {
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const [list, setList] = useState();
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const lastDate = useSelector(state => state.systemSettings.lastDay);
    const userList = useSelector(state => state.user.list);
    const months = getMonths();
    const years = getYears();
    const branchList = useSelector(state => state.branch.list);

    const [selectedFilterBranch, setSelectedFilterBranch] = useState();
    const [selectedFilterUser, setSelectedFilterUser] = useState();
    const [selectedFilterMonth, setSelectedFilterMonth] = useState();
    const [selectedFilterYear, setSelectedFilterYear] = useState();

    const handleMonthChange = (selected) => {
        setSelectedFilterMonth(selected.value);
    }

    const handleYearChange = (selected) => {
        setSelectedFilterYear(parseInt(selected.value));
    }

    const handleBranchChange = (selected) => {
        setSelectedFilterBranch(selected.value);
    }

    const handleUserChange = (selected) => {
        setSelectedFilterUser(selected.value);
    }

    const getHistory = async () => {
        setLoading(true);
        const startDate = `${selectedFilterYear}-${selectedFilterMonth}-01`;
        const endDate = lastDate;

        const url = process.env.NEXT_PUBLIC_API_URL 
                    + 'transactions/transfer-client/list-history-lo-lo?' 
                    + new URLSearchParams({ branchId: selectedFilterBranch, startDate: startDate, endDate: endDate, occurence: type });
        const response = await fetchWrapper.get(url);
            
        if (response.success) {
            const responseData = response.data;
            const data = [];
            responseData.map((transfer, idx) => {
                let details = [];
                if (transfer.details.length > 0) {
                    details = transfer.details[0];
                }

                data.push({
                    ctr: idx + 1,
                    giverName: `${transfer?.giver?.firstName} ${transfer?.giver?.lastName}`,
                    receiverName: `${transfer?.receiver?.firstName} ${transfer?.receiver?.lastName}`,
                    activeClients: details?.activeClients,
                    mcbu: details?.mcbu,
                    mcbuStr: formatPricePhp(details?.mcbu),
                    activeBorrowers: details?.activeClients,
                    activeLoanBalance: details?.activeLoanBalance,
                    activeLoanBalanceStr: formatPricePhp(details?.activeLoanBalance),
                    actualCollection: details?.actualCollection,
                    actualCollectionStr: formatPricePhp(details?.actualCollection),
                    loanBalance: details?.loanBalance,
                    loanBalanceStr: formatPricePhp(details?.loanBalance),
                    noPastDue: details?.noPastDue,
                    pastDue: details?.pastDue,
                    pastDueStr: formatPricePhp(details?.pastDue)
                });
            });

            setList(data);
        }
        setLoading(false);
    }

    useEffect(() => {
        if (currentDate) {
            const dateArr = currentDate.split('-');
            setSelectedFilterMonth(dateArr[1]);
            setSelectedFilterYear(parseInt(dateArr[0]));   
        }
    }, [currentDate]);

    useEffect(() => {
        if (branchList) {
            const initBranch = branchList[0];
            setSelectedFilterBranch(initBranch._id);

            const getListUser = async () => {
                let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
                if (branchList.length > 0) {
                    url = url + '?' + new URLSearchParams({ branchCode: initBranch.code });
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
                        dispatch(setUserList(userList));
                    } else {
                        toast.error('Error retrieving user list.');
                    }
                }
            }

            getListUser();
        }
    }, [branchList]);

    useEffect(() => {
        if (selectedFilterBranch && type) {
            getHistory();
        }
    }, [selectedFilterBranch, type]);
    
    return (
        <React.Fragment>
            { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <div className="flex flex-col bg-white p-4 rounded-2xl w-full">
                        <table className="table-auto">
                            <tbody>
                                <tr>
                                    <td className="text-gray-400 text-sm mt-1 mr-2">Branch:</td>
                                    <td>
                                        <Select 
                                            options={branchList}
                                            value={branchList && branchList.find(branch => { return branch.value === selectedFilterBranch } )}
                                            styles={borderStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleBranchChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder={'Branch Filter'}/>
                                    </td>
                                    <td></td>
                                    <td className="text-gray-400 text-sm mt-1 mr-2">Month:</td>
                                    <td>
                                        <Select 
                                            options={months}
                                            value={months && months.find(month => { return month.value === selectedFilterMonth } )}
                                            styles={borderStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleMonthChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder={'Month Filter'}/>
                                    </td>
                                </tr>
                                <tr>
                                <td className="text-gray-400 text-sm mt-1 mr-2">Loan Officer:</td>
                                    <td>
                                        <Select 
                                            options={userList}
                                            value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                            styles={borderStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleUserChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder={'Loan Officer Filter'}/>
                                    </td>
                                    <td className="font-bold">REGULAR LOAN</td>
                                    <td className="text-gray-400 text-sm mt-1 mr-2">Year:</td>
                                    <td>
                                        <Select 
                                            options={years}
                                            value={years && years.find(year => { return year.value === selectedFilterYear } )}
                                            styles={borderStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleYearChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder={'Year Filter'}/>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div>
                            <TransferTable data={list} />
                        </div>
                    </div>
            )}
        </React.Fragment>
    )
}

const TransferHistoryLOToLOPage = () => {
    return (
        <div className="py-8 mx-4">
            <TransferHistoryDetails type="daily" />
        </div>
    )
}

export default TransferHistoryLOToLOPage;