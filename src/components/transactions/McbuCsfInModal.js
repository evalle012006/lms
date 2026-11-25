//src/components/transactions/McbuCsfInModal.js
import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';

import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-md text-sm ' +
    'focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ' +
    'disabled:bg-gray-100 disabled:cursor-not-allowed';

const labelClass =
    'block text-sm font-medium text-gray-700 mb-1';

const formatMoney = (amount) =>
    Number(amount || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });

export default function McbuCsfInModal({
    isOpen,
    onClose,
    onSuccess,
    currentUser,
    currentDate,
    branchList = [],
    selectedBranch = ''
}) {
    const isBranchManager =
        Number(currentUser?.role?.rep) === 3;

    const today = moment(currentDate || undefined)
        .format('YYYY-MM-DD');

    const [form, setForm] = useState({
        entryDate: today,
        branchId: '',
        loId: '',
        groupId: '',
        clientId: '',
        mcbuAmount: '',
        csfAmount: '',
        remarks: ''
    });

    const [loanOfficers, setLoanOfficers] = useState([]);
    const [groups, setGroups] = useState([]);
    const [clients, setClients] = useState([]);

    const [clientSearch, setClientSearch] = useState('');

    const [loadingLo, setLoadingLo] = useState(false);
    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingClients, setLoadingClients] = useState(false);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // =====================================================
    // RESET MODAL
    // =====================================================

    useEffect(() => {
        if (!isOpen) return;

        setForm({
            entryDate: today,

            branchId: isBranchManager
                ? currentUser?.designatedBranchId || ''
                : selectedBranch || '',

            loId: '',
            groupId: '',
            clientId: '',
            mcbuAmount: '',
            csfAmount: '',
            remarks: ''
        });

        setLoanOfficers([]);
        setGroups([]);
        setClients([]);
        setClientSearch('');
        setError('');

    }, [
        isOpen,
        today,
        isBranchManager,
        currentUser?.designatedBranchId,
        selectedBranch
    ]);

    // =====================================================
    // FETCH LOAN OFFICERS
    // =====================================================

    useEffect(() => {
        if (!isOpen || !form.branchId) return;

        let cancelled = false;

        const fetchLoanOfficers = async () => {
            setLoadingLo(true);

            try {
                const params = new URLSearchParams({
                    branchId: form.branchId
                });

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}users/list?${params}`
                );

                if (cancelled) return;

                if (!response.success) {
                    throw new Error(
                        'Unable to load Loan Officers.'
                    );
                }

                setLoanOfficers(
                    (response.users || []).filter(
                        user => Number(user.role?.rep) === 4
                    )
                );

            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message || 'Failed to load Loan Officers.'
                    );
                }
            } finally {
                if (!cancelled) setLoadingLo(false);
            }
        };

        fetchLoanOfficers();

        return () => {
            cancelled = true;
        };

    }, [isOpen, form.branchId]);

    // =====================================================
    // FETCH GROUPS
    // =====================================================

    useEffect(() => {
        if (
            !isOpen ||
            !form.branchId ||
            !form.loId
        ) return;

        let cancelled = false;

        const fetchGroups = async () => {
            setLoadingGroups(true);

            try {
                const params = new URLSearchParams({
                    branchId: form.branchId,
                    loId: form.loId
                });

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}groups/list?${params}`
                );

                if (cancelled) return;

                const rows =
                    response.groups ||
                    response.data;

                if (!Array.isArray(rows)) {
                    throw new Error(
                        'Unable to load groups.'
                    );
                }

                setGroups(rows);

            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message || 'Failed to load groups.'
                    );
                }
            } finally {
                if (!cancelled) setLoadingGroups(false);
            }
        };

        fetchGroups();

        return () => {
            cancelled = true;
        };

    }, [
        isOpen,
        form.branchId,
        form.loId
    ]);

    // =====================================================
    // FETCH CLIENTS
    // =====================================================

    useEffect(() => {
        if (
            !isOpen ||
            !form.branchId ||
            !form.loId ||
            !form.groupId
        ) return;

        let cancelled = false;

        const fetchClients = async () => {
            setLoadingClients(true);

            try {
                const params = new URLSearchParams({
                    branchId: form.branchId,
                    loId: form.loId,
                    groupId: form.groupId
                });

                const response = await fetchWrapper.get(
                    `${getApiBaseUrl()}clients/list?${params}`
                );

                if (cancelled) return;

                const rows =
                    response.clients ||
                    response.data;

                if (!Array.isArray(rows)) {
                    throw new Error(
                        'Unable to load clients.'
                    );
                }

                setClients(rows);

            } catch (err) {
                if (!cancelled) {
                    setError(
                        err.message || 'Failed to load clients.'
                    );
                }
            } finally {
                if (!cancelled) setLoadingClients(false);
            }
        };

        fetchClients();

        return () => {
            cancelled = true;
        };

    }, [
        isOpen,
        form.branchId,
        form.loId,
        form.groupId
    ]);

    // =====================================================
    // FORM HANDLERS
    // =====================================================

    const updateField = (field, value) => {
        setError('');

        if (field === 'branchId') {
            setLoanOfficers([]);
            setGroups([]);
            setClients([]);
            setClientSearch('');

            setForm(prev => ({
                ...prev,
                branchId: value,
                loId: '',
                groupId: '',
                clientId: ''
            }));

            return;
        }

        if (field === 'loId') {
            setGroups([]);
            setClients([]);
            setClientSearch('');

            setForm(prev => ({
                ...prev,
                loId: value,
                groupId: '',
                clientId: ''
            }));

            return;
        }

        if (field === 'groupId') {
            setClients([]);
            setClientSearch('');

            setForm(prev => ({
                ...prev,
                groupId: value,
                clientId: ''
            }));

            return;
        }

        setForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // =====================================================
    // CLIENT DETAILS
    // =====================================================

    const getClientName = (client) =>
        client?.fullName ||
        [
            client?.firstName,
            client?.middleName,
            client?.lastName
        ].filter(Boolean).join(' ');

    const selectedClient = clients.find(
        client => client._id === form.clientId
    );

    const filteredClients = clients.filter(client => {
        const search = clientSearch.trim().toLowerCase();

        return (
            client._id === form.clientId ||
            getClientName(client).toLowerCase().includes(search) ||
            String(client.slotNo ?? '').includes(search)
        );
    });

    // =====================================================
    // AUTOMATIC TOTAL
    // =====================================================

    const mcbuAmount = Number(form.mcbuAmount || 0);
    const csfAmount = Number(form.csfAmount || 0);

    const totalAmount =
        Math.round((mcbuAmount + csfAmount) * 100) / 100;

    // =====================================================
    // SAVE MANUAL UNCLAIMED TRANSACTION
    // =====================================================

    const handleSave = async (event) => {
        event.preventDefault();

        if (saving) return;

        setError('');

        if (
            !form.entryDate ||
            !form.branchId ||
            !form.loId ||
            !form.groupId ||
            !form.clientId
        ) {
            setError('Please complete all required fields.');
            return;
        }

        if (
            !moment(form.entryDate, 'YYYY-MM-DD', true).isValid() ||
            form.entryDate > today
        ) {
            setError('Please select a valid entry date.');
            return;
        }

        const validAmount = value =>
            /^\d{1,12}(\.\d{1,2})?$/.test(
                String(value || '0')
            );

        if (
            !validAmount(form.mcbuAmount) ||
            !validAmount(form.csfAmount) ||
            !Number.isFinite(totalAmount) ||
            totalAmount <= 0
        ) {
            setError(
                'Enter valid non-negative amounts with a total greater than zero.'
            );
            return;
        }

        setSaving(true);

        try {
            const response = await fetchWrapper.post(
                `${getApiBaseUrl()}transactions/unclaimed-transactions/create`,
                {
                    branchId: form.branchId,
                    loId: form.loId,
                    groupId: form.groupId,
                    clientId: form.clientId,
                    entryDate: form.entryDate,
                    mcbuAmount,
                    csfAmount,
                    remarks: form.remarks.trim()
                }
            );

            if (!response.success) {
                throw new Error(
                    response.message ||
                    'Failed to register MCBU / CSF In.'
                );
            }

            toast.success(
                'MCBU / CSF In registered successfully!'
            );

            onClose?.();

            await onSuccess?.(response.data);

        } catch (err) {
            setError(
                err.message ||
                'Failed to register MCBU / CSF In.'
            );
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    // =====================================================
    // MODAL UI
    // =====================================================

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">

            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="mcbu-csf-modal-title"
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col"
            >

                {/* HEADER */}

                <div className="flex items-center justify-between px-6 py-4 border-b">

                    <div>
                        <h2
                            id="mcbu-csf-modal-title"
                            className="text-lg font-semibold text-gray-900"
                        >
                            MCBU / CSF In
                        </h2>

                        <p className="text-xs text-gray-500 mt-1">
                            Register manual unclaimed MCBU and CSF amounts.
                        </p>
                    </div>

                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-5 h-5" />
                    </button>

                </div>

                <form
                    onSubmit={handleSave}
                    className="flex flex-col min-h-0"
                >

                    {/* BODY */}

                    <div className="p-6 overflow-y-auto space-y-4">

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                                {error}
                            </div>
                        )}

                        <fieldset
                            disabled={saving}
                            className="space-y-4"
                        >

                            {/* DATE AND BRANCH */}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                <div>
                                    <label className={labelClass}>
                                        Date *
                                    </label>

                                    <input
                                        type="date"
                                        required
                                        max={today}
                                        value={form.entryDate}
                                        onChange={e =>
                                            updateField(
                                                'entryDate',
                                                e.target.value
                                            )
                                        }
                                        className={inputClass}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Branch *
                                    </label>

                                    {isBranchManager ? (
                                        <input
                                            type="text"
                                            readOnly
                                            value={
                                                currentUser?.branchName ||
                                                'Assigned Branch'
                                            }
                                            className={`${inputClass} bg-gray-100`}
                                        />
                                    ) : (
                                        <select
                                            required
                                            value={form.branchId}
                                            onChange={e =>
                                                updateField(
                                                    'branchId',
                                                    e.target.value
                                                )
                                            }
                                            className={inputClass}
                                        >
                                            <option value="">
                                                Select Branch
                                            </option>

                                            {branchList.map(branch => (
                                                <option
                                                    key={branch._id}
                                                    value={branch._id}
                                                >
                                                    {branch.code} - {branch.name}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                            </div>

                            {/* LOAN OFFICER AND GROUP */}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                <div>
                                    <label className={labelClass}>
                                        Loan Officer *
                                    </label>

                                    <select
                                        required
                                        disabled={
                                            !form.branchId ||
                                            loadingLo
                                        }
                                        value={form.loId}
                                        onChange={e =>
                                            updateField(
                                                'loId',
                                                e.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">
                                            {loadingLo
                                                ? 'Loading...'
                                                : 'Select Loan Officer'}
                                        </option>

                                        {loanOfficers.map(lo => (
                                            <option
                                                key={lo._id}
                                                value={lo._id}
                                            >
                                                {lo.firstName} {lo.lastName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        Group *
                                    </label>

                                    <select
                                        required
                                        disabled={
                                            !form.loId ||
                                            loadingGroups
                                        }
                                        value={form.groupId}
                                        onChange={e =>
                                            updateField(
                                                'groupId',
                                                e.target.value
                                            )
                                        }
                                        className={inputClass}
                                    >
                                        <option value="">
                                            {loadingGroups
                                                ? 'Loading...'
                                                : 'Select Group'}
                                        </option>

                                        {groups.map(group => (
                                            <option
                                                key={group._id}
                                                value={group._id}
                                            >
                                                {group.name || group.groupName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                            </div>

                            {/* CLIENT SEARCH */}

                            <div>
                                <label className={labelClass}>
                                    Client *
                                </label>

                                <input
                                    type="text"
                                    placeholder="Search client name or slot number..."
                                    disabled={!form.groupId}
                                    value={clientSearch}
                                    onChange={e =>
                                        setClientSearch(e.target.value)
                                    }
                                    className={`${inputClass} mb-2`}
                                />

                                <select
                                    required
                                    disabled={
                                        !form.groupId ||
                                        loadingClients
                                    }
                                    value={form.clientId}
                                    onChange={e =>
                                        updateField(
                                            'clientId',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                >
                                    <option value="">
                                        {loadingClients
                                            ? 'Loading clients...'
                                            : 'Select Client'}
                                    </option>

                                    {filteredClients.map(client => (
                                        <option
                                            key={client._id}
                                            value={client._id}
                                        >
                                            {getClientName(client)}
                                            {client.slotNo != null
                                                ? ` - Slot ${client.slotNo}`
                                                : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* SLOT NUMBER */}

                            <div>
                                <label className={labelClass}>
                                    Slot Number
                                </label>

                                <input
                                    type="text"
                                    readOnly
                                    value={
                                        selectedClient?.slotNo ??
                                        selectedClient?.slotNumber ??
                                        ''
                                    }
                                    placeholder="Automatically assigned"
                                    className={`${inputClass} bg-gray-100`}
                                />
                            </div>

                            {/* AMOUNTS */}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                                <div>
                                    <label className={labelClass}>
                                        MCBU Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={form.mcbuAmount}
                                        onChange={e =>
                                            updateField(
                                                'mcbuAmount',
                                                e.target.value
                                            )
                                        }
                                        className={`${inputClass} text-right`}
                                    />
                                </div>

                                <div>
                                    <label className={labelClass}>
                                        CSF Amount
                                    </label>

                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={form.csfAmount}
                                        onChange={e =>
                                            updateField(
                                                'csfAmount',
                                                e.target.value
                                            )
                                        }
                                        className={`${inputClass} text-right`}
                                    />
                                </div>
                            </div>

                            {/* TOTAL AMOUNT */}

                            <div className="flex items-center justify-between p-4 bg-teal-50 border border-teal-200 rounded-md">

                                <span className="text-sm font-semibold text-teal-800">
                                    Total Unclaimed Amount
                                </span>

                                <span className="text-xl font-bold text-teal-700">
                                    ₱{formatMoney(totalAmount)}
                                </span>
                            </div>

                            {/* REMARKS */}

                            <div>
                                <label className={labelClass}>
                                    Remarks
                                </label>

                                <textarea
                                    rows={3}
                                    placeholder="Enter additional information..."
                                    value={form.remarks}
                                    onChange={e =>
                                        updateField(
                                            'remarks',
                                            e.target.value
                                        )
                                    }
                                    className={inputClass}
                                />
                            </div>
                        </fieldset>
                    </div>

                    {/* FOOTER */}

                    <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50">

                        <button
                            type="button"
                            disabled={saving}
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-100"
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            disabled={
                                saving ||
                                loadingLo ||
                                loadingGroups ||
                                loadingClients ||
                                !form.clientId ||
                                totalAmount <= 0
                            }
                            className="px-4 py-2 bg-teal-600 text-white rounded-md text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Save className="w-4 h-4" />

                            {saving
                                ? 'Saving...'
                                : 'Save MCBU / CSF In'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}