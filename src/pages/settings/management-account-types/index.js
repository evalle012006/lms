import React, { useState, useEffect } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { PlusIcon, TrashIcon, PencilIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Dialog from "@/lib/ui/Dialog";

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
        displayOrder: 0
    });
    const [editingType, setEditingType] = useState(null);

    // Account Name Form States
    const [showNameForm, setShowNameForm] = useState(false);
    const [nameFormData, setNameFormData] = useState({
        accountName: '',
        description: ''
    });

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

    // Account Type Handlers
    const handleAddType = () => {
        setEditingType(null);
        setTypeFormData({
            typeName: '',
            typeCode: '',
            description: '',
            displayOrder: accountTypes.length + 1
        });
        setShowTypeForm(true);
    };

    const handleEditType = (type) => {
        setEditingType(type);
        setTypeFormData({
            typeName: type.type_name,
            typeCode: type.type_code,
            description: type.description || '',
            displayOrder: type.display_order
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
        setNameFormData({
            accountName: '',
            description: ''
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
                accountTypeId: selectedAccountType._id,
                accountName: nameFormData.accountName.trim(),
                description: nameFormData.description.trim(),
                userId: currentUser._id
            });

            if (response.success) {
                toast.success('Account name added successfully');
                setShowNameForm(false);
                loadAccountNames(selectedAccountType._id);
            } else {
                toast.error(response.message || 'Failed to add account name');
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
        <Layout>
            <div className="flex flex-col h-full bg-white">
                {/* Header */}
                <div className="flex flex-row md:flex-col justify-between md:items-center  p-6 border-b border-gray-200">
                    <div className="w-3/4 md:w-full flex flex-col justtify-start md:justify-center">
                        <h1 className="text-2xl font-bold text-gray-800">Management Account Types</h1>
                        <p className="text-sm text-gray-500 mt-1">Manage account type categories and their account names</p>
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
                            <h2 className="text-lg font-semibold text-gray-700 mb-4">Account Types</h2>
                            
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
                                    {accountTypes.map((type) => (
                                        <div
                                            key={type._id}
                                            onClick={() => setSelectedAccountType(type)}
                                            className={`p-4 rounded-lg border cursor-pointer transition-all ${
                                                selectedAccountType?._id === type._id
                                                    ? 'bg-teal-50 border-teal-500 shadow-sm'
                                                    : 'bg-white border-gray-200 hover:border-teal-300'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900">{type.type_name}</h3>
                                                    {type.description && (
                                                        <p className="text-sm text-gray-500 mt-1">{type.description}</p>
                                                    )}
                                                    <p className="text-xs text-gray-400 mt-1">Code: {type.type_code}</p>
                                                </div>
                                                <div className="flex items-center gap-2 ml-2">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleEditType(type);
                                                        }}
                                                        className="text-teal-600 hover:text-teal-900 transition-colors"
                                                        title="Edit"
                                                    >
                                                        <PencilIcon className="h-4 w-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteType(type);
                                                        }}
                                                        className="text-red-600 hover:text-red-900 transition-colors"
                                                        title="Delete"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                    <ChevronRightIcon className={`h-5 w-5 transition-colors ${
                                                        selectedAccountType?._id === type._id ? 'text-teal-600' : 'text-gray-400'
                                                    }`} />
                                                </div>
                                            </div>
                                        </div>
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
                                            Manage account names under this category
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
                                                        accountNames.map((account) => (
                                                            <tr key={account._id} className="hover:bg-gray-50">
                                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                                    {account.account_name}
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
                                                                    <button
                                                                        onClick={() => handleDeleteName(account)}
                                                                        className="text-red-600 hover:text-red-900 transition-colors"
                                                                        title="Delete"
                                                                    >
                                                                        <TrashIcon className="h-5 w-5" />
                                                                    </button>
                                                                </td>
                                                            </tr>
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
                        <h3 className="text-2xl font-semibold text-gray-900">Add Account Name</h3>
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
                                onClick={() => setShowNameForm(false)}
                                label="Cancel"
                                className="p-2"
                            />
                            <ButtonSolid 
                                type="submit" 
                                disabled={isSubmitting}
                                label={isSubmitting ? 'Saving...' : 'Save'}
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
    );
};

export default ManagementAccountTypesPage;