import InputNumber from "@/lib/ui/InputNumber";
import { useRouter } from "node_modules/next/router";
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import { useSelector } from "react-redux";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { BehaviorSubject } from 'rxjs';

const Header = ({ pageNo, pageTitle, pageName, amount, handleAmountChange, currentBranch, handleBranchFilter, currentLO, handleLOFilter }) => {
    const router = useRouter();
    const userList = useSelector(state => state.user.list);
    const branchList = useSelector(state => state.branch.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));

    const handleBack = () => {
        if (pageName == 'group-view') {
            if (pageNo == 2) {
                router.push(`/reports/low-loan-balance`);
            } else {
                router.push(`/reports/low-loan-balance/user/${selectedBranchSubject.value}`);
            }
        } else if (pageName == 'lo-view') {
            router.push(`/reports/low-loan-balance`);
        }
    }

    return (
        <div className="bg-white px-7 py-2 w-screen">
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
                    <div className="ml-6 flex">
                        <span className="text-sm mr-3 mt-2">Loan Balance: </span>
                        <InputNumber name="dayNo" value={amount} onChange={(val) => { handleAmountChange(val.target.value) }} className="w-14" />
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
                        <div className="ml-4 flex w-40">
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