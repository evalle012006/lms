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

const ClientSearchTool = ({ origin = "", callback, setSelected }) => {
    const dispatch = useDispatch();
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [clientList, setClientList] = useState([]);
    const [selectedClient, setSelectedClient] = useState();
    const [toolbarWidth, setToolbarWidth] = useState("40rem");
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (searchText) {
            setSearching(true);
            setCursor(null); // Reset cursor on new search
            setHasMore(true);
            await fetchClients();
        } else {
            setSearching(false);
        }
        return false;
    }

    const fetchClients = async () => {
        const imgpath = process.env.NEXT_PUBLIC_LOCAL_HOST !== 'local' && process.env.NEXT_PUBLIC_LOCAL_HOST;
        const params = new URLSearchParams({ 
            searchText: searchText.toUpperCase(),
            cursor: cursor || ''
        });
        const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + params);
        
        if (response.success) {
            const newClients = response.clients.map(client => ({
                ...client,
                imgUrl: client.profile ? imgpath + '/images/clients/' + client.profile : '',
                birthdate: client.birthdate ? moment(client.birthdate).format('YYYY-MM-DD') : '-',
                groupName: client.group.name,
                branchName: client.branch.name,
                address: client.address ? client.address.replaceAll('undefined', '') : '-',
                delinquentStr: client.delinquent ? 'Yes' : 'No'
            }));

            setClientList(prevList => cursor ? [...prevList, ...newClients] : newClients);
            setCursor(response.nextCursor);
            setHasMore(!!response.nextCursor);

            if (origin == 'client_list') {
                callback(newClients);
            }
        }
    }

    // Add a load more function
    const loadMore = () => {
        if (hasMore) {
            fetchClients();
        }
    }

    const handleCloseModal = () => {
        setSelectedClient({});
        setSearchText('');
        setSearching(false);
    }

    const handleRowClick = (row) => {
        setSelectedClient(row);
        setSelected && setSelected(row);
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

        if (origin == 'client_list') {
            setToolbarWidth("29.5rem");
        }

        return (() => {
            mounted = false;
        });
    }, [origin]);

    return (
        <div className='flex flex-col w-full'>
            <form onSubmit={handleSubmit}>
                <div className="pt-2 relative mx-auto text-gray-600" style={{ width: toolbarWidth }}>
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
                                <Avatar name={selectedClient?.fullName} src={selectedClient?.profile ? selectedClient?.imgUrl : placeholder.src} />
                                <h5 className="mb-1 text-xl font-medium text-gray-900">{selectedClient?.fullName}</h5>
                                <span className="bg-green-100 text-green-800 text-sm font-medium mr-2 px-2.5 py-0.5 rounded dark:bg-green-200 dark:text-green-900">{ selectedClient?.status }</span>
                            </React.Fragment>
                        )}
                        <div className="flex flex-col mt-4 md:mt-6">
                            <TableComponent 
                                columns={columns} 
                                pageSize={8} 
                                data={clientList} 
                                rowClick={handleRowClick} 
                                hasActionButtons={false} 
                                showFilters={false} 
                                noPadding={true} 
                                border={true} 
                            />
                            {hasMore && (
                                <button onClick={loadMore} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
                                    Load More
                                </button>
                            )}
                        </div>
                    </div>
                </Modal>
            ) }
        </div>
    )
}

export default ClientSearchTool;