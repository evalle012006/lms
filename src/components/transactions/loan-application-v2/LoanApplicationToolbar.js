// src/components/transactions/loan-application-v2/LoanApplicationToolbar.js
// Compact filters for the v2 Loan Application page.
//
//   Always visible : client name, CI reference, branch
//                    Both text fields also take a QR scan: a camera button in each
//                    field, and a hardware scanner "typing" into it. Either field
//                    accepts either kind of code: a CI QR fills the CI reference, a
//                    client QR filters to that client (shown as a chip).
//   Appear inline  : loan officer + group, once a branch is chosen (they are
//                    meaningless before that — the LO list is fetched by branch
//                    code and groups by branch id, same as the classic page)
//   Quick row      : "Co-maker pending (n)" toggle — always visible, because the
//                    count is the point. n follows the active tab and the other
//                    filters.
//   "Filters" panel: loan cycle, occurrence, LO type (collapsed by default;
//                    active ones stay visible as chips so a hidden filter can
//                    never silently narrow the list)
//
// NOTE: this repo's tailwind.config.js overrides `theme.screens` with ONLY
// `lg`, so sm:/md:/xl: classes do not exist. Responsiveness here comes from
// flex-wrap + flex-basis and an auto-fit grid (inline styles), not breakpoints.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, FileText, QrCode, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { UppercaseFirstLetter } from '@/lib/utils';
import { looksLikeUrl, parseScannedCode } from '@/lib/qr-scan';
import QrScanDialog from '@/components/transactions/loan-application-v2/QrScanDialog';

const BASE =
    'w-full rounded-lg border border-gray-200 bg-white py-2 text-sm text-gray-900 ' +
    'placeholder:text-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 ' +
    'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';
// @tailwindcss/forms draws the <select> chevron in the right padding; an
// explicit pr-10 keeps text clear of it (a bare px-3 would overlap it).
// text inputs with a left icon and, on the right, room for the scan button
const INPUT_SCAN = `${BASE} pl-9 pr-10`;

// Everything typed into the two text fields waits for this long without a keystroke
// before it is acted on. That is the search debounce for people, and it is what keeps
// a hardware scanner's burst of characters ("h", "ht", "htt" ...) from ever being
// searched as if someone had typed it: the scan is read once, after the last one.
const TYPING_IDLE_MS = 250;
const SELECT = `${BASE} pl-3 pr-10 cursor-pointer`;

const CYCLE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'new_member', label: 'New member' },
    { value: 'reloaner', label: 'Reloaner' },
];
const OCCURENCE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly_standard', label: 'Weekly - standard' },
    { value: 'weekly_accelerated', label: 'Weekly - accelerated' },
];
const LO_TYPE_OPTIONS = [
    { value: 'all', label: 'All' },
    { value: 'main', label: 'Main (LO 1-10)' },
    { value: 'ext', label: 'Extension (LO 11+)' },
];

const labelOf = (options, value) => options.find((o) => o.value === value)?.label ?? value;

function Select({ label, value, onChange, options, placeholder, disabled, flex }) {
    return (
        <select
            aria-label={label}
            className={SELECT}
            style={flex ? { flex } : undefined}
            value={value ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value || null)}
        >
            {placeholder !== undefined && <option value="">{placeholder}</option>}
            {options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

function PanelField({ label, children }) {
    return (
        <label className="block min-w-0">
            <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
            {children}
        </label>
    );
}

export default function LoanApplicationToolbar({
    filters, updateFilters, resetFilters, allowedBranches, coMakerPendingCount,
    lockedLoId = null, // loan officers: the server pins them to their own loans and occurrence
}) {
    const [rootBranches, setRootBranches] = useState([]);
    const [loOptions, setLoOptions] = useState([]);
    const [groupOptions, setGroupOptions] = useState([]);
    const [searchInput, setSearchInput] = useState(filters.search);
    const [ciInput, setCiInput] = useState(filters.ciReference);
    const [panelOpen, setPanelOpen] = useState(false);
    const [scanField, setScanField] = useState(null); // 'name' | 'ci' | null (camera dialog)
    const scanTimerRef = useRef(null);

    // allowedBranches === null      -> root / admin: every branch, fetch the list
    // allowedBranches === array     -> supervisors: server already scoped it
    // allowedBranches === undefined -> first response not back yet
    useEffect(() => {
        if (allowedBranches !== null) return;
        let cancelled = false;
        fetchWrapper.get(`${getApiBaseUrl()}branches/list`).then((res) => {
            if (!cancelled && res.success) setRootBranches(res.branches ?? []);
        });
        return () => { cancelled = true; };
    }, [allowedBranches]);

    const branchSource = useMemo(
        () => (allowedBranches === null ? rootBranches : (allowedBranches ?? [])),
        [allowedBranches, rootBranches]
    );
    const branchOptions = useMemo(
        () => branchSource.map((b) => ({
            value: b._id,
            label: `${b.code ? `${b.code} - ` : ''}${UppercaseFirstLetter(b.name)}`,
        })),
        [branchSource]
    );

    // A single-branch scope behaves as if that branch were already selected.
    const effectiveBranchId = filters.branchId || (branchSource.length === 1 ? branchSource[0]._id : null);
    const effectiveBranch = branchSource.find((b) => b._id === effectiveBranchId);

    const fetchLos = useCallback(async (branch) => {
        if (lockedLoId) return; // a loan officer only ever sees their own loans
        if (!branch?.code) { setLoOptions([]); return; }
        const res = await fetchWrapper.get(
            `${getApiBaseUrl()}users/list?${new URLSearchParams({ branchCode: branch.code })}`
        );
        if (res.success) {
            setLoOptions(
                (res.users || [])
                    .filter((u) => u.role?.rep === 4)
                    .map((u) => ({ value: u._id, label: UppercaseFirstLetter(`${u.firstName} ${u.lastName}`) }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            );
        }
    }, [lockedLoId]);

    const fetchGroups = useCallback(async (branchId, loId) => {
        if (!branchId) { setGroupOptions([]); return; }
        const params = new URLSearchParams({ branchId });
        if (loId) params.set('loId', loId);
        const res = await fetchWrapper.get(`${getApiBaseUrl()}groups/list?${params}`);
        if (res.success) {
            setGroupOptions(
                (res.groups || [])
                    .map((g) => ({ value: g._id, label: UppercaseFirstLetter(g.name) }))
                    .sort((a, b) => a.label.localeCompare(b.label))
            );
        }
    }, []);

    useEffect(() => { fetchLos(effectiveBranch); }, [effectiveBranch, fetchLos]);
    useEffect(() => {
        fetchGroups(effectiveBranchId, lockedLoId || filters.loId);
    }, [effectiveBranchId, filters.loId, lockedLoId, fetchGroups]);

    useEffect(() => () => clearTimeout(scanTimerRef.current), []);

    // ── QR scans ─────────────────────────────────────────────────────────
    const setFieldText = (field, value) => (field === 'ci' ? setCiInput(value) : setSearchInput(value));

    // `raw` is whatever the scan produced; `field` is where it landed (it may be a
    // URL a hardware scanner typed into that field, which then has to be cleared).
    const applyScan = useCallback(async (raw, field) => {
        const parsed = parseScannedCode(raw);

        if (parsed.type === 'ci') {
            setCiInput(parsed.value);
            if (field === 'name') setSearchInput('');
            updateFilters({ ciReference: parsed.value, ...(field === 'name' ? { search: '' } : {}) });
            return;
        }

        if (parsed.type === 'client') {
            try {
                const res = await fetchWrapper.post(
                    `${getApiBaseUrl()}transactions/loans/resolve-client-qr`,
                    { token: parsed.value }
                );
                if (res.success) {
                    setSearchInput('');
                    if (field === 'ci') setCiInput('');
                    updateFilters({
                        clientId: res.client._id,
                        clientLabel: res.client.fullName,
                        search: '',
                        ...(field === 'ci' ? { ciReference: '' } : {}),
                    });
                    return;
                }
                toast.error(res.message || 'This QR code could not be read.');
            } catch (e) {
                console.error('[LoanApplicationToolbar] client QR failed', e);
                toast.error('This QR code could not be read.');
            }
            setFieldText(field, ''); // do not leave the typed URL in the field
            return;
        }

        // not one of our QR codes: plain text for whichever field it was typed in
        setFieldText(field, parsed.value);
        updateFilters(field === 'ci' ? { ciReference: parsed.value } : { search: parsed.value });
    }, [updateFilters]);

    // One idle timer per component: a new keystroke restarts it, whichever field it
    // is in. When it fires, the settled text is either a QR scan or ordinary text.
    const handleFieldChange = (field) => (e) => {
        const value = e.target.value;
        setFieldText(field, value);
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = setTimeout(() => applyScan(value, field), TYPING_IDLE_MS);
    };

    // Scanners usually end with Enter; pasting a copied QR link works too.
    const handleFieldKeyDown = (field) => (e) => {
        if (e.key !== 'Enter') return;
        const value = e.currentTarget.value;
        if (parseScannedCode(value).type !== 'unknown' || looksLikeUrl(value)) {
            e.preventDefault();
            clearTimeout(scanTimerRef.current);
            applyScan(value, field);
        }
    };

    const handleFieldPaste = (field) => (e) => {
        const text = e.clipboardData?.getData('text') ?? '';
        if (parseScannedCode(text).type !== 'unknown') {
            e.preventDefault();
            clearTimeout(scanTimerRef.current);
            applyScan(text, field);
        }
    };

    const scanButton = (field) => (
        <button
            type="button"
            onClick={() => setScanField(field)}
            aria-label="Scan a QR code"
            title="Scan a client or CI QR code"
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-gray-400 hover:text-teal-600 hover:bg-teal-50"
        >
            <QrCode className="w-4 h-4" />
        </button>
    );

    // Secondary filters live in the collapsible panel; each active one is
    // mirrored as a removable chip while the panel is closed.
    const chips = [];
    if (filters.loanCycle !== 'all') {
        chips.push({ key: 'loanCycle', text: labelOf(CYCLE_OPTIONS, filters.loanCycle), clear: { loanCycle: 'all' } });
    }
    if (filters.occurence !== 'all') {
        chips.push({ key: 'occurence', text: labelOf(OCCURENCE_OPTIONS, filters.occurence), clear: { occurence: 'all' } });
    }
    if (filters.loType !== 'all') {
        chips.push({ key: 'loType', text: labelOf(LO_TYPE_OPTIONS, filters.loType), clear: { loType: 'all' } });
    }

    const anyActive =
        chips.length > 0 || filters.coMakerPending || !!filters.branchId || !!filters.loId || !!filters.groupId ||
        !!filters.search.trim() || !!filters.ciReference.trim() || !!filters.clientId;

    const handleClear = () => {
        clearTimeout(scanTimerRef.current);
        setSearchInput('');
        setCiInput('');
        resetFilters();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative" style={{ flex: '2 1 220px' }}>
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        aria-label="Client name"
                        className={INPUT_SCAN}
                        placeholder="Search client name or scan QR"
                        value={searchInput}
                        onChange={handleFieldChange('name')}
                        onKeyDown={handleFieldKeyDown('name')}
                        onPaste={handleFieldPaste('name')}
                    />
                    {scanButton('name')}
                </div>

                <div className="relative" style={{ flex: '1 1 180px' }}>
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        aria-label="CI reference"
                        className={INPUT_SCAN}
                        placeholder="CI reference or scan QR"
                        value={ciInput}
                        onChange={handleFieldChange('ci')}
                        onKeyDown={handleFieldKeyDown('ci')}
                        onPaste={handleFieldPaste('ci')}
                    />
                    {scanButton('ci')}
                </div>

                {branchSource.length > 1 ? (
                    <Select
                        label="Branch"
                        flex="1 1 190px"
                        value={filters.branchId}
                        placeholder="All branches"
                        options={branchOptions}
                        onChange={(v) => updateFilters({ branchId: v, loId: null, groupId: null })}
                    />
                ) : (
                    <div
                        className={`${BASE} px-3 bg-gray-50 text-gray-500 truncate`}
                        style={{ flex: '1 1 190px' }}
                    >
                        {effectiveBranch
                            ? `${effectiveBranch.code} - ${UppercaseFirstLetter(effectiveBranch.name)}`
                            : 'All branches'}
                    </div>
                )}

                {effectiveBranchId && (
                    <>
                        {!lockedLoId && (
                            <Select
                                label="Loan officer"
                                flex="1 1 170px"
                                value={filters.loId}
                                placeholder="All loan officers"
                                options={loOptions}
                                onChange={(v) => updateFilters({ loId: v, groupId: null })}
                            />
                        )}
                        <Select
                            label="Group"
                            flex="1 1 160px"
                            value={filters.groupId}
                            placeholder="All groups"
                            options={groupOptions}
                            onChange={(v) => updateFilters({ groupId: v })}
                        />
                    </>
                )}

                <button
                    type="button"
                    onClick={() => setPanelOpen((o) => !o)}
                    aria-expanded={panelOpen}
                    className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                        panelOpen || chips.length > 0
                            ? 'border-teal-600 text-teal-700 bg-teal-50'
                            : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
                    }`}
                >
                    <SlidersHorizontal className="w-4 h-4" />
                    Filters
                    {chips.length > 0 && (
                        <span className="px-1.5 rounded-full bg-teal-600 text-white text-xs font-semibold">
                            {chips.length}
                        </span>
                    )}
                </button>

                {anyActive && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 inline-flex items-center gap-1 px-2 py-2 text-sm font-medium text-gray-500 hover:text-gray-800"
                    >
                        <X className="w-4 h-4" />
                        Clear
                    </button>
                )}
            </div>

            {panelOpen && (
                <div
                    className="grid gap-3 mt-3 pt-3 border-t border-gray-100"
                    style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}
                >
                    <PanelField label="Loan cycle">
                        <Select
                            label="Loan cycle"
                            value={filters.loanCycle}
                            options={CYCLE_OPTIONS}
                            onChange={(v) => updateFilters({ loanCycle: v || 'all' })}
                        />
                    </PanelField>
                    {!lockedLoId && (
                        <PanelField label="Occurrence">
                            <Select
                                label="Occurrence"
                                value={filters.occurence}
                                options={OCCURENCE_OPTIONS}
                                onChange={(v) => updateFilters({ occurence: v || 'all' })}
                            />
                        </PanelField>
                    )}
                    <PanelField label="LO type">
                        <Select
                            label="LO type"
                            value={filters.loType}
                            options={LO_TYPE_OPTIONS}
                            onChange={(v) => updateFilters({ loType: v || 'all' })}
                        />
                    </PanelField>
                </div>
            )}

            <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {filters.clientId && (
                    <span className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-medium text-teal-800">
                        <QrCode className="w-3.5 h-3.5" />
                        Client: {filters.clientLabel || 'scanned QR'}
                        <button
                            type="button"
                            onClick={() => updateFilters({ clientId: null, clientLabel: null })}
                            aria-label="Remove the scanned client filter"
                            className="p-0.5 rounded-full hover:bg-teal-100"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                )}
                <button
                    type="button"
                    onClick={() => updateFilters({ coMakerPending: !filters.coMakerPending })}
                    aria-pressed={filters.coMakerPending}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                        filters.coMakerPending
                            ? 'bg-amber-50 border-amber-300 text-amber-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                >
                    Co-maker pending
                    {coMakerPendingCount !== null && coMakerPendingCount !== undefined && (
                        <span
                            className={`px-1.5 rounded-full text-xs font-semibold ${
                                coMakerPendingCount > 0 ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                        >
                            {coMakerPendingCount}
                        </span>
                    )}
                </button>

                {!panelOpen && chips.map((c) => (
                    <span
                        key={c.key}
                        className="inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full bg-gray-100 text-xs font-medium text-gray-700"
                    >
                        {c.text}
                        <button
                            type="button"
                            onClick={() => updateFilters(c.clear)}
                            aria-label={`Remove ${c.text} filter`}
                            className="p-0.5 rounded-full hover:bg-gray-200"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}
            </div>

            <QrScanDialog
                open={!!scanField}
                title={scanField === 'ci' ? 'Scan CI QR code' : 'Scan client QR code'}
                hint="Scan a client's collection QR or a CI reference QR. Either one works in either field."
                onClose={() => setScanField(null)}
                onScan={(text) => {
                    const field = scanField;
                    setScanField(null);
                    applyScan(text, field);
                }}
            />
        </div>
    );
}