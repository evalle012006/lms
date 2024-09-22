import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { setBranchList } from "@/redux/actions/branchActions";
import { setUserList } from "@/redux/actions/userActions";
import { UppercaseFirstLetter } from "@/lib/utils";
import { setGroupList } from "@/redux/actions/groupActions";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import TableComponent, { AvatarCell, SelectCell } from "@/lib/table";
import { getApiBaseUrl } from "@/lib/constants";


// unused
const TransferClientTransactionPage = ({ mode = "group", setLoading }) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);

    const [sourceUserList, setSourceUserList] = useState([]);
    const [sourceGroupList, setSourceGroupList] = useState([]);
    const [selectedSourceBranch, setSelectedSourceBranch] = useState();
    const [selectedSourceUser, setSelectedSourceUser] = useState();
    const [selectedSourceGroup, setSelectedSourceGroup] = useState();

    const [targetUserList, setTargetUserList] = useState([]);
    const [targetGroupList, setTargetGroupList] = useState([]);
    const [selectedTargetBranch, setSelectedTargetBranch] = useState();
    const [selectedTargetUser, setSelectedTargetUser] = useState();
    const [selectedTargetGroup, setSelectedTargetGroup] = useState();

    const [clientList, setClientList] = useState([]);
    const [selectedClients, setSelectedClients] = useState([]);
    const [slotNumbers, setSelectedSlotNumbers] = useState([]);

    const getListBranch = async () => {
        let url = getApiBaseUrl() + 'branches/list';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];
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
            // const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            // url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let branches = [];
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

    const getListUser = async (selectedBranch, type) => {
        if (selectedBranch) {
            let url = getApiBaseUrl() + 'users/list';
            let selectedBranch = {};
            if (type === "source") {
                selectedBranch = selectedSourceBranch;
            } else {
                selectedBranch = selectedTargetBranch;
            }

            url = url + '?' + new URLSearchParams({ branchCode: selectedBranch.code });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                let userList = [];
                response.users && response.users.filter(u => u.role.rep === 4).map(u => {
                    const name = `${u.firstName} ${u.lastName}`;
                    userList.push(
                        {
                            ...u,
                            value: u._id,
                            label: UppercaseFirstLetter(name)
                        }
                    );
                });
                userList.sort((a, b) => { return a.loNo - b.loNo; });
                if (type === "source") {
                    setSourceUserList(userList);
                } else {
                    setTargetUserList(userList);
                }
                
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async (selectedUser, type) => {
        let url = getApiBaseUrl() + 'groups/list';
        let selectedBranch = {};
        if (type === "source") {
            selectedBranch = selectedSourceBranch;
        } else {
            selectedBranch = selectedTargetBranch;
        }
        
        if (selectedUser) {
            url = url + '?' + new URLSearchParams({ branchId: selectedBranch._id, loId: selectedUser._id });
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
                groups.sort((a, b) => { return a.groupNo - b.groupNo; });

                if (type === "source") {
                    setSourceGroupList(groups);
                } else {
                    setTargetGroupList(groups);
                }

                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListClient = async (groupId) => {
        setLoading(true);
        let url = getApiBaseUrl() + 'clients/list?' + new URLSearchParams({ mode: "view_all_by_group_for_transfer", groupId: groupId });;

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
                    value: client._id
                });   
            });
            setClientList(clients);
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const handleChangeBranch = (selected, type) => {
        if (type === "source") {
            setSelectedSourceBranch(selected);
        } else {
            setSelectedTargetBranch(selected);
        }
    }

    const handleChangeUser = (selected, type) => {
        if (type === "source") {
            setSelectedSourceUser(selected);
        } else {
            setSelectedTargetUser(selected);
        }
    }

    const handleChangeGroup = (selected, type) => {
        if (type === "source") {
            setSelectedSourceGroup(selected);
        } else {
            setSelectedTargetGroup(selected);
        }
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (clientList) {
            if (mode === 'all') {
                const tempList = clientList.map(loan => {
                    let temp = {...loan};

                    if (temp.allowApproved) {
                        temp.selected = selectAll;
                    }
                    
                    return temp;
                });
                setClientList(tempList);
            } else if (mode === 'row') {
                const tempList = clientList.map((loan, index) => {
                    let temp = {...loan};
    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;
                    }
    
                    return temp;
                });
                setClientList(tempList);
            }
        }
    }

    // const handleMultiApprove = async () => {
    //     let selectedLoanList = list && list.filter(loan => loan.selected === true);
        
    //     if (selectedLoanList.length > 0) {
    //         selectedLoanList = selectedLoanList.map(loan => {
    //             let temp = {...loan};
    //             const group = loan.group;

    //             delete temp.group;
    //             delete temp.client;
    //             delete temp.branch;
    //             delete temp.principalLoanStr;
    //             delete temp.activeLoanStr;
    //             delete temp.loanBalanceStr;
    //             delete temp.mcbuStr;
    //             delete temp.selected;

    //             temp.dateGranted = moment(new Date()).format('YYYY-MM-DD');
    //             temp.status = 'active';
    //             temp.startDate = moment(new Date()).add(1, 'days').format('YYYY-MM-DD');
    //             temp.endDate = getEndDate(temp.dateGranted, group.occurence === type ? 60 : 24 );
    //             temp.mispayment = 0;
    //             temp.insertedBy = currentUser._id;

    //             return temp;
    //         });

    //         const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/loans/approved-reject-by-batch', selectedLoanList);

    //         if (response.success) {
    //             setLoading(false);
    //             toast.success('Selected loans successfully approved.');
    //             setTimeout(() => {
    //                 getListLoan();
    //             }, 500);
    //         }
    //     } else {
    //         toast.error('No loan selected!');
    //     }
    // }

    const updateClient = (u, updatedValue) => {
        setLoading(true);
        const tempUser = { ...u };
        const selectedRole = platformRoles.find(role => role.rep == updatedValue);
        tempUser.role = JSON.stringify(selectedRole);
        delete tempUser.roleId;
        fetchWrapper.sendData('/api/users/', tempUser)
            .then(response => {
                if (currentUser.email === tempUser.email) {
                    dispatch(setUser({
                        ...currentUser,
                        firstName: tempUser.firstName,
                        lastName: tempUser.lastName,
                        email: tempUser.email,
                        number: tempUser.number,
                        position: tempUser.position,
                        role: tempUser.role,
                        designatedBranch: tempUser.designatedBranch,
                        loNo: tempUser.loNo,
                        transactionType: tempUser.transactionType
                    }));
                }
                // update list
                const userList = list.map(o => {
                    let obj = { ...o };
                    if (obj.email === tempUser.email) {
                        obj.roleId = selectedRole.rep;
                        obj.role = UppercaseFirstLetter(selectedRole.name)
                    }

                    return obj;
                });

                dispatch(setUserList(userList));
                setLoading(false);
            }).catch(error => {
                console.log(error);
            });
    }

    const [columns, setColumns] = useState([
        {
            Header: "Last Name",
            accessor: 'lastName',
            Cell: AvatarCell,
            imgAccessor: "profile",
        },
        {
            Header: "First Name",
            accessor: 'firstName'
        },
        {
            Header: "Middle Name",
            accessor: 'middleName'
        },
        {
            Header: "Group",
            accessor: 'groupName',
            filter: 'includes'
        },
        {
            Header: "Loan Officer",
            accessor: 'loName',
            filter: 'includes'
        },
        // {
        //     Header: "Slot No.",
        //     accessor: 'slotNo',
        //     Cell: SelectCell,
        //     Options: [],
        //     valueIdAccessor: 'targetSlotNo',
        //     selectOnChange: updateClient,
        // },
        // {
        //     Header: "Loan Status",
        //     accessor: 'loanStatus',
        //     Cell: StatusPill
        // },
        // {
        //     Header: "Active Loan",
        //     accessor: 'activeLoanStr',
        // },
        // {
        //     Header: "Loan Balance",
        //     accessor: 'loanBalanceStr'
        // },
        // {
        //     Header: "Delinquent",
        //     accessor: 'delinquent',
        //     filter: 'includes'
        // },
        // {
        //     Header: "Status",
        //     accessor: 'status',
        //     Cell: StatusPill
        // }
    ]);

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        return (() => {
            mounted = false;
        })
    }, []);

    useEffect(() => {
        getListUser(selectedSourceBranch, "source");
    }, [selectedSourceBranch]);

    useEffect(() => {
        getListGroup(selectedSourceUser, "source");
    }, [selectedSourceUser]);

    useEffect(() => {
        getListUser(selectedTargetBranch, "target");
    }, [selectedTargetBranch]);

    useEffect(() => {
        getListGroup(selectedTargetUser, "target");
    }, [selectedTargetUser]);

    useEffect(() => {
        if (selectedSourceGroup) {
            getListClient(selectedSourceGroup._id);
        }
    }, [selectedSourceGroup]);

    return (
        <div className="flex flex-col bg-white rounded-lg m-4 p-4">
            <div className="flex flex-col">
                <span className="text-sm font-bold text-zinc-500">Filters</span>
                <div className="flex flex-col mt-2 p-4">
                    <span className="text-sm text-zinc-500">Source:</span>
                    <div className="flex flex-row justify-start mb-4">
                        <div className="px-4">
                            <Select 
                                options={branchList}
                                value={selectedSourceBranch && branchList.find(branch => {
                                    return branch._id === selectedSourceBranch._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeBranch(e, "source")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Select a Branch'}/>
                        </div>
                        <div className="px-4">
                            <Select 
                                options={sourceUserList}
                                value={selectedSourceUser && sourceUserList.find(user => {
                                    return user._id === selectedSourceUser._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeUser(e, "source")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                isDisabled={!selectedSourceBranch}
                                placeholder={'Select LO'}/>
                        </div>
                        <div className="px-4">
                            <Select 
                                options={sourceGroupList}
                                value={selectedSourceGroup && sourceGroupList.find(group => {
                                    return group._id === selectedSourceGroup._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeGroup(e, "source")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                isDisabled={(!selectedSourceBranch && !selectedSourceUser)}
                                placeholder={'Select a Group'}/>
                        </div>
                    </div>
                    {/* target */}
                    <span className="text-sm text-zinc-500">Target:</span>
                    <div className="flex flex-row justify-start">
                        <div className="px-4">
                            <Select 
                                options={branchList}
                                value={selectedTargetBranch && branchList.find(branch => {
                                    return branch._id === selectedTargetBranch._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeBranch(e, "target")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Select Target Branch'}/>
                        </div>
                        <div className="px-4">
                            <Select 
                                options={targetUserList}
                                value={selectedTargetUser && targetUserList.find(user => {
                                    return user._id === selectedTargetUser._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeUser(e, "target")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                isDisabled={!selectedTargetBranch}
                                placeholder={'Select Target LO'}/>
                        </div>
                        <div className="px-4">
                            <Select 
                                options={targetGroupList}
                                value={selectedTargetGroup && targetGroupList.find(group => {
                                    return group._id === selectedTargetGroup._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={(e) => handleChangeGroup(e, "target")}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                isDisabled={!selectedTargetBranch && !selectedTargetUser}
                                placeholder={'Select Target Group'}/>
                        </div>
                    </div>
                </div>
            </div>
            <div className="mt-4">
                <TableComponent columns={columns} data={clientList} pageSize={100} showPagination={false} showPaginationBottom={false} hasActionButtons={false} showFilters={false} multiSelect={true} multiSelectActionFn={handleMultiSelect} />
            </div>
        </div>
    )
}

export default TransferClientTransactionPage;