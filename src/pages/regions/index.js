import React, { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { PlusIcon } from '@heroicons/react/24/solid';
import TableComponent, { AvatarCell, SelectCell, SelectColumnFilter } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { useRouter } from "node_modules/next/router";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { setAreaList } from "@/redux/actions/areaActions";
import { setRegionList } from "@/redux/actions/regionActions";
import AddUpdateRegion from "@/components/regions/AddUpdateRegionDrawer";
import { getApiBaseUrl } from "@/lib/constants";

const RegionsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.region.list);
    const [loading, setLoading] = useState(true);
    const [managerList, setManagerList] = useState();

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [region, setRegion] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const router = useRouter();

    const getListRegion = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'regions/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.regions.map(region => {
                let areas = '';
                region.areas.map((area, index) => {
                    if (region.areas.length - 1 == index) {
                        areas += area.name;
                    } else {
                        areas += area.name + ', ';
                    }
                });

                let regionManagers = '';
                region.managers.map((manager, index) => {
                    const managerName = `${manager.lastName}, ${manager.firstName}`;
                    if (region.managerIds.length - 1 == index) {
                        regionManagers += managerName;
                    } else {
                        regionManagers += managerName + ', ';
                    }
                });

                let temp = {
                    _id: region._id,
                    name: region.name,
                    managerIds: region.managerIds,
                    regionManagers: regionManagers,
                    areaIds: region.areaIds,
                    areas: areas
                };

                data.push(temp);
            });
            dispatch(setRegionList(data));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListArea = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'areas/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.areas.map(branch => {
                data.push({
                    ...branch,
                    value: branch._id,
                    label: branch.name
                })
            });
            dispatch(setAreaList(data));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListManager = async () => {
        let url = getApiBaseUrl() + 'users/list-by-user-type?' + new URLSearchParams({ userType: 'region' });
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
            Header: "Manager",
            accessor: 'regionManagers'
        },
        {
            Header: "Areas",
            accessor: 'areas'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setRegion({});
        setLoading(true);
        fetchData();
    }

    const actionButtons = [
        <ButtonSolid label="Add Region" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setRegion(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setRegion(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (region) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'regions/delete', region)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Region successfully deleted.');
                        setLoading(false);
                        getListRegion();
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
            const response = await Promise.all([getListRegion(), getListManager(), getListArea()]);
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
        <Layout actionButtons={currentUser.root || (currentUser.role && currentUser.role.rep == 2 && currentUser.role.shortCode != 'area_admin' && currentUser.role.shortCode != 'regional_manager') ? actionButtons : null}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
            <AddUpdateRegion mode={mode} region={region} managerList={managerList} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default RegionsPage;