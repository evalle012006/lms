import React, { useEffect, useState } from "react";
import TableComponent, { AvatarCell, SelectColumnFilter, StatusPill } from '@/lib/table';
import { fetchWrapper } from "@/lib/fetch-wrapper";
import { useDispatch, useSelector } from "react-redux";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import Dialog from "@/lib/ui/Dialog";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import { formatPricePhp, getLastWeekdayOfTheMonth } from "@/lib/utils";
import moment from 'moment'

const RevertTransferPage = () => {
    const holidayList = useSelector(state => state.systemSettings.holidayList);
    const isHoliday = useSelector(state => state.systemSettings.holiday);
    const isWeekend = useSelector(state => state.systemSettings.weekend);
    const currentUser = useSelector(state => state.user.data);
    const [loading, setLoading] = useState(true);
    const [list, setList] = useState();
    const [selectedTransfer, setSelectedTransfer] = useState();

    const [showWarningDialog, setShowWarningDialog] = useState(false);

    const getList = async () => {
        setLoading(true);
        const previousLastMonthDate = getLastWeekdayOfTheMonth(moment().subtract(1, 'months').format('YYYY'), moment().subtract(1, 'months').format('MM'), holidayList);
        let url = process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client/list-history';
        if (currentUser.role.rep === 1) {
            url = url + '?' + new URLSearchParams({ previousLastMonthDate: previousLastMonthDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const transfertList = [];
                response.data.map(transfer => {
                    let temp = {...transfer};
                    const client = transfer.client;
                    const loan = transfer.loans.length > 0 ? transfer.loans[0] : [];

                    temp.lastName = client.lastName;
                    temp.firstName = client.firstName;
                    temp.status = client.status;

                    if (transfer.loans.length > 0) {
                        temp.amountRelease = loan.amountRelease;
                        temp.amountReleaseStr = temp.amountRelease > 0 ? formatPricePhp(temp.amountRelease) : '-';
                        temp.loanBalance = loan.loanBalance;
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : '-';
                        temp.targetCollection = loan.amountRelease - loan.loanBalance;
                        temp.targetCollectionStr = temp.targetCollection > 0 ? formatPricePhp(temp.targetCollection) : '-';
                        temp.actualCollection = loan.amountRelease - loan.loanBalance;
                        temp.actualCollectionStr = temp.actualCollection > 0 ? formatPricePhp(temp.actualCollection) : '-';
                        temp.totalMcbu = loan.mcbu;
                        temp.totalMcbuStr = temp.totalMcbu > 0 ? formatPricePhp(temp.totalMcbu) : '-';
                        temp.loanStatus = loan.status;

                        if (temp.loanStatus === "closed") {
                            temp.delinquent = true;
                        }
                    }

                    transfertList.push(temp);
                });
                setList(transfertList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        } else if (currentUser.role.rep === 2) {
            url = url + '?' + new URLSearchParams({ _id: currentUser._id, previousLastMonthDate: previousLastMonthDate });
            const response = await fetchWrapper.get(url);
            if (response.success) {
                const transfertList = [];
                response.data.map(transfer => {
                    let temp = {...transfer};
                    const client = transfer.client;
                    const loan = transfer.loans.length > 0 ? transfer.loans[0] : [];

                    temp.lastName = client.lastName;
                    temp.firstName = client.firstName;
                    temp.status = client.status;

                    if (transfer.loans.length > 0) {
                        temp.amountRelease = loan.amountRelease;
                        temp.amountReleaseStr = temp.amountRelease > 0 ? formatPricePhp(temp.amountRelease) : '-';
                        temp.loanBalance = loan.loanBalance;
                        temp.loanBalanceStr = temp.loanBalance > 0 ? formatPricePhp(temp.loanBalance) : '-';
                        temp.targetCollection = loan.amountRelease - loan.loanBalance;
                        temp.targetCollectionStr = temp.targetCollection > 0 ? formatPricePhp(temp.targetCollection) : '-';
                        temp.actualCollection = loan.amountRelease - loan.loanBalance;
                        temp.actualCollectionStr = temp.actualCollection > 0 ? formatPricePhp(temp.actualCollection) : '-';
                        temp.totalMcbu = loan.mcbu;
                        temp.totalMcbuStr = temp.totalMcbu > 0 ? formatPricePhp(temp.totalMcbu) : '-';
                        temp.loanStatus = loan.status;

                        if (temp.loanStatus === "closed") {
                            temp.delinquent = true;
                        }
                    }

                    transfertList.push(temp);
                });
                setList(transfertList);
                setLoading(false);
            } else if (response.error) {
                setLoading(false);
                toast.error(response.message);
            }
        }
    }

    const [columns, setColumns] = useState([
        {
            Header: "Last Name",
            accessor: 'lastName',
            Cell: AvatarCell,
            imgAccessor: "imgUrl",
        },
        {
            Header: "First Name",
            accessor: 'firstName'
        },
        {
            Header: "Client Status",
            accessor: 'status',
        },
        {
            Header: "Amount Release",
            accessor: 'amountReleaseStr'
        },
        {
            Header: "Loan Balance",
            accessor: 'loanBalanceStr'
        },
        {
            Header: "Target Collection",
            accessor: 'targetCollectionStr'
        },
        {
            Header: "Actual Collection",
            accessor: 'actualCollectionStr'
        },
        {
            Header: "Total MCBU",
            accessor: 'totalMcbuStr'
        },
        {
            Header: "Loan Status",
            accessor: 'loanStatus',
        }
    ]);

    const handleRevertAction = (row) => {
        setSelectedTransfer(row.original);
        setShowWarningDialog(true);
    }

    const [rowActionButtons, setRowActionButtons] = useState([
        { label: 'Revert', action: handleRevertAction, title: "Revert Transfer" }
    ]);

    const handleRevert = () => {
        if (selectedTransfer) {
            setShowWarningDialog(false);
            setLoading(true);
            fetchWrapper.postCors(process.env.NEXT_PUBLIC_API_URL + 'transactions/transfer-client/revert-transfer', {transferId: selectedTransfer._id})
                .then(response => {
                    if (response.success) {
                        setShowWarningDialog(false);
                        toast.success('Transfer successfully reverted.');
                        setLoading(false);
                        setSelectedTransfer({});
                        setTimeout(() => {
                            getList();
                        }, 500);
                    } else if (response.error) {
                        toast.error(response.message);
                    } else {
                        console.log(response);
                    }
                });
        }
    }

    const handleCancelRevert = () => {
        setShowWarningDialog(false);
        setSelectedTransfer({});
    }

    useEffect(() => {
        let mounted = true;

        mounted && getList();

        return () => {
            mounted = false;
        };
    }, []);

    return (
        <React.Fragment>
            <div className="pb-4">
                {loading ?
                    (
                        <div className="absolute top-1/2 left-1/2">
                            <Spinner />
                        </div>
                    ) : <TableComponent columns={columns} data={list} hasActionButtons={(currentUser.role.rep <= 2 && !isWeekend && !isHoliday) ? true : false} rowActionButtons={!isWeekend && !isHoliday && rowActionButtons} showFilters={false} />}
            </div>
            <Dialog show={showWarningDialog}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                    <div className="sm:flex sm:items-start justify-center">
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                            <div className="mt-2">
                                <p className="text-2xl font-normal text-dark-color">Are you sure you want to revert this transfer?</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex">
                    <ButtonOutline label="Cancel" type="button" className="p-2 mr-3" onClick={handleCancelRevert} />
                    <ButtonSolid label="Yes, revert" type="button" className="p-2" onClick={handleRevert} />
                </div>
            </Dialog>
        </React.Fragment>
    );
}

export default RevertTransferPage;