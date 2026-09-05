// src/components/ci/CIPromotedClientBanner.js
// FIX: Accept loanHistory as prop from ci-investigation/index.js (already fetched there)
// — eliminates duplicate loan-history API call
// — fixes stuck "Loading..." button (banner was re-fetching but parent already had data)
// NEW: Revert Promotion — admin/supervisor/BM only, typed-reason confirm gate,
//      calls /api/v2/laf/revert-promotion. Hidden when a loan already exists,
//      since that case must go through loan cancellation instead (backend-enforced).

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { CheckCircle, ArrowRight, Loader2, AlertTriangle, RotateCcw } from 'lucide-react';
import { getLatestNonPendingLoan, resolveLoanCycle } from '@/lib/loan-cycle';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';

const CIPromotedClientBanner = ({ application, investigation, currentUser, loanHistory, onReverted }) => {
    const router = useRouter();

    const clientId         = application?.existingClientId || application?.promotedClientId;
    const isExistingClient = !!(application?.existingClientId);

    // Derive slot/cycle from the loanHistory prop (already fetched by parent page)
    // loanHistory = array of loan objects for existingClientId, or null for new prospects
    const { existingSlotNo, existingLoanCycle, hasPendingLoan, groupNotAvailable } = useMemo(() => {
        if (!loanHistory) {
            return { existingSlotNo: null, existingLoanCycle: null, hasPendingLoan: false };
        }

        const pending    = loanHistory.some(l => l.status === 'pending');
        const latestLoan = getLatestNonPendingLoan(loanHistory);

        return {
            existingSlotNo:    latestLoan?.slotNo ? String(latestLoan.slotNo) : null,
            // Balik clients were reset by closing/offsetting all prior loans —
            // they always restart at cycle 1, regardless of their old cycle
            // number. Reloan / Pending Member continue it. See src/lib/loan-cycle.js.
            existingLoanCycle: String(resolveLoanCycle(loanHistory)),
            hasPendingLoan:    pending,
            groupNotAvailable: application?.groupStatus !== 'available',
        };
    }, [loanHistory, application.groupStatus]);

    // For new prospects: loanHistory null means still loading (parent hasn't fetched yet)
    // For existing clients: loanHistory is always fetched by loadApplication in parent
    // Loading while parent fetches loan-history (null = not yet received)
    const isLoading = loanHistory === null;

    // Any loan at all (not just pending) blocks revert — matches the backend guard,
    // which rejects revert if any loan record exists under this application/client.
    const hasAnyLoan = Array.isArray(loanHistory) && loanHistory.length > 0;

    // ── Revert Promotion state ─────────────────────────────────────────────
    const [revertOpen, setRevertOpen]     = useState(false);
    const [revertReason, setRevertReason] = useState('');
    const [reverting, setReverting]       = useState(false);

    const isAdmin      = currentUser?.role?.rep === 1 || currentUser?.root === true;
    const isSupervisor = currentUser?.role?.rep === 2 &&
        (currentUser?.role?.shortCode === 'deputy_director' || currentUser?.role?.shortCode === 'regional_manager'
            || currentUser?.role?.shortCode === 'area_admin'
        );
    const isBM       = currentUser?.role?.shortCode === 'branch_manager';
    const canRevert  = (isAdmin || isSupervisor || isBM) && !hasAnyLoan && !isLoading;

    const handleRevert = async () => {
        if (!revertReason.trim()) return;
        setReverting(true);
        try {
            const res = await fetchWrapper.post(getApiBaseUrl() + 'laf/revert-promotion', {
                ciReferenceCode: application.ciReferenceCode,
                reason: revertReason.trim(),
            });
            if (!res.success) throw new Error(res.message || 'Revert failed.');
            toast.success(res.deleted
                ? 'Client record removed. This application has been reverted.'
                : 'Promotion reverted.');
            setRevertOpen(false);
            setRevertReason('');
            onReverted?.();
        } catch (err) {
            toast.error(err.message || 'Failed to revert promotion.');
        } finally {
            setReverting(false);
        }
    };

    const handleAddLoan = () => {
        if (!clientId) return;
        if (groupNotAvailable) return;

        const q = new URLSearchParams();

        q.set('clientId', clientId);
        if (application?.groupId)    q.set('groupId',    application.groupId);
        if (application?.loId)       q.set('loId',       application.loId);
        if (application?.clientType) q.set('clientType', application.clientType);
        if (application?.groupName)  q.set('groupName',  application.groupName);

        // slotNo + loanCycle — derived from loanHistory prop, no extra fetch needed
        if (existingSlotNo)    q.set('slotNo',    existingSlotNo);
        if (existingLoanCycle) q.set('loanCycle', existingLoanCycle);

        // CI Name from investigation record
        const ciName = investigation?.picUserName || '';
        if (ciName) q.set('ciName', ciName);

        // Client identity
        if (application?.firstName)   q.set('firstName',   application.firstName);
        if (application?.lastName)    q.set('lastName',    application.lastName);
        if (application?.middleName)  q.set('middleName',  application.middleName);
        if (application?.birthdate)   q.set('birthdate',   application.birthdate);
        if (application?.lafPhotoUrl) q.set('photoUrl',    encodeURIComponent(application.lafPhotoUrl));

        // Contact: prefer contactNumber, fall back to clientChanges
        const contact = application?.contactNumber
            || application?.clientChanges?.contactNumber
            || '';
        if (contact) q.set('contactNumber', contact);
        if (application?.address) q.set('address', application.address);

        // Guarantor from LAF
        if (application?.guarantorFirstName)     q.set('gFN',      application.guarantorFirstName);
        if (application?.guarantorLastName)      q.set('gLN',      application.guarantorLastName);
        if (application?.guarantorRelationship)  q.set('gRel',     application.guarantorRelationship);
        if (application?.guarantorContactNumber) q.set('gContact', application.guarantorContactNumber);
        if (application?.guarantorBirthDate)     q.set('gBD',      application.guarantorBirthDate);
        if (application?.guarantorCivilStatus)   q.set('gCS',      application.guarantorCivilStatus);
        if (application?.guarantorBusiness)      q.set('gBiz',     application.guarantorBusiness);
        if (application?.guarantorDailyIncome)   q.set('gDI',      application.guarantorDailyIncome);
        if (application?.guarantorAddress)       q.set('gAddr',    application.guarantorAddress);
        if (application?.ciReferenceCode)        q.set('ciReferenceCode', application.ciReferenceCode);

        if (investigation?.investigatedAt) q.set('ciApprovedDate', investigation.investigatedAt);

        router.push(`/transactions/loan-applications/add?${q.toString()}`);
    };

    // Message text — clearer for existing vs new clients
    const statusMessage = isExistingClient
        ? 'Client record updated from LAF application.'
        : 'New client record has been created.';

    // Button state
    const buttonReady = !hasPendingLoan && !isLoading && !groupNotAvailable;

    return (
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-green-900">✓ Promoted to Client</p>
                    <p className="text-xs text-green-700 mt-0.5">{statusMessage}</p>

                    {hasPendingLoan ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-800">
                                Loan application already exists
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                This client already has a pending loan application.
                            </p>
                            <button type="button"
                                onClick={() => {
                                    const pendingLoan = loanHistory.find(l => l.status === 'pending');
                                    if (pendingLoan) router.push(`/transactions/loan-applications/edit/${pendingLoan._id}`);
                                }}
                                className="mt-2 text-xs font-semibold text-amber-800 underline underline-offset-2 hover:text-amber-900">
                                View Pending Loan →
                            </button>
                        </div>
                    ) : groupNotAvailable ? (
                        <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                            <p className="text-xs font-semibold text-amber-800">
                                Group not available for loan application
                            </p>
                            <p className="text-xs text-amber-700 mt-0.5">
                                This client is part of a group that is not available for loan applications.
                                Please check the group status before proceeding.
                            </p>
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center gap-1.5 mt-2 text-xs text-green-600">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Checking loan status...
                        </div>
                    ) : (
                        currentUser?.role?.rep <= 3 && clientId && (
                            <button
                                type="button"
                                onClick={handleAddLoan}
                                disabled={!buttonReady}
                                className="mt-3 flex items-center gap-1.5 px-4 py-2
                                    bg-green-600 text-white text-xs font-semibold
                                    rounded-lg hover:bg-green-700 transition-colors
                                    disabled:opacity-60 disabled:cursor-wait">
                                {isLoading ? (
                                    <>
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        Add Loan Application
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    </>
                                )}
                            </button>
                        )
                    )}

                    {/* ── Revert Promotion ────────────────────────────────── */}
                    {canRevert && (
                        <div className="mt-4 pt-3 border-t border-green-200">
                            {!revertOpen ? (
                                <div>
                                    <p className="text-xs text-gray-500 mb-2">
                                        Wrong client, or this shouldn't have been promoted?
                                    </p>
                                    <button type="button" onClick={() => setRevertOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600
                                            text-xs font-semibold rounded-lg hover:bg-red-50 transition-colors">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        Undo This Promotion
                                    </button>
                                </div>
                            ) : (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700">
                                            {isExistingClient
                                                ? "This will revert the client's record to its prior state. This cannot be undone."
                                                : 'This will permanently delete the client record created by this promotion. This cannot be undone.'}
                                        </p>
                                    </div>
                                    <textarea value={revertReason} onChange={e => setRevertReason(e.target.value)}
                                        placeholder="Type the reason for reverting this promotion (required)..."
                                        rows={2}
                                        className="w-full px-3 py-2 text-xs border border-red-200 rounded-lg
                                            focus:outline-none focus:ring-2 focus:ring-red-300 resize-none bg-white" />
                                    <div className="flex gap-2">
                                        <button type="button"
                                            onClick={() => { setRevertOpen(false); setRevertReason(''); }}
                                            className="flex-1 py-2 border border-gray-300 text-gray-600 text-xs font-medium
                                                rounded-lg hover:bg-gray-50">
                                            Cancel
                                        </button>
                                        <button type="button" onClick={handleRevert}
                                            disabled={!revertReason.trim() || reverting}
                                            className="flex-1 py-2 bg-red-600 text-white text-xs font-semibold
                                                rounded-lg hover:bg-red-700 disabled:opacity-50">
                                            {reverting ? 'Reverting…' : 'Confirm Revert'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CIPromotedClientBanner;