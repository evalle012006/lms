import React, { useState, useEffect } from 'react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import Modal from '@/lib/ui/Modal';
import TableComponent, { AvatarCell, StatusPill } from '@/lib/table';
import moment from 'moment';
import { getApiBaseUrl } from '@/lib/constants';
import AddUpdateClient from './AddUpdateClientDrawer';
import ClientDetailPage from './ClientDetailPage';
import { setClient } from '@/redux/actions/clientActions';
import { useDispatch } from 'react-redux';
import { useRef } from 'react';
import { formatPricePhp } from '@/lib/utils';

const ClientSearchV2 = ({ 
    show, 
    onClose, 
    origin = "", 
    callback, 
    mode, 
    initialSearchText = '',
    handleShowAddDrawer,
    showAddDrawer, 
    setShowAddDrawer, 
    handleCloseAddDrawer, 
    client 
}) => {
    const dispatch = useDispatch();
    const [searchText, setSearchText] = useState(initialSearchText);
    const [searching, setSearching] = useState(false);
    const [clientList, setClientList] = useState([]);
    const [selectedClient, setSelectedClient] = useState();
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [showClientInfoModal, setShowClientInfoModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(show);
    const searchFormRef = useRef(null);

    const handleSearch = async (e, search) => {
        if (e) {
            e.preventDefault();
        }
        const searchStr = search || searchText;
        if (searchStr) {
            setSearching(true);
            const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + new URLSearchParams({ 
                searchText: searchStr?.toUpperCase(),
                mode: 'duplicate',
                cursor: ''
            }));
            
            if (response.success) {
                const list = response.clients.map(client => {
                    const filteredList = client.loans.filter(loan => loan.status != 'reject');
                    const lastLoan = filteredList.length > 0 ? filteredList[0] : null;
                    const pastDueStr = lastLoan ? lastLoan.pastDue > 0 ? formatPricePhp(lastLoan.pastDue) : '-' : '-';
                    return {
                        ...client,
                        profile: client.profile || '',
                        birthdate: client.birthdate ? moment(client.birthdate).format('YYYY-MM-DD') : '-',
                        groupName: client.group.name,
                        branchName: client.branch.name,
                        address: client.address ? client.address.replaceAll('undefined', '') : '-',
                        delinquentStr: client.delinquent ? 'Yes' : 'No',
                        pastDueStr: pastDueStr,
                    }
                });

                setClientList(list);
                setCursor(response.nextCursor);
                setHasMore(!!response.nextCursor);

                if (callback && origin === 'client_list') {
                    callback(list);
                }
            }
        }
        return false;
    }

    const loadMore = async () => {
        if (hasMore) {
            const params = new URLSearchParams({ 
                searchText: searchText.toUpperCase(),
                cursor: cursor || ''
            });
            const response = await fetchWrapper.get(getApiBaseUrl() + 'clients/search?' + params);
            
            if (response.success) {
                const newClients = response.clients.map(client => ({
                    ...client,
                    profile: client.profile || '',
                    birthdate: client.birthdate ? moment(client.birthdate).format('YYYY-MM-DD') : '-',
                    groupName: client.group.name,
                    branchName: client.branch.name,
                    address: client.address ? client.address.replaceAll('undefined', '') : '-',
                    delinquentStr: client.delinquent ? 'Yes' : 'No'
                }));

                setClientList(prev => [...prev, ...newClients]);
                setCursor(response.nextCursor);
                setHasMore(!!response.nextCursor);
            }
        }
    }

    const handleCloseModal = () => {
        setSelectedClient(null);
        setSearchText('');
        setSearching(false);
        setClientList([]);
        setShowSearchModal(false);
        onClose();
    }

    const handleRowClick = (row) => {
        setSelectedClient(row);
        handleShowClientInfoModal(row);
        setShowSearchModal(false);
    }

    const handleAddClient = () => {
        handleCloseModal();
        setTimeout(() => {
            handleShowAddDrawer();
        }, 100);
    }

    const handleShowClientInfoModal = (selected) => {
        const updatedClient = {...selected, profile: selected.profile ? selected.profile : ''};
        dispatch(setClient(updatedClient));
        setShowClientInfoModal(true);
    }

    const handleCloseClientInfoModal = () => {
        setShowClientInfoModal(false);
        setTimeout(async () => {
            window.location.reload();
        }, 1000);
    }

    const handleBackToSearch = () => {
        setShowClientInfoModal(false);
        setShowSearchModal(true);
    }

    useEffect(() => {
        if (show && initialSearchText) {
            setSearchText(initialSearchText);
            // We need to wait for the next render cycle for the form to be available
            setTimeout(() => {
                handleSearch(null, initialSearchText);
            }, 0);
        }
    }, [show, initialSearchText]);

    useEffect(() => {
        setShowSearchModal(show);
    }, [show]);

    const columns = [
        {
            Header: "Name",
            accessor: 'fullName',
            Cell: AvatarCell,
            imgAccessor: "profile"
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
            Header: "Past Due",
            accessor: 'pastDueStr',
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
            Cell: StatusPill
        }
    ];

    return (
        <>
            <Modal 
                show={showSearchModal} 
                onClose={handleCloseModal}
                title="Client Search"
                width="65rem"
            >
                <div className="flex flex-col w-full space-y-6">
                    <form onSubmit={handleSearch} ref={searchFormRef} className="w-full">
                        <div className="relative">
                            <input 
                                className="border-2 border-gray-300 bg-white h-10 px-5 pr-16 rounded-lg text-sm w-full focus:outline-none"
                                autoComplete='off'
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                type="search"
                                name="search"
                                placeholder="Search for Client Name"
                            />
                            <button type="submit" className="absolute right-0 top-0 mt-2 mr-4">
                                <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z"/>
                                </svg>
                            </button>
                        </div>
                    </form>

                    {/* {searching && ( */}
                        <div className="flex flex-col items-center font-proxima">
                            {clientList.length > 0 ? (
                                <div className="w-full">
                                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
                                        <div className="flex">
                                            <div className="ml-3">
                                                <p className="text-sm text-yellow-700">
                                                    Please carefully check the search results to avoid creating duplicate client records.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
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
                                        <div className="flex justify-center mt-4">
                                            <button 
                                                onClick={loadMore} 
                                                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                                            >
                                                Load More
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="flex flex-col items-center py-8">
                                    <p className="text-gray-600 text-lg mb-4">No existing client found</p>
                                </div>
                            )}
                            {searching && (
                                <div className="flex justify-end w-full mt-6">
                                    <button 
                                        onClick={handleAddClient}
                                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                                    >
                                        Add Client
                                    </button>
                                </div>
                            )}
                        </div>
                    {/* )} */}
                </div>
            </Modal>
            
            {showAddDrawer && (
                <AddUpdateClient 
                    mode={mode} 
                    client={client} 
                    showSidebar={showAddDrawer} 
                    setShowSidebar={setShowAddDrawer} 
                    onClose={handleCloseAddDrawer} 
                />
            )}

            <Modal 
                title="Client Detail Info" 
                show={showClientInfoModal} 
                onClose={handleCloseClientInfoModal} 
                width="70rem"
            >
                <div className="flex justify-between items-center mb-4">
                    <button
                        onClick={handleBackToSearch}
                        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Search
                    </button>
                </div>
                <ClientDetailPage />
            </Modal>
        </>
    );
};

export default ClientSearchV2;