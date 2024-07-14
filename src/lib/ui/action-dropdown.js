import React, { useState } from "react";
import { useEffect } from "react";

const ActionDropDown = ({ data, options=[], dataOptions = {}, origin }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [updatedOptions, setUpdatedOptions] = useState([]);
    
    useEffect(() => {
        const temp = options.map(option => {
            let tempOption = { ...option };
            if (origin == 'cash-collection' && data) {
                if (option.label == 'Reloan' && (!data.advance && data.status == 'completed' && !dataOptions?.prevDraft && data.hasOwnProperty("_id") && (data.remarks && data.remarks.value?.startsWith('reloaner')))) {
                    tempOption.hidden = false;
                }

                // if (option.label == 'MCBU Refund' && (!dataOptions?.filter && data.status == 'completed' && !data?.draft)) {
                //     tempOption.hidden = false;
                // }

                if (option.label == 'MCBU Withdrawal' && (!dataOptions?.filter && ((data.occurence == 'daily' && data.status == 'completed') || (data.occurence == 'weekly' && data.status == 'active') ) && !data?.draft)) {
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
            } else if (origin == 'transfer' && data) {
                if ((option.label == 'Reject Transfer' || option.label == 'Edit Transfer' || option.label == 'Delete Transfer') && data.status == 'pending') {
                    tempOption.hidden = false;
                }

                if (option.label == 'Repair Transfer' && data.status == 'approved' && data.withError) {
                    tempOption.hidden = false;
                }
            }
            
            return tempOption;
        });

        setUpdatedOptions(temp);
    }, [options]);

    return (
        <div className="relative inline-block text-left">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="cursor-pointer w-6 h-6" onClick={() => setIsOpen(!isOpen)}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
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
                                                            option.action(data, index);
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
