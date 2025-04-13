import { UserPlus } from "lucide-react";
import React, { useState } from "react";
import { useEffect } from "react";

const ActionDropDown = ({ data, options=[], dataOptions = {}, origin }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [updatedOptions, setUpdatedOptions] = useState([]);
    
    useEffect(() => {
        const last5DaysOfTheMonth = dataOptions?.last5DaysOfTheMonth || [];
        const temp = options.map(option => {
            let tempOption = { ...option };
            if (origin == 'cash-collection' && data) {
                const client = data.client;
                if (option.label == 'Reloan' && (!data.advance && data.status == 'completed' && !dataOptions?.prevDraft && data.hasOwnProperty("_id") && (data.remarks && data.remarks.value?.startsWith('reloaner')))) {
                    tempOption.hidden = false;
                }

                // if (option.label == 'MCBU Refund' && (!dataOptions?.filter && data.status == 'completed' && !data?.draft)) {
                //     tempOption.hidden = false;
                // }
                if (option.label == 'MCBU Withdrawal' && !data?.hasMcbuWithdrawal && (!dataOptions?.filter && (data.status == 'completed' || data.status == 'tomorrow' || (data.occurence == 'weekly' && data.status == 'active') || (client?.groupLeader && data.mcbu > 3000 && last5DaysOfTheMonth.includes(dataOptions?.currentDate))) && !data?.draft)) {
                    tempOption.hidden = false;
                }

                if (option.label == 'Change Reloaner Remarks' && ((data.remarks?.value?.startsWith('reloaner') && (data.status == 'pending' || data.status == 'tomorrow')) && !dataOptions?.filter && !data.draft && !data.reverted)) {
                    tempOption.hidden = false;
                }

                if (option.label == 'Calculate MCBU Interest' && (!dataOptions?.filter && !dataOptions?.editMode && data.status !== 'closed' && dataOptions?.currentMonth === 11 && !data?.draft)) {
                    tempOption.hidden = false;
                }

                if (option.label == 'Offset' && (!dataOptions?.filter && data.status == 'active' && !data.draft)) {
                    tempOption.hidden = false;
                }

                if ((option.label == 'Mark as Late' || option.label == 'Unmark as Late') && (!dataOptions?.filter && data.status == 'active' && !data.draft)) {
                    tempOption.hidden = false;
                    tempOption.label = data.latePayment ? 'Unmark as Late' : 'Mark as Late';
                }

                if ((option.label == 'Mark as Delinquent' || option.label == 'Unmark as Delinquent') && (!dataOptions?.filter && data.status == 'active' && !data.draft)) {
                    tempOption.hidden = false;
                    tempOption.label = data.delinquent ? 'Unmark as Delinquent' : 'Mark as Delinquent';
                }
            } else if (origin == 'transfer' && data) {
                if ((option.label == 'Reject Transfer' || option.label == 'Edit Transfer' || option.label == 'Delete Transfer') && data.status == 'pending') {
                    tempOption.hidden = false;
                }

                if (option.label == 'Repair Transfer' && data.status == 'approved' && data.withError) {
                    tempOption.hidden = false;
                }
            } else if (origin == 'client-list' && data) {
                if (option.label == 'Exclude Client' && data) {
                    if (data.archived == true) {
                        tempOption.label = 'Include Client';
                        tempOption.icon = <UserPlus className="h-4 w-4 mr-2" />
                    }
                }
            } else if (origin == 'mcbu-withdrawal' && data) {
                if (data.status !== 'pending') {
                    tempOption.hidden = true;
                }
            }
            
            return tempOption;
        });

        setUpdatedOptions(temp);
    }, [options]);

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill="none" 
                viewBox="0 0 24 24" 
                strokeWidth={1.5} 
                stroke="currentColor" 
                className="cursor-pointer w-6 h-6" 
                onClick={() => setIsOpen(!isOpen)}
            >
                <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" 
                />
            </svg>

            {isOpen && (
                <>
                    <div
                        className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50"
                        role="menu"
                        aria-orientation="vertical"
                        aria-labelledby="options-menu"
                    >
                        <div role="none">
                            {updatedOptions.every(option => option.hidden) ? <span className="p-6">No Action</span> : (
                                <React.Fragment>
                                    {updatedOptions.map((option, index) => {
                                        return (
                                            <div key={index} className="w-full">
                                                {!option.hidden && (
                                                    <button
                                                        key={option.label}
                                                        className="flex text-gray-700 block w-full text-left p-2 text-sm hover:bg-gray-100 hover:text-gray-900"
                                                        role="menuitem"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            setIsOpen(false);
                                                            option.action(data, index, option?.flag);
                                                        }}
                                                    >
                                                        <div className="flex flex-row justify-start px-2">
                                                            {option?.icon && option.icon}
                                                            <span className="pl-2">{option.label}</span>
                                                        </div>
                                                    </button>
                                                )}
                                            </div>
                                        )
                                    })}
                                </React.Fragment>
                            )}
                        </div>
                    </div>
                    <div className="fixed z-10 inset-0" onClick={() => setIsOpen(false)}></div>
                </>
            )}
        </div>
    );
};

export default ActionDropDown;
