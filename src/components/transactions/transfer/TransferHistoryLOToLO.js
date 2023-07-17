import React, { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import Select from 'react-select';
import { DropdownIndicator, borderStyles } from "@/styles/select";
import { formatPricePhp, getLastWeekdayOfTheMonth, getMonths, getYears } from "@/lib/utils";
import moment from 'moment';
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { setUserList } from "@/redux/actions/userActions";
import { setTransferHistoryBranchToBranch, setTransferHistoryLOToLO } from "@/redux/actions/transferActions";
import { TabSelector } from "@/lib/ui/tabSelector";
import { TabPanel, useTabs } from "node_modules/react-headless-tabs/dist/react-headless-tabs";

const TransferHistoryTable = ({ list = [], totals }) => {
    return (
        <div className="flex flex-col min-h-[50rem] mt-10 pl-6 pr-2 overflow-y-auto">
            <div className="block rounded-xl overflow-auto border border-gray-300">
                <table className="relative w-full table-auto border-collapse text-sm bg-white">
                    <thead className="">
                        <tr>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-l-0 border-t-0  px-2 py-2 text-gray-500 uppercase">LO #</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Name of LO (Giver)</th>
                            <th rowSpan={2} className="sticky top-0 bg-white  border border-gray-300 border-t-0 px-2 py-2 text-gray-500 uppercase">Name of LO (Receiver)</th>
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
                        {list.map((transfer, index) => {
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
                        <tr className="font-bold">
                            <td colSpan={3} className="px-2 py-4 text-center border border-gray-300 border-l-0">TOTALS</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.activeClients }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.mcbuStr }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.activeBorrowers }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.activeLoanBalanceStr }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.actualCollectionStr }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.loanBalanceStr }</td>
                            <td className="px-2 py-4 text-center border border-gray-300">{ totals?.noPastDue }</td>
                            <td className="px-2 py-4 text-center border border-gray-300 border-r-0">{ totals?.pastDueStr }</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const TransferHistoryDetails = ({ type }) => {
    const [loading, setLoading] = useState(false);
    const dispatch = useDispatch();
    const holidayList = useSelector(state => state.holidays.list);
    const currentDate = useSelector(state => state.systemSettings.currentDate);
    const lastDate = useSelector(state => state.systemSettings.lastDay);
    const userList = useSelector(state => state.user.list);
    const months = getMonths();
    const years = getYears();
    const branchList = useSelector(state => state.branch.list);
    const [selectedLastDate, setSelectedLastDate] = useState(lastDate);

    const [selectedFilterBranch, setSelectedFilterBranch] = useState();
    const [selectedFilterUser, setSelectedFilterUser] = useState();
    const [selectedFilterMonth, setSelectedFilterMonth] = useState();
    const [selectedFilterYear, setSelectedFilterYear] = useState();

    const [giverList, setGiverList] = useState();
    const [receiverList, setReceiverList] = useState();
    const [consolidatedList, setConsolidatedList] = useState();

    const [selectedTab, setSelectedTab] = useTabs([
        'giver',
        'receiver',
        'consolidated'
    ]);

    const [giverTotal, setGiverTotal] = useState();
    const [receiverTotal, setReceiverTotal] = useState();
    const [consolidatedTotal, setConsolidatedTotal] = useState();
    
    const getLastDateOfTheMonth = (month, year) => {
        const holidays = holidayList.map(h => {
            return h.date;
        });

        return getLastWeekdayOfTheMonth(year, month, holidays);
    }

    const handleMonthChange = (selected) => {
        setSelectedFilterMonth(selected.value);
        setSelectedLastDate(getLastDateOfTheMonth(selected.value, selectedFilterYear));
    }

    const handleYearChange = (selected) => {
        setSelectedFilterYear(parseInt(selected.value));
        setSelectedLastDate(getLastDateOfTheMonth(selectedFilterMonth, parseInt(selected.value)));
    }

    const handleBranchChange = (selected) => {
        setSelectedFilterBranch(selected.value);
    }

    // const handleUserChange = (selected) => {
    //     setSelectedFilterUser(selected.value);
    // }

    const getHistory = async () => {
        setLoading(true);
        const startDate = `${selectedFilterYear}-${selectedFilterMonth}-01`;
        const endDate = selectedLastDate;

        const url = process.env.NEXT_PUBLIC_API_URL 
                    + 'transactions/transfer-client/list-history-lo-lo?' 
                    + new URLSearchParams({ branchId: selectedFilterBranch, startDate: startDate, endDate: endDate, occurence: type });
        const response = await fetchWrapper.get(url);

        if (response.success) {
            const responseData = response.data;
            let giverData = [];
            let receiverData = [];
            let consolidatedData = [];

            responseData.map(transfer => {
                transfer.giverDetails.map(giverDetail => {
                    const giverName = `${transfer.firstName} ${transfer.lastName}`;
                    const receiverName = `${giverDetail.receiver[0].firstName} ${giverDetail.receiver[0].lastName}`;
                    const id = `${transfer._id}-${giverDetail.receiver[0]._id}`;
                    let details = giverDetail.details.length > 0 && giverDetail.details[0];
                    
                    const exist = giverData.find(gd => gd.id === id);
                    if (exist) {
                        const index = giverData.indexOf(exist);
                        giverData[index] = mergeData(exist, details);
                    } else {
                        giverData.push({
                            id: id,
                            ctr: transfer.loNo,
                            giverName: giverName,
                            receiverName: receiverName,
                            activeClients: -Math.abs(details?.activeClients),
                            mcbu: -Math.abs(details?.mcbu),
                            mcbuStr: formatPricePhp(-Math.abs(details?.mcbu)),
                            activeBorrowers: -Math.abs(details?.activeClients),
                            activeLoanBalance: -Math.abs(details?.activeLoanBalance),
                            activeLoanBalanceStr: formatPricePhp(-Math.abs(details?.activeLoanBalance)),
                            actualCollection: -Math.abs(details?.actualCollection),
                            actualCollectionStr: formatPricePhp(-Math.abs(details?.actualCollection)),
                            loanBalance: -Math.abs(details?.loanBalance),
                            loanBalanceStr: formatPricePhp(-Math.abs(details?.loanBalance)),
                            noPastDue: details?.noPastDue,
                            pastDue: -Math.abs(details?.pastDue),
                            pastDueStr: formatPricePhp(-Math.abs(details?.pastDue))
                        });
                    }
                });

                transfer.receiverDetails.map(receiverDetail => {
                    const receiverName = `${transfer.firstName} ${transfer.lastName}`;
                    const giverName = `${receiverDetail.giver[0].firstName} ${receiverDetail.giver[0].lastName}`;
                    const id = `${receiverDetail.giver[0]._id}-${transfer._id}`;
                    let details = receiverDetail.details.length > 0 && receiverDetail.details[0];

                    const exist = receiverData.find(gd => gd.id === id);
                    if (exist) {
                        const index = receiverData.indexOf(exist);
                        receiverData[index] = mergeData(exist, details);
                    } else {
                        console.log(receiverDetail)
                        // not merged giver to receiver
                        // check id
                        receiverData.push({
                            id: id,
                            ctr: receiverDetail.giver[0].loNo,
                            giverName: giverName,
                            receiverName: receiverName,
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
                    }
                });

                if (transfer.giverDetails.length === 0) {
                    giverData.push({
                        ctr: transfer.loNo,
                        giverName: `${transfer.firstName} ${transfer.lastName}`,
                        receiverName: '-',
                        activeClients: 0,
                        mcbu: 0,
                        mcbuStr: '-',
                        activeBorrowers: 0,
                        activeLoanBalance: 0,
                        activeLoanBalanceStr: '-',
                        actualCollection: 0,
                        actualCollectionStr: '-',
                        loanBalance: 0,
                        loanBalanceStr: '-',
                        noPastDue: 0,
                        pastDue: 0,
                        pastDueStr: '-'
                    });
                }

                if (transfer.receiverDetails.length === 0) {
                    receiverData.push({
                        ctr: transfer.loNo,
                        giverName: `${transfer.firstName} ${transfer.lastName}`,
                        receiverName: '-',
                        activeClients: 0,
                        mcbu: 0,
                        mcbuStr: '-',
                        activeBorrowers: 0,
                        activeLoanBalance: 0,
                        activeLoanBalanceStr: '-',
                        actualCollection: 0,
                        actualCollectionStr: '-',
                        loanBalance: 0,
                        loanBalanceStr: '-',
                        noPastDue: 0,
                        pastDue: 0,
                        pastDueStr: '-'
                    });
                }
            });

            giverData.sort((a,b) => { return a.ctr - b.ctr; });
            receiverData.sort((a,b) => { return a.ctr - b.ctr; });

            setGiverList(giverData);
            setGiverTotal(getTotals(giverData));

            setReceiverList(receiverData);
            setReceiverTotal(getTotals(receiverData));

            consolidatedData = getConsolidatedData(giverData, receiverData);
            console.log(giverData, consolidatedData)
            setConsolidatedList(consolidatedData);
            setConsolidatedTotal(getTotals(consolidatedData));
        }
        setLoading(false);
    }

    const getConsolidatedData = (giverDetails, receiverDetails) => {
        let consolidatedData = [];
        
        if (giverDetails.length > 0) {
            consolidatedData = [...giverDetails];
        }

        if (receiverDetails.length > 0) {
            receiverDetails.map(receiver => {
                const exist = consolidatedData.find(c => c.id === receiver.id);

                if (exist) {
                    const index = consolidatedData.indexOf(exist);
                    consolidatedData[index] = mergeData(exist, receiver);
                } else {
                    consolidatedData.push(receiver);
                }
            });
        }

        consolidatedData.sort((a,b) => { return a.ctr - b.ctr; });
        
        return consolidatedData;
    }

    const mergeData = (existingData, data) => {
        let totalActiveClients = existingData.activeClients + data.activeClients;
        let totalMcbu = existingData.mcbu + data.mcbu;
        let totalActiveBorrowers = existingData.activeBorrowers + data.activeClients;
        let totalActiveLoanBalance = existingData.activeLoanBalance + data.activeLoanBalance;
        let totalActualCollection = existingData.actualCollection + data.actualCollection;
        let totalLoanBalance = existingData.loanBalance + data.loanBalance;
        let totalNoPastDue = existingData.noPastDue + data.noPastDue;
        let totalPastDue = existingData.pastDue + data.pastDue;

        return {
            ...existingData,
            activeClients: totalActiveClients,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            activeBorrowers: totalActiveBorrowers,
            activeLoanBalance: totalActiveLoanBalance,
            activeLoanBalanceStr: formatPricePhp(totalActiveLoanBalance),
            actualCollection: totalActualCollection,
            actualCollectionStr: formatPricePhp(totalActualCollection),
            loanBalance: totalLoanBalance,
            loanBalanceStr: formatPricePhp(totalLoanBalance),
            noPastDue: totalNoPastDue,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue)
        }
    }

    const getTotals = (data) => {
        let totalActiveClients = 0;
        let totalMcbu = 0;
        let totalActiveBorrowers = 0;
        let totalActiveLoanBalance = 0;
        let totalActualCollection = 0;
        let totalLoanBalance = 0;
        let totalNoPastDue = 0;
        let totalPastDue = 0;

        data.map(transfer => {
            totalActiveClients += transfer.activeClients;
            totalMcbu += transfer.mcbu;
            totalActiveBorrowers += transfer.activeClients;
            totalActiveLoanBalance += transfer.activeLoanBalance;
            totalActualCollection += transfer.actualCollection;
            totalLoanBalance += transfer.loanBalance;
            totalNoPastDue += transfer.noPastDue;
            totalPastDue += transfer.pastDue;
        });

        return {
            activeClients: totalActiveClients,
            mcbu: totalMcbu,
            mcbuStr: formatPricePhp(totalMcbu),
            activeBorrowers: totalActiveBorrowers,
            activeLoanBalance: totalActiveLoanBalance,
            activeLoanBalanceStr: formatPricePhp(totalActiveLoanBalance),
            actualCollection: totalActualCollection,
            actualCollectionStr: formatPricePhp(totalActualCollection),
            loanBalance: totalLoanBalance,
            loanBalanceStr: formatPricePhp(totalLoanBalance),
            noPastDue: totalNoPastDue,
            pastDue: totalPastDue,
            pastDueStr: formatPricePhp(totalPastDue)
        };
    }

    useEffect(() => {
        if (currentDate) {
            const dateArr = currentDate.split('-');
            setSelectedFilterMonth(dateArr[1]);
            setSelectedFilterYear(parseInt(dateArr[0]));   
        }
    }, [currentDate]);

    useEffect(() => {
        let mounted = true;
        if (mounted && branchList) {
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

        return (() => {
            mounted = false;
        });
    }, [branchList]);

    useEffect(() => {
        if (selectedFilterBranch && selectedFilterMonth && selectedFilterYear && selectedLastDate) {
            
            getHistory();
        }
    }, [selectedFilterBranch, selectedFilterMonth, selectedFilterYear, selectedLastDate]);
    
    return (
        <React.Fragment>
            { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <React.Fragment>
                        <table className="table-fixed">
                            <tbody>
                                <tr className="ml-8">
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
                                    <td className=""></td>
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
                                <td className="text-gray-400 text-sm mt-1 mr-2"></td>
                                    <td>
                                        {/* <Select 
                                            options={userList}
                                            value={userList && userList.find(user => { return user.value === selectedFilterUser } )}
                                            styles={borderStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleUserChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder={'Loan Officer Filter'}/> */}
                                    </td>
                                    <td className="font-bold text-lg w-80">{ type === 'daily' ? 'REGULAR LOAN' : 'OTHER LOAN (WEEKLY)' }</td>
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
                            <nav className="flex pl-10 bg-white border-b border-gray-300">
                                <TabSelector
                                    isActive={selectedTab === "giver"}
                                    onClick={() => setSelectedTab("giver")}>
                                    Giver Details
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "receiver"}
                                    onClick={() => setSelectedTab("receiver")}>
                                    Receiver Details
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "consolidated"}
                                    onClick={() => setSelectedTab("consolidated")}>
                                    Consolidated
                                </TabSelector>
                            </nav>
                            <React.Fragment>
                                <TabPanel hidden={selectedTab !== "giver"}>
                                    <TransferHistoryTable list={giverList} totals={giverTotal} />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "receiver"}>
                                    <TransferHistoryTable list={receiverList} totals={receiverTotal} />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "consolidated"}>
                                    <TransferHistoryTable list={consolidatedList} totals={consolidatedTotal} />
                                </TabPanel>
                            </React.Fragment>
                        </div>
                    </React.Fragment>
            )}
        </React.Fragment>
    )
}

const TransferHistoryLOToLOPage = () => {
    return (
        <div className="flex flex-col bg-white p-4 rounded-2xl w-full mt-8">
            <div className="flex flex-col py-8 mx-4">
                <TransferHistoryDetails type="daily" />
                <div className="border-b border-gray-300" style={{ marginTop: "5rem", marginBottom: "1rem" }}></div>
                <TransferHistoryDetails type="weekly" />
            </div>
        </div>
    )
}

export default TransferHistoryLOToLOPage;