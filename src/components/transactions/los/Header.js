import { UppercaseFirstLetter } from "@/lib/utils";
import { getMonths, getYears } from "@/lib/date-utils";
import { DropdownIndicator, borderStyles } from "@/styles/select";
import React from "react";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Select from 'react-select';
import { useRouter } from 'next/router';
import { ArrowLeftIcon, UserIcon, BuildingOfficeIcon, CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';
import RadioButton from "@/lib/ui/radio-button";

const LOSHeader = ({ 
    pageTitle, 
    page, 
    selectedMonth, 
    handleMonthFilter, 
    selectedYear, 
    handleYearFilter, 
    selectedBranch, 
    selectedLoGroup, 
    handleSelectedLoGroupChange, 
    selectedLo, 
    handleSelectedLoChange 
}) => {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);
    const currentBranch = useSelector(state => state.branch.data);
    const userList = useSelector(state => state.user.list);
    const [loanOfficer, setLoanOfficer] = useState();
    const months = getMonths();
    const years = getYears();

    const handleBack = () => {
        if (currentUser?.role?.rep == 3) {
            router.push('/transactions/summary');
        } else {
            router.back();
        }
    }

    useEffect(() => {
        if (currentUser?.role?.rep === 4) {
            setLoanOfficer(currentUser);
        } else {
            setLoanOfficer(selectedLo)
        }
    }, [currentUser, selectedLo]);

    // Determine if title should be shown
    const shouldShowTitle = () => {
        // For branch managers (role.rep = 3), only show title if a loan officer is selected
        if (currentUser?.role?.rep === 3) {
            return selectedLo != null && selectedLo != undefined;
        }
        // For other roles, always show the title
        return true;
    };

    // Get dynamic subtitle text
    const getSubtitleText = () => {
        if (currentUser?.role?.rep === 3 && (!selectedLo || selectedLo == null)) {
            return `Showing the transaction summary of ${currentUser.firstName} ${currentUser.lastName}`;
        }
        if (loanOfficer) {
            return `Viewing data for ${loanOfficer.firstName} ${loanOfficer.lastName}`;
        }
        return 'Select filters to view data';
    };

    // Custom styles for react-select with modern design
    const modernSelectStyles = {
        control: (provided, state) => ({
            ...provided,
            minHeight: '38px',
            border: state.isFocused ? '2px solid #3B82F6' : '1px solid #E5E7EB',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            boxShadow: state.isFocused ? '0 0 0 3px rgba(59, 130, 246, 0.1)' : 'none',
            transition: 'all 0.2s ease',
            '&:hover': {
                borderColor: '#9CA3AF'
            }
        }),
        option: (provided, state) => ({
            ...provided,
            backgroundColor: state.isSelected ? '#3B82F6' : state.isFocused ? '#EFF6FF' : 'white',
            color: state.isSelected ? 'white' : '#374151',
            padding: '8px 12px',
            fontSize: '14px',
            '&:hover': {
                backgroundColor: state.isSelected ? '#3B82F6' : '#EFF6FF'
            }
        }),
        placeholder: (provided) => ({
            ...provided,
            color: '#9CA3AF',
            fontSize: '14px'
        }),
        singleValue: (provided) => ({
            ...provided,
            color: '#374151',
            fontSize: '14px'
        }),
        menu: (provided) => ({
            ...provided,
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            zIndex: 100
        }),
        menuPortal: (provided) => ({
            ...provided,
            zIndex: 100
        })
    };

    return (
        <div className="bg-white border-b border-gray-200 px-6 py-4 fixed w-full z-20 shadow-sm">
            {page === 1 && (
                <div className="max-w-none">
                    {/* Header Section - Compact */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                            {(currentUser?.role?.rep < 4 && (selectedLo != undefined && selectedLo != null)) && (
                                <button
                                    onClick={handleBack}
                                    className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                                >
                                    <ArrowLeftIcon className="w-4 h-4 mr-2" />
                                    Back
                                </button>
                            )}
                            <div>
                                {/* Conditionally render the title */}
                                {shouldShowTitle() && (
                                    <h1 className="text-xl font-bold text-gray-900">{pageTitle}</h1>
                                )}
                                {/* Dynamic subtitle that changes based on state */}
                                <p className="text-sm text-gray-500 mt-1">
                                    {getSubtitleText()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Filters Section - Horizontal Layout */}
                    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <FunnelIcon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-semibold text-gray-900">Filters:</span>
                            </div>

                            {/* Month Filter */}
                            <div className="flex items-center space-x-2">
                                <CalendarIcon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700 min-w-[50px]">Month:</span>
                                <div className="w-40">
                                    <Select 
                                        options={months}
                                        value={selectedMonth && months.find(m => parseInt(m.value) === parseInt(selectedMonth))}
                                        styles={modernSelectStyles}
                                        components={{ DropdownIndicator }}
                                        onChange={handleMonthFilter}
                                        isSearchable={true}
                                        closeMenuOnSelect={true}
                                        placeholder="Select Month"
                                        menuPortalTarget={document.body}
                                        menuPosition="fixed"
                                    />
                                </div>
                            </div>

                            {/* Year Filter */}
                            <div className="flex items-center space-x-2">
                                <CalendarIcon className="w-4 h-4 text-gray-600" />
                                <span className="text-sm font-medium text-gray-700 min-w-[40px]">Year:</span>
                                <div className="w-32">
                                    <Select 
                                        options={years}
                                        value={selectedYear && years.find(y => y.value === selectedYear)}
                                        styles={modernSelectStyles}
                                        components={{ DropdownIndicator }}
                                        onChange={handleYearFilter}
                                        isSearchable={true}
                                        closeMenuOnSelect={true}
                                        placeholder="Select Year"
                                    />
                                </div>
                            </div>

                            {/* LO Group Filter (for branch managers) */}
                            {(currentUser?.role?.rep < 4) && (currentBranch?.noOfLO?.count > 10 && pageTitle == "Branch Manager Summary") && (
                                <div className="flex items-center space-x-2">
                                    <span className="text-sm font-medium text-gray-700 min-w-[70px]">LO Group:</span>
                                    <div className="flex items-center space-x-3">
                                        <RadioButton 
                                            id="radio_all" 
                                            name="radio-lo" 
                                            label="All" 
                                            checked={selectedLoGroup === 'all'} 
                                            value="all" 
                                            onChange={handleSelectedLoGroupChange} 
                                        />
                                        <RadioButton 
                                            id="radio_main" 
                                            name="radio-lo" 
                                            label="Main" 
                                            checked={selectedLoGroup === 'main'} 
                                            value="main" 
                                            onChange={handleSelectedLoGroupChange} 
                                        />
                                        <RadioButton 
                                            id="radio_ext" 
                                            name="radio-lo" 
                                            label="Extension" 
                                            checked={selectedLoGroup === 'ext'} 
                                            value="ext" 
                                            onChange={handleSelectedLoGroupChange} 
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Loan Officer Filter */}
                            {(currentUser?.role?.rep < 4) && (
                                <div className="flex items-center space-x-2">
                                    <UserIcon className="w-4 h-4 text-gray-600" />
                                    <span className="text-sm font-medium text-gray-700 min-w-[80px]">Loan Officer:</span>
                                    <div className="w-56">
                                        <Select 
                                            options={userList || []}
                                            value={selectedLo && userList && userList.find(user => user.value === selectedLo._id)}
                                            styles={modernSelectStyles}
                                            components={{ DropdownIndicator }}
                                            onChange={handleSelectedLoChange}
                                            isSearchable={true}
                                            closeMenuOnSelect={true}
                                            placeholder="Select Loan Officer"
                                            noOptionsMessage={() => "No loan officers available"}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default LOSHeader;