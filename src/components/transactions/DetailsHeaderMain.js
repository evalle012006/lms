import { UppercaseFirstLetter } from "@/lib/utils";
import { styles, DropdownIndicator } from "@/styles/select";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Select from 'react-select';

const DetailsHeader = ({ pageTitle, currentDate, mode = 'daily', setFilter }) => {
    const currentUser = useSelector(state => state.user.data);
    const branchList = useSelector(state => state.branch.list);
    const groupList = useSelector(state => state.group.list);
    const userList = useSelector(state => state.user.list);

    const [branch, setBranch] = useState();
    const [group, setGroup] = useState();
    const [user, setUser] = useState();
    const [loanOfficerName, setLoanOfficerName] = useState();
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
        if (!currentUser.root && currentUser.role.rep === 4 && branchList.length > 0) {
            const branchData = branchList.find(b => b.code === currentUser.designatedBranch);
            setBranchName(branchData.name);
            setBranchCode(branchData.code);
            setLoanOfficerName(`${currentUser.lastName}, ${currentUser.firstName}`);
        }
    }, [currentUser, branchList]);

    return (
        <div className="bg-white px-7 py-2 fixed w-screen z-10">
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
                            <span className="text-gray-400 text-sm">Loan Officer:</span >
                            <span className="text-sm">{loanOfficerName}</span>
                        </div>
                    </div>
                </div>
                {currentUser.role.rep < 4 && (
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
                )}
            </div>
        </div>
    );
}

export default DetailsHeader;