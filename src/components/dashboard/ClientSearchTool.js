import React from 'react';
import { toast } from "react-toastify";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useDispatch, useSelector } from 'node_modules/react-redux/es/exports';
import { useState } from 'react';
import { useEffect } from 'react';
import Modal from '@/lib/ui/Modal';
import TableComponent from '@/lib/table';
import Avatar from '@/lib/avatar';
import placeholder from '/public/images/image-placeholder.png';
import moment from 'moment';
import { getApiBaseUrl } from '@/lib/constants';

const ClientSearchTool = () => {
    const dispatch = useDispatch();
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [clientList, setClientList] = useState([]);
    const [selectedClient, setSelectedClient] = useState();

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (searchText) {
            setSearching(true);
            const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
            const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + new URLSearchParams({ searchText: searchText.toUpperCase() }));
            const list = [];
            if (response.success) {
                response.clients.map(client => {
                    list.push({
                        ...client,
                        imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                        birthdate: client.birthdate?  moment(client.birthdate).format('YYYY-MM-DD') : '-',
                        groupName: client.group.name,
                        branchName: client.branch.name,
                        address: client.address ? client.address.replaceAll('undefined', '') : '-',
                        delinquentStr: client.delinquent ? 'Yes' : 'No'
                    });
                });

                setClientList(list);
            }
        } else {
            setSearching(false);
        }

        return false;
    }

    const handleCloseModal = () => {
        setSelectedClient({});
        setSearchText('');
        setSearching(false);
    }

    const handleRowClick = (row) => {
        setSelectedClient(row);
    }

    const [columns, setColumns] = useState([
        {
            Header: "Name",
            accessor: 'fullName',
        },
        {
            Header: "Address",
            accessor: 'address',
        },
        {
            Header: "Birthdate",
            accessor: 'birthdate',
        },
        {
            Header: "Deliqnuent",
            accessor: 'delinquentStr',
        },
        {
            Header: "Branch Name",
            accessor: 'branchName',
        },
        {
            Header: "Group Name",
            accessor: 'groupName',
        },
        {
            Header: "Status",
            accessor: 'status',
        }
    ]);

    useEffect(() => {
        let mounted = true;

        return (() => {
            mounted = false;
        });
    }, []);

    return (
        <div className='flex flex-col w-full'>
            <form onSubmit={handleSubmit}>
                <div className="pt-2 relative mx-auto text-gray-600" style={{ width: '40rem' }}>
                    <input className="border-2 border-gray-300 bg-white h-10 px-5 pr-16 rounded-lg text-sm w-full focus:outline-none" autoComplete='off' value={searchText} onChange={(e) => setSearchText(e.target.value)} type="search" name="search" placeholder="Search for Client Name"/>
                    <button type="submit" className="absolute right-0 top-0 mt-5 pr-2">
                        <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                        </svg>
                    </button>
                </div>
            </form>
            { searching && (
                <Modal title={`Search Result for: ${searchText.toUpperCase()}`} show={searching} onClose={handleCloseModal}>
                    <div className="flex flex-col items-center font-proxima">
                        {selectedClient && (
                            <React.Fragment>
                                <Avatar name={selectedClient?.fullName} src={selectedClient?.profile ? selectedClient?.imgUrl : placeholder.src} className={`${selectedClient?.profile ? 'p-20' : 'p-12 mx-auto'} `} />
                                <h5 className="mb-1 text-xl font-medium text-gray-900">{selectedClient?.fullName}</h5>
                                <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-green-200 dark:text-green-900">{ selectedClient?.status }</span>
                            </React.Fragment>
                        )}
                        <div className="flex flex-col mt-4 md:mt-6">
                            <TableComponent columns={columns} pageSize={8} data={clientList} rowClick={handleRowClick} hasActionButtons={false} showFilters={false} noPadding={true} border={true} />
                        </div>
                    </div>
                </Modal>
            ) }
        </div>
    )
}

export default ClientSearchTool;