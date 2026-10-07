// src/pages/api/v2/transactions/loans/list-paginated.js
// GET — server-paginated, server-filtered loan applications for the v2
// Loan Application page. Replaces (for the new page only) the unpaginated
// loans/list.js + client-side tab splitting + Redux fan-out.
//
// Scope comes ONLY from req.auth.sub (never from a currentUserId query param —
// loans/list-history.js trusts that param, so any user can read another
// user's scope by passing their id).
//
// Tabs mirror the classic page's client-side predicates exactly:
//   ldf               status=pending AND dateOfRelease <= today
//   tomorrow          status=pending AND dateOfRelease  = today+1
//   forecast          status=pending AND dateOfRelease >= today+2
//   application       status=pending AND ldfApproved
//   duplicate         status=pending AND client.duplicate        (rep 1 / root only)
//   guarantor-review  status=pending AND guarantorDuplicate      (rep 1 / root only)
//   history           status<>pending AND dateGrantedMonthYear = MM/YYYY
//
// Default sort (all tabs): modifiedDateTime DESC, then dateOfRelease DESC.
//
// "today" is the system date in Asia/Manila (loadSettingsSystemDate: the
// settings override on staging, the server clock converted to Manila in prod).

import momentTz from 'moment-timezone';
import { apiHandler } from '@/services/api-handler';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, aggregateQl } from '@/lib/graph/graph.util';
import { findUserById, loadSettingsSystemDate } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';

const graph = new GraphProvider();
const TZ = 'Asia/Manila';

// Slim list projection — deliberately NOT LOAN_FIELDS (editHistory blobs,
// collection columns etc. are dead weight on a list).
const LOAN_TYPE = createGraphType('loans', `
    _id clientId branchId groupId loId loanCycle status slotNo
    fullName pnNumber principalLoan amountRelease dateOfRelease dateAdded modifiedDateTime
    occurence weeklyScheduleType groupName ciName ciReferenceCode
    ldfApproved ldfApprovedDate preApproved
    guarantorDuplicate coMakerPending coMakerPendingName
    client { _id fullName profile duplicate }
    branch { _id code name }
    loanOfficer { _id firstName lastName loNo }
`);

const IDS_TYPE = createGraphType('loans', '_id');

// Excel export: the columns useExcelExport reads (it tolerates several shapes;
// these are the ones it checks first), nothing heavier. Fetched in chunks by the
// browser so one request never has to hold the whole export.
const EXPORT_TYPE = createGraphType('loans', `
    _id slotNo loanCycle mcbu principalLoan amountRelease loanBalance pnNumber
    dateOfRelease dateGranted dateAdded ciName status fullName groupName occurence
    client { _id fullName }
    branch { _id code name }
    loanOfficer { _id firstName lastName }
    group { _id name }
`);
const EXPORT_CHUNK = 2000;
const EXPORT_ORDER = [
    { branch: { name: 'asc' } },
    { loanOfficer: { loNo: 'asc' } },
    { groupName: 'asc' },
    { slotNo: 'asc' },
    { _id: 'asc' },
];
const IDS_CAP = 500;

const AGG = 'aggregate { count sum { amountRelease } }';

const PENDING_TABS = ['ldf', 'tomorrow', 'forecast', 'application'];
// Classic visibility: the duplicate-clients tab was `rep < 2` (admin only); the
// guarantor-review tab's Review/View button was `rep <= 3` (admin, supervisors,
// branch managers — loan officers do not get it).
const ADMIN_ONLY_TABS = ['duplicate'];
const REP3_UP_TABS = ['guarantor-review'];
const ALL_TABS = [...PENDING_TABS, ...ADMIN_ONLY_TABS, ...REP3_UP_TABS, 'history'];

// Lower bound excludes '' / junk strings if dateOfRelease is a text column,
// and is harmless if it is a date column (unlike `_neq: ''`, which would
// throw an invalid-date error on a date column).
const DATE_FLOOR = '2000-01-01';

const first = (v) => (Array.isArray(v) ? v[0] : v);
const escapeLike = (s) => s.replace(/[\\%_]/g, '\\$&');
const aliasKey = (tab) => `agg_${tab.replace(/-/g, '_')}`;

const emptyPagination = (limit) => ({
    page: 1, limit, total: 0, totalPages: 0, hasNext: false, hasPrev: false,
});

export default apiHandler({ get: listPaginated });

async function listPaginated(req, res) {
    try {
        const currentUser = await findUserById(req.auth.sub);
        if (!currentUser) {
            return res.status(200).json({ success: false, message: 'User not found.' });
        }

        const q = {
            tab:            first(req.query.tab) || 'ldf',
            branchId:       first(req.query.branchId) || null,
            loId:           first(req.query.loId) || null,
            groupId:        first(req.query.groupId) || null,
            loanCycle:      first(req.query.loanCycle) || 'all',
            occurence:      first(req.query.occurence) || 'all',
            loType:         first(req.query.loType) || 'all',
            coMakerPending: first(req.query.coMakerPending) === '1',
            search:         (first(req.query.search) || '').trim(),
            ciReference:    (first(req.query.ciReference) || '').trim().slice(0, 64),
            month:          first(req.query.month) || null,
            year:           first(req.query.year) || null,
            withCounts:     first(req.query.withCounts) !== '0',
            idsOnly:        first(req.query.idsOnly) === '1',
            exportRows:     first(req.query.export) === '1',
        };
        const page   = Math.max(1, parseInt(first(req.query.page), 10) || 1);
        const limit  = Math.min(q.exportRows ? EXPORT_CHUNK : 50, Math.max(1, parseInt(first(req.query.limit), 10) || 25));
        const offset = (page - 1) * limit;

        const rep = currentUser.role?.rep;
        const isAdminLevel = currentUser.root === true || rep === 1;

        if (!ALL_TABS.includes(q.tab)) {
            return res.status(200).json({ success: false, message: `Invalid tab "${q.tab}".` });
        }
        const canSeeGuarantorTab = currentUser.root === true || (rep >= 1 && rep <= 3);
        if (
            (ADMIN_ONLY_TABS.includes(q.tab) && !isAdminLevel) ||
            (REP3_UP_TABS.includes(q.tab) && !canSeeGuarantorTab)
        ) {
            return res.status(200).json({ success: false, message: 'This tab is not available for your role.' });
        }
        if (q.tab === 'history') {
            if (!/^(0[1-9]|1[0-2])$/.test(q.month || '') || !/^\d{4}$/.test(q.year || '')) {
                return res.status(200).json({ success: false, message: 'History requires month (MM) and year (YYYY).' });
            }
        }

        const visiblePendingTabs = [
            ...PENDING_TABS,
            ...(isAdminLevel ? ADMIN_ONLY_TABS : []),
            ...(canSeeGuarantorTab ? REP3_UP_TABS : []),
        ];

        // ── Scope ────────────────────────────────────────────────────────
        const { branchIds: allowedBranchIds, branches: allowedBranches } = await resolveLoanBranchScope(currentUser);

        const emptyResponse = () => res.status(200).json({
            success: true,
            loans: [],
            pagination: emptyPagination(limit),
            tabCounts: q.withCounts
                ? Object.fromEntries(visiblePendingTabs.map((t) => [t, { count: 0, amount: 0 }]))
                : undefined,
            allowedBranches,
            tab: q.tab,
        });

        if (allowedBranchIds && allowedBranchIds.length === 0) return emptyResponse();
        // A branch the caller is not allowed to see is an empty result, not a
        // silent fallback to something wider or narrower.
        if (q.branchId && allowedBranchIds && !allowedBranchIds.includes(q.branchId)) return emptyResponse();

        // ── Dates (system date, Manila) ──────────────────────────────────
        const systemDate = await loadSettingsSystemDate();
        const today    = momentTz(systemDate).tz(TZ).format('YYYY-MM-DD');
        const tomorrow = momentTz.tz(today, TZ).add(1, 'day').format('YYYY-MM-DD');
        const dayAfter = momentTz.tz(today, TZ).add(2, 'day').format('YYYY-MM-DD');

        // ── Filters shared by every tab ──────────────────────────────────
        const common = [];

        if (allowedBranchIds) common.push({ branchId: { _in: allowedBranchIds } });
        if (q.branchId)       common.push({ branchId: { _eq: q.branchId } });

        if (rep === 4 && !isAdminLevel) common.push({ loId: { _eq: currentUser._id } });
        else if (q.loId)                common.push({ loId: { _eq: q.loId } });

        if (q.groupId) common.push({ groupId: { _eq: q.groupId } });

        if (q.loanCycle === 'new_member')    common.push({ loanCycle: { _eq: 1 } });
        else if (q.loanCycle === 'reloaner') common.push({ loanCycle: { _gt: 1 } });

        // Occurrence: daily | weekly_standard | weekly_accelerated.
        // weeklyScheduleType is frozen onto the loan at creation. Weekly loans
        // that predate the accelerated program may have it NULL, and those are
        // standard weekly loans, so "standard" matches 'standard' OR NULL
        // (`_is_null`, not `_eq: null`, which Hasura treats differently).
        //
        // A loan officer only ever works one transaction type; the classic page
        // passed it to the SQL function as `occurrence`. Pin it here and ignore
        // the filter. If the user has no daily/weekly type on record, do not guess.
        const loOccurrence = rep === 4 && !isAdminLevel && ['daily', 'weekly'].includes(currentUser.transactionType)
            ? currentUser.transactionType
            : null;

        if (loOccurrence) {
            common.push({ occurence: { _eq: loOccurrence } });
        } else if (q.occurence === 'daily') {
            common.push({ occurence: { _eq: 'daily' } });
        } else if (q.occurence === 'weekly_standard') {
            common.push({
                occurence: { _eq: 'weekly' },
                _or: [
                    { weeklyScheduleType: { _eq: 'standard' } },
                    { weeklyScheduleType: { _is_null: true } },
                ],
            });
        } else if (q.occurence === 'weekly_accelerated') {
            common.push({
                occurence: { _eq: 'weekly' },
                weeklyScheduleType: { _eq: 'accelerated' },
            });
        }

        // Classic page's Main / Ext split: loNo < 11 vs > 10.
        if (q.loType === 'main')     common.push({ loanOfficer: { loNo: { _lt: 11 } } });
        else if (q.loType === 'ext') common.push({ loanOfficer: { loNo: { _gt: 10 } } });

        // Client name: every word must match, in any order ("dela cruz juan"
        // finds "Juan Dela Cruz"). Checks the loan's denormalized fullName and
        // the live client record so a client renamed after the loan was
        // created is still found.
        q.search.split(/[\s,]+/).filter(Boolean).slice(0, 5).forEach((token) => {
            const p = `%${escapeLike(token.slice(0, 40))}%`;
            common.push({
                _or: [
                    { fullName: { _ilike: p } },
                    { client: { fullName: { _ilike: p } } },
                ],
            });
        });

        if (q.ciReference) {
            common.push({ ciReferenceCode: { _ilike: `%${escapeLike(q.ciReference)}%` } });
        }

        // ── Per-tab predicate ────────────────────────────────────────────
        const TAB_COND = {
            ldf:                { dateOfRelease: { _gte: DATE_FLOOR, _lte: today } },
            tomorrow:           { dateOfRelease: { _eq: tomorrow } },
            forecast:           { dateOfRelease: { _gte: dayAfter } },
            application:        { ldfApproved: { _eq: true } },
            duplicate:          { client: { duplicate: { _eq: true } } },
            'guarantor-review': { guarantorDuplicate: { _eq: true } },
        };

        // The co-maker filter is applied on top of `common` (not inside it) so
        // the button can show how many loans it WOULD match under the other
        // filters, without that count being narrowed by the filter itself.
        const withFilter = q.coMakerPending ? [...common, { coMakerPending: { _eq: true } }] : common;

        const whereForTab = (tab, filters = withFilter) => {
            if (tab === 'history') {
                return {
                    _and: [
                        { status: { _neq: 'pending' } },
                        { dateGrantedMonthYear: { _eq: `${q.month}/${q.year}` } },
                        ...filters,
                    ],
                };
            }
            return { _and: [{ status: { _eq: 'pending' } }, TAB_COND[tab], ...filters] };
        };

        const activeWhere = whereForTab(q.tab);
        // Default sort, all tabs: most recently modified first, then latest
        // release date first. desc_nulls_last keeps legacy rows with a NULL
        // value from floating to the top (Postgres sorts NULLs first on DESC).
        const orderBy = [
            { modifiedDateTime: 'desc_nulls_last' },
            { dateOfRelease: 'desc_nulls_last' },
            { _id: 'asc' },
        ];

        // "Select all" support: just the ids matching the active tab + filters
        // (capped), so the browser can select across pages without loading them.
        if (q.idsOnly) {
            const ids = await graph
                .query(queryQl(IDS_TYPE('ids'), { where: activeWhere, order_by: orderBy, limit: IDS_CAP }))
                .then((r) => (r.data?.ids ?? []).map((l) => l._id));
            return res.status(200).json({ success: true, ids, capped: ids.length >= IDS_CAP, cap: IDS_CAP });
        }

        // Excel export: same scope, tab and filters as the list, but a different
        // projection, a stable branch / loan officer / group order, and bigger
        // chunks. `dateRelease` mirrors dateOfRelease because useExcelExport reads
        // dateGranted / dateRelease / releaseDate for its DATE OF RELEASE column,
        // and dateGranted is empty for loans that are still pending.
        if (q.exportRows) {
            const exportData = await graph
                .query(
                    queryQl(EXPORT_TYPE('page'), { where: activeWhere, order_by: EXPORT_ORDER, limit, offset }),
                    aggregateQl(IDS_TYPE('agg_active'), 'aggregate { count }', activeWhere)
                )
                .then((r) => r.data);
            const exportLoans = exportData.page ?? [];
            const agg = exportData.agg_active?.aggregate?.count ?? 0;
            const pages = Math.ceil(agg / limit);
            return res.status(200).json({
                success: true,
                loans: exportLoans.map((l) => ({ ...l, dateRelease: l.dateOfRelease })),
                pagination: { page, limit, total: agg, totalPages: pages, hasNext: page < pages, hasPrev: page > 1 },
            });
        }

        // One round trip: the page, the active tab's total, and (only when the
        // filters changed) the other tabs' counts. Page-turns skip the counts.
        const parts = [
            queryQl(LOAN_TYPE('page'), { where: activeWhere, order_by: orderBy, limit, offset }),
            aggregateQl(LOAN_TYPE('agg_active'), AGG, activeWhere),
        ];
        // Co-maker pending count for the active (pending-type) tab. Always
        // returned, because it depends on the tab AND the filters.
        const needsCoMakerAgg = q.tab !== 'history' && !q.coMakerPending;
        if (needsCoMakerAgg) {
            parts.push(aggregateQl(
                LOAN_TYPE('agg_comaker'),
                'aggregate { count }',
                whereForTab(q.tab, [...common, { coMakerPending: { _eq: true } }])
            ));
        }
        const countedTabs = q.withCounts ? visiblePendingTabs.filter((t) => t !== q.tab) : [];
        countedTabs.forEach((tab) => {
            parts.push(aggregateQl(LOAN_TYPE(aliasKey(tab)), AGG, whereForTab(tab)));
        });

        const data = await graph.query(...parts).then((r) => r.data);

        const readAgg = (a) => ({
            count:  a?.aggregate?.count ?? 0,
            amount: Number(a?.aggregate?.sum?.amountRelease ?? 0),
        });

        const active = readAgg(data.agg_active);
        const total = active.count;
        const totalPages = Math.ceil(total / limit);

        let coMakerPendingCount = null;
        if (q.tab !== 'history') {
            coMakerPendingCount = q.coMakerPending ? total : (data.agg_comaker?.aggregate?.count ?? 0);
        }

        let tabCounts;
        if (q.withCounts) {
            tabCounts = {};
            visiblePendingTabs.forEach((tab) => {
                tabCounts[tab] = tab === q.tab ? active : readAgg(data[aliasKey(tab)]);
            });
        }

        return res.status(200).json({
            success: true,
            loans: data.page ?? [],
            pagination: { page, limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
            activeTotals: active,
            coMakerPendingCount,
            tabCounts,
            allowedBranches,
            currentDate: today,
            tab: q.tab,
        });
    } catch (e) {
        console.error('[loans/list-paginated] failed', e);
        // 200 + success:false, never 403/500 — a non-200 can trigger the
        // client-side logout handling.
        return res.status(200).json({ success: false, message: 'Failed to load loan applications.' });
    }
}