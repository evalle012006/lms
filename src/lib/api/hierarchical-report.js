// src/lib/api/hierarchical-report.js
//
// Shared engine for the Branch -> Loan Officer -> Client drill-down reports (Mispayment List,
// Low Loan Balance, ...). A report is a CONFIG; this file owns everything that must never drift
// between reports:
//
//   - identity + scope from the token (never from a client-supplied id), shortCode-based, fails closed
//   - level resolution:  branch (no ids) | lo (branchId) | client (loId); rep 3 pinned to own branch,
//     rep 4 pinned to self
//   - validation (sort, page, limit), search, sort with stable tie-break
//   - response modes:  all=1 | page/limit | legacy (only if the report supplies `legacy`)
//   - Server-Timing header + slow-request log, real error messages instead of "reading 'collections'"
//
// A report supplies:
//   name           log label
//   levels         { branch|lo|client: { sortable, defaultSort, searchable, summary, count? } }
//                    summary: [[summaryKey, rowKey], ...]   count: summary key that receives the row count
//   parseFilters   (query, { systemDate }) => { filters, scope } | { error }
//   sources        { branch|lo|client: { query, variables(ctx), toRows(rawItems) } }
//   legacy?        { decorate(level, rows), totalsRow(level, summary) }   (keeps an old UI contract alive)
//
// The SQL functions behind `sources` return the WHOLE result set (no LIMIT), so sort/search/paging
// happen here, after the fetch. Pushing LIMIT/OFFSET into Postgres means changing those functions.

import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl } from '@/lib/graph/graph.util';
import { findUserById } from '@/lib/graph.functions';
import { resolveLoanBranchScope } from '@/lib/api/resolveLoanBranchScope';
import { getSystemDate } from '@/lib/date-utils';
import logger from '@/logger';

const graph = new GraphProvider();

const BRANCH_TYPE = createGraphType('branches', '_id name code')('branches');
const USER_TYPE = createGraphType('users', '_id firstName lastName designatedBranchId')('users');

const SLOW_MS = 3000;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

// ── Helpers shared with report configs ───────────────────────────────────────

export const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

// Query-string values arrive as strings; URLSearchParams turns undefined into 'undefined'.
export const clean = (v) =>
    typeof v === 'string' && v.trim() && v !== 'undefined' && v !== 'null' ? v.trim() : null;

// designatedBranchId is sometimes stored as " " instead of null.
export const hasId = (v) => typeof v === 'string' && v.trim().length > 0;

const positiveInt = (v, fallback) => {
    const n = parseInt(v, 10);
    return Number.isInteger(n) && n > 0 ? n : fallback;
};

async function runQuery(query, variables) {
    const result = await graph.apollo.query({
        query,
        variables,
        fetchPolicy: 'no-cache',
        errorPolicy: 'none',
    });
    // If the client is configured with errorPolicy 'all', GraphQL errors come back with `data`
    // undefined — surface the real Hasura/Postgres message instead of a TypeError.
    if (result?.errors?.length) {
        throw new Error(result.errors.map(e => e.message).join('; '));
    }
    return (result?.data?.collections ?? []).map(c => c?.data).filter(Boolean);
}

// ── Sorting / search / summary ───────────────────────────────────────────────

const tieKey = (r) => String(r._id ?? `${r.groupId}:${r.slotNo}:${r.loanId ?? ''}`);

function comparator(field, dir) {
    const m = dir === 'desc' ? -1 : 1;
    return (a, b) => {
        const x = a[field];
        const y = b[field];
        if (x == null && y == null) return tieKey(a).localeCompare(tieKey(b));
        if (x == null) return 1;   // nulls last in both directions
        if (y == null) return -1;
        const c = (typeof x === 'number' && typeof y === 'number')
            ? (x - y) * m
            : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * m;
        // The SQL functions have no ORDER BY, so tie-break to keep pages stable between requests.
        return c !== 0 ? c : tieKey(a).localeCompare(tieKey(b));
    };
}

function summarize(levelCfg, rows) {
    const out = {};
    if (levelCfg.count) out[levelCfg.count] = rows.length;
    for (const [summaryKey, rowKey] of levelCfg.summary) {
        out[summaryKey] = rows.reduce((s, r) => s + num(r[rowKey]), 0);
    }
    return out;
}

function send(report, res, { level, rows, scope, view, timing }) {
    const levelCfg = report.levels[level];
    const totalMs = Date.now() - timing.t0;
    res.setHeader('Server-Timing', `db;dur=${timing.db}, total;dur=${totalMs}`);
    if (totalMs > SLOW_MS) {
        logger.warn({ page: report.name, message: 'Slow report', level, rows: rows.length, dbMs: timing.db, totalMs });
    }

    let list = rows;
    if (view.search) {
        const needle = view.search.toLowerCase();
        list = list.filter(r => levelCfg.searchable.some(f => String(r[f] ?? '').toLowerCase().includes(needle)));
    }
    list = [...list].sort(comparator(view.sortBy, view.sortDir));
    const summary = summarize(levelCfg, list);

    if (view.all) {
        return res.status(200).json({ success: true, data: list, summary, scope });
    }

    if (!view.paginated) {
        // Legacy contract (only reports that supply `legacy`): all rows + a TOTALS row inside `data`.
        return res.status(200).json({
            success: true,
            data: [...report.legacy.decorate(level, list), report.legacy.totalsRow(level, summary)],
            scope,
        });
    }

    const total = list.length;
    const totalPages = Math.ceil(total / view.limit);
    const page = Math.min(view.page, Math.max(totalPages, 1));
    const start = (page - 1) * view.limit;

    return res.status(200).json({
        success: true,
        data: list.slice(start, start + view.limit),
        summary,
        scope,
        pagination: { page, limit: view.limit, total, totalPages, hasNext: page < totalPages, hasPrev: page > 1 },
    });
}

// ── The handler factory ──────────────────────────────────────────────────────

export function createHierarchicalReport(report) {
    return async function handler(req, res) {
        // Project convention: never 403 (the client treats it as a logout) — 200 + success:false.
        const fail = (message) => res.status(200).json({ success: false, message });
        const timing = { t0: Date.now(), db: 0 };
        const fetchRows = async (source, variables) => {
            const t = Date.now();
            try { return await runQuery(source.query, variables); } finally { timing.db += Date.now() - t; }
        };

        try {
            const currentUser = req.auth?.sub ? await findUserById(req.auth.sub) : null;
            if (!currentUser) return fail('User not found.');

            const systemDate = moment(getSystemDate()).format('YYYY-MM-DD');
            const parsed = report.parseFilters(req.query, { systemDate });
            if (parsed.error) return fail(parsed.error);
            const { filters, scope: scopeExtras } = parsed;

            // ── Level from role + params. Role wins over whatever the client sent. ──
            const rep = currentUser.role?.rep;
            let loId = clean(req.query.loId);
            let branchId = clean(req.query.branchId);

            if (rep === 4) {
                loId = String(currentUser._id);
                branchId = null;
            } else if (rep === 3 && !loId) {
                branchId = hasId(currentUser.designatedBranchId) ? currentUser.designatedBranchId : null;
            }

            const level = loId ? 'client' : (branchId ? 'lo' : 'branch');
            const levelCfg = report.levels[level];

            const sortBy = clean(req.query.sortBy) ?? levelCfg.defaultSort.field;
            const sortDir = (clean(req.query.sortDir) ?? (clean(req.query.sortBy) ? 'asc' : levelCfg.defaultSort.dir)).toLowerCase();
            if (!levelCfg.sortable.includes(sortBy)) return fail(`Invalid sortBy "${sortBy}" for level "${level}".`);
            if (sortDir !== 'asc' && sortDir !== 'desc') return fail('Invalid sortDir. Expected "asc" or "desc".');

            const paginated = req.query.page !== undefined || req.query.limit !== undefined;
            const view = {
                // A report with no legacy contract answers with the full list by default.
                all: clean(req.query.all) === '1' || (!paginated && !report.legacy),
                paginated,
                page: positiveInt(req.query.page, 1),
                limit: Math.min(positiveInt(req.query.limit, DEFAULT_LIMIT), MAX_LIMIT),
                sortBy,
                sortDir,
                search: clean(req.query.search) ?? '',
            };

            // ── Scope: shortCode-based, fails closed. null = unrestricted. ──
            const { branchIds: allowedBranchIds, branches: allowedBranches } = await resolveLoanBranchScope(currentUser);
            const hasAccess = (id) => allowedBranchIds === null || (hasId(id) && allowedBranchIds.includes(id));

            const scope = {
                level,
                systemDate,                 // lets the UI cap a date picker without knowing the system date itself
                // Highest level this role may view — the UI only links breadcrumbs the user can actually reach.
                topLevel: rep === 4 ? 'client' : (rep === 3 ? 'lo' : 'branch'),
                sort: { by: sortBy, dir: sortDir },   // resolved (incl. default) so headers can show the active sort
                allowedBranches: allowedBranches === null
                    ? null
                    : allowedBranches.map(({ _id, code, name }) => ({ _id, code, name })),
                ...scopeExtras,
            };

            if (allowedBranchIds !== null && allowedBranchIds.length === 0) {
                return send(report, res, { level, rows: [], scope, view, timing });
            }

            let rows;

            if (level === 'branch') {
                const source = report.sources.branch;
                const raw = await fetchRows(source, source.variables({ currentUser, unrestricted: allowedBranchIds === null, filters }));
                // Defensive intersection: whatever the SQL function returns, the caller never gets a
                // branch outside their shortCode scope.
                rows = source.toRows(raw).filter(b => hasAccess(b._id));

            } else if (level === 'lo') {
                if (!hasAccess(branchId)) return fail('You do not have access to this branch.');

                const [branch] = await graph
                    .query(queryQl(BRANCH_TYPE, { where: { _id: { _eq: branchId } } }))
                    .then(r => r.data?.branches ?? []);
                if (!branch) return fail('Branch not found.');

                const source = report.sources.lo;
                const raw = await fetchRows(source, source.variables({ branchId, filters }));
                rows = source.toRows(raw);
                scope.branch = { _id: branch._id, code: branch.code, name: branch.name };

            } else {
                const [lo] = await graph
                    .query(queryQl(USER_TYPE, { where: { _id: { _eq: loId } } }))
                    .then(r => r.data?.users ?? []);
                if (!lo) return fail('Loan officer not found.');
                if (!hasAccess(lo.designatedBranchId)) return fail('You do not have access to this loan officer.');

                const source = report.sources.client;
                const [raw, [loBranch]] = await Promise.all([
                    fetchRows(source, source.variables({ loId, filters })),
                    hasId(lo.designatedBranchId)
                        ? graph.query(queryQl(BRANCH_TYPE, { where: { _id: { _eq: lo.designatedBranchId } } }))
                            .then(r => r.data?.branches ?? [])
                        : Promise.resolve([]),
                ]);
                rows = source.toRows(raw);
                if (loBranch) scope.branch = { _id: loBranch._id, code: loBranch.code, name: loBranch.name };
                // Returned so the UI doesn't depend on the Redux userList ("undefined undefined").
                scope.lo = {
                    _id: lo._id,
                    name: `${lo.firstName ?? ''} ${lo.lastName ?? ''}`.trim(),
                    branchId: lo.designatedBranchId,
                };
            }

            return send(report, res, { level, rows, scope, view, timing });
        } catch (error) {
            logger.error({
                page: report.name,
                message: 'Failed to build report',
                user_id: req.auth?.sub,
                query: req.query,
                error: error.message,
                stack: error.stack,
            });
            return res.status(500).json({
                success: false,
                message: 'Unable to load the report. Please try again.',
            });
        }
    };
}