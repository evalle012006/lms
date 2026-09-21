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
import { useRouter } from "next/router";
// NEW — see save-client-partial.js. `clients/` PUT does not reliably merge
// partial payloads with the existing DB record; handleTransferAction and
// handleUnmarkDuplicateAction below used to mutate the table row in place
// and send it directly, which is fragile in its own right (see notes below)
// and, more importantly, is exactly the shape of call that produced null
// firstName/lastName on both offset and prospect clients elsewhere in this
// app. Route both through the same safe utility instead of hand-rolling
// the payload here too.
import { saveClientPartial } from "@/lib/clients/save-client-partial";

const ViewClientsByGroupPage = ({
    groupId, status, client, setClientParent, setMode,
    handleShowAddDrawer,
    handleShowCoMakerDrawer
}) => {
    const router = useRouter();
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const currentBranch = useSelector(state => state.branch.data);
    const list = useSelector(state => state.client.list);
    const [activeList, setActiveList] = useState();
    const [excludedList, setExcludedList] = useState();
    const [duplicateList, setDuplicateList] = useState();
    const [loading, setLoading] = useState(true);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);

    const [filteredActiveList, setFilteredActiveList] = useState([]);
    const [filteredDuplicateList, setFilteredDuplicateList] = useState([]);
    const [filteredExcludedList, setFilteredExcludedList] = useState([]);

    const [deleteMessage, setDeleteMessage] = useState({ msg: '', btnLabel: '' });

    const [showSearchModal, setShowSearchModal] = useState(false);
    const [searchClientData, setSearchClientData] = useState(null);

    const [filteredList, setFilteredList] = useState([]);

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

    const getFilteredOptions = (list) => {
        if (!list) return { branches: [], los: [], groups: [], clients: [] };

        const branches = [...new Set(list.map(item => item.branchName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        let branchFiltered = list;
        if (filters.branch) {
            branchFiltered = list.filter(item => item.branchName === filters.branch);
        }

        const los = [...new Set(branchFiltered.map(item => item.loName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        let loFiltered = branchFiltered;
        if (filters.lo) {
            loFiltered = branchFiltered.filter(item => item.loName === filters.lo);
        }

        const groups = [...new Set(loFiltered.map(item => item.groupName))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b));

        let groupFiltered = loFiltered;
        if (filters.group) {
            groupFiltered = loFiltered.filter(item => item.groupName === filters.group);
        }

        const clients = groupFiltered;

        return { branches, los, groups, clients };
    };

    const handleFilterChange = (field, value) => {
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

        let listToFilter;
        if (status === 'pending') {
            listToFilter = selectedTab === 'new-prospects' ? activeList :
                           selectedTab === 'duplicate-prospects' ? duplicateList :
                           selectedTab === 'excluded-prospects' ? excludedList : [];
        } else {
            listToFilter = list;
        }

        if (!listToFilter || listToFilter.length === 0) return;

        let filteredData = listToFilter;
        if (newFilters.branch) {
            filteredData = filteredData.filter(item => item.branchName === newFilters.branch);
        }

        if (newFilters.lo) {
            filteredData = filteredData.filter(item => item.loName === newFilters.lo);
        }

        if (newFilters.group) {
            filteredData = filteredData.filter(item => item.groupName === newFilters.group);
        }

        if (newFilters.name) {
            const searchTerm = newFilters.name.toLowerCase();
            filteredData = filteredData.filter(item => {
                const fullName = item.name?.toLowerCase() || '';
                const firstName = item.firstName?.toLowerCase() || '';
                const lastName = item.lastName?.toLowerCase() || '';

                return fullName.includes(searchTerm) ||
                       firstName.includes(searchTerm) ||
                       lastName.includes(searchTerm);
            });
        }

        if (status === 'pending') {
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
        } else {
            setFilteredList(filteredData);
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
        let listToUse;
        if (status === 'pending') {
            listToUse = getCurrentList();
        } else {
            listToUse = list;
        }

        const { branches, los, groups } = getFilteredOptions(listToUse);

        return (
            <div className="p-4 bg-white shadow mb-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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

                    <select
                        className="p-2 w-full border rounded-md"
                        value={filters.lo}
                        onChange={(e) => handleFilterChange('lo', e.target.value)}
                    >
                        <option value="">All Loan Officers</option>
                        {los.map((lo) => (
                            <option key={lo} value={lo}>{lo}</option>
                        ))}
                    </select>

                    <select
                        className="p-2 w-full border rounded-md"
                        value={filters.group}
                        onChange={(e) => handleFilterChange('group', e.target.value)}
                    >
                        <option value="">All Groups</option>
                        {groups.map((group) => (
                            <option key={group} value={group}>{group}</option>
                        ))}
                    </select>

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
                        />
                    </div>
                </div>
            </div>
        );
    };

    const createClientObject = (client) => {
        const name = `${client.lastName}, ${client.firstName} ${client.middleName}`;
        const ciName = client?.ciName || '';

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
            groupLeaderStr: client.groupLeader ? 'Yes' : 'No',
            archived: client.archived || false,
            archivedBy: client.archivedBy || '',
            archivedDate: client.archivedDate || '',
        };
    };

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
        if (currentBranch?.clientFlowVersion === 'v1') {
            setMode("edit");
            let clientData = row;
            setClientParent(clientData);
            handleShowAddDrawer();
        } else {
            router.push(`/clients/edit/${row._id}`);
        }
    };

    const handleCoMakerAction = (row) => {
        let clientData = row;
        setClientParent(clientData);
        handleShowCoMakerDrawer();
    }

    const handleDeleteAction = (row, index, flag) => {
        let clientData = row;
        setClientParent(clientData);
        setShowDeleteDialog(true);

        if (flag === 'delete' || !flag) {
            setDeleteMessage({ msg: 'Are you sure you want to delete this client?', btnLabel: 'Yes, delete!' });
        } else if (flag === 'reject') {
            setDeleteMessage({ msg: 'Are you sure you want to reject this client? Note, this will delete the client from the system.', btnLabel: 'Yes, reject!' });
        }
    }

    const handleCancelDelete = () => {
        setShowDeleteDialog(false);
        setClientParent({});
    }

    // FIXED — previously: mutated `row` in place, sent it as-is (`{...client,
    // ...display-derived fields}` from createClientObject, so this was
    // probably safe today, but only by accident — nothing prevented a future
    // change to createClientObject or the API response shape from silently
    // dropping firstName/lastName the way ClientQuickEditModal's 3-field
    // payload did). Also fixed: the original swallowed request failures
    // with a bare console.log and no toast, and never reset `setLoading`
    // on that path — a failed exclude left the page's spinner stuck forever.
    const handleTransferAction = async (row) => {
        if (row.status !== 'pending') {
            toast.error('Client must be in pending status to transfer.');
            return;
        }

        setLoading(true);
        const willBeArchived = !(row.archived === true);

        const res = await saveClientPartial(row._id, {
            archived: willBeArchived,
            archivedBy: currentUser._id,
            archivedDate: moment().format('YYYY-MM-DD'),
        });

        if (res.success) {
            toast.success('Client successfully updated.');
            setTimeout(() => {
                fetchData();
            }, 800);
        } else {
            toast.error(res.message || 'Failed to update client.');
            setLoading(false);
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

    // FIXED — same reasoning as handleTransferAction above.
    const handleUnmarkDuplicateAction = async (row) => {
        const response = await saveClientPartial(row._id, { duplicate: false });
        if (response.success) {
            toast.success('Client successfully updated.');
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } else {
            toast.error(response.message || 'Failed to update client.');
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
            setFilteredList(list);
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
                            <React.Fragment>
                                {renderFilters()}
                                <TableComponent
                                    columns={columns}
                                    data={filteredList}
                                    hasActionButtons={false}
                                    dropDownActions={dropDownActions}
                                    dropDownActionOrigin="client-list"
                                    showFilters={true}
                                    rowClick={handleShowClientInfoModal}
                                />
                            </React.Fragment>
                        )}
                    </React.Fragment>
                )}
            </div>
            <Modal title="Client Detail Info" show={showClientInfoModal} onClose={handleCloseClientInfoModal} width="70rem" size="xl">
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