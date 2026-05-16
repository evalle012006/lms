import React, { useEffect, useState, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import Spinner from '@/components/Spinner';
import moment from 'moment';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { useSignedUrl } from 'hooks/useSignedUrl';
import placeholder from '/public/images/image-placeholder.png';
import TempLAFModal from '@/components/laf/TempLAFModal';
import { Printer } from 'lucide-react';

// ── Status badge ──────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        pending:     { label: 'Pending CI',  cls: 'bg-amber-100 text-amber-700' },
        ci_approved: { label: 'CI Approved', cls: 'bg-green-100 text-green-700' },
        ci_declined: { label: 'CI Declined', cls: 'bg-red-100 text-red-700' },
        promoted:    { label: 'Promoted',    cls: 'bg-blue-100 text-blue-700' },
        expired:     { label: 'Expired',     cls: 'bg-gray-100 text-gray-500' },
    };
    const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-500' };
    return (
        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
            {s.label}
        </span>
    );
};

// ── LAF photo in the table row — uses bulk signed URLs ────────────────────
const RowPhoto = ({ urlMap, photoKey }) => {
    const resolvedUrl = photoKey ? urlMap[photoKey] : null;
    return resolvedUrl ? (
        <img
            src={resolvedUrl}
            alt="LAF photo"
            className="w-9 h-9 rounded-full object-cover border border-gray-200 flex-shrink-0"
            onError={e => { e.target.src = placeholder.src || '/images/image-placeholder.png'; }}
        />
    ) : (
        <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200
            flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
        </div>
    );
};

// ── LAF photo in the detail modal — uses useSignedUrl (single key) ────────
const ModalPhoto = ({ photoKey }) => {
    const { signedUrl, loading } = useSignedUrl(photoKey);

    if (!photoKey) return null;

    return (
        <div className="px-6 pt-4 pb-2 flex-shrink-0 flex flex-col items-center">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Client Photo (LAF)
            </p>
            {loading ? (
                <div className="w-36 h-36 rounded-xl bg-gray-100 border border-gray-200
                    flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 text-gray-400" fill="none"
                        viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                            stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                </div>
            ) : signedUrl ? (
                <img
                    src={signedUrl}
                    alt="Client LAF photo"
                    className="w-36 h-36 object-cover rounded-xl border border-gray-200 shadow-sm"
                    onError={e => { e.target.style.display = 'none'; }}
                />
            ) : (
                <div className="w-36 h-36 rounded-xl bg-gray-100 border border-gray-200
                    flex items-center justify-center text-gray-400 text-xs">
                    No photo
                </div>
            )}
        </div>
    );
};

// ── Detail modal ──────────────────────────────────────────────────────────
const ApplicationDetailModal = ({ application, onClose, onPrintLAF }) => {
    if (!application) return null;

    const fields = [
        ['CI Reference Code',   application.ciReferenceCode],
        ['Branch',              `${application.branchCode} — ${application.branchName}`],
        ['Client Type',         application.clientType
            ? application.clientType.charAt(0).toUpperCase() + application.clientType.slice(1)
            : 'Prospect'],
        ['Full Name',           `${application.lastName}, ${application.firstName} ${application.middleName || ''}`],
        ['Birthdate',           application.birthdate],
        ['Contact',             application.contactNumber],
        ['Address',             application.address],
        application.landmark           && ['Landmark',          application.landmark],
        application.distanceFromBranch && ['Distance',          application.distanceFromBranch],
        ['Loan Amount',         application.loanAmount
            ? `₱${Number(application.loanAmount).toLocaleString()}` : '—'],
        ['Loan Purpose',        application.loanPurpose],
        ['Guarantor',           `${application.guarantorFirstName || ''} ${application.guarantorLastName || ''}`],
        ['Guarantor Contact',   application.guarantorContactNumber],
        ['Relationship',        application.guarantorRelationship],
        // ── Government ID ─────────────────────────────────────────────────
        application.governmentIdType   && ['ID Type',           application.governmentIdType],
        application.governmentIdNumber && ['ID Number',         application.governmentIdNumber],
        // ── Biometric ─────────────────────────────────────────────────────
        ['Biometric',           application.biometricCredentialId
            ? `Registered${application.biometricDeviceName ? ` · ${application.biometricDeviceName}` : ''}`
            : 'Not yet registered'],
        // ── Source info ───────────────────────────────────────────────────
        application.isOffline && ['Submission Mode',   'Offline (synced)'],
        ['Submitted',           moment(application.submittedAt).format('MMM DD, YYYY h:mm A')],
        ['Expires',             moment(application.expiresAt).format('MMM DD, YYYY')],
        ['Status',              <StatusBadge key="s" status={application.status} />],
    ].filter(Boolean); // remove null/false entries from optional rows

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center
                justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg
                max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4
                    border-b border-gray-100 flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">
                            Application Details
                        </h2>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">
                            {application.ciReferenceCode}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg text-gray-400
                            hover:text-gray-600 transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Photo */}
                <ModalPhoto photoKey={application.lafPhotoKey} />

                {/* Fields */}
                <div className="overflow-y-auto px-6 py-4 space-y-3">
                    {fields.map(([label, value]) => (
                        <div key={label} className="flex justify-between gap-4 text-sm
                            border-b border-gray-50 pb-2 last:border-0">
                            <span className="text-gray-500 flex-shrink-0 w-40">{label}</span>
                            <span className="text-gray-900 font-medium text-right">
                                {value || '—'}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 pt-3 border-t border-gray-100 flex-shrink-0 flex gap-3">
                    <button
                        onClick={() => {
                            onPrintLAF?.(application);
                            onClose();
                        }}
                        className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium
                            rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print / Download LAF
                    </button>
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 border border-gray-300 text-gray-700
                            text-sm font-medium rounded-lg hover:bg-gray-50"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────
const TemporaryLoanApplicationsTab = () => {
    const currentUser = useSelector(state => state.user.data);
    const [applications, setApplications] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [statusFilter, setStatusFilter] = useState('all');
    const [search, setSearch]             = useState('');
    const [selected, setSelected]         = useState(null);
    const [lafModalOpen, setLafModalOpen] = useState(false);
    const [lafModalApp, setLafModalApp]   = useState(null);

    // Bulk resolve all LAF photo keys in one API call
    const photoKeys = applications.map(a => a.lafPhotoKey).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    // ── Print LAF — use urlMap directly, no extra fetch needed ───────────
    const handlePrintLAF = useCallback((app, e) => {
        e?.stopPropagation();
        setLafModalApp({
            ...app,
            // urlMap already has the signed URL from useBulkSignedUrls above
            lafPhotoUrl: app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null,
        });
        setLafModalOpen(true);
    }, [urlMap]);

    const fetchApplications = useCallback(async () => {
        setLoading(true);
        try {
            const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
            const res = await fetchWrapper.get(
                getApiBaseUrl() + `laf/applications/list${params}`
            );
            if (res.success) {
                setApplications(res.applications);
            } else {
                toast.error('Failed to load CI applications.');
            }
        } catch {
            toast.error('Error loading CI applications.');
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => { fetchApplications(); }, [fetchApplications]);

    // Client-side search
    const filtered = applications.filter(a => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
            a.ciReferenceCode?.toLowerCase().includes(q) ||
            a.firstName?.toLowerCase().includes(q) ||
            a.lastName?.toLowerCase().includes(q) ||
            a.branchName?.toLowerCase().includes(q) ||
            a.contactNumber?.includes(q)
        );
    });

    const statusOptions = [
        { value: 'all',         label: 'All' },
        { value: 'pending',     label: 'Pending CI' },
        { value: 'ci_approved', label: 'CI Approved' },
        { value: 'ci_declined', label: 'CI Declined' },
        { value: 'promoted',    label: 'Promoted' },
    ];

    return (
        <div className="p-4">

            {/* Filters */}
            <div className="flex flex-wrap gap-3 mb-4 bg-white p-4 rounded-lg
                border border-gray-200">
                <div className="flex gap-2 flex-wrap">
                    {statusOptions.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => setStatusFilter(opt.value)}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium
                                transition-colors ${
                                statusFilter === opt.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 min-w-48">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Search by name, CI code, branch..."
                        className="w-full px-3 py-1.5 text-sm border border-gray-300
                            rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                <button
                    onClick={fetchApplications}
                    className="px-3 py-1.5 text-xs font-medium border border-gray-300
                        text-gray-600 rounded-lg hover:bg-gray-50 flex items-center gap-1.5"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor"
                        viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            <div className="flex gap-4 mb-4 text-xs text-gray-500">
                <span>
                    Showing <strong className="text-gray-900">{filtered.length}</strong> of{' '}
                    <strong className="text-gray-900">{applications.length}</strong> applications
                </span>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex justify-center py-12"><Spinner /></div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none"
                        stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm">No CI applications found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide w-12">
                                        Photo
                                    </th>
                                    {currentUser?.role?.rep < 3 && (
                                        <th className="px-4 py-3 text-left text-xs font-semibold
                                            text-gray-600 uppercase tracking-wide">
                                            Branch
                                        </th>
                                    )}
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        CI Reference
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        Applicant
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        Loan Amount
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        Submitted
                                    </th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        Status
                                    </th>
                                    <th className="px-4 py-3 text-center text-xs font-semibold
                                        text-gray-600 uppercase tracking-wide">
                                        Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filtered.map(app => (
                                    <tr
                                        key={app._id}
                                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                                        onClick={() => setSelected(app)}
                                    >
                                        {/* Photo from bulk urlMap */}
                                        <td className="px-4 py-3">
                                            <RowPhoto
                                                urlMap={urlMap}
                                                photoKey={app.lafPhotoKey}
                                            />
                                        </td>

                                        {currentUser?.role?.rep < 3 && (
                                            <td className="px-4 py-3 text-xs text-gray-600">
                                                <span className="font-mono">{app.branchCode}</span>
                                                <span className="ml-1 text-gray-400">
                                                    {app.branchName}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs text-blue-600
                                                font-medium">
                                                {app.ciReferenceCode}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">
                                                {app.lastName}, {app.firstName}
                                            </p>
                                            <p className="text-xs text-gray-400 mt-0.5">
                                                {app.contactNumber}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {app.loanAmount
                                                ? `₱${Number(app.loanAmount).toLocaleString()}`
                                                : '—'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 text-xs">
                                            {moment(app.submittedAt).format('MMM DD, YYYY')}
                                            <br />
                                            <span className="text-gray-400">
                                                {moment(app.submittedAt).format('h:mm A')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={app.status} />
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={e => {
                                                        e.stopPropagation();
                                                        setSelected(app);
                                                    }}
                                                    className="px-3 py-1 text-xs font-medium
                                                        text-blue-600 border border-blue-200
                                                        rounded-lg hover:bg-blue-50"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={e => handlePrintLAF(app, e)}
                                                    className="px-3 py-1 text-xs font-medium
                                                        text-gray-600 border border-gray-200
                                                        rounded-lg hover:bg-gray-50
                                                        flex items-center gap-1"
                                                    title="Print / Download LAF"
                                                >
                                                    <Printer className="w-3 h-3" />
                                                    LAF
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Detail modal */}
            <ApplicationDetailModal
                application={selected}
                onClose={() => setSelected(null)}
                onPrintLAF={(app) => handlePrintLAF({
                    ...app,
                    lafPhotoUrl: app.lafPhotoKey ? urlMap[app.lafPhotoKey] : null,
                })}
            />

            {/* LAF print/download modal — uses lafModalApp, NOT searchResult */}
            <TempLAFModal
                isOpen={lafModalOpen}
                onClose={() => {
                    setLafModalOpen(false);
                    setLafModalApp(null);
                }}
                application={lafModalApp}
            />
        </div>
    );
};

export default TemporaryLoanApplicationsTab;