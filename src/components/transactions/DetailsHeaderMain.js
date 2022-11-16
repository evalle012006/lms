import { UppercaseFirstLetter } from "@/lib/utils";
import { styles, DropdownIndicator } from "@/styles/select";
import React from "react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Select from 'react-select';
import Breadcrumbs from "../Breadcrumbs";

const DetailsHeader = ({ pageTitle, page, currentDate, mode = 'daily', setFilter, selectedLO }) => {
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const userList = useSelector(state => state.user.list);

    const [branch, setBranch] = useState();
    const [group, setGroup] = useState();
    const [user, setUser] = useState();
    const [loanOfficerName, setLoanOfficerName] = useState();
    const [branchManager, setBranchManager] = useState();
    const [branchCode, setBranchCode] = useState();
    const [branchName, setBranchName] = useState();

    const handleFilter = () => {
        // if branch changes, show all groups under that branch
        // if group changes, show all users under that group

        // setFilter({
        //     branch: branch,
        //     group: group,
        //     user: user
        // });
    }

    useEffect(() => {
        // not yet working for area manager and admins
        if (branchList && userList) {
            const branchData = branchList.find(b => b.code === currentUser.designatedBranch);
            branchData && setBranchName(branchData.name);
            branchData && setBranchCode(branchData.code);
            const branchManager = userList.find(b => b.role.rep === 3);
            branchManager && setBranchManager(`${branchManager.lastName}, ${branchManager.firstName}`);
        }
    }, [currentUser, branchList, userList]);

    useEffect(() => {
        if (currentUser.role.rep < 4) {
            setLoanOfficerName(selectedLO && `${selectedLO.lastName}, ${selectedLO.firstName}`);
        } else if (currentUser.role.rep === 4) {
            setLoanOfficerName(`${currentUser.lastName}, ${currentUser.firstName}`)
        }
    }, [selectedLO])

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
            {page === 1 && (
                <div className="py-2 proxima-regular">
                    <div className="page-title">
                        {pageTitle}
                    </div>
                    <div className="flex justify-between w-11/12">
                        <div className="flex flex-row justify-items-start space-x-5 py-4" style={{ height: '40px' }}>
                            <div className="space-x-2 flex items-center">
                                <span className="text-gray-400 text-sm">Cash Collections Type:</span>
                                <span className="text-sm">{UppercaseFirstLetter(mode)}</span>
                            </div>
                            <div className="space-x-2 flex items-center ">
                                <span className="text-gray-400 text-sm">Date:</span >
                                <span className="text-sm">{currentDate}</span>
                            </div>
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
                            {selectedLO && (
                                <div className="space-x-2 flex items-center ">
                                    <span className="text-gray-400 text-sm">Loan Officer:</span >
                                    <span className="text-sm">{loanOfficerName}</span>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* {currentUser.role.rep < 4 && (
                        <div className="flex flex-row justify-start">
                            <span className="text-gray-400 text-sm mt-1">Filters:</span >
                            <div className="ml-4 flex w-40">
                                <Select 
                                    options={branchList}
                                    value={branch}
                                    styles={styles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleFilter}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'All Branch'}/>
                            </div>
                            <div className="ml-4 flex w-40">
                                <Select 
                                    options={groupList}
                                    value={group}
                                    styles={styles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleFilter}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'All Group'}/>
                            </div>
                            <div className="ml-4 flex w-40">
                                <Select 
                                    options={userList}
                                    value={user}
                                    styles={styles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleFilter}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'All User'}/>
                            </div>
                        </div>
                    )} */}
                </div>
            )}
            {page === 2 && (
                <React.Fragment>
                    <div className="flex flex-row justify-between w-11/12">
                        <Breadcrumbs />
                    </div>
                    {selectedLO && (
                        <div className="py-2 proxima-regular">
                            <div className="page-title">
                                {`${selectedLO.lastName}, ${selectedLO.firstName}`}
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
                        </div>
                    )}
                </React.Fragment>
            )}
        </div>
    );
}

export default DetailsHeader;