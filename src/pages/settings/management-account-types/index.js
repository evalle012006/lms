import React, { useState, useEffect, useCallback } from "react";
import Layout from "@/components/Layout";
import { useSelector } from "react-redux";
import { fetchWrapper } from "@/lib/fetch-wrapper";
import Spinner from "@/components/Spinner";
import { toast } from "react-toastify";
import { getApiBaseUrl } from "@/lib/constants";
import ButtonSolid from "@/lib/ui/ButtonSolid";
import ButtonOutline from "@/lib/ui/ButtonOutline";
import { PlusIcon, ChevronRightIcon } from '@heroicons/react/24/solid';
import Dialog from "@/lib/ui/Dialog";
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

import FormulaInput from "@/components/management-account-types/FormulaInput";
import MultiSelectDropdown from "@/components/management-account-types/MultiSelectDropdown";
import DraggableAccountType from "@/components/management-account-types/DraggableAccountType";
import DraggableAccountNameRow from "@/components/management-account-types/DraggableAccountNameRow";
import { ACCOUNT_GROUP_OPTIONS, DISPLAY_GROUP_OPTIONS, getGroupLabels } from "@/components/management-account-types/constants";

const emptyTypeForm = (length = 0) => ({
    typeName: '', typeCode: '', description: '', displayOrder: length,
    accountGroups: [], displayGroups: [],
});

const emptyNameForm = () => ({
    accountName: '', description: '', accountGroups: [],
    serviceCharge: false,
    prevBalanceFormula: '', debitFormula: '', creditFormula: '', balanceFormula: '',
});

// ── Formula hint shown inside the formula panel ───────────────────────────────
const FormulaHint = () => (
    <div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-700 space-y-0.5">
        <p>Click variable tags to insert at cursor. <strong>+ ref</strong> inserts a reference to another account's value.</p>
        <p>
            <strong>Operators:</strong>{' '}
            <code className="bg-blue-100 px-1 rounded">+</code> add &nbsp;
            <code className="bg-blue-100 px-1 rounded">-</code> subtract &nbsp;
            <code className="bg-blue-100 px-1 rounded">*</code> multiply &nbsp;
            <code className="bg-blue-100 px-1 rounded">/</code> divide &nbsp;
            <code className="bg-blue-100 px-1 rounded">( )</code> grouping
        </p>
        <p className="text-blue-400">Leave a column blank to show 0 or use the account's raw entered value.</p>
    </div>
);

// ─────────────────────────────────────────────────────────────────────────────

const ManagementAccountTypesPage = () => {
    const currentUser = useSelector(state => state.user.data);

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

    const [loading, setLoading]                   = useState(true);
    const [accountTypes, setAccountTypes]         = useState([]);
    const [selectedType, setSelectedType]         = useState(null);
    const [accountNames, setAccountNames]         = useState([]);
    const [loadingNames, setLoadingNames]         = useState(false);
    const [isSubmitting, setIsSubmitting]         = useState(false);

    const [showTypeForm, setShowTypeForm]         = useState(false);
    const [editingType, setEditingType]           = useState(null);
    const [typeFormData, setTypeFormData]         = useState(emptyTypeForm());

    const [showNameForm, setShowNameForm]         = useState(false);
    const [editingName, setEditingName]           = useState(null);
    const [nameFormData, setNameFormData]         = useState(emptyNameForm());

    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [itemToDelete, setItemToDelete]         = useState(null);
    const [deleteType, setDeleteType]             = useState('');

    // ── Data loading ──────────────────────────────────────────────────────────
    useEffect(() => { loadAccountTypes(); }, []);
    useEffect(() => { if (selectedType) loadAccountNames(selectedType._id); }, [selectedType]);

    const loadAccountTypes = async () => {
        setLoading(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + 'management-transactions/account-types/list');
            if (res.success) {
                setAccountTypes(res.accountTypes);
                if (!selectedType && res.accountTypes.length > 0) setSelectedType(res.accountTypes[0]);
            }
        } catch { toast.error('Failed to load account types'); }
        finally { setLoading(false); }
    };

    const loadAccountNames = async (typeId) => {
        setLoadingNames(true);
        try {
            const res = await fetchWrapper.get(getApiBaseUrl() + `management-transactions/account-names/list?accountTypeId=${typeId}`);
            if (res.success) setAccountNames(res.accountNames);
        } catch { toast.error('Failed to load account names'); }
        finally { setLoadingNames(false); }
    };

    // ── DnD ───────────────────────────────────────────────────────────────────
    const moveAccountType = useCallback((dragIndex, hoverIndex) => {
        setAccountTypes(prev => {
            const arr = [...prev];
            const [r] = arr.splice(dragIndex, 1);
            arr.splice(hoverIndex, 0, r);
            return arr;
        });
    }, []);

    const handleTypeDropEnd = useCallback(async () => {
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'management-transactions/account-types/reorder', { accountTypes, userId: currentUser._id });
            if (res.success) toast.success('Reordered successfully');
            else { toast.error(res.message || 'Failed'); loadAccountTypes(); }
        } catch { toast.error('Failed to reorder'); loadAccountTypes(); }
    }, [accountTypes, currentUser]);

    const moveAccountName = useCallback((dragIndex, hoverIndex) => {
        setAccountNames(prev => {
            const arr = [...prev];
            const [r] = arr.splice(dragIndex, 1);
            arr.splice(hoverIndex, 0, r);
            return arr;
        });
    }, []);

    const handleNameDropEnd = useCallback(async () => {
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'management-transactions/account-names/reorder', { accountNames, userId: currentUser._id });
            if (res.success) toast.success('Reordered successfully');
            else { toast.error(res.message || 'Failed'); if (selectedType) loadAccountNames(selectedType._id); }
        } catch { toast.error('Failed to reorder'); if (selectedType) loadAccountNames(selectedType._id); }
    }, [accountNames, currentUser, selectedType]);

    // ── Account Type CRUD ─────────────────────────────────────────────────────
    const handleAddType = () => {
        setEditingType(null);
        setTypeFormData(emptyTypeForm(accountTypes.length));
        setShowTypeForm(true);
    };

    const handleEditType = (type) => {
        setEditingType(type);
        setTypeFormData({
            typeName: type.type_name, typeCode: type.type_code,
            description: type.description || '', displayOrder: type.display_order,
            accountGroups: Array.isArray(type.account_groups) ? type.account_groups : (type.account_group ? [type.account_group] : []),
            displayGroups: Array.isArray(type.display_groups) ? type.display_groups : (type.display_group ? [type.display_group] : []),
        });
        setShowTypeForm(true);
    };

    const handleSubmitType = async (e) => {
        e.preventDefault();
        if (!typeFormData.typeName.trim() || !typeFormData.typeCode.trim()) { toast.error('Please enter type name and code'); return; }
        setIsSubmitting(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'management-transactions/account-types/save', {
                typeId: editingType?._id, typeName: typeFormData.typeName.trim(),
                typeCode: typeFormData.typeCode.trim().toLowerCase().replace(/\s+/g, '_'),
                description: typeFormData.description.trim(), displayOrder: typeFormData.displayOrder,
                accountGroups: typeFormData.accountGroups, displayGroups: typeFormData.displayGroups,
                userId: currentUser._id,
            });
            if (res.success) { toast.success(editingType ? 'Account type updated' : 'Account type added'); setShowTypeForm(false); setEditingType(null); loadAccountTypes(); }
            else toast.error(res.message || 'Failed to save');
        } catch { toast.error('Failed to save account type'); }
        finally { setIsSubmitting(false); }
    };

    // ── Account Name CRUD ─────────────────────────────────────────────────────
    const handleAddName = () => {
        if (!selectedType) { toast.error('Please select an account type first'); return; }
        setEditingName(null);
        setNameFormData(emptyNameForm());
        setShowNameForm(true);
    };

    const handleEditName = (account) => {
        setEditingName(account);
        setNameFormData({
            accountName: account.account_name, description: account.description || '',
            accountGroups: Array.isArray(account.account_groups) ? account.account_groups : (account.account_group ? [account.account_group] : []),
            serviceCharge: account.service_charge || false,
            // Read new per-column formulas; fall back to legacy service_charge_formula in debitFormula
            prevBalanceFormula: account.prev_balance_formula || '',
            debitFormula:       account.debit_formula || account.service_charge_formula || '',
            creditFormula:      account.credit_formula || '',
            balanceFormula:     account.balance_formula || '',
        });
        setShowNameForm(true);
    };

    const handleSubmitName = async (e) => {
        e.preventDefault();
        if (!nameFormData.accountName.trim()) { toast.error('Please enter account name'); return; }
        setIsSubmitting(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'management-transactions/account-names/save', {
                accountId: editingName?._id, accountTypeId: selectedType._id,
                accountName: nameFormData.accountName.trim(), description: nameFormData.description.trim(),
                accountGroups: nameFormData.accountGroups, serviceCharge: nameFormData.serviceCharge,
                prevBalanceFormula: nameFormData.prevBalanceFormula.trim(),
                debitFormula:       nameFormData.debitFormula.trim(),
                creditFormula:      nameFormData.creditFormula.trim(),
                balanceFormula:     nameFormData.balanceFormula.trim(),
                userId: currentUser._id,
            });
            if (res.success) { toast.success(editingName ? 'Account name updated' : 'Account name added'); setShowNameForm(false); setEditingName(null); loadAccountNames(selectedType._id); }
            else toast.error(res.message || 'Failed to save');
        } catch { toast.error('Failed to save account name'); }
        finally { setIsSubmitting(false); }
    };

    // ── Delete ────────────────────────────────────────────────────────────────
    const confirmDelete = async () => {
        if (!itemToDelete) return;
        try {
            const endpoint = deleteType === 'type' ? 'account-types/delete' : 'account-names/delete';
            const idField  = deleteType === 'type' ? 'typeId' : 'accountId';
            const res = await fetchWrapper.post(getApiBaseUrl() + `management-transactions/${endpoint}`, { [idField]: itemToDelete._id, userId: currentUser._id });
            if (res.success) {
                toast.success(`${deleteType === 'type' ? 'Account type' : 'Account name'} deleted`);
                setShowDeleteDialog(false); setItemToDelete(null);
                if (deleteType === 'type') {
                    loadAccountTypes();
                    if (selectedType?._id === itemToDelete._id) { setSelectedType(null); setAccountNames([]); }
                } else loadAccountNames(selectedType._id);
            } else toast.error(res.message || 'Failed to delete');
        } catch { toast.error('Failed to delete'); }
    };

    // ── Convenience updater for name form ─────────────────────────────────────
    const setNF = (key) => (val) => setNameFormData(prev => ({ ...prev, [key]: val }));

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <DndProvider backend={HTML5Backend}>
            <Layout>
                <div className="flex flex-col h-full bg-white">
                    {/* Page header */}
                    <div className="flex justify-between items-center p-6 border-b border-gray-200">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">Management Account Types</h1>
                            <p className="text-sm text-gray-500 mt-1">Manage account type categories and account names. Drag to reorder.</p>
                        </div>
                        <ButtonSolid label="Add Account Type" icon={[<PlusIcon className="h-5 w-5" />, 'left']} onClick={handleAddType} width="w-auto" />
                    </div>

                    {/* Two-column layout */}
                    <div className="flex-grow flex overflow-hidden">
                        {/* Left — Account Types list */}
                        <div className="w-1/3 border-r border-gray-200 overflow-auto bg-gray-50 p-4">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-lg font-semibold text-gray-700">Account Types</h2>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded">Drag to reorder</span>
                            </div>
                            {loading ? (
                                <div className="flex justify-center items-center h-64"><Spinner /></div>
                            ) : accountTypes.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    <p>No account types found.</p>
                                    <p className="text-sm mt-2">Click "Add Account Type" to create one.</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {accountTypes.map((type, index) => (
                                        <DraggableAccountType
                                            key={type._id} type={type} index={index}
                                            moveItem={moveAccountType}
                                            isSelected={selectedType?._id === type._id}
                                            onClick={() => setSelectedType(type)}
                                            onEdit={handleEditType}
                                            onDelete={t => { setItemToDelete(t); setDeleteType('type'); setShowDeleteDialog(true); }}
                                            onDragEnd={handleTypeDropEnd}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Right — Account Names table */}
                        <div className="flex-1 overflow-auto p-6">
                            {selectedType ? (
                                <>
                                    <div className="flex items-center justify-between mb-6">
                                        <div>
                                            <h2 className="text-lg font-semibold text-gray-800">Account Names — {selectedType.type_name}</h2>
                                            <p className="text-sm text-gray-500 mt-1">Drag to reorder.</p>
                                        </div>
                                        <ButtonSolid label="Add Account Name" icon={[<PlusIcon className="h-5 w-5" />, 'left']} onClick={handleAddName} width="w-auto" />
                                    </div>
                                    {loadingNames ? (
                                        <div className="flex justify-center items-center h-64"><Spinner /></div>
                                    ) : (
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                                            <table className="min-w-full divide-y divide-gray-200">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Account Name</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created By</th>
                                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="bg-white divide-y divide-gray-200">
                                                    {accountNames.length === 0 ? (
                                                        <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-500">No account names. Click "Add Account Name" to create one.</td></tr>
                                                    ) : (
                                                        accountNames.map((account, index) => (
                                                            <DraggableAccountNameRow
                                                                key={account._id} account={account} index={index}
                                                                moveItem={moveAccountName}
                                                                onEdit={handleEditName}
                                                                onDelete={a => { setItemToDelete(a); setDeleteType('name'); setShowDeleteDialog(true); }}
                                                                onDragEnd={handleNameDropEnd}
                                                            />
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
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


                {/* ── Account Type Dialog — custom overlay bypasses Dialog's sm width cap ── */}
                {showTypeForm && (
                <div className="modal-container" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="modal-backdrop" />
                    <div className="modal-body flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl px-6 pt-6 pb-4 w-full"
                         style={{ maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto' }}>
                        <h3 className="text-xl font-semibold text-gray-900 mb-5">
                            {editingType ? 'Edit Account Type' : 'Add New Account Type'}
                        </h3>
                        <form onSubmit={handleSubmitType}>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Type Name *</label>
                                    <input type="text" value={typeFormData.typeName}
                                        onChange={e => setTypeFormData(p => ({ ...p, typeName: e.target.value }))}
                                        placeholder="e.g., Management Cost/Expenses"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Type Code * <span className="text-xs text-gray-400">(lowercase, underscores only)</span>
                                    </label>
                                    <input type="text" value={typeFormData.typeCode}
                                        onChange={e => setTypeFormData(p => ({ ...p, typeCode: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                                        placeholder="e.g., management_cost"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required disabled={!!editingType} />
                                    {editingType && <p className="text-xs text-gray-400 mt-1">Cannot be changed after creation</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Groups</label>
                                    <MultiSelectDropdown options={ACCOUNT_GROUP_OPTIONS} selectedValues={typeFormData.accountGroups}
                                        onChange={vals => setTypeFormData(p => ({ ...p, accountGroups: vals }))} placeholder="Select account groups..." />
                                    <p className="text-xs text-gray-400 mt-1">Used for grouping in transaction summary view</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Groups</label>
                                    <MultiSelectDropdown options={DISPLAY_GROUP_OPTIONS} selectedValues={typeFormData.displayGroups}
                                        onChange={vals => setTypeFormData(p => ({ ...p, displayGroups: vals }))} placeholder="Select display groups..." />
                                    <p className="text-xs text-gray-400 mt-1">Assets, Liabilities, or Management Expenses</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                    <textarea value={typeFormData.description}
                                        onChange={e => setTypeFormData(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Enter description" rows={2}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
                                    <input type="number" value={typeFormData.displayOrder}
                                        onChange={e => setTypeFormData(p => ({ ...p, displayOrder: parseInt(e.target.value) || 0 }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500" />
                                </div>
                            </div>
                            <div className="flex justify-center gap-3 mt-6">
                                <ButtonOutline type="button" onClick={() => setShowTypeForm(false)} label="Cancel" className="p-2" />
                                <ButtonSolid type="submit" disabled={isSubmitting} label={isSubmitting ? 'Saving...' : editingType ? 'Update' : 'Save'} className="p-2" />
                            </div>
                        </form>
                    </div>
                    </div>
                </div>
                )}



                {/* ── Account Name Dialog — custom wide overlay bypasses Dialog's sm cap ── */}
                {showNameForm && (
                <div className="modal-container" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="modal-backdrop" />
                    <div className="modal-body flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-xl px-6 pt-6 pb-4 w-full"
                         style={{ maxWidth: '860px', maxHeight: '92vh', overflowY: 'auto' }}>
                        <h3 className="text-xl font-semibold text-gray-900 mb-5">
                            {editingName ? 'Edit Account Name' : 'Add Account Name'}
                        </h3>
                        <form onSubmit={handleSubmitName}>
                            <div className="grid grid-cols-2 gap-6">

                                {/* ── LEFT: account details ─── */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Name *</label>
                                        <input type="text" value={nameFormData.accountName}
                                            onChange={e => setNameFormData(p => ({ ...p, accountName: e.target.value }))}
                                            placeholder="Enter account name"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500" required />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Account Groups (Override)</label>
                                        <MultiSelectDropdown options={ACCOUNT_GROUP_OPTIONS} selectedValues={nameFormData.accountGroups}
                                            onChange={vals => setNameFormData(p => ({ ...p, accountGroups: vals }))} placeholder="Select account groups..." />
                                        {selectedType?.account_groups?.length > 0 && (
                                            <p className="text-xs text-gray-400 mt-1">
                                                Type default: <span className="font-medium">{getGroupLabels(selectedType.account_groups).join(', ')}</span>
                                            </p>
                                        )}
                                    </div>

                                    {/* Service Charge toggle */}
                                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                        <div className="flex items-start justify-between gap-3">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Service Charge (with S.C.)</p>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    When <strong>on</strong>: the formula columns drive a virtual
                                                    "Less: Unearned Service Charges" sub-row shown below this account
                                                    on the transaction input page.
                                                    <br />
                                                    When <strong>off</strong>: the formulas override this account's
                                                    own displayed values (shown as a computed read-only row).
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setNameFormData(p => ({ ...p, serviceCharge: !p.serviceCharge }))}
                                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${nameFormData.serviceCharge ? 'bg-teal-600' : 'bg-gray-300'}`}
                                            >
                                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${nameFormData.serviceCharge ? 'translate-x-6' : 'translate-x-1'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                        <textarea value={nameFormData.description}
                                            onChange={e => setNameFormData(p => ({ ...p, description: e.target.value }))}
                                            placeholder="Enter description" rows={5}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500" />
                                    </div>
                                </div>

                                {/* ── RIGHT: formula section — always visible ─── */}
                                <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3 self-start">
                                    <p className="text-sm font-semibold text-gray-700">Column Formulas</p>
                                    <FormulaHint />
                                    <FormulaInput
                                        label="Previous Balance column"
                                        value={nameFormData.prevBalanceFormula}
                                        onChange={setNF('prevBalanceFormula')}
                                        placeholder="blank = raw prev_balance"
                                        accountNames={accountNames}
                                        currentAccountId={editingName?._id}
                                    />
                                    <FormulaInput
                                        label="Debit column"
                                        value={nameFormData.debitFormula}
                                        onChange={setNF('debitFormula')}
                                        placeholder="e.g. debit * 2 / 12"
                                        accountNames={accountNames}
                                        currentAccountId={editingName?._id}
                                    />
                                    <FormulaInput
                                        label="Credit column"
                                        value={nameFormData.creditFormula}
                                        onChange={setNF('creditFormula')}
                                        placeholder="e.g. credit * 2 / 12"
                                        accountNames={accountNames}
                                        currentAccountId={editingName?._id}
                                    />
                                    <FormulaInput
                                        label="Balance / Total column"
                                        value={nameFormData.balanceFormula}
                                        onChange={setNF('balanceFormula')}
                                        placeholder="e.g. loan_receivables_debit - loan_receivables_sc_debit"
                                        accountNames={accountNames}
                                        currentAccountId={editingName?._id}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-center gap-3 mt-6">
                                <ButtonOutline type="button" onClick={() => { setShowNameForm(false); setEditingName(null); }} label="Cancel" className="p-2" />
                                <ButtonSolid type="submit" disabled={isSubmitting} label={isSubmitting ? 'Saving...' : editingName ? 'Update' : 'Save'} className="p-2" />
                            </div>
                        </form>
                    </div>
                    </div>
                </div>
                )}


                {/* ── Delete Confirmation ───────────────────────────────────── */}
                <Dialog show={showDeleteDialog}>
                    <div className="bg-white px-6 pt-6 pb-4 text-center" style={{ width: '420px', maxWidth: '95vw' }}>
                        <p className="text-2xl font-normal text-gray-800">Delete {deleteType === 'type' ? 'Account Type' : 'Account Name'}</p>
                        <p className="text-gray-600 mt-3">
                            Are you sure you want to delete{' '}
                            <strong>"{deleteType === 'type' ? itemToDelete?.type_name : itemToDelete?.account_name}"</strong>?
                            <br />This action cannot be undone.
                        </p>
                        <div className="flex justify-center gap-3 mt-6">
                            <ButtonOutline onClick={() => setShowDeleteDialog(false)} label="Cancel" type="button" className="p-2" />
                            <ButtonSolid onClick={confirmDelete} className="p-2 bg-red-600 hover:bg-red-700" label="Delete" type="button" />
                        </div>
                    </div>
                </Dialog>
            </Layout>
        </DndProvider>
    );
};

export default ManagementAccountTypesPage;