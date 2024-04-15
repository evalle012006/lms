import InputNumber from "@/lib/ui/InputNumber";
import { useRouter } from "node_modules/next/router";
import { ArrowLeftCircleIcon } from '@heroicons/react/24/solid';
import { useSelector } from "react-redux";
import Select from 'react-select';
import { styles, DropdownIndicator, borderStyles } from "@/styles/select";
import { BehaviorSubject } from 'rxjs';
import CheckBox from "@/lib/ui/checkbox";

const Header = ({ pageNo, pageTitle, pageName, amount, handleAmountChange, amountOperator, handleAmountOperatorChange, 
                    noOfPayments, handleNoOfPaymentsChange, noOfPaymentsOperator, handleNoOfPaymentsOperatorChange,
                    includeDelinquent, handleIncludeDelinquentChange,
                    currentBranch, handleBranchFilter, currentLO, handleLOFilter }) => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const userList = useSelector(state => state.user.list);
    const branchList = useSelector(state => state.branch.list);
    const selectedBranchSubject = new BehaviorSubject(process.browser && localStorage.getItem('selectedBranch'));
    const operatorOptions = [
        { label: 'Less Than Equal', value: 'less_than_equal' },
        { label: 'Greater Than Equal', value: 'greater_than_equal' },
        { label: 'Equal', value: 'equal' }
    ];

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
                <div className="flex flex-col">
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start align-middle">
                        <span className="text-zinc-500 text-sm font-bold mt-2">Filters:</span>
                        <div className="ml-6 flex w-[27rem]">
                            <span className="text-sm mt-2">Loan Balance: </span>
                            <div className="ml-4 flex w-40">
                                <Select 
                                    options={operatorOptions}
                                    value={amountOperator && operatorOptions.find(op => {
                                        return op.value == amountOperator
                                    })}
                                    styles={borderStyles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleAmountOperatorChange}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'Amount Operator Filter'}/>
                                <div className="ml-2">
                                    <InputNumber name="amount" value={amount} onChange={(val) => { handleAmountChange(val.target.value) }} className="w-14" />
                                </div>
                            </div>
                        </div>
                        <div className={`ml-6 flex w-[28rem]`}>
                            <span className="text-sm mt-2">No Of Payments: </span>
                            <div className="ml-4 flex w-40">
                                <Select 
                                    options={operatorOptions}
                                    value={noOfPaymentsOperator && operatorOptions.find(op => {
                                        return op.value == noOfPaymentsOperator
                                    })}
                                    styles={borderStyles}
                                    components={{ DropdownIndicator }}
                                    onChange={handleNoOfPaymentsOperatorChange}
                                    isSearchable={true}
                                    closeMenuOnSelect={true}
                                    placeholder={'No of Payments Operator Filter'}/>
                                <div className="ml-2">
                                    <InputNumber name="noOfPayments" value={noOfPayments} onChange={(val) => { handleNoOfPaymentsChange(val.target.value) }} className="w-14" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-row w-11/12 text-gray-400 text-sm justify-start align-middle">
                        {(currentUser.role.rep == 4 || pageName == 'group-view') && (
                            <div className="ml-12 flex w-[10rem]">
                                <CheckBox name="includeDelinquent"
                                    value={includeDelinquent} 
                                    onChange={handleIncludeDelinquentChange}
                                    label="Include Delinquent"
                                    size={"md"} 
                                />
                            </div>
                        )}
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
                                <div className="ml-6 flex w-40">
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
        </div>
    )
}

export default Header;