import React from 'react';
import { toast } from "react-toastify";
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { useDispatch, useSelector } from 'node_modules/react-redux/es/exports';
import { useState } from 'react';
import { useEffect } from 'react';
import { setBranchList } from '@/redux/actions/branchActions';
import Spinner from '../Spinner';
import TableComponent from '@/lib/table';

const BranchNotCloseTool = () => {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(false);
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const [list, setList] = useState([]);
    const [title, setTitle] = useState('List of Branches Not Close');
    const [columns, setColumns] = useState([
        {
            Header: "Branch",
            accessor: 'branchName',
        },
        {
            Header: "Date",
            accessor: 'dateAdded',
        },
        {
            Header: "Reason",
            accessor: 'reason',
        }
    ]);

    const getList = async () => {
        setLoading(true);
        let url = process.env.NEXT_PUBLIC_API_URL + 'reports/get-all-branch-not-close';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.cashCollectionsDraft.map(data => {
                    const exist = responseData.find(d => d.branchName == data.branchName);
                    if (!exist) {
                        responseData.push({
                            branchName: data.branchName,
                            dateAdded: data.dateAdded,
                            reason: 'DRAFT'
                        });
                    }
                });
                response.cashCollectionsPending.map(data => {
                    const exist = responseData.find(d => d.branchName == data.branchName);
                    if (!exist) {
                        responseData.push({
                            branchName: data.branchName,
                            dateAdded: data.dateAdded,
                            reason: 'PENDING'
                        });
                    }
                });
                setList(Array.from(responseData));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            // const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            // const branchIds = branchList.filter(branch => branchCodes.includes(branch.code)).map(branch => branch._id);
            // url = url + '?' + new URLSearchParams({ branchIds: JSON.stringify(branchIds) });
            url = url + '?' + new URLSearchParams({ currentUserId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.cashCollectionsDraft.map(data => {
                    const exist = responseData.find(d => d.branchName == data.branchName);
                    if (!exist) {
                        responseData.push({
                            branchName: data.branchName,
                            dateAdded: data.dateAdded,
                            reason: 'DRAFT'
                        });
                    }
                });
                response.cashCollectionsPending.map(data => {
                    const exist = responseData.find(d => d.branchName == data.branchName);
                    if (!exist) {
                        responseData.push({
                            branchName: data.branchName,
                            dateAdded: data.dateAdded,
                            reason: 'PENDING'
                        });
                    }
                });
                setList(responseData);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }  else if (currentUser.role.rep === 3) {
            url = url + '?' + new URLSearchParams({ branchId: currentUser.designatedBranchId });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.cashCollectionsDraft.map(data => {
                    const loanOfficerName = `${data.loanOfficerFirstName} ${data.loanOfficerLastName}`;
                    const exist = responseData.find(d => d.loanOfficerName == loanOfficerName);
                    if (!exist) {
                        responseData.push({
                            loanOfficerName: loanOfficerName,
                            dateAdded: data.dateAdded,
                            reason: 'DRAFT'
                        });
                    }
                });
                response.cashCollectionsPending.map(data => {
                    const loanOfficerName = `${data.loanOfficerFirstName} ${data.loanOfficerLastName}`;
                    const exist = responseData.find(d => d.loanOfficerName == loanOfficerName);
                    if (!exist) {
                        responseData.push({
                            loanOfficerName: loanOfficerName,
                            dateAdded: data.dateAdded,
                            reason: 'PENDING'
                        });
                    }
                });
                setList(responseData);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ loId: currentUser._id });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const responseData = [];
                response.cashCollectionsDraft.map(data => {
                    const exist = responseData.find(d => d.groupName == data.groupName);
                    if (!exist) {
                        responseData.push({
                            slotNo: data.slotNo,
                            fullName: data.clientName,
                            groupName: data.groupName,
                            dateAdded: data.dateAdded,
                            reason: 'DRAFT'
                        });
                    }
                });
                response.cashCollectionsPending.map(data => {
                    const exist = responseData.find(d => d.groupName == data.groupName);
                    if (!exist) {
                        responseData.push({
                            slotNo: data.slotNo,
                            fullName: data.clientName,
                            groupName: data.groupName,
                            dateAdded: data.dateAdded,
                            reason: 'PENDING'
                        });
                    }
                });
                setList(responseData);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const getListBranch = async () => {
        let url = process.env.NEXT_PUBLIC_API_URL + 'branches/list';
        if (currentUser.role.rep === 1) {
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            const branchCodes = typeof currentUser.designatedBranch === 'string' ? JSON.parse(currentUser.designatedBranch) : currentUser.designatedBranch;
            url = url + '?' + new URLSearchParams({ branchCodes: branchCodes });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 3 || currentUser.role.rep === 4) {
            url = url + '?' + new URLSearchParams({ branchCode: currentUser.designatedBranch });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                dispatch(setBranchList(response.branches));
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    useEffect(() => {
        let mounted = true;

        mounted && getListBranch();

        let tempCols = [];

        if (currentUser.role.rep == 1 || currentUser.role.rep == 2) {
            tempCols = [
                {
                    Header: "Branch",
                    accessor: 'branchName',
                },
                {
                    Header: "Date",
                    accessor: 'dateAdded',
                },
                {
                    Header: "Reason",
                    accessor: 'reason',
                }
            ];
            setTitle('List of Branches Not Close');
        } else if (currentUser.role.rep == 3) {
            tempCols = [
                {
                    Header: "Loan Officer",
                    accessor: 'loanOfficerName',
                },
                {
                    Header: "Date",
                    accessor: 'dateAdded',
                },
                {
                    Header: "Reason",
                    accessor: 'reason',
                }
            ];
            setTitle('List of Loan Officers Not Close');
        } else if (currentUser.role.rep == 4) {
            tempCols = [
                {
                    Header: "Slot No",
                    accessor: 'slotNo',
                },
                {
                    Header: "Name",
                    accessor: 'fullName',
                },
                {
                    Header: "Group",
                    accessor: 'groupName',
                },
                {
                    Header: "Date",
                    accessor: 'dateAdded',
                },
                {
                    Header: "Reason",
                    accessor: 'reason',
                }
            ];
            setTitle('List of Clients Not Close');
        }

        setColumns(tempCols);

        return (() => {
            mounted = false;
        });
    }, [currentUser]);

    useEffect(() => {
        if (branchList && branchList.length > 0) {
            getList();
        }
    }, [branchList]);

    return (
        <div className='flex flex-col min-w-64 border rounded-lg border-zinc-300 mt-4 h-[32rem] p-4'>
            <h3>{ title }</h3>
            {loading ? (
                <div className="absolute top-1/2 left-1/2">
                    <Spinner />
                </div>
            ) : (
                <TableComponent columns={columns} data={list} hasActionButtons={false} showFilters={false} pageSize={5} />
            )}
        </div>
    )
}

export default BranchNotCloseTool;