import React from 'react';
import { toast } from "react-toastify";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useDispatch, useSelector } from 'react-redux';
import { useState } from 'react';
import { useEffect } from 'react';
import Modal from '@/lib/ui/Modal';
import TableComponent from '@/lib/table';
import Avatar from '@/lib/avatar';
import placeholder from '/public/images/image-placeholder.png';
import moment from 'moment';
import { getApiBaseUrl } from '@/lib/constants';
import { Search, X } from 'lucide-react';

const ClientSearchTool = ({ origin = "", callback, setSelected }) => {
    const dispatch = useDispatch();
    const [searchText, setSearchText] = useState('');
    const [searching, setSearching] = useState(false);
    const [clientList, setClientList] = useState([]);
    const [selectedClient, setSelectedClient] = useState();
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Check for mobile view
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (searchText?.trim()) {
            setSearching(true);
            setCursor(null);
            setHasMore(true);
            
            try {
                const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + new URLSearchParams({ searchText: searchText?.toUpperCase() }));
                const list = [];
                
                if (response.success) {
                    if (response.clients.length === 0) {
                        callback && callback([]);
                        setClientList([]);
                    } else {
                        if (origin === 'client_list') {
                            callback && callback(response.clients);
                        }
                        
                        response.clients.forEach(client => {
                            list.push({
                                ...client,
                                profile: client.profile || '',
                                birthdate: client.birthdate ? moment(client.birthdate).format('YYYY-MM-DD') : '-',
                                groupName: client.group?.name || '-',
                                branchName: client.branch?.name || '-',
                                address: client.address ? client.address.replaceAll('undefined', '') : '-',
                                delinquentStr: client.delinquent ? 'Yes' : 'No'
                            });
                        });
                        setClientList(list);
                    }
                } else {
                    setClientList([]);
                }
            } catch (error) {
                console.error('Search error:', error);
                toast.error('Search failed. Please try again.');
                setClientList([]);
            }
        } else {
            setSearching(false);
            setClientList([]);
        }
        return false;
    };

    const fetchClients = async () => {
        if (!searchText?.trim()) return;
        
        try {
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
                    groupName: client.group?.name || '-',
                    branchName: client.branch?.name || '-',
                    address: client.address ? client.address.replaceAll('undefined', '') : '-',
                    delinquentStr: client.delinquent ? 'Yes' : 'No'
                }));

                setClientList(prevList => cursor ? [...prevList, ...newClients] : newClients);
                setCursor(response.nextCursor);
                setHasMore(!!response.nextCursor);

                if (origin === 'client_list') {
                    callback && callback(newClients);
                }
            }
        } catch (error) {
            console.error('Fetch clients error:', error);
            toast.error('Failed to load more clients.');
        }
    };

    // Load more function
    const loadMore = () => {
        if (hasMore && !searching) {
            fetchClients();
        }
    };

    const handleCloseModal = () => {
        setSelectedClient(null);
        setSearchText('');
        setSearching(false);
        setClientList([]);
        setCursor(null);
        setHasMore(true);
    };

    const handleRowClick = (row) => {
        setSelectedClient(row);
        setSelected && setSelected(row);
    };

    const clearSearch = () => {
        setSearchText('');
        setClientList([]);
        setSearching(false);
        setCursor(null);
        setHasMore(true);
    };

    // Responsive columns based on screen size
    const getColumns = () => {
        const baseColumns = [
            {
                Header: "Name",
                accessor: 'fullName',
                minWidth: 150,
            },
            {
                Header: "Status",
                accessor: 'status',
                minWidth: 80,
            }
        ];

        const desktopColumns = [
            {
                Header: "Name",
                accessor: 'fullName',
                minWidth: 150,
            },
            {
                Header: "Address",
                accessor: 'address',
                minWidth: 180,
            },
            {
                Header: "Birthdate",
                accessor: 'birthdate',
                minWidth: 100,
            },
            {
                Header: "Delinquent",
                accessor: 'delinquentStr',
                minWidth: 90,
            },
            {
                Header: "Branch",
                accessor: 'branchName',
                minWidth: 120,
            },
            {
                Header: "Group",
                accessor: 'groupName',
                minWidth: 120,
            },
            {
                Header: "Status",
                accessor: 'status',
                minWidth: 80,
            }
        ];

        return isMobile ? baseColumns : desktopColumns;
    };

    useEffect(() => {
        let mounted = true;
        return () => {
            mounted = false;
        };
    }, [origin]);

    return (
        <div className='flex flex-col w-full'>
            <form onSubmit={handleSubmit} className="w-full">
                <div className="relative w-full">
                    <div className="relative">
                        <input 
                            className="w-full bg-white border-2 border-gray-300 rounded-lg h-12 pl-12 pr-12 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 placeholder-gray-400" 
                            autoComplete='off' 
                            value={searchText} 
                            onChange={(e) => setSearchText(e.target.value)} 
                            type="search" 
                            name="search" 
                            placeholder="Search for Client Name..."
                        />
                        
                        {/* Search Icon */}
                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                            <Search className="w-5 h-5 text-gray-400" />
                        </div>
                        
                        {/* Clear Button */}
                        {searchText && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-12 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full transition-colors duration-200"
                            >
                                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                            </button>
                        )}
                        
                        {/* Submit Button */}
                        <button 
                            type="submit" 
                            disabled={!searchText?.trim()}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors duration-200"
                        >
                            <Search className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {/* Search suggestions or recent searches could go here */}
                    {searchText && !searching && clientList.length === 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg mt-1 p-3 shadow-lg z-10">
                            <p className="text-sm text-gray-500">Press Enter to search for "{searchText}"</p>
                        </div>
                    )}
                </div>
            </form>
            
            {searching && (
                <Modal 
                    title={
                        <div className="flex items-center justify-between w-full">
                            <span className="text-lg font-semibold">
                                Search Results for: <span className="text-blue-600">"{searchText.toUpperCase()}"</span>
                            </span>
                            {clientList.length > 0 && (
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                                    {clientList.length} result{clientList.length !== 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                    } 
                    show={searching} 
                    onClose={handleCloseModal}
                    size={isMobile ? "full" : "5xl"}
                >
                    <div className="flex flex-col items-center font-proxima">
                        {selectedClient && (
                            <div className="w-full mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                                <div className="flex flex-col sm:flex-row items-center space-y-4 sm:space-y-0 sm:space-x-4">
                                    <Avatar 
                                        name={selectedClient?.fullName} 
                                        src={selectedClient?.profile || placeholder.src} 
                                        className="w-16 h-16 sm:w-20 sm:h-20" 
                                    />
                                    <div className="text-center sm:text-left">
                                        <h5 className="text-xl font-semibold text-gray-900 mb-2">
                                            {selectedClient?.fullName}
                                        </h5>
                                        <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                                            <span className="bg-green-100 text-green-800 text-sm font-medium px-3 py-1 rounded-full">
                                                {selectedClient?.status}
                                            </span>
                                            {selectedClient?.delinquentStr === 'Yes' && (
                                                <span className="bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full">
                                                    Delinquent
                                                </span>
                                            )}
                                        </div>
                                        <div className="mt-2 text-sm text-gray-600">
                                            <p>{selectedClient?.branchName} • {selectedClient?.groupName}</p>
                                            {selectedClient?.address !== '-' && (
                                                <p className="mt-1">{selectedClient?.address}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        <div className="w-full">
                            {clientList.length === 0 ? (
                                <div className="text-center py-12">
                                    <div className="w-24 h-24 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                        <Search className="w-12 h-12 text-gray-400" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No clients found</h3>
                                    <p className="text-gray-500">
                                        No clients match your search term "{searchText}". 
                                        Try adjusting your search criteria.
                                    </p>
                                </div>
                            ) : (
                                <>
                                    <div className="overflow-x-auto">
                                        <TableComponent 
                                            columns={getColumns()} 
                                            pageSize={isMobile ? 5 : 8} 
                                            data={clientList} 
                                            rowClick={handleRowClick} 
                                            hasActionButtons={false} 
                                            showFilters={false} 
                                            noPadding={true} 
                                            border={true}
                                            selectedRowId={selectedClient?._id}
                                        />
                                    </div>
                                    
                                    {hasMore && (
                                        <div className="text-center mt-6">
                                            <button 
                                                onClick={loadMore} 
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors duration-200 inline-flex items-center space-x-2"
                                                disabled={searching}
                                            >
                                                <Search className="w-4 h-4" />
                                                <span>Load More Results</span>
                                            </button>
                                        </div>
                                    )}
                                    
                                    {!hasMore && clientList.length > 0 && (
                                        <div className="text-center mt-6 text-gray-500">
                                            <p className="text-sm">End of search results</p>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
};

export default ClientSearchTool;