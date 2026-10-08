// src/components/transactions/loan-application-v2/LoanApplicationList.js
// Read-only list for the v2 Loan Application page.
//
// Clicking a row (or card) opens the client detail, as on the classic page; the
// application form (LAF) is the file icon in the row's actions.
//
// Layout switches on the width of THIS container (ResizeObserver), not the
// viewport, so it also adapts when the sidebar collapses. Wide enough -> dense
// rows with a fluid grid that fits without sideways scrolling (the action
// column is always on screen); narrower -> cards.
//
// NOTE: this repo's tailwind.config.js overrides `theme.screens` with ONLY
// `lg`, so only lg: exists as a responsive prefix.

import React, { useEffect, useRef, useState } from 'react';
import moment from 'moment';
import { ExternalLink, FileText, Info, Loader2, Pencil, ShieldAlert, XCircle } from 'lucide-react';
import Spinner from '@/components/Spinner';
import ClientAvatar from '@/components/clients/ClientAvatar';
import { useBulkSignedUrls } from '@/hooks/useBulkSignedUrls';
import { formatPricePhp, UppercaseFirstLetter } from '@/lib/utils';

// Dense rows need roughly this much room (see gridTemplate); below it, cards.
const DENSE_MIN_WIDTH = 920;

// [checkbox] | avatar | client | branch/group | PN | principal/release | release date | flags | actions
// The actions track is a fixed px width (header and rows are separate grids, so
// an `auto` track would not line up). It is sized from the icons the user's role
// can actually see; the checkbox track only exists when selection is enabled.
const BASE_ACTION_WIDTH = 76;
const CHECKBOX_WIDTH = 28;
const gridTemplate = (actionWidth, selectable) =>
    `${selectable ? `${CHECKBOX_WIDTH}px ` : ''}32px minmax(0,1.5fr) minmax(0,1.5fr) 132px 112px 104px minmax(0,1fr) ${actionWidth}px`;

function actionWidthFor(actions) {
    const icons = 1
        + (actions.canEdit ? 1 : 0)
        + (actions.canDisclosure ? 1 : 0)
        + (actions.canReviewGuarantor ? 1 : 0)
        + (actions.canDetails ? 1 : 0)
        + (actions.canReject ? 1 : 0);
    return Math.max(BASE_ACTION_WIDTH, icons * 32 + 4);
}

const COLUMNS = [
    '', 'Client', 'Branch / group', 'PN number', 'Principal / release', 'Release date', 'Flags', '',
];

function useContainerWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(null);
    useEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        setWidth(el.getBoundingClientRect().width);
        if (typeof ResizeObserver === 'undefined') return undefined;
        const ro = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    return [ref, width];
}

function getPageNumbers(current, total, delta = 1) {
    const pages = [];
    const range = [];
    for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) {
        range.push(i);
    }
    pages.push(1);
    if (range[0] > 2) pages.push('…');
    pages.push(...range);
    if (range[range.length - 1] < total - 1) pages.push('…');
    if (total > 1) pages.push(total);
    return pages;
}

// ── Row helpers ──────────────────────────────────────────────────────────
const clientName = (loan) => UppercaseFirstLetter(loan.client?.fullName || loan.fullName || 'Unknown');

function loLabel(loan) {
    const lo = loan.loanOfficer;
    return lo ? `LO${lo.loNo ?? ''} - ${UppercaseFirstLetter(lo.lastName || '')}` : '-';
}

function branchLabel(loan) {
    const b = loan.branch;
    return b ? `${b.code ? `${b.code} - ` : ''}${UppercaseFirstLetter(b.name)}` : '-';
}

function releaseInfo(dateOfRelease, today) {
    if (!dateOfRelease) return { label: '-', hint: null };
    const d = moment(dateOfRelease).format('YYYY-MM-DD');
    const label = moment(d).format('MMM D, YYYY');
    if (!today) return { label, hint: null };
    if (d < today) return { label, hint: { text: 'Overdue', cls: 'text-amber-600' } };
    if (d === today) return { label, hint: { text: 'Today', cls: 'text-teal-600' } };
    return { label, hint: null };
}

function flagsFor(loan) {
    const flags = [];
    if (loan.ldfApproved) flags.push({ text: 'LDF approved', cls: 'bg-teal-50 text-teal-700' });
    if (loan.client?.duplicate) flags.push({ text: 'Duplicate', cls: 'bg-orange-50 text-orange-700' });
    if (loan.guarantorDuplicate) flags.push({ text: 'Guarantor review', cls: 'bg-red-50 text-red-700' });
    if (loan.coMakerPending) flags.push({ text: 'No co-maker', cls: 'bg-amber-50 text-amber-700' });
    if (loan.occurence === 'weekly' && loan.weeklyScheduleType === 'accelerated') {
        flags.push({ text: 'Accelerated', cls: 'bg-violet-50 text-violet-700' });
    }
    if (loan.loanCycle === 1) flags.push({ text: 'New member', cls: 'bg-sky-50 text-sky-700' });
    else if (loan.loanCycle > 1) flags.push({ text: `Cycle ${loan.loanCycle}`, cls: 'bg-gray-100 text-gray-600' });
    return flags;
}

// Blockers that already have their own flag pill (duplicate, guarantor, co-maker)
// are not repeated; the rest are shown so the user can see why a row cannot be
// selected.
const PILLED_ELSEWHERE = ['DUPLICATE_CLIENT', 'GUARANTOR_FLAG', 'NO_COMAKER'];

function blockerFlags(ctx) {
    return (ctx?.blockers ?? [])
        .filter((b) => !PILLED_ELSEWHERE.includes(b.code))
        .map((b) => ({ text: b.label, cls: 'bg-red-50 text-red-700', title: b.message }));
}

function FlagPills({ loan, ctx }) {
    const flags = [...blockerFlags(ctx), ...flagsFor(loan)];
    if (flags.length === 0) return <span className="text-gray-300">-</span>;
    return (
        <div className="flex flex-wrap gap-1">
            {flags.map((f) => (
                <span key={f.text} title={f.title} className={`px-2 py-0.5 rounded-full text-xs font-medium ${f.cls}`}>
                    {f.text}
                </span>
            ))}
        </div>
    );
}

function RowCheckbox({ loan, selection }) {
    const ctx = selection.context[loan._id];
    const checked = selection.selectedIds.has(loan._id);
    const blocked = !!ctx && ctx.blockers.length > 0;
    const title = !ctx
        ? 'Checking whether this loan can be approved…'
        : blocked ? ctx.blockers.map((b) => b.label).join(', ') : 'Select';
    return (
        <input
            type="checkbox"
            checked={checked}
            disabled={!ctx || blocked}
            title={title}
            aria-label={`Select ${clientName(loan)}`}
            onClick={(e) => e.stopPropagation()}
            onChange={() => selection.onToggle(loan._id)}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        />
    );
}

function HeaderCheckbox({ selection }) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current) ref.current.indeterminate = selection.somePageSelected && !selection.allPageSelected;
    }, [selection.somePageSelected, selection.allPageSelected]);
    return (
        <input
            ref={ref}
            type="checkbox"
            checked={selection.allPageSelected}
            disabled={selection.eligiblePageCount === 0}
            aria-label="Select all eligible loans on this page"
            title="Select all eligible loans on this page"
            onChange={selection.onTogglePage}
            className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
        />
    );
}

function IconBtn({ label, onClick, disabled, tone = 'text-gray-600 hover:bg-gray-100', children }) {
    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={`p-1.5 rounded-lg disabled:opacity-60 ${tone}`}
        >
            {children}
        </button>
    );
}

// Row actions mirror the classic page by role (see the page's `actions`). View
// stays rightmost so it lines up across rows even when other icons come and go.
function RowActions({ loan, actions, onView, viewingId }) {
    const busy = viewingId === loan._id;
    const name = clientName(loan);
    return (
        <div className="flex items-center justify-end gap-0.5">
            {actions.canReject && (
                <IconBtn
                    label={actions.rejectDisabledReason || `Reject loan for ${name}`}
                    tone="text-red-600 hover:bg-red-50"
                    disabled={!!actions.rejectDisabledReason}
                    onClick={() => actions.onReject(loan)}
                >
                    <XCircle className="w-4 h-4" />
                </IconBtn>
            )}
            {actions.canReviewGuarantor && loan.guarantorDuplicate && (
                <IconBtn
                    label={`Review guarantor flag for ${name}`}
                    tone="text-red-600 hover:bg-red-50"
                    onClick={() => actions.onEdit(loan)}
                >
                    <ShieldAlert className="w-4 h-4" />
                </IconBtn>
            )}
            {actions.canEdit && (
                <IconBtn label={`Edit loan for ${name}`} onClick={() => actions.onEdit(loan)}>
                    <Pencil className="w-4 h-4" />
                </IconBtn>
            )}
            {actions.canDisclosure && (
                <IconBtn label={`View disclosure for ${name}`} onClick={() => actions.onDisclosure(loan)}>
                    <ExternalLink className="w-4 h-4" />
                </IconBtn>
            )}
            {actions.canDetails && (
                <IconBtn label={`View approval details for ${name}`} onClick={() => actions.onDetails(loan)}>
                    <Info className="w-4 h-4" />
                </IconBtn>
            )}
            <IconBtn label={`View application form for ${name}`} disabled={busy} onClick={() => onView(loan)}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            </IconBtn>
        </div>
    );
}

function DenseRow({ loan, photoUrl, today, onView, onOpenClient, openingId, viewingId, actions, template, selection }) {
    const release = releaseInfo(loan.dateOfRelease, today);
    const branch = branchLabel(loan);
    const groupLo = `${UppercaseFirstLetter(loan.groupName || '-')} · ${loLabel(loan)}`;
    return (
        <div
            className={`grid items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 text-sm ${
                openingId === loan._id ? 'opacity-60 cursor-wait' : 'cursor-pointer'
            }`}
            style={{ gridTemplateColumns: template }}
            onClick={() => { if (!openingId) onOpenClient(loan); }}
        >
            {selection && <RowCheckbox loan={loan} selection={selection} />}
            <ClientAvatar name={clientName(loan)} src={photoUrl} size={32} />
            <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate" title={clientName(loan)}>{clientName(loan)}</p>
                <p className="text-xs text-gray-400 truncate" title={loan.ciReferenceCode || ''}>
                    {loan.ciReferenceCode || 'No CI reference'}
                </p>
            </div>
            <div className="min-w-0">
                <p className="text-gray-700 truncate" title={branch}>{branch}</p>
                <p className="text-xs text-gray-400 truncate" title={groupLo}>{groupLo}</p>
            </div>
            <p className="text-gray-700 truncate" title={loan.pnNumber || ''}>
                {loan.pnNumber || <span className="text-red-500">Missing</span>}
            </p>
            <div>
                <p className="text-xs text-gray-400">{formatPricePhp(loan.principalLoan || 0)}</p>
                <p className="text-gray-900 font-medium">{formatPricePhp(loan.amountRelease || 0)}</p>
            </div>
            <div>
                <p className="text-gray-700">{release.label}</p>
                {release.hint && <p className={`text-xs font-medium ${release.hint.cls}`}>{release.hint.text}</p>}
            </div>
            <FlagPills loan={loan} ctx={selection?.context[loan._id]} />
            <div className="justify-self-end">
                <RowActions loan={loan} actions={actions} onView={onView} viewingId={viewingId} />
            </div>
        </div>
    );
}

function LoanCard({ loan, photoUrl, today, onView, onOpenClient, openingId, viewingId, actions, selection }) {
    const release = releaseInfo(loan.dateOfRelease, today);
    return (
        <div
            className={`bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-2 ${
                openingId === loan._id ? 'opacity-60' : ''
            }`}
            onClick={() => { if (!openingId) onOpenClient(loan); }}
        >
            <div className="flex items-start gap-3">
                {selection && <div className="pt-1"><RowCheckbox loan={loan} selection={selection} /></div>}
                <ClientAvatar name={clientName(loan)} src={photoUrl} size={40} />
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 truncate">{clientName(loan)}</p>
                    <p className="text-xs text-gray-500 truncate">
                        {branchLabel(loan)} · {UppercaseFirstLetter(loan.groupName || '-')}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                        {loan.ciReferenceCode || 'No CI reference'}
                    </p>
                </div>
                <RowActions loan={loan} actions={actions} onView={onView} viewingId={viewingId} />
            </div>
            <div
                className="grid gap-2 mt-3 text-sm"
                style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))' }}
            >
                <div>
                    <p className="text-xs text-gray-400">PN number</p>
                    <p className="text-gray-700 truncate">{loan.pnNumber || <span className="text-red-500">Missing</span>}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400">Principal</p>
                    <p className="text-gray-700">{formatPricePhp(loan.principalLoan || 0)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400">Amount release</p>
                    <p className="text-gray-900 font-medium">{formatPricePhp(loan.amountRelease || 0)}</p>
                </div>
                <div>
                    <p className="text-xs text-gray-400">Release date</p>
                    <p className="text-gray-700">{release.label}</p>
                    {release.hint && <p className={`text-xs font-medium ${release.hint.cls}`}>{release.hint.text}</p>}
                </div>
            </div>
            <div className="mt-2"><FlagPills loan={loan} ctx={selection?.context[loan._id]} /></div>
        </div>
    );
}

function Pagination({ pagination, goToPage }) {
    if (pagination.totalPages <= 1) return null;
    const btn =
        'px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 ' +
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white';
    return (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 px-1">
            <p className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-900">{pagination.page}</span> of{' '}
                <span className="font-semibold text-gray-900">{pagination.totalPages}</span>
                {' · '}{pagination.total} applications
            </p>
            <div className="flex items-center gap-1">
                <button type="button" className={btn} disabled={!pagination.hasPrev} onClick={() => goToPage(pagination.page - 1)}>
                    Previous
                </button>
                {/* Page numbers only where there is room; phones get Previous / Next. */}
                <div className="hidden lg:flex items-center gap-1">
                    {getPageNumbers(pagination.page, pagination.totalPages).map((p, i) =>
                        p === '…' ? (
                            <span key={`ellipsis-${i}`} className="px-2 text-gray-400">…</span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => goToPage(p)}
                                className={`w-9 h-9 rounded-lg text-sm font-medium transition-colors ${
                                    p === pagination.page ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                {p}
                            </button>
                        )
                    )}
                </div>
                <button type="button" className={btn} disabled={!pagination.hasNext} onClick={() => goToPage(pagination.page + 1)}>
                    Next
                </button>
            </div>
        </div>
    );
}

export default function LoanApplicationList({
    loans, loading, error, pagination, goToPage, currentDate, onView, onOpenClient, openingId = null,
    viewingId, actions = {}, selection = null,
}) {
    const [containerRef, width] = useContainerWidth();
    const actionWidth = actionWidthFor(actions);
    const template = gridTemplate(actionWidth, !!selection);
    const denseMin = DENSE_MIN_WIDTH + Math.max(0, actionWidth - BASE_ACTION_WIDTH) + (selection ? CHECKBOX_WIDTH : 0);
    const { urlMap } = useBulkSignedUrls(loans.map((l) => l.client?.profile).filter(Boolean));

    // Before the first measurement, guess from the viewport.
    const dense = width === null
        ? (typeof window !== 'undefined' ? window.innerWidth >= 1100 : true)
        : width >= denseMin;

    const rowProps = (loan) => ({
        loan,
        actions,
        template,
        selection,
        photoUrl: loan.client?.profile ? urlMap[loan.client.profile] : null,
        today: currentDate,
        onView,
        onOpenClient,
        openingId,
        viewingId,
    });

    // The wrapper (and its ref) is always rendered so measurement never
    // depends on which state the list is in.
    let body;
    if (loading && loans.length === 0) {
        body = <div className="flex justify-center py-16"><Spinner /></div>;
    } else if (error) {
        body = <div className="text-center py-16 text-sm text-red-500">{error}</div>;
    } else if (!loading && loans.length === 0) {
        body = (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 text-center py-16">
                <p className="text-sm font-medium text-gray-700">No applications match these filters.</p>
                <p className="text-xs text-gray-400 mt-1">Try another tab or clear a filter.</p>
            </div>
        );
    } else {
        body = (
            <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
                {dense ? (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
                        <div style={{ minWidth: denseMin - 24 }}>
                            <div
                                className="grid items-center gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50 text-xs font-semibold text-gray-500"
                                style={{ gridTemplateColumns: template }}
                            >
                                {selection && <HeaderCheckbox selection={selection} />}
                                {COLUMNS.map((label, i) => <div key={i}>{label}</div>)}
                            </div>
                            {loans.map((loan) => <DenseRow key={loan._id} {...rowProps(loan)} />)}
                        </div>
                    </div>
                ) : (
                    <div>
                        {loans.map((loan) => <LoanCard key={loan._id} {...rowProps(loan)} />)}
                    </div>
                )}
                <Pagination pagination={pagination} goToPage={goToPage} />
            </div>
        );
    }

    return <div ref={containerRef}>{body}</div>;
}