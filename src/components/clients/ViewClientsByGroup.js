import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setClient, setClientList } from "@/redux/actions/clientActions";
import Modal from "@/lib/ui/Modal";
import ClientDetailPage from "./ClientDetailPage";
import { formatPricePhp } from "@/lib/utils";
import { getApiBaseUrl } from "@/lib/constants";
import { TabSelector } from "@/lib/ui/tabSelector";
import { TabPanel, useTabs } from "react-headless-tabs";
import moment from "moment";
import { 
    Pencil, 
    UserMinus, 
    Trash2, 
    Users, 
    Users2,
    CheckCircle, 
    Search 
} from 'lucide-react';
import ClientSearchV2 from "./ClientSearchV2";

const ViewClientsByGroupPage = ({groupId, status, client, setClientParent, setMode, handleShowAddDrawer, handleShowCoMakerDrawer}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const list = useSelector(state => state.client.list);
    const [activeList, setActiveList] = useState();
    const [excludedList, setExcludedList] = useState();
    const [duplicateList, setDuplicateList] = useState();
    const [loading, setLoading] = useState(true);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    // New state for filtered lists
    const [filteredActiveList, setFilteredActiveList] = useState([]);
    const [filteredDuplicateList, setFilteredDuplicateList] = useState([]);
    const [filteredExcludedList, setFilteredExcludedList] = useState([]);

    const [deleteMessage, setDeleteMessage] = useState({ msg: '', btnLabel: '' });

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchClientData, setSearchClientData] = useState(null);

    // Filter states
    const [filters, setFilters] = useState({
        branch: '',
        lo: '',
        group: '',
        name: ''
    });

    const [selectedTab, setSelectedTab] = useTabs([
        'new-prospects',
        'duplicate-prospects',
        'excluded-prospects'
    ]);

    // Get current list based on selected tab
    const getCurrentList = () => {
        switch (selectedTab) {
            case 'new-prospects':
                return activeList || [];
            case 'duplicate-prospects':
                return duplicateList || [];
            case 'excluded-prospects':
                return excludedList || [];
            default:
                return [];
        }
    };

    // Get filtered lists based on current selections
    const getFilteredOptions = (list) => {
        if (!list) return { branches: [], los: [], groups: [], clients: [] };

        // Get all unique branches
        const branches = [...new Set(list.map(item => item.branchName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        // Filter list by selected branch
        let branchFiltered = list;
        if (filters.branch) {
            branchFiltered = list.filter(item => item.branchName === filters.branch);
        }

        // Get loan officers for selected branch
        const los = [...new Set(branchFiltered.map(item => item.loName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        // Filter by selected loan officer
        let loFiltered = branchFiltered;
        if (filters.lo) {
            loFiltered = branchFiltered.filter(item => item.loName === filters.lo);
        }

        // Get groups for selected loan officer
        const groups = [...new Set(loFiltered.map(item => item.groupName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        // Filter by selected group
        let groupFiltered = loFiltered;
        if (filters.group) {
            groupFiltered = loFiltered.filter(item => item.groupName === filters.group);
        }

        // Get clients that match all filters
        const clients = groupFiltered;

        return { branches, los, groups, clients };
    };

    const handleFilterChange = (field, value) => {
        // Reset subsequent filters when a parent filter changes
        const newFilters = { ...filters, [field]: value };
        if (field === 'branch') {
            newFilters.lo = '';
            newFilters.group = '';
            newFilters.name = '';
        } else if (field === 'lo') {
            newFilters.group = '';
            newFilters.name = '';
        } else if (field === 'group') {
            newFilters.name = '';
        }
        
        setFilters(newFilters);
        
        // Apply filters to current list
        const currentList = getCurrentList();
        const { clients } = getFilteredOptions(currentList);
        const filteredData = clients.filter(item => {
            if (!newFilters.name) return true;
            
            const searchTerm = newFilters.name.toLowerCase();
            const fullName = item.name?.toLowerCase() || '';
            const firstName = item.firstName?.toLowerCase() || '';
            const lastName = item.lastName?.toLowerCase() || '';
            
            return fullName.includes(searchTerm) || 
                   firstName.includes(searchTerm) || 
                   lastName.includes(searchTerm);
        });
        
        // Update the appropriate filtered list based on current tab
        switch (selectedTab) {
            case 'new-prospects':
                setFilteredActiveList(filteredData);
                break;
            case 'duplicate-prospects':
                setFilteredDuplicateList(filteredData);
                break;
            case 'excluded-prospects':
                setFilteredExcludedList(filteredData);
                break;
        }
    };

    useEffect(() => {
        setFilters({
            branch: '',
            lo: '',
            group: '',
            name: ''
        });
        const currentList = getCurrentList();
        switch (selectedTab) {
            case 'new-prospects':
                setFilteredActiveList(currentList);
                break;
            case 'duplicate-prospects':
                setFilteredDuplicateList(currentList);
                break;
            case 'excluded-prospects':
                setFilteredExcludedList(currentList);
                break;
        }
    }, [selectedTab]);

    const renderFilters = () => {
        const currentList = getCurrentList();
        const { branches, los, groups } = getFilteredOptions(currentList);

        return (
            <div className="p-4 bg-white shadow mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Branch Filter */}
                    <select
                        className="p-2 w-full border rounded-md"
                        value={filters.branch}
                        onChange={(e) => handleFilterChange('branch', e.target.value)}
                    >
                        <option value="">All Branches</option>
                        {branches.map((branch) => (
                            <option key={branch} value={branch}>{branch}</option>
                        ))}
                    </select>

                    {/* Loan Officer Filter */}
                    <select
                        className="p-2 w-full border rounded-md"
                        value={filters.lo}
                        onChange={(e) => handleFilterChange('lo', e.target.value)}
                        disabled={false}
                    >
                        <option value="">All Loan Officers</option>
                        {los.map((lo) => (
                            <option key={lo} value={lo}>{lo}</option>
                        ))}
                    </select>

                    {/* Group Filter */}
                    <select
                        className="p-2 w-full border rounded-md"
                        value={filters.group}
                        onChange={(e) => handleFilterChange('group', e.target.value)}
                        disabled={false}
                    >
                        <option value="">All Groups</option>
                        {groups.map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>

                    {/* Client Name Filter */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search by full name, first name, or last name..."
                            className="pl-10 p-2 w-full border rounded-md"
                            value={filters.name}
                            onChange={(e) => handleFilterChange('name', e.target.value)}
                            disabled={false}
                        />
                    </div>
                </div>
            </div>
        );
    };

    const createClientObject = (client) => {
        const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
        const ciName = client?.ciName || '';
        
        // Create new arrays instead of spreading potentially mutable arrays
        const cashCollections = Array.isArray(client?.cashCollections) ? 
            client.cashCollections.map(collection => ({...collection})) : [];
        const groups = Array.isArray(client?.groups) ? 
            client.groups.map(group => ({...group})) : [];
        const lo = Array.isArray(client?.lo) ? 
            client.lo.map(officer => ({...officer})) : [];
        const loans = Array.isArray(client?.loans) ? 
            client.loans.map(loan => ({...loan})) : [];
    
        return {
            ...client,
            cashCollections,
            groups,
            lo,
            loans,
            name,
            middleName: client.middleName || '',
            profile: client.profile || '',
            slotNo: loans.length > 0 ? loans[0].slotNo : '-',
            loanStatus: loans.length > 0 ? loans[0].status : '-',
            activeLoanStr: loans.length > 0 ? formatPricePhp(loans[0].activeLoan) : '0.00',
            loanBalanceStr: loans.length > 0 ? formatPricePhp(loans[0].loanBalance) : '0.00',
            missPayments: loans.length > 0 ? loans[0].missPayments : 0,
            noOfPayment: loans.length > 0 ? loans[0].noOfPayment : 0,
            delinquent: client.delinquent === true ? 'Yes' : 'No',
            loName: lo.length > 0 ? `${lo[0].lastName}, ${lo[0].firstName}` : '',
            coMaker: (loans[0]?.coMaker && typeof loans[0]?.coMaker === 'number') ? loans[0].coMaker : '',
            ciName: loans.length > 0 ? loans[0]?.ciName : ciName,
            groupLeaderStr: client.groupLeader ? 'Yes' : 'No'
        };
    };

    // admin: should be viewed first per branch -> group -> clients
    // am: branch -> group -> clients
    // bm: all groups -> clients
    // lo: assigned groups -> clients
    const getListClient = async () => {
        let url = getApiBaseUrl() + 'clients/list';
        if (groupId) {
            url = url + '?' + new URLSearchParams({ mode: "view_by_group", groupId: groupId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const clients = await response.clients && response.clients
                    .sort((a, b) => {
                        const dateA = new Date(a.dateAdded);
                        const dateB = new Date(b.dateAdded);
                        return dateB - dateA;
                    })
                    .map(loan => createClientObject({
                        ...loan.client,
                        ...loan
                    }));
                dispatch(setClientList(clients));
            } else if (response.error) {
                toast.error(response.message);
            }
        } else if (!currentUser.root) {
            if (currentUser.role.rep > 2) {
                const currentUserBranch = branchList.find(b => b.code === currentUser.designatedBranch);
                if (status === 'offset') {
                    url = url + '?' + new URLSearchParams({ mode: "view_offset", status: status, origin: 'client' });
                    const response = await fetchWrapper.get(url);
                    if (response.success) {
                        const clients = await response.clients && response.clients
                            .sort((a, b) => {
                                const dateA = new Date(a.dateAdded);
                                const dateB = new Date(b.dateAdded);
                                return dateB - dateA;
                            })
                            .map(client => createClientObject(client));
                        dispatch(setClientList(clients));
                    } else if (response.error) {
                        toast.error(response.message);
                    }
                } else {
                    if (currentUser.role.rep === 4 && branchList.length > 0) {
                        url = url + '?' + new URLSearchParams({ mode: "view_by_lo", loId: currentUser._id, status: status });
                        const response = await fetchWrapper.get(url);
                        if (response.success) {
                            const clients = await response.clients && response.clients
                                .sort((a, b) => {
                                    const dateA = new Date(a.dateAdded);
                                    const dateB = new Date(b.dateAdded);
                                    return dateB - dateA;
                                })
                                .map(client => createClientObject(client));
                            dispatch(setClientList(clients));
                        } else if (response.error) {
                            toast.error(response.message);
                        }
                    } else if (currentUser.role.rep === 3 && branchList.length > 0 && currentUserBranch) {
                        url = url + '?' + new URLSearchParams({ mode: "view_all_by_branch", branchId: currentUserBranch._id, status: status });
                        const response = await fetchWrapper.get(url);
                        if (response.success) {
                            const clients = await response.clients && response.clients
                                .sort((a, b) => {
                                    const dateA = new Date(a.dateAdded);
                                    const dateB = new Date(b.dateAdded);
                                    return dateB - dateA;
                                })
                                .map(client => createClientObject(client));
                            dispatch(setClientList(clients));
                        } else if (response.error) {
                            toast.error(response.message);
                        }
                    }
                }
            } else if (branchList.length > 0) {
                url = url + '?' + new URLSearchParams({ mode: "view_all_by_branch_codes", currentUserId: currentUser._id, status: status });
                const response = await fetchWrapper.get(url);
                if (response.success) {
                    const clients = await response.clients && response.clients
                        .sort((a, b) => {
                            const dateA = new Date(a.dateAdded);
                            const dateB = new Date(b.dateAdded);
                            return dateB - dateA;
                        })
                        .map(client => createClientObject(client));
                    dispatch(setClientList(clients));
                } else if (response.error) {
                    toast.error(response.message);
                }
            }
        }  else {
            const response = await fetchWrapper.get(url + '?' + new URLSearchParams({ status: status }));
            if (response.success) {
                const clients = await response.clients && response.clients.map(client => createClientObject(client));
                dispatch(setClientList(clients));
            } else if (response.error) {
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([]);
    const [duplicateColumns, setDuplicateColumns] = useState([]);

    const handleEditAction = (row) => {
        setMode("edit");
        let clientData = row;
        setClientParent(clientData);
        handleShowAddDrawer();
    }

    const handleCoMakerAction = (row) => {
        let clientData = row;
        setClientParent(clientData);
        handleShowCoMakerDrawer();
    }

    const handleDeleteAction = (row, index, flag) => {
        let clientData = row;
        setClientParent(clientData);
        setShowDeleteDialog(true);

        if (flag === 'delete') {
            setDeleteMessage({ msg: 'Are you sure you want to delete this client?', btnLabel: 'Yes, delete!' });
        } else if (flag === 'reject') {
            setDeleteMessage({ msg: 'Are you sure you want to reject this client? Note, this will delete the client from the system.', btnLabel: 'Yes, reject!' });
        }
    }

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setClientParent({});
    }

    const handleTransferAction = (row) => {
        setLoading(true)
        let clientData = row;
        if (clientData.status == 'pending')  {
            if (clientData.hasOwnProperty("archived") && clientData.archived == true) {
                clientData.archived = false;
                clientData.archivedBy = currentUser._id;
            } else {
                clientData.archived = true;
                clientData.archivedBy = currentUser._id;
            }
            clientData.archivedDate = moment().format('YYYY-MM-DD');
            delete clientData.group;
            delete clientData.loans;
            delete clientData.lo;
            fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData)
                .then(response => {
                    setTimeout(() => {
                        fetchData();
                    }, 800);
                    toast.success('Client successfully updated.');
                }).catch(error => {
                    console.log(error);
                });
        } else {
            toast.error('Client must be in pending status to transfer.');
        }
    }

    const handleShowClientInfoModal = (row) => {
        let clientData = row;
        dispatch(setClient(clientData));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
    }

    const handleUnmarkDuplicateAction = async (row) => {
        let clientData = row;
        clientData.duplicate = false;
        
        const response = await fetchWrapper.sendData(getApiBaseUrl() + 'clients/', clientData);
        if (response.success) {
            toast.success('Client successfully updated.');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            toast.error('Failed to update client.');
        }
    }

    const handleShowDuplicateClients = (row) => {
        let clientData = row;
        setClientParent(clientData);
        setSearchClientData(clientData);
        setShowSearchModal(true);
    };

    const [dropDownActions, setDropDownActions] = useState([]);
    const [adminDropDownActions, setAdminDropDownActions] = useState([]);

    useEffect(() => {
        if (status != 'active') {
            setDropDownActions([
                {
                    label: 'Edit Client',
                    action: handleEditAction,
                    icon: <Pencil className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Exclude Client',
                    action: handleTransferAction,
                    icon: <UserMinus className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Delete Client',
                    action: handleDeleteAction,
                    icon: <Trash2 className="h-4 w-4 mr-2 text-red-400" />,
                    hidden: false,
                    flag: 'delete'
                },
            ]);
        } else {
            setDropDownActions([
                {
                    label: 'Edit Client',
                    action: handleEditAction,
                    icon: <Pencil className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Update CoMaker',
                    action: handleCoMakerAction,
                    icon: <Users className="h-4 w-4 mr-2" />,
                    hidden: false
                },
            ]);
        }
    }, [status, currentUser]);

    useEffect(() => {
        if (currentUser.role.rep <= 2) {
            setAdminDropDownActions([
                {
                    label: 'Edit Client',
                    action: handleEditAction,
                    icon: <Pencil className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Exclude Client',
                    action: handleTransferAction,
                    icon: <UserMinus className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Update CoMaker',
                    action: handleCoMakerAction,
                    icon: <Users className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Show Duplicate Clients',
                    action: handleShowDuplicateClients,
                    icon: <Users2 className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Approve Duplicate',
                    action: handleUnmarkDuplicateAction,
                    icon: <CheckCircle className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Reject Duplicate',
                    action: handleDeleteAction,
                    icon: <Trash2 className="h-4 w-4 mr-2 text-red-400" />,
                    hidden: false,
                    flag: 'reject'
                },
            ]);
        } else {
            setAdminDropDownActions([
                {
                    label: 'Edit Client',
                    action: handleEditAction,
                    icon: <Pencil className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Exclude Client',
                    action: handleTransferAction,
                    icon: <UserMinus className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Update CoMaker',
                    action: handleCoMakerAction,
                    icon: <Users className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Show Duplicate Clients',
                    action: handleShowDuplicateClients,
                    icon: <Users2 className="h-4 w-4 mr-2" />,
                    hidden: false
                },
                {
                    label: 'Delete Client',
                    action: handleDeleteAction,
                    icon: <Trash2 className="h-4 w-4 mr-2 text-red-400" />,
                    hidden: false
                },
            ]);
        }
    }, [currentUser]);

    const handleDelete = () => {
        if (client) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'clients/delete', {_id: client._id})
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Client successfully deleted.');
                        setLoading(false);
                        getListClient();
                        setClientParent({});
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const fetchData = async () => {
        setLoading(true);
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListClient()]);
            resolve(response);
        });

        if (promise) {
            setLoading(false);
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && fetchData();
        
        return () => {
            mounted = false;
        };
    }, [branchList]);

    useEffect(() => {
        let activeColumns = [];
        if (currentUser.role.rep === 4) {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
                },
                {
                    Header: "Loan Status",
                    accessor: 'loanStatus',
                    Cell: StatusPill
                },
                {
                    Header: "Active Loan",
                    accessor: 'activeLoanStr'
                },
                {
                    Header: "Loan Balance",
                    accessor: 'loanBalanceStr'
                },
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments'
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        } else if (currentUser.role.rep === 3) {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
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
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments',
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        } else {
            activeColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Branch",
                    accessor: 'branchName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Slot No.",
                    accessor: 'slotNo'
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
                // {
                //     Header: "Miss Payments",
                //     accessor: 'missPayments',
                // },
                // {
                //     Header: "No. of Payment",
                //     accessor: 'noOfPayment'
                // },
                {
                    Header: "Delinquent",
                    accessor: 'delinquent',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        }

        setColumns(activeColumns);

        let duplicateColumns = [];
        if (currentUser.role.rep === 4) {
            duplicateColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        } else if (currentUser.role.rep === 3) {
            duplicateColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        } else {
            duplicateColumns = [
                {
                    Header: "Name",
                    accessor: 'name',
                    Cell: AvatarCell,
                    imgAccessor: "profile"
                },
                {
                    Header: "Address",
                    accessor: 'address'
                },
                {
                    Header: "Branch",
                    accessor: 'branchName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Loan Officer",
                    accessor: 'loName',
                    Filter: SelectColumnFilter,
                    filter: 'includes'
                },
                {
                    Header: "Status",
                    accessor: 'status',
                    Cell: StatusPill
                },
                {
                    Header: "CI Name",
                    accessor: 'ciName'
                },
                {
                    Header: "Group Leader",
                    accessor: 'groupLeaderStr'
                },
            ];
        }

        setDuplicateColumns(duplicateColumns);
    }, [currentUser]);

    useEffect(() => {
        if (list) {
            const active = list
                .filter(client => !client.archived && !client?.duplicate)
                .map(client => ({...client}));
                
            const excluded = list
                .filter(client => client.archived)
                .map(client => ({...client}));
                
            const duplicates = list
                .filter(client => client.duplicate)
                .map(client => ({...client}));
    
            setActiveList(active);
            setFilteredActiveList(active);
            setExcludedList(excluded);
            setFilteredExcludedList(excluded);
            setDuplicateList(duplicates);
            setFilteredDuplicateList(duplicates);
        }
    }, [list]);

    return (
        <React.Fragment>
            <div className="pb-4">
                {loading ? (
                    <Spinner />
                ) : (
                    <React.Fragment>
                        {status == 'pending' ? (
                            <React.Fragment>
                                <nav className="flex pl-10 bg-white border-b border-gray-300">
                                    <TabSelector
                                        isActive={selectedTab === "new-prospects"}
                                        onClick={() => setSelectedTab("new-prospects")}>
                                            New Prospects
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "duplicate-prospects"}
                                        onClick={() => setSelectedTab("duplicate-prospects")}>
                                            Duplicate Prospects
                                    </TabSelector>
                                    <TabSelector
                                        isActive={selectedTab === "excluded-prospects"}
                                        onClick={() => setSelectedTab("excluded-prospects")}>
                                            Excluded Prospects
                                    </TabSelector>
                                </nav>
                                {renderFilters()}
                                <TabPanel hidden={selectedTab !== "new-prospects"}>
                                    <TableComponent
                                        columns={columns}
                                        data={filteredActiveList}
                                        hasActionButtons={false} 
                                        dropDownActions={dropDownActions} 
                                        dropDownActionOrigin="client-list"
                                        showFilters={true}
                                        rowClick={handleShowClientInfoModal}
                                    />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "duplicate-prospects"}>
                                    <TableComponent
                                        columns={duplicateColumns}
                                        data={filteredDuplicateList}
                                        // hasActionButtons={true}
                                        // rowActionButtons={rowActionButtonsAdmin}
                                        hasActionButtons={false} 
                                        dropDownActions={adminDropDownActions} 
                                        dropDownActionOrigin="client-list"
                                        showFilters={true}
                                        rowClick={handleShowClientInfoModal}
                                    />
                                </TabPanel>
                                <TabPanel hidden={selectedTab !== "excluded-prospects"}>
                                    <TableComponent
                                        columns={columns}
                                        data={filteredExcludedList}
                                        hasActionButtons={false} 
                                        dropDownActions={dropDownActions} 
                                        dropDownActionOrigin="client-list"
                                        showFilters={true}
                                        rowClick={handleShowClientInfoModal}
                                    />
                                </TabPanel>
                            </React.Fragment>
                        ) : (
                            <TableComponent
                                columns={columns}
                                data={list}
                                hasActionButtons={groupId ? false : true}
                                rowActionButtons={currentUser.role.rep > 2 && rowActionButtons}
                                showFilters={true}
                                rowClick={handleShowClientInfoModal}
                            />
                        )}
                    </React.Fragment>
                )}
            </div>
            <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="70rem">
                <ClientDetailPage />
            </Modal>
            <Dialog show={showDeleteDialog}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <p className="text-2xl font-normal text-dark-color">{ deleteMessage.msg }</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                    <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={handleCancelDelete} />
                    <ButtonSolid label={`${deleteMessage.btnLabel}`} type="button" className="p-2" onClick={handleDelete} />
                </div>
            </Dialog>
            <ClientSearchV2 
                show={showSearchModal}
                onClose={() => setShowSearchModal(false)}
                origin="duplicate_check"
                initialSearchText={searchClientData ? `${searchClientData.firstName} ${searchClientData.lastName}` : ''}
                mode="view"
            />
        </React.Fragment>
    );
}

export default ViewClientsByGroupPage;