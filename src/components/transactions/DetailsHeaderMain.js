import DatePicker from "@/lib/ui/DatePicker";
import { UppercaseFirstLetter } from "@/lib/utils";
import { DropdownIndicator, borderStyles } from "@/styles/select";
import React from "react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Select from 'react-select';
import Breadcrumbs from "../Breadcrumbs";
import moment from 'moment';
import { useRouter } from 'next/router';
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import ButtonSolid from "@/lib/ui/ButtonSolid";
import RadioButton from "@/lib/ui/radio-button";
import { useDispatch } from "node_modules/react-redux/es/exports";
import { setBranch } from "@/redux/actions/branchActions";
import InputNumber from "@/lib/ui/InputNumber";

const DetailsHeader = ({ pageTitle, page, pageName, currentDate, mode, selectedBranch, filter,
                            handleBranchFilter, selectedLO, handleLOFilter, dateFilter, handleDateFilter, weekend, holiday, handleSubmit, 
                            selectedLoGroup, handleLoGroupChange, selectedBranchGroup, handleBranchGroup, viewMode, handleViewModeChange,
                            cohData, handleCOHDataChange
                        }) => {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const currentBranch = useSelector(state => state.branch.data);
    const userList = useSelector(state => state.user.list);
    const [showCalendar, setShowCalendar] = useState(false);
    const [loanOfficerName, setLoanOfficerName] = useState();
    const [branchManager, setBranchManager] = useState();
    const [branchCode, setBranchCode] = useState();
    const [branchName, setBranchName] = useState();
    const [cohAmount, setCohAmount] = useState(0);

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleBack = () => {
        if (currentUser.role.rep < 3 && page == 2 && pageName == 'lo-view') {
            router.push(`/transactions/branch-manager/cash-collection/users/${currentBranch._id}`);
        } else if (currentUser.role.rep == 3) {
            router.push(`/transactions/branch-manager/cash-collection`);
        } else if (currentUser.role.rep < 3) {
            if (pageName == 'branch-view') {
                router.push(`/transactions/branch-manager/cash-collection`);
            } else {
                router.push(`/transactions/branch-manager/cash-collection/users/${selectedLO._id}`);
            }
        }
    }

    useEffect(() => {
        if (branchList && userList) {
            if (page === 2 && currentUser.role.rep <= 2 && pageName === "branch-view") {
                const branchData = branchList.find(b => b._id === selectedBranch._id);
                branchData && setBranchName(branchData.name);
                branchData && setBranchCode(branchData.code);
                const branchManager = userList.find(b => b.designatedBranch === selectedBranch.code && b.role.rep === 3);
                branchManager && setBranchManager(`${branchManager.lastName}, ${branchManager.firstName}`);
            } else {
                const branchData = branchList.find(b => b?.code === currentUser.designatedBranch);
                branchData && setBranchName(branchData.name);
                branchData && setBranchCode(branchData.code);
                const branchManager = userList.find(b => b.role.rep === 3);
                branchManager && setBranchManager(`${branchManager.lastName}, ${branchManager.firstName}`);
            }
        }
    }, [currentUser, branchList, userList]);

    useEffect(() => {
        if (currentUser.role.rep < 4) {
            setLoanOfficerName(selectedLO && `${selectedLO.lastName}, ${selectedLO.firstName}`);
        } else if (currentUser.role.rep === 4) {
            setLoanOfficerName(`${currentUser.lastName}, ${currentUser.firstName}`)
        }
    }, [selectedLO]);

    useEffect(() => {
        if (currentBranch && branchList.length === 1) {
            dispatch(setBranch(branchList[0]));
        }
    }, [branchList, currentBranch])

    useEffect(() => {
        if (cohData) {
            setCohAmount(cohData?.amount);
        }
    }, [cohData]);

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            {page === 1 && (
                <div className="py-2 proxima-regular">
                    <div className="flex flex-row justify-between w-10/12">
                        <div className="page-title">
                            {currentUser.role.rep === 4 ? pageTitle + ' - Group Summary' : pageTitle}
                        </div>
                        {((currentUser.role.rep === 4 || currentUser.role.rep === 3) && !weekend && !holiday && !filter) && (
                            <div className="flex items-center w-32">
                                <ButtonSolid label="Submit" onClick={handleSubmit} />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-between w-11/12">
                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                            {mode && (
                                <div className="space-x-2 flex items-center">
                                    <span className="text-gray-400 text-sm">Cash Collections Type:</span>
                                    <span className="text-sm">{UppercaseFirstLetter(mode)}</span>
                                </div>
                            )}
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Date:</span >
                                <span className="text-sm">{currentDate}</span>
                            </div>
                            {pageName !== 'branch-view' && (
                                <React.Fragment>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Branch:</span >
                                        <span className="text-sm">{branchName}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Branch Code:</span >
                                        <span className="text-sm">{branchCode}</span>
                                    </div>
                                    <div className="space-x-2 flex items-center ">
                                        <span className="text-gray-400 text-sm">Branch Manager:</span >
                                        <span className="text-sm">{branchManager}</span>
                                    </div>
                                </React.Fragment>
                            )}
                            {selectedLO && (
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Loan Officer:</span >
                                    <span className="text-sm">{loanOfficerName}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start">
                        <span className="text-gray-400 text-sm mt-1">Filters:</span >
                        <div className="ml-6 flex w-64">
                            <div className="relative w-full" onClick={openCalendar}>
                                <DatePicker name="dateFilter" value={moment(dateFilter).format('YYYY-MM-DD')} maxDate={moment(new Date()).format('YYYY-MM-DD')} onChange={handleDateFilter} />
                            </div>
                        </div>
                        { currentUser.role.rep < 4 && currentBranch?.noOfLO?.count > 10 && (
                            <div className="flex flex-row ml-4">
                                <RadioButton id={"radio_all"} name="radio-lo" label={"All"} checked={selectedLoGroup === 'all'} value="all" onChange={handleLoGroupChange} />
                                <RadioButton id={"radio_main"} name="radio-lo" label={"Main"} checked={selectedLoGroup === 'main'} value="main" onChange={handleLoGroupChange} />
                                <RadioButton id={"radio_ext"} name="radio-lo" label={"Extension"} checked={selectedLoGroup === 'ext'} value="ext" onChange={handleLoGroupChange} />
                            </div>
                        ) }

                        {(currentUser.role.rep < 3 && currentUser.role.shortCode !== 'area_admin' && pageName == 'branch-view') && (
                            <div className="flex flex-row ml-4">
                                <RadioButton id={"radio_branch"} name="radio-branch" label={"View by Branch"} checked={viewMode === 'branch'} value="branch" onChange={handleViewModeChange} />
                                <RadioButton id={"radio_area"} name="radio-area" label={"View by Area"} checked={viewMode === 'area'} value="area" onChange={handleViewModeChange} />
                                <RadioButton id={"radio_region"} name="radio-region" label={"View by Region"} checked={viewMode === 'region'} value="region" onChange={handleViewModeChange} />
                                <RadioButton id={"radio_division"} name="radio-division" label={"View by Division"} checked={viewMode === 'division'} value="division" onChange={handleViewModeChange} />
                            </div>
                        )}

                        { (currentUser.role.rep == 2 && currentUser.role.shortCode !== 'area_admin' && pageName == 'branch-view') && (
                            <div className="flex flex-row ml-4">
                                <RadioButton id={"radio_mine"} name="radio-lo" label={"Mine"} checked={selectedBranchGroup === 'mine'} value="mine" onChange={handleBranchGroup} />
                                <RadioButton id={"radio_all"} name="radio-lo" label={"All"} checked={selectedBranchGroup === 'all'} value="all" onChange={handleBranchGroup} />
                            </div>
                        ) }

                        { (currentUser.role.rep == 3) && (
                            <div className="flex flex-row ml-4">
                                <span className="text-gray-400 text-sm mt-1 mr-4">COH:</span >
                                <InputNumber 
                                    name="coh"
                                    value={cohAmount}
                                    onChange={(val) => { setCohAmount(val.target.value) }}
                                    onBlur={(val) => { handleCOHDataChange(val.target.value) }}
                                    className="w-22"
                                    filter={true}
                                    disabled={filter} 
                                />
                            </div>
                        ) }
                    </div>
                </div>
            )}

            {page === 2 && (
                <React.Fragment>
                    <div className="flex flex-row justify-between w-11/12">
                        <Breadcrumbs />
                    </div>
                    {pageName === 'branch-view' ? (
                        <React.Fragment>
                            {selectedBranch && (
                                <div className="py-2 proxima-regular">
                                    <div className="flex flex-row justify-between w-10/12">
                                        <div className="page-title flex-row">
                                            <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                            <span>{`${selectedBranch.name} - Loan Officer Summary`}</span>
                                        </div>
                                        {((currentUser.role.rep === 3 && !weekend && !holiday && !filter) || currentUser.role.rep < 3) && (
                                            <div className="flex items-center w-32">
                                                <ButtonSolid label="Submit" onClick={handleSubmit} />
                                            </div>
                                        )}
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
                                            { (currentUser.role.rep < 4 && currentBranch?.noOfLO?.count > 10 && pageName !== 'lo-view') && (
                                                <div className="flex flex-row ml-4">
                                                    <RadioButton id={"radio_all"} name="radio-lo" label={"All"} checked={selectedLoGroup === 'all'} value="all" onChange={handleLoGroupChange} />
                                                    <RadioButton id={"radio_main"} name="radio-lo" label={"Main"} checked={selectedLoGroup === 'main'} value="main" onChange={handleLoGroupChange} />
                                                    <RadioButton id={"radio_ext"} name="radio-lo" label={"Extension"} checked={selectedLoGroup === 'ext'} value="ext" onChange={handleLoGroupChange} />
                                                </div>
                                            ) }
                                            { (currentUser.role.rep < 3) && (
                                                <div className="flex flex-row ml-4">
                                                    <span className="text-gray-400 text-sm mt-1 mr-4">COH:</span >
                                                    <InputNumber 
                                                        name="coh"
                                                        value={cohAmount}
                                                        onChange={(val) => { setCohAmount(val.target.value) }}
                                                        onBlur={(val) => { handleCOHDataChange(val.target.value) }}
                                                        className="w-22"
                                                        filter={true}
                                                        disabled={true} 
                                                    />
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                </div>
                            )}  
                        </React.Fragment>
                    ) : (
                        <React.Fragment>
                            {selectedLO && (
                                <div className="py-2 proxima-regular">
                                    <div className="flex flex-row justify-between w-10/12">
                                        <div className="page-title">
                                            <span><ArrowLeftCircleIcon className="w-5 h-5 mr-6 cursor-pointer" title="Back" onClick={handleBack} /></span>
                                            <span>{`${selectedLO.lastName}, ${selectedLO.firstName} - Group Summary`}</span>
                                        </div>
                                        <div className="flex items-center w-32">
                                            <ButtonSolid label="Submit" onClick={handleSubmit} />
                                        </div>
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
                                            { (currentUser.role.rep < 4 && currentBranch?.noOfLO?.count > 10 && pageName !== 'lo-view') && (
                                                <div className="flex flex-row ml-4">
                                                    <RadioButton id={"radio_all"} name="radio-lo" label={"All"} checked={selectedLoGroup === 'all'} value="all" onChange={handleLoGroupChange} />
                                                    <RadioButton id={"radio_main"} name="radio-lo" label={"Main"} checked={selectedLoGroup === 'main'} value="main" onChange={handleLoGroupChange} />
                                                    <RadioButton id={"radio_ext"} name="radio-lo" label={"Extension"} checked={selectedLoGroup === 'ext'} value="ext" onChange={handleLoGroupChange} />
                                                </div>
                                            ) }
                                        </div>
                                    </div>
                                </div>
                            )}  
                        </React.Fragment>
                    )}
                </React.Fragment>
            )}
        </div>
    );
}

export default DetailsHeader;