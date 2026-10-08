// src/components/transactions/LoanVerificationSection.js
// Section 3 of BranchClosingDocumentsModal — v2-branch-only. Server-side
// (checkUnreviewedLoans) is the real gate; this is the review UI for it.

import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';

const PAGE_LIMIT = 15;

const FACE_STATUS_LABEL = {
    matched: { text: 'Face verified', className: 'text-green-700 bg-green-50 border-green-200' },
    unmatched: { text: 'Face mismatch', className: 'text-red-700 bg-red-50 border-red-200' },
    missing: { text: 'No verification attempt', className: 'text-red-700 bg-red-50 border-red-200' },
    not_required: { text: 'Not required', className: 'text-gray-500 bg-gray-50 border-gray-200' },
};

export default function LoanVerificationSection({ branchId, dateFor, canFinalize, branchClosed }) {
    const [loading, setLoading] = useState(true);
    const [applicable, setApplicable] = useState(true);
    const [loans, setLoans] = useState([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        loadPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [branchId, dateFor]);

    const loadPage = async (targetPage) => {
        setLoading(true);
        const url = `${getApiBaseUrl()}transactions/closing-documents/loan-verification/list?` +
            new URLSearchParams({ branchId, dateFor, page: targetPage, limit: PAGE_LIMIT });
        const response = await fetchWrapper.get(url);
        if (response.success) {
            setApplicable(response.applicable);
            setLoans(response.loans || []);
            setPage(response.page);
            setTotalPages(response.totalPages || 1);
            setTotal(response.total || 0);

            // Auto-log a view for every loan on this page — the data is
            // already fully visible the moment this renders, unlike the
            // closing-documents flow where "view" is a real click behind
            // a modal. Fire-and-forget; doesn't block the UI.
            (response.loans || []).forEach(loan => {
                fetchWrapper.post(
                    `${getApiBaseUrl()}transactions/closing-documents/loan-verification/log-view`,
                    { branchId, dateFor, loanId: loan.loanId },
                ).catch(err => console.error('Failed to log loan verification view:', err));
            });
        } else {
            toast.error(response.message || 'Failed to load loan verification data.');
        }
        setLoading(false);
    };

    const photoKeys = loans.flatMap(l => [
        l.client?.faceEnrollPhotoKey,
        l.documents?.guarantorPhotoKey,
        l.documents?.guarantorIdPhotoKey,
        l.documents?.disbursementPhotoKey,
        l.ci?.selfieKey,
        l.faceVerify?.attempt?.photoKey,
    ]).filter(Boolean);
    const { urlMap } = useBulkSignedUrls(photoKeys);

    const handleAcknowledge = async (loan) => {
        const response = await fetchWrapper.post(
            `${getApiBaseUrl()}transactions/closing-documents/loan-verification/acknowledge`,
            { branchId, dateFor, loanId: loan.loanId },
        );
        if (response.success) {
            setLoans(prev => prev.map(l => l.loanId === loan.loanId
                ? { ...l, review: { ...l.review, acknowledged: true, acknowledgedAt: new Date().toISOString() } }
                : l));
        } else {
            toast.error(response.message || 'Failed to acknowledge loan.');
        }
    };

    if (!loading && !applicable) return null; // not a v2 branch — section doesn't apply

    const Thumb = ({ label, fileKey }) => {
        if (!fileKey) return (
            <div className="text-center">
                <div className="w-16 h-16 rounded border border-dashed bg-gray-50 flex items-center justify-center text-[10px] text-gray-300">None</div>
                <p className="text-[10px] text-gray-400 mt-0.5">{label}</p>
            </div>
        );
        const url = urlMap[fileKey];
        return (
            <div className="text-center">
                {url ? <img src={url} alt={label} className="w-16 h-16 rounded border object-cover" /> : <div className="w-16 h-16 rounded border bg-gray-50 animate-pulse" />}
                <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
            </div>
        );
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold shrink-0">3</span>
                <h3 className="text-sm font-semibold text-gray-900">Loan Verification</h3>
                <span className="text-xs text-gray-400">({total} approved today)</span>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8 text-gray-400 text-sm">Loading...</div>
            ) : loans.length === 0 ? (
                <p className="text-xs text-gray-400">No approved loans for this date.</p>
            ) : (
                <div className="space-y-3">
                    {loans.map(loan => {
                        const faceStatus = FACE_STATUS_LABEL[loan.faceVerify.status] || FACE_STATUS_LABEL.missing;
                        return (
                            <div key={loan.loanId} className="border rounded-lg p-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{loan.client?.name || 'Unknown client'}</p>
                                        <p className="text-xs text-gray-400">{loan.pnNumber} · ₱{Number(loan.principalLoan || 0).toLocaleString()} · {loan.groupName}</p>
                                    </div>
                                    <span className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded border ${faceStatus.className}`}>{faceStatus.text}</span>
                                </div>

                                <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
                                    <Thumb label="Guarantor" fileKey={loan.documents.guarantorPhotoKey} />
                                    <Thumb label="Guarantor ID" fileKey={loan.documents.guarantorIdPhotoKey} />
                                    <Thumb label="Disbursement" fileKey={loan.documents.disbursementPhotoKey} />
                                    <Thumb label="CI selfie" fileKey={loan.ci?.selfieKey} />
                                    {loan.faceVerify.attempt?.photoKey && (
                                        <Thumb label={`Face verify (${Math.round(loan.faceVerify.attempt.confidence || 0)}%)`} fileKey={loan.faceVerify.attempt.photoKey} />
                                    )}
                                </div>

                                {loan.ci?.ciReferenceCode === null && <p className="text-[11px] text-gray-400 mt-2">No CI reference on this loan.</p>}
                                {loan.ci?.ciReferenceCode && !loan.ci?.found && (
                                    <p className="text-[11px] text-amber-600 mt-2">⚠ CI reference {loan.ci.ciReferenceCode} — investigation record not found.</p>
                                )}

                                {canFinalize && !branchClosed && (
                                    <div className="mt-2 pt-2 border-t flex justify-end">
                                        <label className={`flex items-center gap-1.5 text-xs ${loan.review.acknowledged ? 'text-green-700' : 'text-gray-700 cursor-pointer'}`}>
                                            <input type="checkbox" checked={!!loan.review.acknowledged} disabled={loan.review.acknowledged}
                                                onChange={() => handleAcknowledge(loan)} className="h-3.5 w-3.5" />
                                            {loan.review.acknowledged ? 'Reviewed' : 'Mark as reviewed'}
                                        </label>
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-2">
                            <button type="button" disabled={page <= 1} onClick={() => loadPage(page - 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Previous</button>
                            <span className="text-xs text-gray-400">Page {page} of {totalPages}</span>
                            <button type="button" disabled={page >= totalPages} onClick={() => loadPage(page + 1)} className="text-xs px-2 py-1 border rounded disabled:opacity-40">Next</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}