import { useRouter } from "node_modules/next/router";
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import { useSelector } from "react-redux";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { BehaviorSubject } from 'rxjs';
import { LOR_MISPAY_REMARKS } from "@/lib/constants";
import DatePicker from "@/lib/ui/DatePicker";
import moment from 'moment'
import { useState } from "react";

const Header = ({ pageNo, pageTitle, pageName, remarks, handleRemarksFilter, dateFilter, handleDateFilter,
                    currentBranch, handleBranchFilter, currentLO, handleLOFilter }) => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const userList = useSelector(state => state.user.list);
    const branchList = useSelector(state => state.branch.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const [showCalendar, setShowCalendar] = useState(false);
    const [remarksOption, setRemarksOption] = useState([
        { label: 'All', value: 'all'},
        ...LOR_MISPAY_REMARKS
    ]);

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleBack = () => {
        if (pageName == 'group-view') {
            if (pageNo == 2) {
                router.push(`/reports/mispay-list`);
            } else {
                router.push(`/reports/mispay-list/user/${selectedBranchSubject.value}`);
            }
        } else if (pageName == 'lo-view') {
            router.push(`/reports/mispay-list`);
        }
    }

    return (
        <div className="bg-white px-7 py-2 w-full">
            <div className="flex flex-col py-2 proxima-regular">
                <div className="flex flex-row justify-between w-10/12">
                    <div className="page-title">
                        { pageTitle }
                    </div>
                </div>
                {pageNo > 1 && (
                    <div className="flex justify-between w-11/12 my-2">
                        <div className="page-title flex-row">
                            <span><ArrowLeftCircleIcon className="w-5 h-5 mr-2 cursor-pointer" title="Back" onClick={handleBack} /></span>
                            <span className="text-lg mt-1">Go back</span>
                        </div>
                    </div>
                )}
                <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start align-middle">
                    <span className="text-zinc-500 text-sm font-bold mt-2">Filters:</span>
                    <div className="ml-24 flex w-64">
                        <div className="relative w-full" onClick={openCalendar}>
                            <DatePicker name="dateFilter" value={dateFilter} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                        </div>
                    </div>
                    <div className="ml-6 flex w-[20rem]">
                        <span className="text-sm mt-2">Remarks: </span>
                        <div className="ml-4 flex w-40">
                            <Select 
                                options={remarksOption}
                                value={remarks && remarksOption.find(op => {
                                    return op.value == remarks
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleRemarksFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Remarks Filter'}/>
                        </div>
                    </div>
                    {pageName == 'group-view' && (
                        <div className="ml-4 flex w-40">
                            <Select 
                                options={userList}
                                value={currentLO && userList.find(lo => {
                                    return lo._id === currentLO._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleLOFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'LO Filter'}/>
                        </div>
                    )}
                    {pageName == 'lo-view' && (
                        <div className="ml-2flex w-40">
                            <Select 
                                options={branchList}
                                value={currentBranch && branchList.find(branch => {
                                    return branch._id === currentBranch._id
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleBranchFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Branch Filter'}/>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default Header;