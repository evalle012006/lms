import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { PlusIcon, TrashIcon, PencilIcon, ChevronRightIcon, Bars3Icon } from '@heroicons/react/24/solid';
import Dialog from "@/lib/ui/Dialog";
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const ItemTypes = {
    ACCOUNT_TYPE: 'accountType',
    ACCOUNT_NAME: 'accountName'
};

// Account Group Options
const ACCOUNT_GROUP_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'other_receipts', label: 'Other Receipts' },
    { value: 'management_expenses', label: 'Management Expenses' },
    { value: 'other_payments', label: 'Other Payments' }
];

// Display Group Options
const DISPLAY_GROUP_OPTIONS = [
    { value: '', label: 'None' },
    { value: 'assets', label: 'Assets' },
    { value: 'liabilities', label: 'Liabilities' },
    { value: 'management_expenses', label: 'Management Expenses' }
];

// Helper function to get group label
const getGroupLabel = (groupCode) => {
    const group = ACCOUNT_GROUP_OPTIONS.find(g => g.value === groupCode);
    return group ? group.label : 'None';
};

// Helper function to get display group label
const getDisplayGroupLabel = (groupCode) => {
    const group = DISPLAY_GROUP_OPTIONS.find(g => g.value === groupCode);
    return group ? group.label : 'None';
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
                            {type.account_group && (
                                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                    {getGroupLabel(type.account_group)}
                                </span>
                            )}
                            {type.display_group && (
                                <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full">
                                    {getDisplayGroupLabel(type.display_group)}
                                </span>
                            )}
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
                        {account.account_group && (
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full mt-1 w-fit">
                                {getGroupLabel(account.account_group)}
                            </span>
                        )}
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
        accountGroup: '',
        displayGroup: ''
    });
    const [editingType, setEditingType] = useState(null);

    // Account Name Form States
    const [showNameForm, setShowNameForm] = useState(false);
    const [nameFormData, setNameFormData] = useState({
        accountName: '',
        description: '',
        accountGroup: ''
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
            accountGroup: '',
            displayGroup: ''
        });
        setShowTypeForm(true);
    };

    const handleEditType = (type) => {
        setEditingType(type);
        setTypeFormData({
            typeName: type.type_name,
            typeCode: type.type_code,
            description: type.description || '',
            displayOrder: type.display_order,
            accountGroup: type.account_group || '',
            displayGroup: type.display_group || ''
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
                accountGroup: typeFormData.accountGroup,
                displayGroup: typeFormData.displayGroup,
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
            accountGroup: ''
        });
        setShowNameForm(true);
    };

    const handleEditName = (account) => {
        setEditingName(account);
        setNameFormData({
            accountName: account.account_name,
            description: account.description || '',
            accountGroup: account.account_group || ''
        });
        setShowNameForm(true);
    };

    const handleSubmitName = async (e) => {
        e.preventDefault();
        
        if (!nameFormData.accountName.trim()) {
            toast.error('Please enter account name');
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
                accountGroup: nameFormData.accountGroup,
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
                                        Account Group
                                    </label>
                                    <select
                                        value={typeFormData.accountGroup}
                                        onChange={(e) => setTypeFormData({...typeFormData, accountGroup: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        {ACCOUNT_GROUP_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Used for grouping in transaction summary view
                                    </p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Display Group
                                    </label>
                                    <select
                                        value={typeFormData.displayGroup}
                                        onChange={(e) => setTypeFormData({...typeFormData, displayGroup: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        {DISPLAY_GROUP_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        Used for categorizing as Assets, Liabilities, or Management Expenses
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
                                        Account Group (Override)
                                    </label>
                                    <select
                                        value={nameFormData.accountGroup}
                                        onChange={(e) => setNameFormData({...nameFormData, accountGroup: e.target.value})}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                    >
                                        {ACCOUNT_GROUP_OPTIONS.map(option => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">
                                        If set, this overrides the account type's group for summary view.
                                        {selectedAccountType?.account_group && (
                                            <span className="block mt-1">
                                                Account Type default: <span className="font-medium">{getGroupLabel(selectedAccountType.account_group)}</span>
                                            </span>
                                        )}
                                    </p>
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