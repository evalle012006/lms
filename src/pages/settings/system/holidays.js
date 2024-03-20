import React, { useEffect, useRef, useState } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useSelector, useDispatch } from 'react-redux';
import { toast } from "react-toastify";
import Spinner from '@/components/Spinner';
import ButtonSolid from '@/lib/ui/ButtonSolid';
import { PlusIcon } from '@heroicons/react/24/solid';
import { setHolidayList } from '@/redux/actions/holidayActions';
import Dialog from '@/lib/ui/Dialog';
import ButtonOutline from '@/lib/ui/ButtonOutline';
import AddUpdateHoliday from '@/components/settings/holidays/AddUpdateHoliday';
import TableComponent, { SelectColumnFilter } from '@/lib/table';
import moment from 'moment';
import { getApiBaseUrl } from '@/lib/constants';

const HolidaysSettingsPage = (props) => {
    const currentUser = useSelector(state => state.user.data);
    const list = useSelector(state => state.holidays.list);
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentDate = useSelector(state => state.systemSettings.currentDate);

    const [showAddDrawer, setShowAddDrawer] = useState(false);
    const [mode, setMode] = useState('add');
    const [holiday, setHoliday] = useState();

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'name',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Description",
            accessor: 'description',
            Filter: SelectColumnFilter,
            filter: 'includes'
        },
        {
            Header: "Date",
            accessor: 'dateStr',
            Filter: SelectColumnFilter,
            filter: 'includes'
        }
    ]);

    const handleShowAddDrawer = () => {
        setShowAddDrawer(true);
    }

    const handleCloseAddDrawer = () => {
        setLoading(true);
        setMode('add');
        setHoliday({});
        getListHoliday();
    }

    const handleEditAction = (row) => {
        setMode("edit");
        setHoliday(row.original);
        handleShowAddDrawer();
    }

    const handleDeleteAction = (row) => {
        setHoliday(row.original);
        setShowDeleteDialog(true);
    }

    const rowActionButtons = [
        { label: 'Edit', action: handleEditAction },
        { label: 'Delete', action: handleDeleteAction }
    ];

    const handleDelete = () => {
        if (holiday) {
            setLoading(true);
            fetchWrapper.postCors(getApiBaseUrl() + 'settings/holidays/delete', holiday)
                .then(response => {
                    if (response.success) {
                        setShowDeleteDialog(false);
                        toast.success('Holiday successfully deleted.');
                        getListHoliday();
                        setLoading(false);
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
        if ((currentUser.role && currentUser.role.rep > 2)) {
            router.push('/');
        }
    }, []);

    const getListHoliday = async () => {
        let url = getApiBaseUrl() + 'settings/holidays/list';
        const response = await fetchWrapper.get(url);
        if (response.success) {
            const holidays = response.holidays.map(h => {
                let temp = {...h};
                
                const tempDate = moment(currentDate).year() + '-' + temp.date;
                temp.dateStr = moment(tempDate).format('MMMM DD');

                return temp;
            });
            dispatch(setHolidayList(holidays));
            setLoading(false);
        } else if (response.error) {
            setLoading(false);
            toast.error(response.message);
        }
    }

    useEffect(() => {
        let mounted = true;
        
        mounted && setLoading(false);

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            {loading ? (
                    <div className="absolute top-1/2 left-1/2">
                        <Spinner />
                    </div>
                ) : (
                    <div className="profile-photo bg-white rounded-lg p-3 proxima-regular mt-10 w-11/12 lg:mt-0 m-4">
                        <div className='flex flex-row justify-between'>
                            <div className="proxima-bold mt-2">Holiday Settings</div>
                            <div className='w-1/6'>
                                <ButtonSolid label="Add Holiday" type="button" className="p-2 mr-3" onClick={handleShowAddDrawer} icon={[<PlusIcon className="w-5 h-5" />, 'left']} />
                            </div>
                        </div>
                        <div className='mt-8'>
                            <TableComponent columns={columns} data={list} hasActionButtons={true} rowActionButtons={rowActionButtons} showFilters={false} />
                        </div>
                        <AddUpdateHoliday mode={mode} holiday={holiday} showSidebar={showAddDrawer} setShowSidebar={setShowAddDrawer} onClose={handleCloseAddDrawer} />
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
                    </div>
                )
            }
        </React.Fragment>
    );
}

export default HolidaysSettingsPage;