import React, { useState, useEffect, useCallback, useRef } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { PlusIcon, TrashIcon, PencilIcon, ChevronRightIcon, Bars3Icon, ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/solid';
import Dialog from "@/lib/ui/Dialog";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemTypes = {
    ACCOUNT_TYPE: 'accountType',
    ACCOUNT_NAME: 'accountName'
};

// Account Group Options (without 'None' - empty array means none selected)
const ACCOUNT_GROUP_OPTIONS = [
    { value: 'other_receipts', label: 'Other Receipts' },
    { value: 'management_expenses', label: 'Management Expenses' },
    { value: 'other_payments', label: 'Other Payments' }
];

// Display Group Options
const DISPLAY_GROUP_OPTIONS = [
    { value: 'assets', label: 'Assets' },
    { value: 'liabilities', label: 'Liabilities' },
    { value: 'management_expenses', label: 'Management Expenses' }
];

// Helper function to get group labels (for multiple groups)
const getGroupLabels = (groupCodes) => {
    if (!groupCodes || !Array.isArray(groupCodes) || groupCodes.length === 0) return [];
    return groupCodes.map(code => {
        const group = ACCOUNT_GROUP_OPTIONS.find(g => g.value === code);
        return group ? group.label : code;
    });
};

// Helper function to get display group labels (for multiple groups)
const getDisplayGroupLabels = (groupCodes) => {
    if (!groupCodes || !Array.isArray(groupCodes) || groupCodes.length === 0) return [];
    return groupCodes.map(code => {
        const group = DISPLAY_GROUP_OPTIONS.find(g => g.value === code);
        return group ? group.label : code;
    });
};

// Multi-Select Dropdown Component
const MultiSelectDropdown = ({ options, selectedValues, onChange, placeholder, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = (value) => {
        const newValues = selectedValues.includes(value)
            ? selectedValues.filter(v => v !== value)
            : [...selectedValues, value];
        onChange(newValues);
    };

    const removeTag = (e, value) => {
        e.stopPropagation();
        onChange(selectedValues.filter(v => v !== value));
    };

    const getSelectedLabels = () => {
        return selectedValues.map(value => {
            const option = options.find(o => o.value === value);
            return option ? option.label : value;
        });
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="w-full min-h-[42px] px-4 py-2 border border-gray-300 rounded-md cursor-pointer bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500 flex items-center justify-between gap-2"
            >
                <div className="flex flex-wrap gap-1 flex-1">
                    {selectedValues.length === 0 ? (
                        <span className="text-gray-400">{placeholder || 'Select options...'}</span>
                    ) : (
                        getSelectedLabels().map((label, idx) => (
                            <span
                                key={selectedValues[idx]}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs"
                            >
                                {label}
                                <XMarkIcon
                                    className="h-3 w-3 cursor-pointer hover:text-teal-900"
                                    onClick={(e) => removeTag(e, selectedValues[idx])}
                                />
                            </span>
                        ))
                    )}
                </div>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                    {options.map(option => (
                        <label
                            key={option.value}
                            className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                        >
                            <input
                                type="checkbox"
                                checked={selectedValues.includes(option.value)}
                                onChange={() => handleToggle(option.value)}
                                className="rounded text-teal-600 focus:ring-teal-500"
                            />
                            <span className="text-sm text-gray-700">{option.label}</span>
                        </label>
                    ))}
                    {options.length === 0 && (
                        <div className="px-4 py-2 text-sm text-gray-500">No options available</div>
                    )}
                </div>
            )}
        </div>
    );
};

// Draggable Account Type Component
const DraggableAccountType = ({ type, index, moveItem, isSelected, onClick, onEdit, onDelete, onDragEnd }) => {
    const ref = React.useRef(null);

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.ACCOUNT_TYPE,
        collect(monitor) {
            return {
                handlerId: monitor.getHandlerId(),
            };
        },
        hover(item, monitor) {
            if (!ref.current) return;
            
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveItem(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.ACCOUNT_TYPE,
        item: () => ({ id: type._id, index, originalIndex: index }),
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        end: (item, monitor) => {
            // Only trigger reorder if the item was actually dropped (not cancelled)
            // and if the position changed
            if (monitor.didDrop() || item.index !== item.originalIndex) {
                onDragEnd();
            }
        },
    });

    drag(drop(ref));

    // Get arrays of groups (handle both old single value and new array format)
    const accountGroups = Array.isArray(type.account_groups) ? type.account_groups : 
                          (type.account_group ? [type.account_group] : []);
    const displayGroups = Array.isArray(type.display_groups) ? type.display_groups : 
                          (type.display_group ? [type.display_group] : []);

    return (
        <div
            ref={ref}
            data-handler-id={handlerId}
            onClick={onClick}
            style={{ opacity: isDragging ? 0.4 : 1 }}
            className={`p-4 rounded-lg border cursor-move transition-all ${
                isSelected
                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                    : 'bg-white border-gray-200 hover:border-teal-300'
            }`}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center flex-1 min-w-0">
                    <Bars3Icon className="h-5 w-5 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900">{type.type_name}</h3>
                        {type.description && (
                            <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <p className="text-xs text-gray-400">Code: {type.type_code}</p>
                            {accountGroups.map(group => (
                                <span key={group} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {ACCOUNT_GROUP_OPTIONS.find(g => g.value === group)?.label || group}
                                </span>
                            ))}
                            {displayGroups.map(group => (
                                <span key={group} className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                    {DISPLAY_GROUP_OPTIONS.find(g => g.value === group)?.label || group}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(type);
                        }}
                        className="text-teal-600 hover:text-teal-900 transition-colors"
                        title="Edit"
                    >
                        <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(type);
                        }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-4 w-4" />
                    </button>
                    <ChevronRightIcon className={`h-5 w-5 transition-colors ${
                        isSelected ? 'text-teal-600' : 'text-gray-400'
                    }`} />
                </div>
            </div>
        </div>
    );
};

// Draggable Account Name Row Component
const DraggableAccountNameRow = ({ account, index, moveItem, onEdit, onDelete, onDragEnd }) => {
    const ref = React.useRef(null);

    const [{ handlerId }, drop] = useDrop({
        accept: ItemTypes.ACCOUNT_NAME,
        collect(monitor) {
            return {
                handlerId: monitor.getHandlerId(),
            };
        },
        hover(item, monitor) {
            if (!ref.current) return;
            
            const dragIndex = item.index;
            const hoverIndex = index;

            if (dragIndex === hoverIndex) return;

            const hoverBoundingRect = ref.current?.getBoundingClientRect();
            const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
            const clientOffset = monitor.getClientOffset();
            const hoverClientY = clientOffset.y - hoverBoundingRect.top;

            if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
            if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

            moveItem(dragIndex, hoverIndex);
            item.index = hoverIndex;
        },
    });

    const [{ isDragging }, drag] = useDrag({
        type: ItemTypes.ACCOUNT_NAME,
        item: () => ({ id: account._id, index, originalIndex: index }),
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
        end: (item, monitor) => {
            // Only trigger reorder if the item was actually dropped (not cancelled)
            // and if the position changed
            if (monitor.didDrop() || item.index !== item.originalIndex) {
                onDragEnd();
            }
        },
    });

    drag(drop(ref));

    // Get array of groups (handle both old single value and new array format)
    const accountGroups = Array.isArray(account.account_groups) ? account.account_groups : 
                          (account.account_group ? [account.account_group] : []);

    return (
        <tr 
            ref={ref}
            data-handler-id={handlerId}
            className="hover:bg-gray-50 cursor-move"
            style={{ opacity: isDragging ? 0.4 : 1 }}
        >
            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                <div className="flex items-center">
                    <Bars3Icon className="h-5 w-5 text-gray-400 mr-3" />
                    <div className="flex flex-col">
                        <span>{account.account_name}</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                            {account.service_charge && (
                                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full" title={account.service_charge_formula || ''}>
                                    S.C.
                                </span>
                            )}
                            {accountGroups.map(group => (
                                <span key={group} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {ACCOUNT_GROUP_OPTIONS.find(g => g.value === group)?.label || group}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-6 py-4 text-sm text-gray-900">
                {account.description || '-'}
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {account.inserted_by_user 
                    ? `${account.inserted_by_user.firstName} ${account.inserted_by_user.lastName}`.trim()
                    : '-'
                }
            </td>
            <td className="px-6 py-4 whitespace-nowrap text-center">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(account);
                        }}
                        className="text-teal-600 hover:text-teal-900 transition-colors"
                        title="Edit"
                    >
                        <PencilIcon className="h-5 w-5" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(account);
                        }}
                        className="text-red-600 hover:text-red-900 transition-colors"
                        title="Delete"
                    >
                        <TrashIcon className="h-5 w-5" />
                    </button>
                </div>
            </td>
        </tr>
    );
};

const ManagementAccountTypesPage = () => {
    const currentUser = useSelector(state => state.user.data);

    // Check access permission - only admin
    if (!currentUser || currentUser.role?.shortCode !== 'admin') {
        return (
            <Layout>
                <div className="flex flex-col items-center justify-center h-96">
                    <h1 className="text-2xl font-bold text-gray-700">Access Denied</h1>
                    <p className="text-gray-500 mt-2">Only administrators can access this page.</p>
                </div>
            </Layout>
        );
    }

    const [loading, setLoading] = useState(true);
    const [accountTypes, setAccountTypes] = useState([]);
    const [selectedAccountType, setSelectedAccountType] = useState(null);
    const [accountNames, setAccountNames] = useState([]);
    const [loadingNames, setLoadingNames] = useState(false);

    // Account Type Form States
    const [showTypeForm, setShowTypeForm] = useState(false);
    const [typeFormData, setTypeFormData] = useState({
        typeName: '',
        typeCode: '',
        description: '',
        displayOrder: 0,
        accountGroups: [],
        displayGroups: []
    });
    const [editingType, setEditingType] = useState(null);

    // Account Name Form States
    const [showNameForm, setShowNameForm] = useState(false);
    const [nameFormData, setNameFormData] = useState({
        accountName: '',
        description: '',
        accountGroups: [],
        serviceCharge: false,
        serviceChargeFormula: ''
    });
    const [editingName, setEditingName] = useState(null);

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete] = useState(null);
    const [deleteType, setDeleteType] = useState(''); // 'type' or 'name'

    // Load account types on mount
    useEffect(() => {
        loadAccountTypes();
    }, []);

    // Load account names when type is selected
    useEffect(() => {
        if (selectedAccountType) {
            loadAccountNames(selectedAccountType._id);
        }
    }, [selectedAccountType]);

    const loadAccountTypes = async () => {
        setLoading(true);
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-types/list';
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setAccountTypes(response.accountTypes);
                // Auto-select first type if none selected
                if (!selectedAccountType && response.accountTypes.length > 0) {
                    setSelectedAccountType(response.accountTypes[0]);
                }
            }
        } catch (error) {
            console.error('Error loading account types:', error);
            toast.error('Failed to load account types');
        } finally {
            setLoading(false);
        }
    };

    const loadAccountNames = async (accountTypeId) => {
        setLoadingNames(true);
        try {
            const apiUrl = getApiBaseUrl() + `management-transactions/account-names/list?accountTypeId=${accountTypeId}`;
            const response = await fetchWrapper.get(apiUrl);
            
            if (response.success) {
                setAccountNames(response.accountNames);
            }
        } catch (error) {
            console.error('Error loading account names:', error);
            toast.error('Failed to load account names');
        } finally {
            setLoadingNames(false);
        }
    };

    // Drag and Drop handlers for Account Types
    const moveAccountType = useCallback((dragIndex, hoverIndex) => {
        setAccountTypes((prevTypes) => {
            const updatedTypes = [...prevTypes];
            const [removed] = updatedTypes.splice(dragIndex, 1);
            updatedTypes.splice(hoverIndex, 0, removed);
            return updatedTypes;
        });
    }, []);

    const handleAccountTypeDropEnd = useCallback(async () => {
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-types/reorder';
            const response = await fetchWrapper.post(apiUrl, {
                accountTypes: accountTypes,
                userId: currentUser._id
            });

            if (response.success) {
                toast.success('Account types reordered successfully');
            } else {
                toast.error(response.message || 'Failed to reorder account types');
                loadAccountTypes(); // Reload to reset order
            }
        } catch (error) {
            console.error('Error reordering account types:', error);
            toast.error('Failed to reorder account types');
            loadAccountTypes(); // Reload to reset order
        }
    }, [accountTypes, currentUser]);

    // Drag and Drop handlers for Account Names
    const moveAccountName = useCallback((dragIndex, hoverIndex) => {
        setAccountNames((prevNames) => {
            const updatedNames = [...prevNames];
            const [removed] = updatedNames.splice(dragIndex, 1);
            updatedNames.splice(hoverIndex, 0, removed);
            return updatedNames;
        });
    }, []);

    const handleAccountNameDropEnd = useCallback(async () => {
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-names/reorder';
            const response = await fetchWrapper.post(apiUrl, {
                accountNames: accountNames,
                userId: currentUser._id
            });

            if (response.success) {
                toast.success('Account names reordered successfully');
            } else {
                toast.error(response.message || 'Failed to reorder account names');
                if (selectedAccountType) {
                    loadAccountNames(selectedAccountType._id); // Reload to reset order
                }
            }
        } catch (error) {
            console.error('Error reordering account names:', error);
            toast.error('Failed to reorder account names');
            if (selectedAccountType) {
                loadAccountNames(selectedAccountType._id); // Reload to reset order
            }
        }
    }, [accountNames, currentUser, selectedAccountType]);

    // Account Type Handlers
    const handleAddType = () => {
        setEditingType(null);
        setTypeFormData({
            typeName: '',
            typeCode: '',
            description: '',
            displayOrder: accountTypes.length,
            accountGroups: [],
            displayGroups: []
        });
        setShowTypeForm(true);
    };

    const handleEditType = (type) => {
        setEditingType(type);
        // Handle both old single value and new array format
        const accountGroups = Array.isArray(type.account_groups) ? type.account_groups : 
                              (type.account_group ? [type.account_group] : []);
        const displayGroups = Array.isArray(type.display_groups) ? type.display_groups : 
                              (type.display_group ? [type.display_group] : []);
        setTypeFormData({
            typeName: type.type_name,
            typeCode: type.type_code,
            description: type.description || '',
            displayOrder: type.display_order,
            accountGroups: accountGroups,
            displayGroups: displayGroups
        });
        setShowTypeForm(true);
    };

    const handleSubmitType = async (e) => {
        e.preventDefault();
        
        if (!typeFormData.typeName.trim() || !typeFormData.typeCode.trim()) {
            toast.error('Please enter type name and code');
            return;
        }

        setIsSubmitting(true);
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-types/save';
            const response = await fetchWrapper.post(apiUrl, {
                typeId: editingType?._id,
                typeName: typeFormData.typeName.trim(),
                typeCode: typeFormData.typeCode.trim().toLowerCase().replace(/\s+/g, '_'),
                description: typeFormData.description.trim(),
                displayOrder: typeFormData.displayOrder,
                accountGroups: typeFormData.accountGroups,
                displayGroups: typeFormData.displayGroups,
                userId: currentUser._id
            });

            if (response.success) {
                toast.success(editingType ? 'Account type updated successfully' : 'Account type added successfully');
                setShowTypeForm(false);
                setEditingType(null);
                loadAccountTypes();
            } else {
                toast.error(response.message || 'Failed to save account type');
            }
        } catch (error) {
            console.error('Error saving account type:', error);
            toast.error('Failed to save account type');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteType = (type) => {
        setItemToDelete(type);
        setDeleteType('type');
        setShowDeleteDialog(true);
    };

    // Account Name Handlers
    const handleAddName = () => {
        if (!selectedAccountType) {
            toast.error('Please select an account type first');
            return;
        }
        setEditingName(null);
        setNameFormData({
            accountName: '',
            description: '',
            accountGroups: [],
            serviceCharge: false,
            serviceChargeFormula: ''
        });
        setShowNameForm(true);
    };

    const handleEditName = (account) => {
        setEditingName(account);
        // Handle both old single value and new array format
        const accountGroups = Array.isArray(account.account_groups) ? account.account_groups : 
                              (account.account_group ? [account.account_group] : []);
        setNameFormData({
            accountName: account.account_name,
            description: account.description || '',
            accountGroups: accountGroups,
            serviceCharge: account.service_charge || false,
            serviceChargeFormula: account.service_charge_formula || ''
        });
        setShowNameForm(true);
    };

    const handleSubmitName = async (e) => {
        e.preventDefault();
        
        if (!nameFormData.accountName.trim()) {
            toast.error('Please enter account name');
            return;
        }

        // Validate formula if service charge is enabled
        if (nameFormData.serviceCharge && !nameFormData.serviceChargeFormula.trim()) {
            toast.error('Please enter a formula when service charge is enabled');
            return;
        }

        setIsSubmitting(true);
        try {
            const apiUrl = getApiBaseUrl() + 'management-transactions/account-names/save';
            const response = await fetchWrapper.post(apiUrl, {
                accountId: editingName?._id,
                accountTypeId: selectedAccountType._id,
                accountName: nameFormData.accountName.trim(),
                description: nameFormData.description.trim(),
                accountGroups: nameFormData.accountGroups,
                serviceCharge: nameFormData.serviceCharge,
                serviceChargeFormula: nameFormData.serviceChargeFormula.trim(),
                userId: currentUser._id
            });

            if (response.success) {
                toast.success(editingName ? 'Account name updated successfully' : 'Account name added successfully');
                setShowNameForm(false);
                setEditingName(null);
                loadAccountNames(selectedAccountType._id);
            } else {
                toast.error(response.message || 'Failed to save account name');
            }
        } catch (error) {
            console.error('Error saving account name:', error);
            toast.error('Failed to add account name');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteName = (account) => {
        setItemToDelete(account);
        setDeleteType('name');
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (!itemToDelete) return;

        try {
            const endpoint = deleteType === 'type' ? 'account-types/delete' : 'account-names/delete';
            const idField = deleteType === 'type' ? 'typeId' : 'accountId';
            
            const apiUrl = getApiBaseUrl() + `management-transactions/${endpoint}`;
            const response = await fetchWrapper.post(apiUrl, {
                [idField]: itemToDelete._id,
                userId: currentUser._id
            });

            if (response.success) {
                toast.success(`${deleteType === 'type' ? 'Account type' : 'Account name'} deleted successfully`);
                setShowDeleteDialog(false);
                setItemToDelete(null);
                
                if (deleteType === 'type') {
                    loadAccountTypes();
                    if (selectedAccountType?._id === itemToDelete._id) {
                        setSelectedAccountType(null);
                        setAccountNames([]);
                    }
                } else {
                    loadAccountNames(selectedAccountType._id);
                }
            } else {
                toast.error(response.message || 'Failed to delete');
            }
        } catch (error) {
            console.error('Error deleting:', error);
            toast.error('Failed to delete');
        }
    };

    return (
        <DndProvider backend={HTML5Backend}>
            <Layout>
                <div className="flex flex-col h-full bg-white">
                    {/* Header */}
                    <div className="flex flex-row md:flex-col justify-between md:items-center p-6 border-b border-gray-200">
                        <div className="w-3/4 md:w-full flex flex-col justtify-start md:justify-center">
                            <h1 className="text-2xl font-bold text-gray-800">Management Account Types</h1>
                            <p className="text-sm text-gray-500 mt-1">
                                Manage account type categories and their account names. Drag items to reorder.
                            </p>
                        </div>
                        
                        <div className="w-1/4 md:w-full flex justify-end md:justify-center">
                            <ButtonSolid
                                label="Add Account Type"
                                icon={[<PlusIcon className="h-5 w-5" />, 'left']}
                                onClick={handleAddType}
                                className="mt-4 md:mt-0"
                                width="w-auto"
                            />
                        </div>
                    </div>

                    {/* Main Content - Two Column Layout */}
                    <div className="flex-grow flex overflow-hidden">
                        {/* Left Panel - Account Types */}
                        <div className="w-1/3 border-r border-gray-200 overflow-auto bg-gray-50">
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-semibold text-gray-700">Account Types</h2>
                                    <div className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">
                                        Drag to reorder
                                    </div>
                                </div>
                                
                                {loading ? (
                                    <div className="flex justify-center items-center h-64">
                                        <Spinner />
                                    </div>
                                ) : accountTypes.length === 0 ? (
                                    <div className="text-center text-gray-500 py-8">
                                        <p>No account types found.</p>
                                        <p className="text-sm mt-2">Click "Add Account Type" to create one.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {accountTypes.map((type, index) => (
                                            <DraggableAccountType
                                                key={type._id}
                                                type={type}
                                                index={index}
                                                moveItem={moveAccountType}
                                                isSelected={selectedAccountType?._id === type._id}
                                                onClick={() => setSelectedAccountType(type)}
                                                onEdit={handleEditType}
                                                onDelete={handleDeleteType}
                                                onDragEnd={handleAccountTypeDropEnd}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Panel - Account Names */}
                        <div className="flex-1 overflow-auto p-6">
                            {selectedAccountType ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-800">
                                                Account Names - {selectedAccountType.type_name}
                                            </h2>
                                            <p className="text-sm text-gray-500 mt-1">
                                                Manage account names under this category. Drag to reorder.
                                            </p>
                                        </div>
                                        <ButtonSolid 
                                            label="Add Account Name"
                                            icon={[<PlusIcon className="h-5 w-5" />, 'left']}
                                            onClick={handleAddName}
                                            width="w-auto"
                                        />
                                    </div>

                                    {loadingNames ? (
                                        <div className="flex justify-center items-center h-64">
                                            <Spinner />
                                        </div>
                                    ) : (
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                            <div className="overflow-x-auto">
                                                <table className="min-w-full divide-y divide-gray-200">
                                                    <thead className="bg-gray-50">
                                                        <tr>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Account Name
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Description
                                                            </th>
                                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                                Created By
                                                            </th>
                                                            <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                                                                Actions
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="bg-white divide-y divide-gray-200">
                                                        {accountNames.length === 0 ? (
                                                            <tr>
                                                                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                                                    No account names found. Click "Add Account Name" to create one.
                                                                </td>
                                                            </tr>
                                                        ) : (
                                                            accountNames.map((account, index) => (
                                                                <DraggableAccountNameRow
                                                                    key={account._id}
                                                                    account={account}
                                                                    index={index}
                                                                    moveItem={moveAccountName}
                                                                    onEdit={handleEditName}
                                                                    onDelete={handleDeleteName}
                                                                    onDragEnd={handleAccountNameDropEnd}
                                                                />
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                                    <ChevronRightIcon className="h-16 w-16 mb-4 text-gray-300" />
                                    <p className="text-lg">Select an account type to view account names</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Account Type Form Dialog */}
                <Dialog show={showTypeForm}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="mb-4">
                            <h3 className="text-2xl font-semibold text-gray-900">
                                {editingType ? 'Edit Account Type' : 'Add New Account Type'}
                            </h3>
                        </div>
                        
                        <form onSubmit={handleSubmitType}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Type Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={typeFormData.typeName}
                                        onChange={(e) => setTypeFormData({...typeFormData, typeName: e.target.value})}
                                        placeholder="e.g., Management Cost/Expenses"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Type Code * <span className="text-xs text-gray-500">(lowercase, underscores only)</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={typeFormData.typeCode}
                                        onChange={(e) => setTypeFormData({...typeFormData, typeCode: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                                        placeholder="e.g., management_cost"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required
                                        disabled={editingType !== null}
                                    />
                                    {editingType && (
                                        <p className="text-xs text-gray-500 mt-1">Type code cannot be changed after creation</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Account Groups
                                    </label>
                                    <MultiSelectDropdown
                                        options={ACCOUNT_GROUP_OPTIONS}
                                        selectedValues={typeFormData.accountGroups}
                                        onChange={(values) => setTypeFormData({...typeFormData, accountGroups: values})}
                                        placeholder="Select account groups..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Used for grouping in transaction summary view (can select multiple)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Display Groups
                                    </label>
                                    <MultiSelectDropdown
                                        options={DISPLAY_GROUP_OPTIONS}
                                        selectedValues={typeFormData.displayGroups}
                                        onChange={(values) => setTypeFormData({...typeFormData, displayGroups: values})}
                                        placeholder="Select display groups..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Used for categorizing as Assets, Liabilities, or Management Expenses (can select multiple)
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        value={typeFormData.description}
                                        onChange={(e) => setTypeFormData({...typeFormData, description: e.target.value})}
                                        placeholder="Enter description"
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        value={typeFormData.displayOrder}
                                        onChange={(e) => setTypeFormData({...typeFormData, displayOrder: parseInt(e.target.value) || 0})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex flex-row justify-center text-center px-4 py-3 mt-6 sm:px-6 sm:flex gap-3">
                                <ButtonOutline 
                                    type="button" 
                                    onClick={() => setShowTypeForm(false)}
                                    label="Cancel"
                                    className="p-2"
                                />
                                <ButtonSolid 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    label={isSubmitting ? 'Saving...' : editingType ? 'Update' : 'Save'}
                                    className="p-2"
                                />
                            </div>
                        </form>
                    </div>
                </Dialog>

                {/* Account Name Form Dialog */}
                <Dialog show={showNameForm}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="mb-4">
                            <h3 className="text-2xl font-semibold text-gray-900">
                                {editingName ? 'Edit Account Name' : 'Add Account Name'}
                            </h3>
                        </div>
                        
                        <form onSubmit={handleSubmitName}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Account Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={nameFormData.accountName}
                                        onChange={(e) => setNameFormData({...nameFormData, accountName: e.target.value})}
                                        placeholder="Enter account name"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Account Groups (Override)
                                    </label>
                                    <MultiSelectDropdown
                                        options={ACCOUNT_GROUP_OPTIONS}
                                        selectedValues={nameFormData.accountGroups}
                                        onChange={(values) => setNameFormData({...nameFormData, accountGroups: values})}
                                        placeholder="Select account groups..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        If set, this overrides the account type's groups for summary view (can select multiple).
                                        {selectedAccountType?.account_groups && selectedAccountType.account_groups.length > 0 && (
                                            <span className="block mt-1">
                                                Account Type default: <span className="font-medium">{getGroupLabels(selectedAccountType.account_groups).join(', ')}</span>
                                            </span>
                                        )}
                                    </p>
                                </div>
                                
                                {/* Service Charge Section */}
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="text-sm font-medium text-gray-700">
                                            Service Charge (with S.C.)
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => setNameFormData({
                                                ...nameFormData, 
                                                serviceCharge: !nameFormData.serviceCharge,
                                                serviceChargeFormula: !nameFormData.serviceCharge ? nameFormData.serviceChargeFormula : ''
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                                nameFormData.serviceCharge ? 'bg-teal-600' : 'bg-gray-300'
                                            }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                    nameFormData.serviceCharge ? 'translate-x-6' : 'translate-x-1'
                                                }`}
                                            />
                                        </button>
                                    </div>
                                    {nameFormData.serviceCharge && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Formula *
                                            </label>
                                            <input
                                                type="text"
                                                value={nameFormData.serviceChargeFormula}
                                                onChange={(e) => setNameFormData({...nameFormData, serviceChargeFormula: e.target.value})}
                                                placeholder="e.g., (debit + credit) / 12"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 font-mono text-sm"
                                            />
                                            <div className="mt-2 text-xs text-gray-500 space-y-1">
                                                <p>A "Less: Unearned Service Charges" row will be auto-generated below this account.</p>
                                                <p><strong>Variables:</strong> <code className="bg-gray-200 px-1 rounded">debit</code>, <code className="bg-gray-200 px-1 rounded">credit</code></p>
                                                <p><strong>Operators:</strong> <code className="bg-gray-200 px-1 rounded">+</code> <code className="bg-gray-200 px-1 rounded">-</code> <code className="bg-gray-200 px-1 rounded">*</code> <code className="bg-gray-200 px-1 rounded">/</code> <code className="bg-gray-200 px-1 rounded">( )</code></p>
                                                <p><strong>Examples:</strong></p>
                                                <ul className="list-disc list-inside pl-2">
                                                    <li><code className="bg-gray-200 px-1 rounded">(debit + credit) / 12</code></li>
                                                    <li><code className="bg-gray-200 px-1 rounded">-(debit / 11)</code></li>
                                                    <li><code className="bg-gray-200 px-1 rounded">debit * 0.09</code></li>
                                                </ul>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description (Optional)
                                    </label>
                                    <textarea
                                        value={nameFormData.description}
                                        onChange={(e) => setNameFormData({...nameFormData, description: e.target.value})}
                                        placeholder="Enter description"
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    />
                                </div>
                            </div>
                            
                            <div className="flex flex-row justify-center text-center px-4 py-3 mt-6 sm:px-6 sm:flex gap-3">
                                <ButtonOutline 
                                    type="button" 
                                    onClick={() => {
                                        setShowNameForm(false);
                                        setEditingName(null);
                                    }}
                                    label="Cancel"
                                    className="p-2"
                                />
                                <ButtonSolid 
                                    type="submit" 
                                    disabled={isSubmitting}
                                    label={isSubmitting ? 'Saving...' : editingName ? 'Update' : 'Save'}
                                    className="p-2"
                                />
                            </div>
                        </form>
                    </div>
                </Dialog>

                {/* Delete Confirmation Dialog */}
                <Dialog show={showDeleteDialog}>
                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                        <div className="sm:flex sm:items-start justify-center">
                            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-center">
                                <div className="mt-2">
                                    <p className="text-2xl font-normal text-dark-color">
                                        Delete {deleteType === 'type' ? 'Account Type' : 'Account Name'}
                                    </p>
                                    <p className="text-gray-700 mt-4">
                                        Are you sure you want to delete "<strong>{deleteType === 'type' ? itemToDelete?.type_name : itemToDelete?.account_name}</strong>"?
                                        <br />This action cannot be undone.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-row justify-center text-center px-4 py-3 sm:px-6 sm:flex gap-3">
                        <ButtonOutline 
                            onClick={() => setShowDeleteDialog(false)}
                            label="Cancel"
                            type="button"
                            className="p-2"
                        />
                        <ButtonSolid 
                            onClick={confirmDelete} 
                            className="p-2 bg-red-600 hover:bg-red-700"
                            label="Delete"
                            type="button"
                        />
                    </div>
                </Dialog>
            </Layout>
        </DndProvider>
    );
};

export default ManagementAccountTypesPage;