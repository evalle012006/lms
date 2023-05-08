import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useEffect, useState } from "react";
import toast from 'react-hot-toast';
import { setBranchList } from "@/redux/actions/branchActions";
import { setUserList } from "@/redux/actions/userActions";
import { UppercaseFirstLetter, formatPricePhp } from "@/lib/utils";
import { setGroupList } from "@/redux/actions/groupActions";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import TableComponent, { AvatarCell, SelectCell, StatusPill } from "@/lib/table";
import Layout from "@/components/Layout";
import Spinner from "@/components/Spinner";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { PlusIcon } from '@heroicons/react/24/solid';
import { setTransferClientList } from "@/redux/actions/clientActions";

const TransferClientPage = () => {
    const [loading, setLoading] = useState(true);
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const transferList = useSelector(state => state.client.transferList);

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

    const [slotNumbers, setSelectedSlotNumbers] = useState([
        {
            "label": 1,
            "value": 1
        },
        {
            "label": 2,
            "value": 2
        },
        {
            "label": 3,
            "value": 3
        },
        {
            "label": 4,
            "value": 4
        },
        {
            "label": 5,
            "value": 5
        },
        {
            "label": 6,
            "value": 6
        },
        {
            "label": 7,
            "value": 7
        },
        {
            "label": 8,
            "value": 8
        },
        {
            "label": 9,
            "value": 9
        },
        {
            "label": 10,
            "value": 10
        },
        {
            "label": 11,
            "value": 11
        },
        {
            "label": 12,
            "value": 12
        },
        {
            "label": 13,
            "value": 13
        },
        {
            "label": 14,
            "value": 14
        },
        {
            "label": 15,
            "value": 15
        },
        {
            "label": 16,
            "value": 16
        },
        {
            "label": 17,
            "value": 17
        },
        {
            "label": 18,
            "value": 18
        },
        {
            "label": 19,
            "value": 19
        },
        {
            "label": 20,
            "value": 20
        },
        {
            "label": 21,
            "value": 21
        },
        {
            "label": 22,
            "value": 22
        },
        {
            "label": 23,
            "value": 23
        },
        {
            "label": 24,
            "value": 24
        },
        {
            "label": 25,
            "value": 25
        },
        {
            "label": 26,
            "value": 26
        },
        {
            "label": 27,
            "value": 27
        },
        {
            "label": 28,
            "value": 28
        },
        {
            "label": 29,
            "value": 29
        },
        {
            "label": 30,
            "value": 30
        }
    ]);

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
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
            url = url + '?' + new URLSearchParams({ branchCodes: currentUser.designatedBranch });
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
            let url = process.env.NEXT_PUBLIC_API_URL + 'users/list';
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
                    setSourceGroupList([]);
                    setSelectedSourceGroup({});
                    dispatch(setTransferClientList([]));
                } else {
                    // selected user won't reset...
                    setTargetUserList(userList);
                    setTargetGroupList([]);
                    setSelectedTargetGroup({});
                }
                
            } else {
                toast.error('Error retrieving user list.');
            }

            setLoading(false);
        }
    }

    const getListGroup = async (selectedUser, type) => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'groups/list';
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
                    setSelectedSourceGroup({});
                    dispatch(setTransferClientList([]));
                } else {
                    setTargetGroupList(groups);
                    setSelectedTargetGroup({});
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
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list?' + new URLSearchParams({ mode: "view_all_by_group", groupId: groupId });;

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    slotNo: client.loans.length > 0 ? client.loans[0].slotNo : '-',
                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                    activeLoanStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].activeLoan) : '-',
                    loanBalanceStr: client.loans.length > 0 ? formatPricePhp(client.loans[0].loanBalance) : '-',
                    delinquent: client.loans.length > 0 ? client.delinquent ? "Yes" : "No" : '-',
                    label: UppercaseFirstLetter(`${client.lastName}, ${client.firstName}`),
                    value: client._id
                });   
            });
            dispatch(setTransferClientList(clients));
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
            if (selected._id === selectedSourceGroup._id) {
                toast.error('Selected group is the same as the source group.');
                setSelectedTargetGroup(null);
            } else if (selected.occurence !== selectedSourceGroup.occurence) {
                toast.error(`Please select a ${selectedSourceGroup.occurence} group.`);
                setSelectedTargetGroup(null);
            } else if (selected.status === 'available') {
                setSelectedTargetGroup(selected);
            } else {
                toast.error("Selected group is currently full.");
                setSelectedTargetGroup(null);
            }
        }
    }

    const handleMultiSelect = (mode, selectAll, row, rowIndex) => {
        if (transferList) {
            if (mode === 'all') {
                let tempList = transferList.map(loan => {
                    let temp = {...loan};

                    temp.selected = selectAll;

                    if (temp.selected === false) {
                        delete temp.error;
                    }
                    
                    return temp;
                });

                dispatch(setTransferClientList(tempList));
            } else if (mode === 'row') {
                let tempList = transferList.map((loan, index) => {
                    let temp = {...loan};
    
                    if (index === rowIndex) {
                        temp.selected = !temp.selected;

                        if (temp.selected === false) {
                            delete temp.error;
                        }
                    }
    
                    return temp;
                });

                dispatch(setTransferClientList(tempList));
            }
        }
    }

    const handleTransfer = async () => {
        setLoading(true);
        if (selectedSourceGroup._id === selectedTargetGroup._id) {
            toast.error('Selected source and target group are the same.');
        } else {
            const updatedClientList = [...transferList];
            let selectedClientList = transferList && transferList.filter(client => client.selected === true);

            if (selectedClientList.length > 0) {
                if (selectedTargetGroup) {
                    const updatedSelectedClientList = selectedClientList.map(client => {
                        let uClient = {...client};

                        uClient.branchId = selectedTargetBranch?._id;
                        uClient.loId = selectedTargetUser?._id;
                        uClient.groupId = selectedTargetGroup?._id;
                        uClient.groupName = selectedTargetGroup?.name;
                        uClient.sameLo = client.loId === selectedTargetUser?._id;
                        uClient.oldGroupId = client.groupId;
                        uClient.oldBranchId = client.branchId;
                        uClient.oldLoId = client.loId;

                        const index = updatedClientList.findIndex(c => c._id === uClient._id);
                        if (index > -1) {
                            updatedClientList[index] = uClient;
                        }

                        return uClient;
                    });

                    dispatch(setTransferClientList(updatedClientList));
                    const response = await fetchWrapper.post(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client', updatedSelectedClientList);

                    if (response.success) {
                        setLoading(false);
                        let msg = 'Selected client/s successfully transfered.';
                        if (response?.message) {
                            msg = msg + ' ' + response.message;
                        }
                        toast.success(msg);
                        setTimeout(() => {
                            getListClient(selectedSourceGroup._id);
                        }, 800);
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    }
                } else {
                    setLoading(false);
                    toast.error("Please select target group.");
                }
            } else {
                setLoading(false);
                toast.error('No client selected.');
            }
        }
    }

    const actionButtons = [
        <ButtonSolid label="Transfer" type="button" className="p-2 mr-3" onClick={handleTransfer} />
    ];

    const [columns, setColumns] = useState([
        // {
        //     Header: "Slot No.",
        //     accessor: 'slotNo'
        // },
        // {
        //     Header: "Group",
        //     accessor: 'groupName',
        //     filter: 'includes'
        // },
        {
            Header: "Last Name",
            accessor: 'lastName',
            Cell: AvatarCell,
            imgAccessor: "imgUrl",
        },
        {
            Header: "First Name",
            accessor: 'firstName'
        },
        {
            Header: "Loan Status",
            accessor: 'loanStatus',
            Cell: StatusPill
        },
        {
            Header: "Active Loan",
            accessor: 'activeLoanStr',
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "Delinquent",
            accessor: 'delinquent',
            filter: 'includes'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill
        }
    ]);

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep !== 2)) {
            router.push('/');
        }
    }, []);

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
        <Layout actionButtons={actionButtons}>
            <div className="pb-4">
                { loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <div className="flex flex-col bg-white rounded-lg m-4 p-4">
                        <div className="flex flex-col border-b border-zinc-400">
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
                                            isDisabled={!selectedSourceGroup}
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
                            <TableComponent columns={columns} data={transferList} pageSize={100} showPagination={false} showPaginationBottom={false} hasActionButtons={false} showFilters={false} multiSelect={true} multiSelectActionFn={handleMultiSelect} />
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    )
}

export default TransferClientPage;