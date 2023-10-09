import Breadcrumbs from "@/components/Breadcrumbs";
import { useDispatch, useSelector } from 'react-redux';
import { UppercaseFirstLetter } from "@/lib/utils";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { useEffect, useRef, useState } from "react";
import moment from 'moment'
import DatePicker from "@/lib/ui/DatePicker";
import { useRouter } from 'next/router';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import ButtonOutline from "@/lib/ui/ButtonOutline";

const DetailsHeader = ({ page, handleSaveUpdate, data, setData, showSaveButton, dateFilter, setDateFilter, handleDateFilter, revertMode = false,
                            groupFilter, handleGroupFilter, groupTransactionStatus, allowMcbuWithdrawal, allowOffsetTransaction }) => {
    const router = useRouter();
    const groupList = useSelector(state => state.group.list);
    const group = useSelector(state => state.group.data);
    const [showCalendar, setShowCalendar] = useState(false);
    const statusClass = {
        'available': "text-green-700 bg-green-100",
        'full': "text-red-400 bg-red-100",
        'open': "text-green-700 bg-green-100",
        'close': "text-red-400 bg-red-100"
    }

    const legends = [
        {label: 'Active', bg: ''},
        {label: 'Pending', bg: 'bg-yellow-100'},
        {label: 'Completed', bg: 'bg-green-100'},
        {label: 'For Tomorrow', bg: 'bg-lime-100'}
    ];

    const handleRemarkFilter = (selected) => {
        if (data.length > 0) {
            const temp = data.filter(d => d.remarks === selected.value)
            setData(temp);
        }
    }

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const setSelectedDate = (e) => {
        setDateFilter(e);
        setShowCalendar(false);
    };

    const handleBack = () => {
        router.back();
    }

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            <div className="flex flex-row justify-between w-11/12">
                <Breadcrumbs />
            </div>
            {group && (
                <div className="py-2 proxima-regular">
                    <div className="flex flex-row alternate-gothic text-2xl">
                        <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                        <span>{group.name}</span>
                    </div>
                    <div className="flex justify-between w-11/12">
                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                            <div className="space-x-2 flex items-center">
                                <span className="text-gray-400 text-sm">Branch Name:</span>
                                <span className="text-sm">{group.branchName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day:</span >
                                <span className="text-sm">{UppercaseFirstLetter(group.day)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Day No.:</span >
                                <span className="text-sm">{group.dayNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Time:</span >
                                <span className="text-sm">{group.time}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Group No.:</span >
                                <span className="text-sm">{group.groupNo}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Loan Officer:</span >
                                <span className="text-sm">{group.loanOfficerName}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">No. of Clients:</span >
                                <span className="text-sm">{group.noOfClients}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Status:</span >
                                <span className={`text-sm status-pill ${statusClass[group.status]}`}>{UppercaseFirstLetter(group.status)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Group Transaction Status:</span >
                                <span className={`text-sm status-pill ${statusClass[groupTransactionStatus]}`}>{UppercaseFirstLetter(groupTransactionStatus)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {page === 'transaction' && (
                <div className="flex justify-between w-10/12">
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                        <span className="text-gray-400 text-sm mt-1">Filters:</span >
                        <div className="ml-4 flex w-40">
                            <Select 
                                options={groupList}
                                value={groupFilter && groupList.find(g => {
                                    return g._id === groupFilter
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleGroupFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Group Filter'}/>
                        </div>
                        <div className="ml-24 flex w-64">
                            <div className="relative w-full" onClick={openCalendar}>
                                <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                            </div>
                        </div>
                    </div>
                    {(showSaveButton || allowMcbuWithdrawal || allowOffsetTransaction) && (
                        <div className={`flex items-center ${revertMode ? 'w-40' : 'w-96'}`}>
                            {!revertMode && <ButtonOutline label="Save Draft" type="button" className="p-2 mr-3" onClick={() => handleSaveUpdate(true)} />}
                            <ButtonSolid label="Submit Collection" onClick={() => handleSaveUpdate(false)} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DetailsHeader;