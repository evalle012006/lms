// src/components/settings/duplicate-clients/CompareProfilesModal.js
// Side-by-side profile comparison of the records in one duplicate group. Rows whose values differ are highlighted;
// "Only differences" hides the rows that are identical. Data: GET clients/duplicates/compare (already scope-limited).

import React, { useEffect, useMemo, useState } from 'react';
import moment from 'moment';
import { ExternalLink } from 'lucide-react';
import PrivateImage from '@/components/common/PrivateImage';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';

const date = (v) => (v ? moment(v).format('MMM DD, YYYY') : null);
const money = (v) => (v == null ? null : `₱${Number(v).toLocaleString()}`);
const name = (p) => [p.lastName, p.firstName, p.middleName].filter(Boolean).join(', ') || null;

// [label, getter -> display string|null, how to normalise for comparison]
const SECTIONS = [
    ['Identity', [
        ['Last name', p => p.lastName],
        ['First name', p => p.firstName],
        ['Middle name', p => p.middleName],
        ['Birthdate', p => date(p.birthdate), 'date'],
        ['Contact no.', p => p.contactNumber, 'digits'],
        ['Civil status', p => p.civilStatus],
        ['Business', p => p.business],
    ]],
    ['Address', [
        ['Street', p => p.addressStreet],
        ['Barangay / District', p => p.addressBarangay],
        ['City / Municipality', p => p.addressCity],
        ['Province', p => p.addressProvince],
        ['ZIP', p => p.addressZip],
        ['Full address', p => p.address],
        ['Landmark', p => p.landmark],
        ['Years of stay', p => p.yearsOfStay],
    ]],
    ['Government ID', [
        ['ID type', p => p.governmentIdType],
        ['ID number', p => p.governmentIdNumber],
    ]],
    ['Account', [
        ['Status', p => p.status],
        ['Loans', p => p.activeLoan
            ? `Active C${p.activeLoan.loanCycle ?? '?'}${p.activeLoan.loanBalance != null ? ` · ${money(p.activeLoan.loanBalance)} balance` : ''}`
            : `${p.loanCount ?? 0} loan(s), none active`, 'none'],
        ['Branch', p => p.branch],
        ['Loan officer', p => p.loanOfficer],
        ['Group', p => p.group],
        ['Delinquent', p => (p.delinquent ? 'Yes' : 'No'), 'none'],
        ['Date added', p => date(p.dateAdded), 'none'],
        ['Added by', p => p.addedBy, 'none'],
        ['CI', p => p.ciName, 'none'],
    ]],
];

const norm = (value, mode) => {
    if (value == null || value === '') return '';
    const s = String(value).trim().toLowerCase();
    return mode === 'digits' ? s.replace(/\D/g, '').slice(-10) : s;
};

// Fields that are expected to differ between records of one person never count as "different".
const differs = (people, getter, mode) => mode !== 'none' && new Set(people.map(p => norm(getter(p), mode))).size > 1;

const CompareProfilesModal = ({ clusterId, onClose, onOpenProfile, profileLoading }) => {
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [onlyDiff, setOnlyDiff] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetchWrapper.get(getApiBaseUrl() + 'clients/duplicates/compare?clusterId=' + encodeURIComponent(clusterId));
                if (cancelled) return;
                if (res?.success) setData(res); else setError(res?.message || 'Could not load the profiles.');
            } catch (e) {
                if (!cancelled) setError(e.message || 'Could not load the profiles.');
            }
        })();
        return () => { cancelled = true; };
    }, [clusterId]);

    const people = data?.people ?? [];
    const sections = useMemo(() => SECTIONS.map(([title, rows]) => [title, rows.map(([label, get, mode]) => ({
        label, get, diff: people.length > 1 && differs(people, get, mode),
    }))]), [people]);

    return (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                    <h2 className="text-lg font-bold text-gray-900">Compare profiles</h2>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 text-sm text-gray-600">
                            <input type="checkbox" checked={onlyDiff} onChange={(e) => setOnlyDiff(e.target.checked)} /> Only differences
                        </label>
                        <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-800">Close</button>
                    </div>
                </div>

                <div className="overflow-auto p-5">
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    {!error && !data && <p className="text-sm text-gray-400">Loading…</p>}
                    {data && (
                        <>
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr>
                                        <th className="w-40" />
                                        {people.map(p => (
                                            <th key={p._id} className="px-3 py-2 align-top text-left min-w-[12rem]">
                                                <div className="w-24 h-24 rounded-lg overflow-hidden bg-gray-100 border border-gray-200 mb-2">
                                                    <PrivateImage src={p.profile} alt={name(p) ?? 'Client'} width={96} height={96} className="w-24 h-24 object-cover" />
                                                </div>
                                                <p className="font-semibold text-gray-900">{name(p) ?? '—'}</p>
                                                <p className="text-xs text-gray-400 font-normal break-all">{p._id}</p>
                                                {p.inScope === false ? (
                                                    <span className="inline-block mt-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-200 text-gray-600"
                                                        title="This record belongs to a branch outside your scope">Other branch</span>
                                                ) : (
                                                    <button type="button" onClick={() => onOpenProfile?.(p._id)} disabled={!!profileLoading}
                                                        className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 mt-1 disabled:opacity-50">
                                                        {profileLoading === p._id ? 'Opening…' : 'View profile'} <ExternalLink className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {sections.map(([title, rows]) => {
                                        const shown = rows.filter(r => !onlyDiff || r.diff);
                                        if (!shown.length) return null;
                                        return (
                                            <React.Fragment key={title}>
                                                <tr><td colSpan={people.length + 1} className="pt-4 pb-1 text-xs font-semibold text-gray-500 uppercase">{title}</td></tr>
                                                {shown.map(r => (
                                                    <tr key={r.label} className="border-t border-gray-100">
                                                        <td className="py-1.5 pr-3 text-gray-500 whitespace-nowrap">{r.label}</td>
                                                        {people.map(p => (
                                                            <td key={p._id} className={`px-3 py-1.5 ${r.diff ? 'bg-amber-50 text-amber-900 font-medium' : ''}`}>
                                                                {r.get(p) ?? <span className="text-gray-300">—</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {onlyDiff && sections.every(([, rows]) => rows.every(r => !r.diff)) && (
                                <p className="text-sm text-gray-500 mt-4">No differences in the compared fields.</p>
                            )}
                            {people.some(p => p.inScope === false) && (
                                <p className="text-xs text-gray-500 mt-4">
                                    Records marked “Other branch” are outside your branches: their details are shown for comparison, but their full profile is not available to you.
                                </p>
                            )}
                            <p className="text-xs text-gray-400 mt-2">
                                Highlighted rows differ between the records. Loan, branch, LO, group and date fields are expected to differ, so they are never highlighted.
                                Government ID numbers are masked. Biometric data is never shown.
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CompareProfilesModal;
