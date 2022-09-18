import React, { useEffect, useState } from "react";
import TableComponent, { SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import toast from 'react-hot-toast';
import { useRouter } from "node_modules/next/router";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setClientList } from "@/redux/actions/clientActions";

const ViewClientsByGroupPage = ({branchId, groupId, client, setClient, setMode, handleShowAddDrawer}) => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const groupList = useSelector(state => state.group.list);
    const list = useSelector(state => state.client.list);
    const [loading, setLoading] = useState(true);

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [rootUser, setRootUser] = useState(currentUser.root ? currentUser.root : false);
    const router = useRouter();

    const getListClient = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'clients/list';

        if (groupId) {
            url = url + '?' + new URLSearchParams({ groupId: groupId })
        } else if (branchId) {
            url = url + '?' + new URLSearchParams({ branchId: branchId })
        }

        const response = await fetchWrapper.get(url);
        if (response.success) {
            let clients = [];
            await response.clients && response.clients.map(client => {
                clients.push({
                    ...client,
                    loanStatus: client.loans.length > 0 ? client.loans[0].status : '-',
                    activeLoan: client.loans.length > 0 ?  client.loans[0].activeLoan : 0.00,
                    loanBalance: client.loans.length > 0 ?  client.loans[0].loanBalance : 0.00,
                    missPayments: client.loans.length > 0 ?  client.loans[0].missPayments : 0,
                    noOfPayment: client.loans.length > 0 ? client.loans[0].noOfPayment : 0,
                    delinquent: client.delinquent === true ? 'Yes' : 'No'
                });
            });
            
            if (currentUser.root !== true && currentUser.role.rep === 4) { 
                // get all groups for this lo
                // then filter the clients that is under that groups
                let clientPerGroup = [];
                groupList.map(group => {
                    clients && clients.map(c => {
                        if (c.groupId === group._id) {
                            clientPerGroup.push({...c});
                        }
                    });
                });
                dispatch(setClientList(clientPerGroup));
            } else {
                dispatch(setClientList(clients));
            }
        } else if (response.error) {
            toast.error(response.message);
        }

        setLoading(false);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Last Name",
            accessor: 'lastName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "First Name",
            accessor: 'firstName',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Middle Name",
            accessor: 'middleName',
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
            Header: "Loan Status",
            accessor: 'loanStatus',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Active Loan",
            accessor: 'activeLoan',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalance',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Miss Payments",
            accessor: 'missPayments',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "No. of Payment",
            accessor: 'noOfPayment',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Status",
            accessor: 'status',
            Cell: StatusPill,
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Delinquent",
            accessor: 'delinquent',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleEditAction = (row) => {
        setMode("edit");
        setClient(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setClient(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (client) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'clients/delete', {_id: client._id})
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Client successfully deleted.');
                        setLoading(false);
                        getListClient();
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    useEffect(() => {
        let mounted = true;

        if (groupList.length > 0) {
            mounted && getListClient();
        }

        return () => {
            mounted = false;
        };
    }, [groupList]);

    return (
        <React.Fragment>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={groupId ? false : true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
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
        </React.Fragment>
    );
}

export default ViewClientsByGroupPage;