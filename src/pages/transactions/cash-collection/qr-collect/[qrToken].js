// src/pages/transactions/cash-collection/qr-collect/[qrToken].js

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { toast } from 'react-toastify';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

const ERROR_MESSAGES = {
    INVALID_QR: 'This QR code is not valid.',
    FORBIDDEN: 'You are not authorized to collect for this client.',
    CLIENT_INACTIVE: 'This client is no longer active.',
    NO_ACTIVE_LOAN: 'This client has no active loan.',
    DAY_NOT_VALID: null,
    ALREADY_PROCESSED: null,
};

function statusPillClass(status) {
    const s = (status || '').toLowerCase();
    if (s === 'active') return 'bg-green-100 text-green-700';
    if (s === 'completed') return 'bg-blue-100 text-blue-700';
    if (s === 'closed') return 'bg-zinc-200 text-zinc-700';
    if (s === 'pending') return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
}

export default function QrCollectPage() {
    const router = useRouter();
    const { qrToken } = router.query;
    const currentUser = useSelector(state => state.user.data);

    const [loading, setLoading] = useState(true);
    const [scanInfo, setScanInfo] = useState(null);
    const [errorCode, setErrorCode] = useState(null);
    const [errorMessage, setErrorMessage] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submittedRef, setSubmittedRef] = useState(null);

    const [form, setForm] = useState({
        mcbuCol: '',
        csfCollection: '',
        paymentCollection: '',
        mcbuWithdrawFlag: false,
        offsetTransFlag: false,
    });

    useEffect(() => {
        if (!router.isReady) return;
        if (!currentUser?._id) {
            router.replace(`/login?returnUrl=${encodeURIComponent(router.asPath)}`);
        }
    }, [router.isReady, currentUser, router]);

    const fetchScanInfo = useCallback(async () => {
        if (!qrToken || !currentUser?._id) return;
        setLoading(true);
        setErrorCode(null);
        setErrorMessage(null);

        const res = await fetchWrapper.get(
            `${getApiBaseUrl()}qr-cash-collection/scan-info?${new URLSearchParams({ qrToken })}`
        );

        if (res.success) {
            setScanInfo(res);
            if (res.existingDraft) {
                setForm({
                    mcbuCol: res.existingDraft.mcbuCol || '',
                    csfCollection: res.existingDraft.csfCollection || '',
                    paymentCollection: res.existingDraft.paymentCollection || '',
                    mcbuWithdrawFlag: !!res.existingDraft.mcbuWithdrawFlag,
                    offsetTransFlag: !!res.existingDraft.offsetTransFlag,
                });
            }
        } else {
            setErrorCode(res.code || 'UNKNOWN');
            setErrorMessage(res.message || 'Something went wrong.');
        }
        setLoading(false);
    }, [qrToken, currentUser]);

    useEffect(() => { fetchScanInfo(); }, [fetchScanInfo]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        const res = await fetchWrapper.post(`${getApiBaseUrl()}qr-cash-collection/submit`, {
            qrToken,
            mcbuCol: form.mcbuCol,
            csfCollection: form.csfCollection,
            paymentCollection: form.paymentCollection,
            mcbuWithdrawFlag: form.mcbuWithdrawFlag,
            offsetTransFlag: form.offsetTransFlag,
        });

        setSubmitting(false);

        if (res.success) {
            setSubmittedRef(res.referenceCode);
            toast.success(res.message);
        } else {
            toast.error(res.message || 'Failed to submit.');
            if (res.code === 'ALREADY_PROCESSED') {
                fetchScanInfo();
            }
        }
    };

    if (!currentUser?._id) {
        return <CenteredMessage icon={<Loader2 className="w-6 h-6 animate-spin" />} text="Checking session…" />;
    }

    if (loading) {
        return <CenteredMessage icon={<Loader2 className="w-6 h-6 animate-spin" />} text="Loading…" />;
    }

    if (errorCode) {
        return (
            <CenteredMessage
                icon={<AlertTriangle className="w-8 h-8 text-amber-500" />}
                text={ERROR_MESSAGES[errorCode] || errorMessage}
            />
        );
    }

    if (submittedRef) {
        return (
            <CenteredMessage
                icon={<CheckCircle className="w-8 h-8 text-green-500" />}
                text="Collection submitted"
                subtext={`Reference code: ${submittedRef}`}
            />
        );
    }

    const { client, loan, dayValidity, existingDraft, limits } = scanInfo;

    // Live display-only estimate — mirrors submit.js's authoritative
    // server-side formula (noPaymentsToday * minDailyMcbuCollection), but
    // this value is NEVER what actually gets saved; it's purely so the
    // person sees a sensible number before submitting, not a promise it'll
    // match exactly (the server may compute a different figure if settings
    // changed between page load and submit).
    const noPaymentsToday = (parseFloat(form.paymentCollection) || 0) / (loan.activeLoan || 1);
    const computedDailyMcbu = Math.round((limits?.minMcbuCollectionPerInstallment ?? 0) * noPaymentsToday);

    return (
        <div className="min-h-screen bg-gray-50 flex items-start justify-center p-4 pt-10">
            <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-5">

                {/* ── Header ────────────────────────────────────────────────
                    Client name stays the prominent element (same size as
                    before). Branch / LO / Group / Occurence sit underneath
                    as a compact, secondary info row — this is orientation
                    context for the person scanning, not data they act on,
                    so it's deliberately smaller and less visually loud than
                    the name itself. */}
                <h1 className="text-lg font-semibold text-gray-900">{client.fullName}</h1>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                    <span>{client.branchName}</span>
                    {client.loName && <span>· {client.loName}</span>}
                    {client.groupName && <span>· {client.groupName}</span>}
                    {client.occurence && <span className="capitalize">· {client.occurence}</span>}
                </div>

                {existingDraft && (
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700">
                        A draft already exists for today. Submitting will update it.
                    </div>
                )}

                {/* ── Read-only details ────────────────────────────────────
                    Loan status as a pill (matches the office page's status
                    color convention), everything else as plain figures.
                    CSF only ever appears here if the client is a group
                    leader — for anyone else, loan.csf is already null from
                    the API, so it's never rendered or exposed at all. */}
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2 flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                        <span className="text-[10px] uppercase tracking-wide text-gray-400">Loan Status</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusPillClass(loan.status)}`}>
                            {loan.status || '-'}
                        </span>
                    </div>
                    <ReadOnlyField label="Amount Release" value={loan.amountRelease} />
                    <ReadOnlyField label="Active Loan" value={loan.activeLoan} />
                    <ReadOnlyField label="Loan Balance" value={loan.loanBalance} />
                    <ReadOnlyField label="MCBU" value={loan.mcbu} />
                    {client.groupLeader && (
                        <ReadOnlyField label="CSF" value={loan.csf} />
                    )}
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    {dayValidity.restrictedToFlaggedTypes ? (
                        <>
                            <p className="text-xs text-gray-500">
                                Today is not this group's scheduled collection day. Only the transaction types below are allowed.
                            </p>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.mcbuWithdrawFlag}
                                    onChange={(e) => setForm(f => ({ ...f, mcbuWithdrawFlag: e.target.checked, offsetTransFlag: false }))} />
                                MCBU Withdrawal
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.offsetTransFlag}
                                    onChange={(e) => setForm(f => ({ ...f, offsetTransFlag: e.target.checked, mcbuWithdrawFlag: false }))} />
                                Offset Transaction
                            </label>
                            <NumberField label="Amount" value={form.paymentCollection}
                                onChange={(v) => setForm(f => ({ ...f, paymentCollection: v }))} />
                        </>
                    ) : (
                        <>
                            {/* MCBU on daily collection is auto-computed, not a free
                                input — matches the desktop's implementation. Weekly
                                keeps it as a real input, per instruction. The
                                displayed figure recalculates live as Payment
                                Collection changes; the server independently
                                recomputes the authoritative value at submit time
                                regardless of what's shown here. */}
                            {client.occurence === 'daily' ? (
                                <div className="bg-gray-50 rounded-lg px-3 py-2">
                                    <p className="text-[10px] uppercase tracking-wide text-gray-400">MCBU Collection (auto-computed)</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        ₱{computedDailyMcbu.toLocaleString()}
                                    </p>
                                </div>
                            ) : (
                                <NumberField label="MCBU Collection" value={form.mcbuCol}
                                    hint={limits?.minMcbuCollectionPerInstallment ? `~₱${limits.minMcbuCollectionPerInstallment} per installment` : null}
                                    onChange={(v) => setForm(f => ({ ...f, mcbuCol: v }))} />
                            )}
                            {client.groupLeader && (
                                <NumberField label="CSF Collection" value={form.csfCollection}
                                    hint={limits?.minCsfCollection ? `Minimum ₱${limits.minCsfCollection}` : null}
                                    onChange={(v) => setForm(f => ({ ...f, csfCollection: v }))} />
                            )}
                            <NumberField label="Payment Collection" value={form.paymentCollection}
                                hint="Required"
                                onChange={(v) => setForm(f => ({ ...f, paymentCollection: v }))} />
                        </>
                    )}

                    <button type="submit" disabled={submitting}
                        className="w-full py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                        {submitting ? 'Submitting…' : existingDraft ? 'Update Collection' : 'Submit Collection'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function ReadOnlyField({ label, value }) {
    return (
        <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
            <p className="text-sm font-medium text-gray-800">₱{Number(value || 0).toLocaleString()}</p>
        </div>
    );
}

function NumberField({ label, value, onChange, hint }) {
    return (
        <div>
            <div className="flex items-baseline justify-between mb-1">
                <label className="block text-xs text-gray-500">{label}</label>
                {hint && <span className="text-[10px] text-gray-400">{hint}</span>}
            </div>
            <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
        </div>
    );
}

function CenteredMessage({ icon, text, subtext }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
            {icon}
            <p className="text-sm text-gray-700">{text}</p>
            {subtext && <p className="text-xs text-gray-400">{subtext}</p>}
        </div>
    );
}