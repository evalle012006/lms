import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import { setBranchList } from "@/redux/actions/branchActions";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import AddUpdateArea from "@/components/areas/AddUpdateAreaDrawer";
import { setAreaList } from "@/redux/actions/areaActions";

const AreasPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.area.list);
    const [loading, setLoading] = useState(true);
    const [managerList, setManagerList] = useState();

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [area, setArea] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const router = useRouter();

    const getListArea = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'areas/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.areas.map(area => {
                let branchCodes = '';
                area.branches.map((branch, index) => {
                    if (area.branches.length - 1 == index) {
                        branchCodes += branch.code;
                    } else {
                        branchCodes += branch.code + ', ';
                    }
                });

                let areaManagers = '';
                area.managers.map((manager, index) => {
                    const managerName = `${manager.lastName}, ${manager.firstName}`;
                    if (area.managerIds.length - 1 == index) {
                        areaManagers += managerName;
                    } else {
                        areaManagers += managerName + ', ';
                    }
                });

                let temp = {
                    _id: area._id,
                    name: area.name,
                    managerIds: area.managerIds,
                    areaManagers: areaManagers,
                    branchIds: area.branchIds,
                    branches: branchCodes
                };

                data.push(temp);
            });
            dispatch(setAreaList(data));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            let branchList = [];
            response.branches.map(branch => {
                branchList.push({
                    ...branch,
                    value: branch._id,
                    label: branch.name
                })
            });
            branchList = branchList.filter(branch => !branch.hasOwnProperty('areaId'));
            dispatch(setBranchList(branchList));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListManager = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list-by-user-type?' + new URLSearchParams({ userType: 'area' });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.users.map(user => {
                data.push({
                    ...user,
                    value: user._id,
                    label: `${user.lastName}, ${user.firstName}`
                })
            });
            setManagerList(data);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Area Manager",
            accessor: 'areaManagers'
        },
        {
            Header: "Branches",
            accessor: 'branches'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setArea({});
        setLoading(true);
        fetchData();
    }

    const actionButtons = [
        <ButtonSolid label="Add Area" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setArea(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setArea(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (area) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'areas/delete', area)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Area successfully deleted.');
                        setLoading(false);
                        getListArea();
                    } else if (response.error) {
                        setLoading(false);
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    useEffect(() => {
        if ((currentUser.role && currentUser.role.rep > 1)) {
            router.push('/');
        }
    }, []);

    const fetchData = async () => {
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all([getListBranch(), getListManager(), getListArea()]);
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
    }, []);

    return (
        <Layout actionButtons={currentUser.root || (currentUser.role && currentUser.role.rep == 2 && currentUser.role.shortCode != 'area_admin') ? actionButtons : null}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
            <AddUpdateArea mode={mode} area={area} managerList={managerList} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default AreasPage;