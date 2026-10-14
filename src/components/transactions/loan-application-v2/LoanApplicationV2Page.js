// src/components/transactions/loan-application-v2/LoanApplicationV2Page.js
// The new Loan Application page, as a component.
//
// It is rendered by /transactions/loan-applications (the single url both versions
// share) when the user's chosen view is 'v2'; `onSwitchView` takes them back to
// classic. See useLoanApplicationView and the gate file.
//
// Approvals (see approvalMode in the gate file):
//   branch managers  own branch: LDF approve and LDF unapprove (tab "LDF pending"), Approve loans
//                    (tab "LDF approved", with the disbursement photo step on v2
//                    branches), Reject, View approval details.
//   supervisors      admin / deputy_director / regional_manager / area_admin, across
//                    their branches: LDF approve, Approve loans (not for v2
//                    branches, which need the branch's disbursement photo),
//                    View approval details. No Reject.
// Loan officers (rep 4) get their own loans only: the server pins them to their
// loId and their daily / weekly transaction type. They can add and edit loans,
// open the disclosure and the LAF, and see approval details; they cannot approve.
// Everyone gets the list, filters, the navigation actions and Excel export (the
// current tab with the current filters, all pages). Branch managers can also print
// the LDF sheet from the "LDF pending" tab. Disclosure (NDS) is the per-loan icon,
// which opens the existing disclosure page.
//
// Layout notes:
//   - <Layout header={false} noPad>: Layout's default `header` renders an empty
//     80px white bar (it only exists to hold actionButtons) and `p-6` content
//     padding. The page title is already shown by the top HeaderComponent, so
//     both are dropped and spacing is set here.
//   - tailwind.config.js overrides `theme.screens` with ONLY `lg`, so sm:/md:/xl:
//     classes do not exist in this repo. Use base classes + lg: only.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import moment from 'moment';
import Layout from '@/components/Layout';
import Spinner from '@/components/Spinner';
import LAFModal from '@/components/transactions/loan-application/LAFModal';
import ClientDetailPage from '@/components/clients/ClientDetailPage';
import Modal from '@/lib/ui/Modal';
import LDFListPage from '@/components/transactions/loan-application/LDFList';
import DisbursementPhotoModal from '@/components/transactions/loan-application/DisbursementPhotoModal';
import LDFApprovalDetailsModal from '@/components/transactions/loan-application/LDFApprovalDetailsModal';
import LoanApplicationToolbar from '@/components/transactions/loan-application-v2/LoanApplicationToolbar';
import LoanApplicationList from '@/components/transactions/loan-application-v2/LoanApplicationList';
import ApprovalActionBar from '@/components/transactions/loan-application-v2/ApprovalActionBar';
import { BlockersDialog, RejectLoanDialog } from '@/components/transactions/loan-application-v2/ApprovalDialogs';
import { useLoanApplicationList } from '@/hooks/useLoanApplicationList';
import { useLoanApproval } from '@/hooks/useLoanApproval';
import { useExcelExport } from '@/hooks/useExcelExport';
import { approvalBlockedMessage, isApprovalBlocked } from '@/lib/approval-restriction-utils';
import { setTransactionSettings } from '@/redux/actions/transactionsActions';
import { setClient } from '@/redux/actions/clientActions';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { getApiBaseUrl } from '@/lib/constants';
import { getMonths, getYears } from '@/lib/date-utils';
import { formatPricePhp } from '@/lib/utils';
import {
    approvalMode,
    isEligibleForLoanApplicationV2,
    LOAN_APPLICATION_ADD_PATH,
    loanApplicationEditPath,
    loanApplicationDisclosurePath,
} from '@/lib/loan-application-v2-gate';

// Same predicates and labels as the classic page's tabs.
const TABS = [
    { key: 'ldf',              label: 'LDF pending',       counted: true },
    { key: 'tomorrow',         label: 'Tomorrow',          counted: true },
    { key: 'forecast',         label: 'Forecasted',        counted: true },
    { key: 'application',      label: 'LDF approved',      counted: true },
    { key: 'duplicate',        label: 'Duplicate clients', counted: true, minAccess: 'admin' },
    { key: 'guarantor-review', label: 'Guarantor review',  counted: true, minAccess: 'rep3' },
    { key: 'history',          label: 'History',           counted: false },
];

// @tailwindcss/forms draws the <select> chevron inside the right padding.
// An explicit pr-10 keeps the text clear of it; a bare px-3 overlaps it.
const SELECT =
    'rounded-lg border border-gray-200 bg-white py-2 pl-3 pr-10 text-sm text-gray-900 cursor-pointer ' +
    'focus:outline-none focus:ring-2 focus:ring-teal-500';

export default function LoanApplicationV2Page({ onSwitchView }) {
    const router = useRouter();
    const currentUser = useSelector((state) => state.user.data);
    const userReady = !!currentUser?._id;
    const eligible = isEligibleForLoanApplicationV2(currentUser);

    const {
        loans, pagination, tabCounts, activeTotals, coMakerPendingCount, loading, error,
        currentDate, allowedBranches, filters,
        updateFilters, resetFilters, goToPage, refresh, fetchAllIds, fetchExportRows,
    } = useLoanApplicationList({ enabled: userReady && eligible });

    const [lafLoan, setLafLoan] = useState(null);
    const [viewingId, setViewingId] = useState(null);
    const [openingClientId, setOpeningClientId] = useState(null);
    const [showClientModal, setShowClientModal] = useState(false);
    const [exporting, setExporting] = useState(false);
    const ldfSheetRef = useRef(null);
    const { exportLoansToExcel } = useExcelExport();

    // Same inputs the classic page used to decide whether approving is allowed.
    const dispatch = useDispatch();
    const txnSettings = useSelector((state) => state.transactionsSettings?.data || {});
    const isHoliday = useSelector((state) => state.systemSettings.holiday);
    const isWeekend = useSelector((state) => state.systemSettings.weekend);
    const currentBranch = useSelector((state) => state.branch.data);
    const reduxDate = useSelector((state) => state.systemSettings.currentDate);

    const rep = currentUser?.role?.rep;
    const isAdminLevel = currentUser?.root === true || rep === 1;

    // Row actions mirror the classic page by role:
    //   Edit loan / View disclosure : branch manager (3) and loan officer (4)
    //   Review guarantor flag       : rep <= 2 (the banner on the edit page is
    //                                 admin-only; it has no other entry point)
    //   Add loan                    : rep > 2
    // All of these are navigation to existing pages. The approve / LDF-approve /
    // reject actions are NOT here yet (see the Phase 2 notes).
    const actions = useMemo(() => ({
        canEdit: rep === 3 || rep === 4,
        canDisclosure: rep === 3 || rep === 4,
        canReviewGuarantor: rep <= 2,
        onEdit: (loan) => router.push(loanApplicationEditPath(loan._id)),
        onDisclosure: (loan) => window.open(loanApplicationDisclosurePath(loan._id), '_blank'),
    }), [rep, router]);
    const canAddLoan = rep > 2;

    const mode = approvalMode(currentUser);
    const isBranchManager = mode === 'branch_manager';
    const isApprover = mode !== null;
    const approvalTab = filters.tab === 'ldf' || filters.tab === 'application';
    const pendingTab = filters.tab !== 'history';

    const approval = useLoanApproval({
        enabled: isApprover && approvalTab,
        mode,
        tab: filters.tab,
        loans,
        resetKey: JSON.stringify(filters),
        currentUser,
        currentBranch,
        currentDate: reduxDate,
        fetchAllIds,
        onChanged: refresh,
    });

    // The approval-restriction cutoffs are changed by admins while branch
    // managers have the page open; the classic page re-read them every 60s.
    useEffect(() => {
        if (!isApprover) return undefined;
        const fetchTxnSettings = async () => {
            try {
                const response = await fetchWrapper.get(`${getApiBaseUrl()}settings/transactions`);
                if (response.success && response.transactions) {
                    dispatch(setTransactionSettings(response.transactions));
                }
            } catch (e) {
                // silent, same as classic
            }
        };
        const interval = setInterval(fetchTxnSettings, 60 * 1000);
        return () => clearInterval(interval);
    }, [isApprover, dispatch]);

    // Classic rules: LDF approval is blocked only by its cutoff time; final
    // approval is also blocked on weekends, holidays and a locked branch, and
    // reject is unavailable on weekends and holidays. Shown as a reason, not
    // by hiding the button.
    const ldfBlocked = isApprovalBlocked(
        txnSettings.enableLdfApprovalRestriction,
        txnSettings.ldfApprovalCutoffTime
    );
    const loanBlocked = isApprovalBlocked(
        txnSettings.enableLoanApprovalRestriction,
        txnSettings.loanApprovalCutoffTime
    );

    let primaryDisabledReason = null;
    if (filters.tab === 'ldf' && ldfBlocked) {
        primaryDisabledReason = approvalBlockedMessage('LDF', txnSettings.ldfApprovalCutoffTime);
    } else if (filters.tab === 'application') {
        if (isWeekend) primaryDisabledReason = 'Loan approval is not available on weekends.';
        else if (isHoliday) primaryDisabledReason = 'Loan approval is not available on holidays.';
        else if (!reduxDate) primaryDisabledReason = 'The system date has not loaded yet.';
        else if (isBranchManager && currentBranch?.lockTransaction) primaryDisabledReason = 'Transactions for this branch are locked.';
        else if (loanBlocked) primaryDisabledReason = approvalBlockedMessage('Loan', txnSettings.loanApprovalCutoffTime);
    }

    const rejectDisabledReason = isWeekend || isHoliday ? 'Reject is not available on weekends and holidays.' : null;

    // ── Print LDF ────────────────────────────────────────────────────────
    // Classic: the LDF sheet (LDFListPage) is rendered hidden on screen and printed
    // with react-to-print. The sheet now holds whatever rows were just prepared, so
    // printing waits for them to render (LDFListPage derives its table in an effect).
    const printLdfSheet = useReactToPrint({
        content: () => ldfSheetRef.current,
        documentTitle: `AC_LDF_${moment(reduxDate || undefined).format('YYYY-MM-DD_HH-mm-ss')}`,
    });
    const ldfPrintSeq = approval.ldfPrintSeq;
    useEffect(() => {
        if (!ldfPrintSeq) return undefined;
        const timer = setTimeout(() => printLdfSheet(), 400);
        return () => clearTimeout(timer);
        // printLdfSheet changes identity every render; the sequence number is the trigger
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ldfPrintSeq]);

    const canPrintLdf = isBranchManager && filters.tab === 'ldf';

    // ── Excel export ─────────────────────────────────────────────────────
    // What is on the active tab under the current filters, every page — not just
    // the page on screen. The workbook itself is built by the existing
    // useExcelExport hook, unchanged. History uses its month/year picker; the
    // other tabs are stamped with the current month.
    const handleExport = async () => {
        if (exporting) return;
        setExporting(true);
        const toastId = toast.loading('Preparing export…');
        try {
            const { rows, capped } = await fetchExportRows();
            toast.dismiss(toastId);
            if (rows.length === 0) {
                toast.warning('Nothing to export for this tab and these filters.');
                return;
            }
            const stamp = moment(currentDate || undefined);
            const month = filters.tab === 'history' && filters.month ? Number(filters.month) : stamp.month() + 1;
            const year = filters.tab === 'history' && filters.year ? Number(filters.year) : stamp.year();
            await exportLoansToExcel(rows, currentUser, month, year);
            if (capped) toast.warning('The export was cut off at 30,000 rows. Narrow the filters to get the rest.');
        } catch (e) {
            toast.dismiss(toastId);
            console.error('[LoanApplicationV2] export failed', e);
            toast.error(`Export failed: ${e.message}`);
        } finally {
            setExporting(false);
        }
    };

    // Navigation actions (above) + approval actions, both for the list's row icons.
    const rowActions = {
        ...actions,
        canReject: isBranchManager && pendingTab,
        rejectDisabledReason,
        onReject: approval.openReject,
        canDetails: pendingTab,
        onDetails: approval.showDetails,
    };

    // Checkboxes only where an approval action exists for the tab.
    const selection = isApprover && approvalTab
        ? {
            context: approval.context,
            selectedIds: approval.selectedIds,
            eligiblePageCount: approval.eligiblePageCount,
            allPageSelected: approval.allPageSelected,
            somePageSelected: approval.somePageSelected,
            onToggle: approval.toggle,
            onTogglePage: approval.togglePage,
        }
        : null;
    // Classic visibility: duplicates were admin only (rep < 2); the guarantor
    // review tab's button was rep <= 3. Loan officers get neither.
    const isRep3OrAbove = currentUser?.root === true || (rep >= 1 && rep <= 3);
    const visibleTabs = useMemo(
        () => TABS.filter((t) => (
            !t.minAccess
            || (t.minAccess === 'admin' && isAdminLevel)
            || (t.minAccess === 'rep3' && isRep3OrAbove)
        )),
        [isAdminLevel, isRep3OrAbove]
    );

    const handleTab = (key) => {
        if (key === filters.tab) return;
        if (key === 'history') {
            const now = moment(currentDate || undefined);
            updateFilters(
                { tab: key, month: filters.month ?? now.format('MM'), year: filters.year ?? now.format('YYYY') },
                { tabOnly: true }
            );
        } else {
            updateFilters({ tab: key }, { tabOnly: true });
        }
    };

    const handleYear = (value) => {
        const year = String(value);
        const allowed = getMonths(Number(year));
        const month = allowed.some((m) => m.value === filters.month) ? filters.month : allowed[0]?.value;
        updateFilters({ year, month }, { tabOnly: true });
    };

    // One scope-checked fetch (loan + client + branch + group) feeds both the
    // application form and the client detail.
    const fetchLoanDetail = async (loan) => {
        try {
            const res = await fetchWrapper.get(
                `${getApiBaseUrl()}transactions/loans/get-for-laf?${new URLSearchParams({ loanId: loan._id })}`
            );
            if (res.success) return res.loan;
            toast.error(res.message || 'Unable to load this loan.');
        } catch (e) {
            console.error('[LoanApplicationV2] loan detail failed', e);
            toast.error('Unable to load this loan.');
        }
        return null;
    };

    const handleViewLaf = async (loan) => {
        if (viewingId) return;
        setViewingId(loan._id);
        const detail = await fetchLoanDetail(loan);
        if (detail) setLafLoan(detail);
        setViewingId(null);
    };

    // Classic behaviour (rowClick -> handleShowClientInfoModal): put the client in
    // the store, show the client detail page in a modal.
    const handleOpenClient = async (loan) => {
        if (openingClientId) return;
        setOpeningClientId(loan._id);
        const detail = await fetchLoanDetail(loan);
        if (detail?.client) {
            dispatch(setClient({ ...detail.client, profile: detail.client.profile ? detail.client.profile : '' }));
            setShowClientModal(true);
        } else if (detail) {
            toast.error('This loan has no client record.');
        }
        setOpeningClientId(null);
    };

    if (!userReady || !eligible) {
        return <Layout header={false} noPad><Spinner /></Layout>;
    }

    const monthOptions = getMonths(Number(filters.year) || moment().year());
    const yearOptions = getYears();
    const isHistory = filters.tab === 'history';

    return (
        <Layout header={false} noPad>
            <div className="p-3 lg:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm text-gray-500">
                        {currentDate ? `As of ${moment(currentDate).format('MMM D, YYYY')}` : 'Loading…'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {canPrintLdf && (
                            <button
                                type="button"
                                onClick={approval.prepareLdfPrint}
                                disabled={!!approval.busy}
                                title={approval.selectedCount > 0
                                    ? 'Print the selected loans'
                                    : 'Print every loan on this tab that can be approved'}
                                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                            >
                                {approval.busy === 'print'
                                    ? 'Preparing…'
                                    : approval.selectedCount > 0 ? `Print LDF (${approval.selectedCount})` : 'Print LDF'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={exporting || activeTotals.count === 0}
                            title="Exports every loan on this tab under the current filters, not just the page on screen"
                            className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                            {exporting
                                ? 'Exporting…'
                                : `Export Excel${activeTotals.count > 0 ? ` (${activeTotals.count})` : ''}`}
                        </button>
                        {canAddLoan && (
                            <button
                                type="button"
                                onClick={() => router.push(LOAN_APPLICATION_ADD_PATH)}
                                className="px-3 py-1.5 rounded-lg bg-teal-600 text-sm font-medium text-white hover:bg-teal-700"
                            >
                                Add loan
                            </button>
                        )}
                        {onSwitchView && (
                            <button
                                type="button"
                                onClick={onSwitchView}
                                title="Go back to the classic Loan Approval page"
                                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Switch to classic view
                            </button>
                        )}
                    </div>
                </div>

                {/* One scrollable row on phones, wraps from lg up. */}
                <div
                    className="flex flex-nowrap lg:flex-wrap gap-2 mb-3 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0"
                    role="tablist"
                >
                    {visibleTabs.map((t) => {
                        const active = filters.tab === t.key;
                        const count = tabCounts?.[t.key]?.count;
                        return (
                            <button
                                key={t.key}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => handleTab(t.key)}
                                className={`shrink-0 whitespace-nowrap inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                    active ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
                                }`}
                            >
                                {t.label}
                                {t.counted && count !== undefined && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                                            active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {count}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-gray-900">{activeTotals.count}</span>{' '}
                        {activeTotals.count === 1 ? 'application' : 'applications'}
                        {activeTotals.amount > 0 && (
                            <>
                                {' · '}Total amount release{' '}
                                <span className="font-semibold text-gray-900">{formatPricePhp(activeTotals.amount)}</span>
                            </>
                        )}
                    </p>

                    {isHistory && (
                        <div className="flex items-center gap-2">
                            <select
                                className={SELECT}
                                aria-label="Month"
                                value={filters.month ?? ''}
                                onChange={(e) => updateFilters({ month: e.target.value }, { tabOnly: true })}
                            >
                                {monthOptions.map((m) => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <select
                                className={SELECT}
                                aria-label="Year"
                                value={filters.year ?? ''}
                                onChange={(e) => handleYear(e.target.value)}
                            >
                                {yearOptions.map((y) => (
                                    <option key={y.value} value={y.value}>{y.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <LoanApplicationToolbar
                    lockedLoId={rep === 4 ? currentUser._id : null}
                    filters={filters}
                    updateFilters={updateFilters}
                    resetFilters={resetFilters}
                    allowedBranches={allowedBranches}
                    coMakerPendingCount={coMakerPendingCount}
                />

                {selection && (
                    <ApprovalActionBar
                        tab={filters.tab}
                        selectedCount={approval.selectedCount}
                        totalOnTab={pagination.total}
                        busy={approval.busy}
                        disabledReason={primaryDisabledReason}
                        onSelectAll={approval.selectAllMatching}
                        onClear={approval.clearSelection}
                        onPrimary={filters.tab === 'ldf' ? approval.ldfApprove : approval.approveLoans}
                        onSecondary={filters.tab === 'ldf' ? approval.ldfUnapprove : undefined}
                    />
                )}

                <LoanApplicationList
                    loans={loans}
                    loading={loading}
                    error={error}
                    pagination={pagination}
                    goToPage={goToPage}
                    currentDate={currentDate}
                    onView={handleViewLaf}
                    onOpenClient={handleOpenClient}
                    openingId={openingClientId}
                    viewingId={viewingId}
                    actions={rowActions}
                    selection={selection}
                />
            </div>

            <LAFModal isOpen={!!lafLoan} onClose={() => setLafLoan(null)} loanData={lafLoan} />

            <Modal title="Client Detail Info" show={showClientModal} onClose={() => setShowClientModal(false)} width="70rem">
                <ClientDetailPage />
            </Modal>

            {/* LDF sheet: hidden on screen (its own media-to-print class), printed on demand */}
            {isBranchManager && <LDFListPage ref={ldfSheetRef} data={approval.ldfPrintRows || []} />}

            <RejectLoanDialog
                key={approval.rejectTarget?._id || 'none'}
                loan={approval.rejectTarget}
                busy={approval.busy === 'reject'}
                onCancel={approval.closeReject}
                onConfirm={approval.confirmReject}
            />
            <BlockersDialog messages={approval.blockersDialog} onClose={approval.closeBlockers} />
            <DisbursementPhotoModal
                show={!!approval.disbursementRows}
                loans={approval.disbursementRows || []}
                onConfirm={approval.confirmDisbursement}
                onCancel={approval.cancelDisbursement}
            />
            <LDFApprovalDetailsModal
                show={!!approval.detailsRow}
                loan={approval.detailsRow}
                onClose={approval.closeDetails}
            />
        </Layout>
    );
}