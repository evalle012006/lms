import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { setBranch, setBranchList } from "@/redux/actions/branchActions";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setFilteredLoanList, setLoanList } from "@/redux/actions/loanActions";
import { setGroupList } from "@/redux/actions/groupActions";
import { setClient, setClientList } from "@/redux/actions/clientActions";
import { formatPricePhp, getEndDate, getTotal, UppercaseFirstLetter } from "@/lib/utils";
import AddUpdateLoan from "@/components/transactions/AddUpdateLoanDrawer";
import moment from 'moment';
import { TabPanel, useTabs } from "react-headless-tabs";
import { TabSelector } from "@/lib/ui/tabSelector";
import { setUserList } from "@/redux/actions/userActions";
import Select from 'react-select';
import { DropdownIndicator, borderStyles, borderStylesDynamic } from "@/styles/select";
import Modal from "@/lib/ui/Modal";
import ClientDetailPage from "@/components/clients/ClientDetailPage";

const LoanApplicationPage = () => {
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.loan.list);
    const filteredList = useSelector(state => state.loan.filteredList);
    const branchList = useSelector(state => state.branch.list);
    const userList = useSelector(state => state.user.list);
    const groupList = useSelector(state => state.group.list);
    const clientList = useSelector(state => state.client.list);
    const [data, setData] = useState(list);
    const [loading, setLoading] = useState(true);
    const [isFiltering, setIsFiltering] = useState(false);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [loan, setLoan] = useState();
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showWaningDialog, setShowWarningDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    const [historyList, setHistoryList] = useState([]);
    const [selectedTab, setSelectedTab] = useTabs([
        'application',
        'history'
    ]);

    const [noOfPendingLoans, setNoOfPendingLoans] = useState(0);
    const [totalAmountRelease, setTotalAmountRelease] = useState(0);

    const [selectedFilterBranch, setSelectedFilterBranch] = useState();
    const [selectedFilterUser, setSelectedFilterUser] = useState();
    const [selectedFilterGroup, setSelectedFilterGroup] = useState();
    const [occurence, setOccurence] = useState('daily');

    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState();

    const handleBranchChange = (selected) => {
        setSelectedFilterBranch(selected.value);
        getListUser(selected.code);
        handleFilter('branch', selected.value, data);
    }

    const handleUserChange = (selected) => {
        setSelectedFilterUser(selected.value);
        getListGroup(selected.value, selected.transactionType);
        setOccurence(selected.transactionType);
        handleFilter('user', selected.value, data);
    }

    const handleGroupChange = (selected) => {
        setSelectedFilterGroup(selected.value);
        handleFilter('group', selected.value, list);
    }

    const handleFilter = (field, value, dataArr) => {
        if (value) {
          let searchResult = [];
          if (field === 'branch') {
            searchResult = dataArr.filter(b => b.branchId === value);
          } else if (field === 'user') {
            searchResult = dataArr.filter(b => b.loId === value);
          } else if (field === 'group') {
            searchResult = dataArr.filter(b => b.groupId === value);
          }

          dispatch(setFilteredLoanList(searchResult));
          setIsFiltering(true);
        } else {
          setData(list);
          setIsFiltering(false);
        }
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';

        if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
        }
        
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branches = [];
            response.branches && response.branches.map(branch => {
                branches.push(
                    {
                        ...branch,
                        value: branch._id,
                        label: UppercaseFirstLetter(branch.name)
                    }
                );
            });

            if (branches.length > 0 && (currentUser.role.rep === 3 || currentUser.role.rep === 4)) {
                dispatch(setBranch(branches[0]));
            }
            
            dispatch(setBranchList(branches));
        } else {
            toast.error('Error retrieving branches list.');
        }

        setLoading(false);
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

    const getListGroup = async (selectedUser, selectedOccurence) => {
        const url = process.env.NEXT_PUBLIC_API_URL + 'groups/list-by-group-occurence?' + new URLSearchParams({ loId: selectedUser, occurence: selectedOccurence });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let groups = [];
            await response.groups && response.groups.map(group => {
                groups.push({
                    ...group,
                    value: group._id,
                    label: UppercaseFirstLetter(group.name)
                });
            });

            dispatch(setGroupList(groups));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListLoan = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ status: 'pending', branchId: branchList[0]._id, loId: currentUser._id, mode: currentUser.transactionType, currentDate: currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    let allowApproved = false;

                    if (loan.groupStatus.length > 0) {
                        const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                        if (transactionStatus.length > 0) {
                            allowApproved = true;
                        }
                    } else {
                        allowApproved = true;
                    }

                    loanList.push({
                        ...loan,
                        loanOfficerName: `${loan.loanOfficer.lastName}, ${loan.loanOfficer.firstName}`,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        loanRelease: loan.amountRelease,
                        loanReleaseStr: formatPricePhp(loan.amountRelease),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        allowApproved: allowApproved,
                        selected: false
                    });
                });
                loanList.sort((a, b) => {
                    if (a.pnNumber < b.pnNumber) {
                        return -1;
                    }

                    if (b.pnNumber < b.pnNumber) {
                        return 1;
                    }

                    return 0;
                } );
                dispatch(setLoanList(loanList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ status: 'pending', branchId: branchList[0]._id, currentDate: currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    let allowApproved = false;

                    if (loan.groupStatus.length > 0) {
                        const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                        if (transactionStatus.length > 0) {
                            allowApproved = true;
                        }
                    } else {
                        allowApproved = true;
                    }

                    loanList.push({
                        ...loan,
                        loanOfficerName: `${loan.loanOfficer.lastName}, ${loan.loanOfficer.firstName}`,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        loanRelease: loan.amountRelease,
                        loanReleaseStr: formatPricePhp(loan.amountRelease),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        allowApproved: allowApproved,
                        selected: false
                    });
                });
                loanList.sort((a, b) => {
                    if (a.pnNumber < b.pnNumber) {
                        return -1;
                    }

                    if (b.pnNumber < b.pnNumber) {
                        return 1;
                    }

                    return 0;
                } );
                dispatch(setLoanList(loanList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ status: 'pending', areaManagerId: currentUser._id, currentDate: currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    let allowApproved = false;

                    if (loan.groupStatus.length > 0) {
                        const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                        if (transactionStatus.length > 0) {
                            allowApproved = true;
                        }
                    } else {
                        allowApproved = true;
                    }

                    loanList.push({
                        ...loan,
                        branchName: `${loan.branch[0].code} - ${loan.branch[0].name}`,
                        loanOfficerName: `${loan.loanOfficer.lastName}, ${loan.loanOfficer.firstName}`,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        loanRelease: loan.amountRelease,
                        loanReleaseStr: formatPricePhp(loan.amountRelease),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        allowApproved: allowApproved,
                        selected: false
                    });
                });
                loanList.sort((a, b) => {
                    if (a.pnNumber < b.pnNumber) {
                        return -1;
                    }

                    if (b.pnNumber < b.pnNumber) {
                        return 1;
                    }

                    return 0;
                } );
                dispatch(setLoanList(loanList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ status: 'pending', currentDate: currentDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    let allowApproved = false;

                    if (loan.groupStatus.length > 0) {
                        const transactionStatus = loan.groupStatus[0].groupStatusArr.filter(s => s === "pending");
                        if (transactionStatus.length > 0) {
                            allowApproved = true;
                        }
                    } else {
                        allowApproved = true;
                    }
                    
                    loanList.push({
                        ...loan,
                        branchName: `${loan.branch[0].code} - ${loan.branch[0].name}`,
                        loanOfficerName: `${loan.loanOfficer.lastName}, ${loan.loanOfficer.firstName}`,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        loanRelease: loan.amountRelease,
                        loanReleaseStr: formatPricePhp(loan.amountRelease),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        allowApproved: allowApproved,
                        selected: false
                    });
                });
                loanList.sort((a, b) => {
                    if (a.pnNumber < b.pnNumber) {
                        return -1;
                    }

                    if (b.pnNumber < b.pnNumber) {
                        return 1;
                    }

                    return 0;
                } );
                dispatch(setLoanList(loanList));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getHistoyListLoan = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/list-history';
        if (currentUser.root !== true && currentUser.role.rep === 4 && branchList.length > 0) { 
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id, loId: currentUser._id, mode: occurence });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.root !== true && currentUser.role.rep === 3 && branchList.length > 0) {
            url = url + '?' + new URLSearchParams({ branchId: branchList[0]._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (branchList.length > 0) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let loanList = [];
                await response.loans && response.loans.map(loan => {
                    loanList.push({
                        ...loan,
                        groupName: loan.group.name,
                        principalLoanStr: formatPricePhp(loan.principalLoan),
                        mcbuStr: formatPricePhp(loan.mcbu),
                        activeLoanStr: formatPricePhp(loan.activeLoan),
                        loanBalanceStr: formatPricePhp(loan.loanBalance),
                        fullName: UppercaseFirstLetter(`${loan.client.lastName}, ${loan.client.firstName} ${loan.client.middleName ? loan.client.middleName : ''}`),
                        selected: false
                    });
                });

                setHistoryList(loanList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }   
        }
    }

    const updateClientStatus = async (data, updatedValue, rejectReason) => {
        setLoading(true);
        const group = data.group;
        const lo = data.loanOfficer;

        let loanData = {...data};
        delete loanData.group;
        delete loanData.client;
        delete loanData.branch;
        delete loanData.principalLoanStr;
        delete loanData.activeLoanStr;
        delete loanData.loanBalanceStr;
        delete loanData.mcbuStr;

        loanData.insertedBy = currentUser._id;
        loanData.currentDate = currentDate;
        if (loanData.status === 'pending' && updatedValue === 'active') {
            loanData.dateGranted = currentDate;
            loanData.status = updatedValue;
            loanData.startDate = currentDate;
            loanData.endDate = getEndDate(loanData.dateGranted, group.occurence === lo.transactionType ? 60 : 24 );
            loanData.mispayment = 0;

            delete loanData.selected;

            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-loan', loanData)
            
            if (response.success) {
                setLoading(false);
                toast.success('Loan successfully updated.');
                window.location.reload();
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else {
            loanData.status = updatedValue;
            loanData.rejectReason = rejectReason;
            const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-loan', loanData)
            if (response.success) {
                setLoading(false);
                toast.success('Loan successfully updated.');
                setTimeout(() => {
                    getListLoan();
                    window.location.reload();
                }, 1000);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setLoan({});
        setOccurence('daily');
        getListLoan();
        if (currentUser.role.rep === 4) {
            getListGroup(currentUser._id, currentUser?.transactionType);
        }
        setTimeout(() => {
            setLoading(false);
        }, 1000);
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (list) {
            if (mode === 'all') {
                const tempList = list.map(loan => {
                    let temp = {...loan};

                    if (temp.allowApproved) {
                        temp.selected = selectAll;
                    }
                    
                    return temp;
                });
                dispatch(setLoanList(tempList));
            } else if (mode === 'row') {
                const tempList = list.map((loan, index) => {
                    let temp = {...loan};
    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;
                    }
    
                    return temp;
                });
                dispatch(setLoanList(tempList));
            }
        }
    }

    const handleMultiApprove = async () => {
        let selectedLoanList = list && list.filter(loan => loan.selected === true);
        
        if (selectedLoanList.length > 0) {
            const coMakerList = [];
            let errorMsg = '';
            selectedLoanList = selectedLoanList.map(loan => {
                let temp = {...loan};

                const client = loan.client;
                const group = loan.group;
                const lo = loan.loanOfficer;

                if (!client.firstName || !client.lastName) {
                    errorMsg += `First and/or Last Name of slot no ${loan.slotNo} from group ${group.name} is missing! \n`;
                }
                if (!client.fullName && (client.fullName && !client.fullName.length === 0)) {
                    errorMsg += `There are missing info for slot no ${loan.slotNo} from group ${group.name}! \n`;
                }
                if (!client.hasOwnProperty('profile') && !client.profile) {
                    errorMsg += `Slot no ${loan.slotNo} from group ${group.name} don't have photo uploaded! \n`;
                }

                delete temp.group;
                delete temp.client;
                delete temp.branch;
                delete temp.principalLoanStr;
                delete temp.activeLoanStr;
                delete temp.loanBalanceStr;
                delete temp.mcbuStr;
                delete temp.selected;

                temp.dateGranted = currentDate
                temp.status = 'active';
                temp.startDate = moment(currentDate).add(1, 'days').format('YYYY-MM-DD');
                temp.endDate = getEndDate(temp.dateGranted, group.occurence === lo.transactionType ? 60 : 24 );
                temp.mispayment = 0;
                temp.insertedBy = currentUser._id;
                temp.currentDate = currentDate;

                if (temp.coMaker) {
                    coMakerList.push({ coMaker: temp.coMaker, slotNo: temp.slotNo });
                }

                return temp;
            });

            // let pendingCoMaker = [];
            // const coMakerStatus = checkCoMakerLoanStatus(coMakerList);
            // if (coMakerStatus.length > 0) {
            //     pendingCoMaker = coMakerStatus.filter(cm => cm.status !== 'active' );
            // }

            // if (pendingCoMaker.length > 0 ) {
            //     let msg = 'Selected slot number co-maker have no approved loan: ';
            //     pendingCoMaker.map((p, i) => {
            //         if (i !== pendingCoMaker.length - 1) {
            //             msg += p.slotNo + ', ';
            //         } else {
            //             msg += p.slotNo;
            //         }
            //     });

            //     toast.error(msg);
            // } else {
                if (errorMsg.length > 0) {
                    errorMsg += "\n\nPlease update each missing info by clicking the row.";
                    toast.error(errorMsg, { autoClose: 10000 });
                } else {
                    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-by-batch', selectedLoanList);

                    if (response.success) {
                        setLoading(false);
                        toast.success('Selected loans successfully approved.');
                        setTimeout(() => {
                            getListLoan();
                            window.location.reload();
                        }, 1000);
                    }
                }
            // }
        } else {
            toast.error('No loan selected!');
        }
    }

    const actionButtons = currentUser.role.rep < 4 ? [
        <ButtonOutline label="Approved Selected Loans" type="button" className="p-2 mr-3" onClick={handleMultiApprove} />,
        <ButtonSolid label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ] : [
        <ButtonSolid label="Add Loan" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setLoan(row.original);
        let clientListData = [...clientList];
        let client = row.original.client;
        client.label = `${client.lastName}, ${client.firstName} ${client.middleName ? client.middleName : ''}`;
        client.value = client._id;
        clientListData.push(client);
        dispatch(setClientList(clientListData));
        setOccurence(row.original.occurence);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setLoan(row.original);
        setShowDeleteDialog(true);
    }

    const handleApprove = (row) => {
        if (row.original.allowApproved) {
            updateClientStatus(row.original, 'active');
            // checkCoMakerLoanStatus([{ coMaker: row.original.coMaker, slotNo: row.original.slotNo }]).then(statusList => {
            //     statusList.map(status => {
            //         if (status.status === 'active') {
            //             updateClientStatus(row.original, 'active');
            //         } else {
            //             toast.error('Co Maker latest loan is not yet approved.');
            //         }
            //     });
            // });
        } else {
            toast.error("Group transaction is already closed for the day.");
        }
    }

    const handleReject = () => {
        // if (row.original.allowApproved) {
        //     updateClientStatus(row.original, 'reject');
        // } else {
        //     toast.error("Group transaction is already closed for the day.");
        // }
        if (!rejectReason) {
            toast.error("Reject reason is required!");
        } else if (loan) {
            updateClientStatus(loan, 'reject', rejectReason);
            setShowRejectModal(false);
            setRejectReason('');
        }
    }

    const handleShowNDSAction = (row) => {
        setLoan(row.original);
        window.open(`/transactions/loan-applications/${row.original._id}`, '_blank');
    }

    const checkCoMakerLoanStatus = async (coMakerList) => {
        const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/get-comaker-loan-status', coMakerList);
        let statusList = [];
        if (response.success) {
            statusList = response.data;
        }

        return statusList;
    }

    const [rowActionButtons, setRowActionButtons] = useState([]);

    const handleDelete = () => {
        if (loan) {
            setLoading(true);
            const loanData = {...loan, deleted: true, deletedBy: currentUser._id, dateDeleted: moment(currentDate).format('YYYY-MM-DD')};
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/delete', loanData)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Loan successfully deleted.');
                        setLoading(false);
                        getListLoan();
                        getListGroup();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const handleShowClientInfoModal = (row) => {
        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
        const selected = row;
        const selectedClient = {...selected.client, imgUrl: selected.client.profile ? imgpath + '/images/clients/' + selected.client.profile : ''};
        dispatch(setClient(selectedClient));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
        getListLoan();
    }
    
    const handleShowWarningModal = (row) => {
        if (row.original.allowApproved) {
            setLoan(row.original);
            setShowRejectModal(true);
        } else {
            toast.error("Group transaction is already closed for the day.");
        }
    }

    useEffect(() => {
        let mounted = true;
        mounted && getListBranch();

        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (branchList) {
            getListLoan();
            getHistoyListLoan();
        }
    }, [branchList, isWeekend, isHoliday]);

    useEffect(() => {
        if (isFiltering) {
          setData(filteredList);
        } else {
          setData(list);
        }
    }, [isFiltering, filteredList, list]);

    useEffect(() => {
        if (groupList) {
            let cols = [];
            cols.push(
                {
                    Header: "Group",
                    accessor: 'groupName',
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Client Name",
                    accessor: 'fullName'
                },
                {
                    Header: "Admission Date",
                    accessor: 'admissionDate'
                },
                {
                    Header: "MCBU",
                    accessor: 'mcbuStr',
                    filter: 'includes'
                },
                {
                    Header: "Principal Loan",
                    accessor: 'principalLoanStr'
                },
                {
                    Header: "Target Loan Collection",
                    accessor: 'activeLoanStr'
                },
                {
                    Header: "Loan Release",
                    accessor: 'loanReleaseStr'
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                {
                    Header: "PN Number",
                    accessor: 'pnNumber'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill,
                    // Cell: SelectCell,
                    // Options: statuses,
                    // valueIdAccessor: 'status',
                    // selectOnChange: updateClientStatus,
                    // Filter: SelectColumnFilter,
                    // filter: 'includes',
                }
            );

            if (currentUser.role.rep === 3) {
                cols.unshift(
                    {
                        Header: "Loan Officer",
                        accessor: 'loanOfficerName'
                    }
                );
            } else if (currentUser.role.rep === 2 || currentUser.role.rep === 1 ) {
                cols.unshift(
                    {
                        Header: "Loan Officer",
                        accessor: 'loanOfficerName'
                    }
                );
                cols.unshift(
                    {
                        Header: "Branch",
                        accessor: 'branchName'
                    }
                )
            }

            let rowActionBtn = [];

            if (currentUser.role.rep === 3) {
                rowActionBtn = [
                    // { label: 'Approve', action: handleApprove},
                    { label: 'Edit Loan', action: handleEditAction},
                    { label: 'Reject', action: handleShowWarningModal},
                    // { label: 'Delete Loan', action: handleDeleteAction},
                    { label: 'NDS', action: handleShowNDSAction}
                ];
            } else if (currentUser.role.rep === 4) {
                rowActionBtn = [
                    { label: 'Edit Loan', action: handleEditAction},
                    // { label: 'Delete Loan', action: handleDeleteAction}
                ];
            }

            setColumns(cols);
            setRowActionButtons(rowActionBtn);
        }
    }, [groupList]);

    useEffect(() => {
        if (currentUser.role.rep === 3 || currentUser.role.rep === 4 && branchList.length > 0) {
            setSelectedFilterBranch(branchList[0]?.value);
            getListUser(branchList[0]?.code);
        }

        if (currentUser.role.rep === 4) {
            setOccurence(currentUser.transactionType);
            getListGroup(currentUser._id, currentUser.transactionType);
        }
    }, [currentUser, branchList]);

    useEffect(() => {
        setNoOfPendingLoans(data.length);
        setTotalAmountRelease(getTotal(data, 'principalLoan'));
    }, [data]);

    return (
        <Layout actionButtons={(currentUser.role.rep > 2 && !isWeekend && !isHoliday) && actionButtons}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : (
                        <React.Fragment>
                            <nav className="flex pl-10 bg-white border-b border-gray-300">
                                <TabSelector
                                    isActive={selectedTab === "application"}
                                    onClick={() => setSelectedTab("application")}>
                                    Pending Applications
                                </TabSelector>
                                <TabSelector
                                    isActive={selectedTab === "history"}
                                    onClick={() => setSelectedTab("history")}>
                                    History
                                </TabSelector>
                            </nav>
                            <div>
                                <TabPanel hidden={selectedTab !== "application"}>
                                    <div className="flex flex-row bg-white p-4">
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
                                    <TableComponent 
                                        columns={columns} 
                                        data={data} 
                                        pageSize={50} 
                                        hasActionButtons={(currentUser.role.rep > 2 && !isWeekend && !isHoliday) ? true : false} 
                                        rowActionButtons={!isWeekend && !isHoliday && rowActionButtons} 
                                        showFilters={false} 
                                        multiSelect={currentUser.role.rep === 3 ? true : false} 
                                        multiSelectActionFn={handleMultiSelect} 
                                        rowClick={handleShowClientInfoModal}
                                    />
                                    <footer className="pl-64 text-md font-bold text-center fixed inset-x-0 bottom-0 text-red-400">
                                        <div className="flex flex-row justify-center bg-white px-4 py-2 shadow-inner border-t-4 border-zinc-200">
                                            <div className="flex flex-row">
                                                <span className="pr-6">No. of Pending Loans: </span>
                                                <span className="pr-6">{ noOfPendingLoans }</span>
                                            </div>
                                            <div className="flex flex-row">
                                                <span className="pr-6">Total Amount Release: </span>
                                                <span className="pr-6">{ formatPricePhp(totalAmountRelease) }</span>
                                            </div>
                                        </div>
                                    </footer>
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== 'history'}>
                                    <TableComponent columns={columns} data={historyList} hasActionButtons={false} showFilters={false} />
                                </TabPanel>
                            </div>
                        </React.Fragment>
                    )
                } 
            </div>
            {occurence && <AddUpdateLoan mode={mode} loan={loan} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} type={occurence} />}
            <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="60rem">
                <ClientDetailPage />
            </Modal>
            <Dialog show={showRejectModal}>
                <h2>Reject Loan</h2>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <textarea rows="4" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                                    className="block p-2.5 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border 
                                                border-gray-300 focus:ring-blue-500 focus:border-main" 
                                    placeholder="Enter reject reason..."></textarea>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-end text-center px-4 py-3 sm:px-6 sm:flex">
                    <div className='flex flex-row'>
                        <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowRejectModal(false)} />
                        <ButtonSolid label="Continue" type="button" className="p-2 mr-3" onClick={handleReject} />
                    </div>
                </div>
            </Dialog>
            <Dialog show={showDeleteDialog}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <p className="text-2xl font-normal text-dark-color">Are you sure you want to delete?</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                    <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={() => setShowDeleteDialog(false)} />
                    <ButtonSolid label="Yes, delete" type="button" className="p-2" onClick={handleDelete} />
                </div>
            </Dialog>
        </Layout>
    );
}

export default LoanApplicationPage;