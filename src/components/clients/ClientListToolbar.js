// src/components/clients/ClientListToolbar.js
// Branch / LO / Group cascading filters + debounced search, wired to useClientList.
// Cascading pattern (branch → LO → group) mirrors the existing convention in
// AddLoanPage.js / AddUpdateLoanDrawer.js.

import React, { useState, useEffect, useCallback } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { UppercaseFirstLetter } from '@/lib/utils';

const NativeSelect = ({ value, onChange, options, placeholder, disabled }) => (
    <div className="relative">
        <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            disabled={disabled}
            className="appearance-none [-webkit-appearance:none] [-moz-appearance:none] w-full bg-white
                       border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm
                       text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:bg-gray-50
                       disabled:text-gray-400"
        >
            <option value="">{placeholder}</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
    </div>
);

export default function ClientListToolbar({
    currentUser,
    filters,
    setFilter,
    setSearch,
    searchValue,
    resolvedBranchId,
    allowedBranches, // [{_id, name, code}] for scoped roles, or null for root (unrestricted)
}) {
    const [loOptions, setLoOptions]       = useState([]);
    const [groupOptions, setGroupOptions] = useState([]);
    const [localSearch, setLocalSearch]   = useState(searchValue || '');

    // FIX: root's allowedBranches is intentionally null (queries run
    // unscoped) — but that means the toolbar previously had nothing to
    // populate the branch selector with for root specifically. Root needs
    // its own fetch of the full branch list; scoped roles (rep 2/3/4)
    // continue to use allowedBranches exactly as returned by the API.
    const [rootBranches, setRootBranches] = useState([]);

    useEffect(() => {
        if (allowedBranches === null) {
            fetchWrapper.get(`${getApiBaseUrl()}branches/list`).then(res => {
                if (res.success) setRootBranches(res.branches ?? []);
            });
        }
    }, [allowedBranches]);

    const rep = currentUser?.role?.rep;

    const branchSource = allowedBranches ?? rootBranches;
    const branchOptions = branchSource.map(b => ({
        value: b._id,
        label: `${b.code ? b.code + ' - ' : ''}${UppercaseFirstLetter(b.name)}`,
    }));
    // Selector shows whenever there's more than one branch to choose from —
    // covers both root (rootBranches) and multi-branch supervisor roles
    // (allowedBranches.length > 1).
    const showBranchSelector = branchSource.length > 1;
    const activeBranch = branchSource.find(b => b._id === resolvedBranchId);

    // LO selector hidden entirely for rep=4 (forced to self server-side anyway).
    const showLoSelector = rep !== 4;

    const fetchLos = useCallback(async (branchId) => {
        if (!branchId) { setLoOptions([]); return; }
        const branch = branchSource.find(b => b._id === branchId);
        if (!branch?.code) { setLoOptions([]); return; }

        const res = await fetchWrapper.get(
            `${getApiBaseUrl()}users/list?${new URLSearchParams({ branchCode: branch.code })}`
        );
        if (res.success) {
            const los = (res.users || [])
                .filter(u => u.role?.rep === 4)
                .map(u => ({ value: u._id, label: UppercaseFirstLetter(`${u.firstName} ${u.lastName}`) }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setLoOptions(los);
        }
    }, [branchSource]);

    const fetchGroups = useCallback(async (branchId, loId) => {
        if (!branchId) { setGroupOptions([]); return; }
        const params = new URLSearchParams({ branchId });
        if (loId) params.set('loId', loId);

        const res = await fetchWrapper.get(`${getApiBaseUrl()}groups/list?${params}`);
        if (res.success) {
            const groups = (res.groups || [])
                .map(g => ({ value: g._id, label: UppercaseFirstLetter(g.name) }))
                .sort((a, b) => a.label.localeCompare(b.label));
            setGroupOptions(groups);
        }
    }, []);

    useEffect(() => {
        if (showLoSelector) fetchLos(resolvedBranchId);
    }, [resolvedBranchId, showLoSelector, fetchLos]);

    useEffect(() => {
        fetchGroups(resolvedBranchId, filters.loId);
    }, [resolvedBranchId, filters.loId, fetchGroups]);

    const handleBranchChange = (branchId) => {
        setFilter('branchId', branchId);
        setFilter('loId', null);
        setFilter('groupId', null);
    };

    const handleLoChange = (loId) => {
        setFilter('loId', loId);
        setFilter('groupId', null);
    };

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setLocalSearch(val);
        setSearch(val);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm p-3 mb-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                    type="text"
                    value={localSearch}
                    onChange={handleSearchChange}
                    placeholder="Search by name..."
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm
                               focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
            </div>

            <div className="flex gap-2 sm:w-auto">
                {showBranchSelector ? (
                    <div className="w-40">
                        <NativeSelect
                            value={resolvedBranchId}
                            onChange={handleBranchChange}
                            options={branchOptions}
                            placeholder="All Branches"
                        />
                    </div>
                ) : activeBranch ? (
                    <div className="w-40 flex items-center px-3 py-2 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-100">
                        {activeBranch.code} - {UppercaseFirstLetter(activeBranch.name)}
                    </div>
                ) : null}

                {showLoSelector && (
                    <div className="w-40">
                        <NativeSelect
                            value={filters.loId}
                            onChange={handleLoChange}
                            options={loOptions}
                            placeholder="All LOs"
                            disabled={!resolvedBranchId}
                        />
                    </div>
                )}

                <div className="w-40">
                    <NativeSelect
                        value={filters.groupId}
                        onChange={(v) => setFilter('groupId', v)}
                        options={groupOptions}
                        placeholder="All Groups"
                        disabled={!resolvedBranchId}
                    />
                </div>
            </div>
        </div>
    );
}