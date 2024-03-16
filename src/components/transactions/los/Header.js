import DatePicker from "@/lib/ui/DatePicker";
import { UppercaseFirstLetter, getMonths, getYears } from "@/lib/utils";
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import React from "react";
import { useRef } from "react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Select from 'react-select';
import moment from 'moment';
import { useRouter } from 'next/router';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import RadioButton from "@/lib/ui/radio-button";

const LOSHeader = ({ pageTitle, page, selectedMonth, handleMonthFilter, selectedYear, handleYearFilter, selectedBranch, 
                        selectedLoGroup, handleSelectedLoGroupChange, selectedLo, handleSelectedLoChange }) => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const userList = useSelector(state => state.user.list);
    const [loanOfficer, setLoanOfficer] = useState();
    const months = getMonths();
    const years = getYears();

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleBack = () => {
        if (currentUser.role.rep == 3) {
            router.push('/transactions/branch-manager/summary');
        } else {
            router.back();
        }
    }

    useEffect(() => {
        if (currentUser.role.rep === 4) {
            setLoanOfficer(currentUser);
        } else {
            setLoanOfficer(selectedLo)
        }
    }, [currentUser]);

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            {page === 1 && (
                <div className="py-2 proxima-regular">
                    <div className="page-title">
                        {pageTitle} 
                    </div>
                    {(currentUser.role.rep < 4 && (selectedLo != undefined && selectedLo != null)) && (
                        <div className="flex justify-between w-11/12 my-2">
                            <div className="page-title flex-row">
                                <span><ArrowLeftCircleIcon className="w-5 h-5 mr-2 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                <span className="text-lg mt-1">Go back</span>
                            </div>
                        </div>
                    )}
                    {loanOfficer && (
                        <div className="flex justify-between w-11/12">
                            <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                                <div className="space-x-2 flex items-center">
                                    <span className="text-gray-400 text-sm">Name:</span>
                                    <span className="text-sm">{`${loanOfficer.lastName}, ${loanOfficer.firstName}`}</span>
                                </div>
                                {/* <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Email:</span >
                                    <span className="text-sm">{loanOfficer.email}</span>
                                </div> */}
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Number:</span >
                                    <span className="text-sm">{loanOfficer.number}</span>
                                </div>
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Role:</span >
                                    <span className="text-sm">{UppercaseFirstLetter(loanOfficer.role.name)}</span>
                                </div>
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Branch:</span >
                                    <span className="text-sm">{selectedBranch?.name}</span>
                                </div>
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Branch Code:</span >
                                    <span className="text-sm">{selectedBranch?.code}</span>
                                </div>
                                <div className="space-x-2 flex items-center">
                                    <span className="text-gray-400 text-sm">Branch Manager:</span >
                                    <span className="text-sm">{`${selectedBranch?.branchManager?.lastName}, ${selectedBranch?.branchManager?.firstName}`}</span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                        <span className="text-gray-400 text-sm mt-1">Filters:</span >
                        {/* filters should be MONTH and YEAR */}
                        <div className="ml-4 flex">
                            <Select 
                                options={months}
                                value={selectedMonth && months.find(m => {
                                    return parseInt(m.value) === parseInt(selectedMonth)
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleMonthFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Month Filter'}/>
                        </div>
                        <div className="ml-4 flex">
                            <Select 
                                options={years}
                                value={selectedYear && years.find(y => {
                                    return y.value === selectedYear
                                })}
                                styles={borderStyles}
                                components={{ DropdownIndicator }}
                                onChange={handleYearFilter}
                                isSearchable={true}
                                closeMenuOnSelect={true}
                                placeholder={'Year Filter'}/>
                        </div>
                        {(currentUser.role.rep < 4) && (
                            <React.Fragment>
                                { (currentBranch?.noOfLO?.count > 10 && pageTitle == "Branch Manager Summary") && (
                                    <div className="flex flex-row ml-4">
                                        <RadioButton id={"radio_all"} name="radio-lo" label={"All"} checked={selectedLoGroup === 'all'} value="all" onChange={handleSelectedLoGroupChange} />
                                        <RadioButton id={"radio_main"} name="radio-lo" label={"Main"} checked={selectedLoGroup === 'main'} value="main" onChange={handleSelectedLoGroupChange} />
                                        <RadioButton id={"radio_ext"} name="radio-lo" label={"Extension"} checked={selectedLoGroup === 'ext'} value="ext" onChange={handleSelectedLoGroupChange} />
                                    </div>
                                ) }
                                <div className="ml-4 flex">
                                    <Select 
                                        options={userList}
                                        value={selectedLo && userList.find(user => {
                                            return user.value === selectedLo._id
                                        })}
                                        styles={borderStyles}
                                        components={{ DropdownIndicator }}
                                        onChange={handleSelectedLoChange}
                                        isSearchable={true}
                                        closeMenuOnSelect={true}
                                        placeholder={'LO Filter'}/>
                                </div>
                            </React.Fragment>
                        )}
                    </div>
                </div>
            )}

            {/* {page === 2 && (
                <React.Fragment>
                    <div className="flex flex-row justify-between w-11/12">
                        <Breadcrumbs />
                    </div>
                    {pageName === 'branch-view' ? (
                        <React.Fragment>
                            {selectedBranch && (
                                <div className="py-2 proxima-regular">
                                    <div className="page-title flex-row">
                                        <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                        <span>{`${selectedBranch.name} - Loan Officer Summary`}</span>
                                    </div>
                                    <div className="flex justify-between w-11/12">
                                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Code:</span >
                                                <span className="text-sm">{selectedBranch.code}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Address:</span >
                                                <span className="text-sm">{selectedBranch.address}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Email:</span >
                                                <span className="text-sm">{selectedBranch.email}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Phone Number:</span >
                                                <span className="text-sm">{selectedBranch.phoneNumber}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Branch Manager:</span >
                                                <span className="text-sm">{branchManager}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between w-10/12">
                                        <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                                            <span className="text-gray-400 text-sm mt-1">Filters:</span >
                                            <div className="ml-4 flex w-40">
                                                <Select 
                                                    options={branchList}
                                                    value={selectedBranch && branchList.find(branch => {
                                                        return branch._id === selectedBranch._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleBranchFilter}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Branch Filter'}/>
                                            </div>
                                            <div className="ml-24 flex w-64">
                                                <div className="relative w-full" onClick={openCalendar}>
                                                    <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}  
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            {selectedLO && (
                                <div className="py-2 proxima-regular">
                                    <div className="page-title flex-row">
                                        <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                        <span>{`${selectedLO.lastName}, ${selectedLO.firstName} - Group Summary`}</span>
                                    </div>
                                    <div className="flex justify-between w-11/12">
                                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Branch:</span >
                                                <span className="text-sm">{branchName}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Branch Manager:</span >
                                                <span className="text-sm">{branchManager}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">LO #:</span >
                                                <span className="text-sm">{selectedLO.loNo}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Email:</span >
                                                <span className="text-sm">{selectedLO.email}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Phone Number:</span >
                                                <span className="text-sm">{selectedLO.number}</span>
                                            </div>
                                            <div className="space-x-2 flex items-center ">
                                                <span className="text-gray-400 text-sm">Position:</span >
                                                <span className="text-sm">{selectedLO.position}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex justify-between w-10/12">
                                        <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                                            <span className="text-gray-400 text-sm mt-1">Filters:</span >
                                            <div className="ml-4 flex w-40">
                                                <Select 
                                                    options={userList}
                                                    value={selectedLO && userList.find(lo => {
                                                        return lo._id === selectedLO._id
                                                    })}
                                                    styles={borderStyles}
                                                    components={{ DropdownIndicator }}
                                                    onChange={handleLOFilter}
                                                    isSearchable={true}
                                                    closeMenuOnSelect={true}
                                                    placeholder={'Loan Officer Filter'}/>
                                            </div>
                                            <div className="ml-24 flex w-64">
                                                <div className="relative w-full" onClick={openCalendar}>
                                                    <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}  
                        </React.Fragment>
                    )}
                </React.Fragment>
            )} */}
        </div>
    );
}

export default LOSHeader;