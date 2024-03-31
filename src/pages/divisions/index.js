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
import { setRegionList } from "@/redux/actions/regionActions";
import { setDivisionList } from "@/redux/actions/divisionActions";
import AddUpdateDivision from "@/components/divisions/AddUpdateDivisionDrawer";

const DivisionsPage = () => {
    const dispatch = useDispatch();
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.division.list);
    const [loading, setLoading] = useState(true);
    const [managerList, setManagerList] = useState();

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [division, setDivision] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const router = useRouter();

    const getListDivision = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'divisions/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.divisions.map(division => {
                let regions = '';
                division.regions.map((region, index) => {
                    if (division.regions.length - 1 == index) {
                        regions += region.name;
                    } else {
                        regions += region.name + ', ';
                    }
                });

                let divisionManagers = '';
                division.managers.map((manager, index) => {
                    const managerName = `${manager.lastName}, ${manager.firstName}`;
                    if (division.managerIds.length - 1 == index) {
                        divisionManagers += managerName;
                    } else {
                        divisionManagers += managerName + ', ';
                    }
                });

                let temp = {
                    _id: division._id,
                    name: division.name,
                    managerIds: division.managerIds,
                    divisionManagers: divisionManagers,
                    regionIds: division.regionIds,
                    regions: regions
                };

                data.push(temp);
            });
            dispatch(setDivisionList(data));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListRegion = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'regions/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const data = [];
            response.regions.map(region => {
                data.push({
                    ...region,
                    value: region._id,
                    label: region.name
                })
            });
            dispatch(setRegionList(data));
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    const getListManager = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'users/list-by-user-type?' + new URLSearchParams({ userType: 'deputy' });
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
            accessor: 'divisionManagers'
        },
        {
            Header: "Regions",
            accessor: 'regions'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setDivision({});
        setLoading(true);
        fetchData();
    }

    const actionButtons = [
        <ButtonSolid label="Add Division" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
    ];

    const handleEditAction = (row) => {
        setMode("edit");
        setDivision(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setDivision(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (division) {
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'divisions/delete', division)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Division successfully deleted.');
                        setLoading(false);
                        getListDivision();
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
            const response = await Promise.all([getListDivision(), getListManager(), getListRegion()]);
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
        <Layout actionButtons={currentUser.root ? actionButtons : null}>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />}
            </div>
            <AddUpdateDivision mode={mode} division={division} managerList={managerList} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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

export default DivisionsPage;