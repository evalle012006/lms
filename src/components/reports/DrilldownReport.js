// src/components/reports/DrilldownReport.js
//
// Shared UI engine for the Branch -> Loan Officer -> Client drill-down reports (Mispayment List,
// Low Loan Balance, ...). A report is a CONFIG object (see MispayListReport.js); this file owns
// everything that must not drift between reports.
//
// How it works
//   - The API (src/lib/api/hierarchical-report.js) resolves identity + scope from the token and tells
//     us which level this is (scope.level) and how far up the user may go (scope.topLevel).
//     No role logic lives here.
//   - It fetches ONCE per (server filters, branch/LO) with all=1, then sorts, searches, hides empty
//     rows and pages in the browser. Paging / sorting / typing never touches the database.
//   - State lives in the URL, so drill-down, back, refresh and shared links work.
//   - Layout follows the Loan Application v2 pattern. This repo's tailwind.config.js defines ONLY the
//     `lg` screen (no sm:/md:), so dense-vs-cards is decided by the container's measured width, and
//     every class name is a static string (Tailwind's JIT can't see names built with template strings).
//
// Report config:
//   endpoint     'reports/get-all-...'
//   filters      [{ key, kind: 'date'|'select'|'compare'|'checkbox', ... , local?, levels? }]
//                  date      value from ?key, falls back to scope[key]; capped at scope.systemDate
//                  select    { options, default }
//                  compare   { operatorKey, operators, default: { operator, value }, label }  (two URL params)
//                  checkbox  { label, default, local: true }  — applied in the browser via rowFilter
//                `local: true` filters are never sent to the server. `levels` limits where one shows.
//                dataSelect { allLabel, options(rows) => [{value,label}], match(row, value), levels, width }
//                  options come from the rows on screen (e.g. the groups of this LO); browser-side, never a request.
//                  Hidden when there are fewer than two options; a stale URL value is ignored, not applied.
//   scopeSelectors  ['branch', 'lo']  lateral navigation without going back up: a Branch picker (the branches the
//                  server says this user may see) and, at client level, a Loan officer picker for the same branch.
//                  Hidden whenever the role has nothing to pick (rep 3 / rep 4, single-branch supervisors).
//   rowFilter    (row, level, filterValues) => boolean        (optional; for local filters)
//   emptyTitle   (scope) => string
//   levels       { branch|lo|client: { noun, searchPlaceholder, denseMin, kpis, columns, rowKey,
//                                      searchText, drill, card, countKey } }
//     column     { key, label, type: 'text'|'int'|'money'|'delinquent'|'remarks', track?, align?, hideIfAllNull? }

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import moment from 'moment';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import {
    AlertTriangle,
    ArrowDown,
    ArrowUp,
    ChevronLeft,
    ChevronRight,
    ChevronsUpDown,
    Inbox,
    Search,
} from 'lucide-react';
import { useReportQuery } from '@/hooks/useReportQuery';
import { fetchWrapper } from '@/lib/fetch-wrapper';
import { LOR_MISPAY_REMARKS, getApiBaseUrl } from '@/lib/constants';
import { formatPricePhp } from '@/lib/utils';

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZES = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 50;
const URL_DEBOUNCE_MS = 300;
const NUMBER_DEBOUNCE_MS = 450;
const LEVEL_RANK = { branch: 0, lo: 1, client: 2 };

// Drilling or jumping level: the old level's page, sort and search don't apply.
const RESET = { page: undefined, sortBy: undefined, sortDir: undefined, q: undefined };

const REMARK_LABELS = Object.fromEntries(LOR_MISPAY_REMARKS.map(o => [o.value, o.label]));

// Static class maps — never build these with `text-${x}`.
const TEXT_ALIGN = { left: 'text-left', center: 'text-center', right: 'text-right' };
const JUSTIFY = { left: 'justify-start', center: 'justify-center', right: 'justify-end' };

const DEFAULT_TRACK = {
    text: 'minmax(0,1fr)',
    money: 'minmax(0,1fr)',
    int: '84px',
    delinquent: '92px',
    remarks: 'minmax(0,1.2fr)',
};
const CHEVRON_TRACK = '20px';

// ── Helpers ──────────────────────────────────────────────────────────────────

const str = (v) => (Array.isArray(v) ? v[0] : v) || undefined;   // Next gives string | string[] | undefined

const alignOf = (c) => c.align ?? (c.type === 'money' || c.type === 'int' ? 'right' : 'left');
const isNumeric = (c) => c.type === 'money' || c.type === 'int';

const isValidDate = (d) => moment(d, 'YYYY-MM-DD', true).isValid();

export const remarkRaw = (r) => (r && typeof r === 'object' ? (r.value ?? r.label ?? '') : (r ?? ''));
export const remarkLabel = (r) => REMARK_LABELS[remarkRaw(r)] ?? (r?.label ?? remarkRaw(r));
const remarkTone = (v) =>
    v.startsWith('delinquent') ? 'red' : v.startsWith('past due') ? 'amber' : v.startsWith('excused') ? 'blue' : 'gray';

export const formatDate = (iso) => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
};

// UTC arithmetic so a local timezone can never shift the calendar day.
const shiftDay = (iso, delta) => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
};

function compareRows(field, dir, rowKey) {
    const m = dir === 'desc' ? -1 : 1;
    return (a, b) => {
        const x = a[field];
        const y = b[field];
        if (x == null && y == null) return String(rowKey(a)).localeCompare(String(rowKey(b)));
        if (x == null) return 1;                       // nulls last in both directions
        if (y == null) return -1;
        const c = (typeof x === 'number' && typeof y === 'number')
            ? (x - y) * m
            : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' }) * m;
        return c !== 0 ? c : String(rowKey(a)).localeCompare(String(rowKey(b)));   // stable pages
    };
}

// The whole client-side view pipeline: local filter -> hide-empty -> search -> sort. Pure, so it's testable.
export function viewRows(rows, levelCfg, { search, sortBy, sortDir, hideEmpty, rowFilter }) {
    let list = rows;
    if (rowFilter) list = list.filter(rowFilter);
    if (hideEmpty && levelCfg.countKey) list = list.filter(r => (r[levelCfg.countKey] ?? 0) > 0);
    const needle = (search ?? '').trim().toLowerCase();
    if (needle) list = list.filter(r => levelCfg.searchText(r).toLowerCase().includes(needle));
    return [...list].sort(compareRows(sortBy, sortDir, levelCfg.rowKey));
}

// Columns that are all-null (e.g. a value the SQL function doesn't return) are hidden, not shown blank.
export function visibleColumns(levelCfg, rows) {
    return levelCfg.columns.filter(c => !c.hideIfAllNull || rows.some(r => r[c.key] != null));
}

const templateFor = (cols, withChevron) =>
    cols.map(c => c.track ?? DEFAULT_TRACK[c.type] ?? DEFAULT_TRACK.text).join(' ') + (withChevron ? ` ${CHEVRON_TRACK}` : '');

// Current filter values, read from the URL with config defaults.
function readFilters(config, qs) {
    const v = {};
    for (const f of config.filters) {
        if (f.kind === 'date') v[f.key] = str(qs[f.key]);
        else if (f.kind === 'select') v[f.key] = str(qs[f.key]) ?? f.default;
        else if (f.kind === 'compare') {
            v[f.key] = str(qs[f.key]) ?? String(f.default.value);
            v[f.operatorKey] = str(qs[f.operatorKey]) ?? f.default.operator;
        } else if (f.kind === 'checkbox') {
            const raw = str(qs[f.key]);
            v[f.key] = raw === undefined ? f.default : raw === '1';
        } else if (f.kind === 'dataSelect') {
            v[f.key] = str(qs[f.key]) ?? 'all';
        }
    }
    return v;
}

// Only filters the URL actually carries go to the server — the server applies its own defaults.
function serverParams(config, qs) {
    const p = {};
    for (const f of config.filters) {
        if (f.local || f.kind === 'dataSelect') continue;
        p[f.key] = str(qs[f.key]);
        if (f.operatorKey) p[f.operatorKey] = str(qs[f.operatorKey]);
    }
    return p;
}

// Same trick as the Loan Application v2 list: measure the container, not the viewport.
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

// ── Lookups for the Branch / Loan officer pickers ────────────────────────────
// Endpoints and shapes are the ones the client list toolbar already uses (branches/list, users/list?branchCode).
// Access is still enforced by the report API: picking something out of scope returns "no access".

const byLabel = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
const ROOT_BRANCHES = { list: null };
const LO_CACHE = new Map();

function useBranchOptions(scope, enabled) {
    const [, force] = useReducer(x => x + 1, 0);
    // Supervisors get their list from the report response; root (allowedBranches === null) needs the full list.
    const needsFetch = enabled && !!scope && scope.allowedBranches === null && !ROOT_BRANCHES.list;
    useEffect(() => {
        if (!needsFetch) return undefined;
        let alive = true;
        fetchWrapper.get(`${getApiBaseUrl()}branches/list`).then((res) => {
            if (!res?.success) return;
            ROOT_BRANCHES.list = (res.branches ?? []).map(({ _id, code, name }) => ({ _id, code, name }));
            if (alive) force();
        }).catch(() => {});
        return () => { alive = false; };
    }, [needsFetch]);

    if (!enabled || !scope) return [];
    const list = scope.allowedBranches ?? ROOT_BRANCHES.list ?? [];
    return list.map(b => ({ value: b._id, label: `${b.code ?? ''} ${b.name ?? ''}`.trim() })).sort(byLabel);
}

function useLoOptions(branch, enabled) {
    const [, force] = useReducer(x => x + 1, 0);
    const key = branch?._id;
    useEffect(() => {
        if (!enabled || !branch?.code || LO_CACHE.has(key)) return undefined;
        let alive = true;
        fetchWrapper.get(`${getApiBaseUrl()}users/list?${new URLSearchParams({ branchCode: branch.code })}`).then((res) => {
            if (!res?.success) return;
            LO_CACHE.set(key, (res.users ?? [])
                .filter(u => u.role?.rep === 4)
                .map(u => ({ value: u._id, label: `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() }))
                .sort(byLabel));
            if (alive) force();
        }).catch(() => {});
        return () => { alive = false; };
    }, [key, enabled, branch?.code]);
    return enabled ? (LO_CACHE.get(key) ?? []) : [];
}

// ── Presentational pieces (private to this file) ─────────────────────────────

const CHIP_TONES = {
    red: 'bg-red-50 text-red-700 ring-red-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    blue: 'bg-blue-50 text-blue-700 ring-blue-200',
    gray: 'bg-gray-100 text-gray-700 ring-gray-200',
};

function Chip({ tone = 'gray', children }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CHIP_TONES[tone]}`}>
            {children}
        </span>
    );
}

const Dash = () => <span className="text-gray-300">—</span>;

function Cell({ col: c, row }) {
    const v = row[c.key];
    switch (c.type) {
        case 'money':
            return <>{formatPricePhp(v ?? 0)}</>;
        case 'int':
            return <>{v ?? '—'}</>;
        case 'delinquent':
            return v === 'Yes' ? <Chip tone="red">Delinquent</Chip> : <Dash />;
        case 'remarks': {
            const raw = remarkRaw(v);
            return raw ? <Chip tone={remarkTone(raw)}>{remarkLabel(v)}</Chip> : <Dash />;
        }
        default:
            return <>{v ?? '—'}</>;
    }
}

function Breadcrumbs({ crumbs }) {
    if (!crumbs.length) return null;
    return (
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm min-w-0">
            {crumbs.map((c, i) => (
                <React.Fragment key={c.label + i}>
                    {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
                    {c.onClick && !c.active ? (
                        <button type="button" onClick={c.onClick} className="text-teal-700 hover:underline truncate">
                            {c.label}
                        </button>
                    ) : (
                        <span className={`truncate ${c.active ? 'font-semibold text-gray-900' : 'text-gray-500'}`}>{c.label}</span>
                    )}
                </React.Fragment>
            ))}
        </nav>
    );
}

function StatsStrip({ levelCfg, summary, dim }) {
    return (
        <div className={`bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 flex flex-wrap items-baseline gap-x-8 gap-y-2 transition-opacity ${dim ? 'opacity-50' : ''}`}>
            {levelCfg.kpis.map(([key, label, type]) => (
                <div key={key} className="flex items-baseline gap-1.5">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-base font-semibold tabular-nums text-gray-900">
                        {type === 'money' ? formatPricePhp(summary?.[key] ?? 0) : (summary?.[key] ?? 0)}
                    </span>
                </div>
            ))}
        </div>
    );
}

function SkeletonRows({ rows = 8 }) {
    return (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-4 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading">
            {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-6 rounded bg-gray-100" />)}
        </div>
    );
}

function Pager({ total, page, limit, onPage, onLimit }) {
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const from = total === 0 ? 0 : (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);
    const btn = 'inline-flex items-center rounded-md border border-gray-200 bg-white p-1.5 text-gray-600 hover:bg-gray-50 ' +
        'disabled:opacity-40 disabled:cursor-not-allowed';
    return (
        <div className="flex flex-wrap items-center justify-between gap-3 px-1 text-sm text-gray-500">
            <span>{from}–{to} of {total}</span>
            <div className="flex items-center gap-2">
                <select
                    aria-label="Rows per page"
                    value={limit}
                    onChange={e => onLimit(Number(e.target.value))}
                    className="rounded-md border border-gray-200 bg-white py-1.5 pl-3 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                    {PAGE_SIZES.map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
                <button type="button" aria-label="Previous page" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="tabular-nums">{page} / {totalPages}</span>
                <button type="button" aria-label="Next page" className={btn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function DenseTable({ cols, template, denseMin, rowKey, rows, sort, onSort, onOpen }) {
    return (
        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
            {/* Own scroll area so the header row can stay pinned while a long list scrolls. */}
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 340px)', minHeight: 320 }}>
                <div style={{ minWidth: denseMin - 24 }}>
                    <div
                        role="row"
                        className="sticky top-0 z-10 grid items-center gap-3 px-4 py-3 bg-slate-100 border-b border-slate-200 text-xs font-bold uppercase tracking-wide text-slate-600"
                        style={{ gridTemplateColumns: template }}
                    >
                        {cols.map(c => {
                            const active = sort.by === c.key;
                            const align = alignOf(c);
                            return (
                                <div key={c.key} role="columnheader" aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={TEXT_ALIGN[align]}>
                                    <button
                                        type="button"
                                        onClick={() => onSort(c)}
                                        className={`inline-flex w-full items-center gap-1 uppercase hover:text-slate-900 ${JUSTIFY[align]} ${active ? 'text-slate-900' : ''}`}
                                    >
                                        <span className="truncate">{c.label}</span>
                                        {active
                                            ? (sort.dir === 'asc' ? <ArrowUp className="w-3.5 h-3.5 shrink-0" /> : <ArrowDown className="w-3.5 h-3.5 shrink-0" />)
                                            : <ChevronsUpDown className="w-3.5 h-3.5 shrink-0 text-slate-400" />}
                                    </button>
                                </div>
                            );
                        })}
                        {onOpen && <div />}
                    </div>

                    {rows.map(row => (
                        <div
                            key={rowKey(row)}
                            role="row"
                            onClick={onOpen ? () => onOpen(row) : undefined}
                            onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(row); } : undefined}
                            tabIndex={onOpen ? 0 : undefined}
                            className={`grid items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 text-sm text-gray-800 ${onOpen ? 'cursor-pointer hover:bg-teal-50 focus:bg-teal-50 focus:outline-none' : 'hover:bg-gray-50'}`}
                            style={{ gridTemplateColumns: template }}
                        >
                            {cols.map(c => (
                                <div key={c.key} role="cell" className={`truncate ${TEXT_ALIGN[alignOf(c)]} ${isNumeric(c) ? 'tabular-nums' : ''}`}>
                                    <Cell col={c} row={row} />
                                </div>
                            ))}
                            {onOpen && <ChevronRight className="w-4 h-4 text-gray-300" />}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function CompactCards({ levelCfg, cols, rows, onOpen }) {
    const find = (k) => cols.find(c => c.key === k);
    const metrics = levelCfg.card.metrics.map(find).filter(Boolean);
    const chips = levelCfg.card.chips.map(find).filter(Boolean);
    return (
        <div className="space-y-3">
            {rows.map(row => {
                const subtitle = levelCfg.card.subtitle(row);
                const shownChips = chips.filter(c => (c.type === 'delinquent' ? row[c.key] === 'Yes' : !!remarkRaw(row[c.key])));
                return (
                    <div
                        key={levelCfg.rowKey(row)}
                        className={`bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 ${onOpen ? 'cursor-pointer active:bg-gray-50' : ''}`}
                        onClick={onOpen ? () => onOpen(row) : undefined}
                        role={onOpen ? 'button' : undefined}
                        tabIndex={onOpen ? 0 : undefined}
                        onKeyDown={onOpen ? (e) => { if (e.key === 'Enter') onOpen(row); } : undefined}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex items-baseline gap-2">
                                <p className="text-base font-semibold text-gray-900 truncate">{levelCfg.card.title(row)}</p>
                                {subtitle && <p className="text-sm text-gray-500 truncate">{subtitle}</p>}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {shownChips.map(c => <Cell key={c.key} col={c} row={row} />)}
                                {onOpen && <ChevronRight className="w-4 h-4 text-gray-300" />}
                            </div>
                        </div>
                        <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-sm">
                            {metrics.map(c => (
                                <div key={c.key} className="min-w-0">
                                    <dt className="text-xs text-gray-500 truncate">{c.label}</dt>
                                    <dd className="tabular-nums text-gray-900 truncate"><Cell col={c} row={row} /></dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                );
            })}
        </div>
    );
}

// ── Filter controls ──────────────────────────────────────────────────────────

const INPUT = 'rounded-md border border-gray-200 bg-white py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500';

// "Loan balance [≤] [1000]" — one control, two URL params. Typing is local; the URL (and therefore the
// request) only updates after a pause, and never with junk.
function CompareFilter({ f, operator, value, onOperator, onValue }) {
    const [local, setLocal] = useState(String(value));
    const lastPushed = useRef(String(value));

    // Re-sync only on an EXTERNAL change (e.g. "Reset filters"); our own writes are recorded in lastPushed,
    // so a slow route update can never overwrite fast typing.
    useEffect(() => {
        if (String(value) !== lastPushed.current) {
            lastPushed.current = String(value);
            setLocal(String(value));
        }
    }, [value]);

    useEffect(() => {
        const t = setTimeout(() => {
            const n = local.trim();
            if (n === lastPushed.current) return;
            if (n === '' || !Number.isFinite(Number(n)) || Number(n) < 0) return;   // never push junk
            lastPushed.current = n;
            onValue(n);
        }, NUMBER_DEBOUNCE_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [local]);

    return (
        <div className="inline-flex items-center gap-2 text-sm text-gray-600">
            <span>{f.label}</span>
            <select
                aria-label={`${f.label} operator`}
                value={operator}
                onChange={e => onOperator(e.target.value)}
                className={`${INPUT} pl-3 pr-8`}
                style={{ width: 200 }}
            >
                {f.operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input
                type="number"
                min="0"
                inputMode="decimal"
                aria-label={`${f.label} value`}
                value={local}
                onChange={e => setLocal(e.target.value)}
                className={`${INPUT} px-2`}
                style={{ width: 110 }}
            />
        </div>
    );
}

function FilterControl({ f, values, scope, navigate, options }) {
    switch (f.kind) {
        case 'date':
            return (
                <input
                    type="date"
                    aria-label={f.label ?? 'Date'}
                    value={values[f.key] ?? scope?.[f.key] ?? ''}
                    max={scope?.systemDate}
                    onChange={e => navigate({ [f.key]: e.target.value || undefined, page: undefined })}
                    className={`${INPUT} px-3`}
                    style={{ width: 160 }}
                />
            );
        case 'select':
            return (
                <select
                    aria-label={f.label}
                    value={values[f.key]}
                    onChange={e => navigate({ [f.key]: e.target.value === f.default ? undefined : e.target.value, page: undefined })}
                    className={`${INPUT} pl-3 pr-8`}
                    style={{ width: f.width ?? 200 }}
                >
                    {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        case 'compare':
            return (
                <CompareFilter
                    f={f}
                    operator={values[f.operatorKey]}
                    value={values[f.key]}
                    onOperator={op => navigate({ [f.operatorKey]: op, page: undefined })}
                    onValue={n => navigate({ [f.key]: n, page: undefined })}
                />
            );
        case 'dataSelect':
            return (
                <select
                    aria-label={f.label}
                    value={values[f.key]}
                    onChange={e => navigate({ [f.key]: e.target.value === 'all' ? undefined : e.target.value, page: undefined })}
                    className={`${INPUT} pl-3 pr-8`}
                    style={{ width: f.width ?? 170 }}
                >
                    <option value="all">{f.allLabel}</option>
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            );
        case 'checkbox':
            return (
                <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={values[f.key]}
                        onChange={e => navigate({ [f.key]: e.target.checked === f.default ? undefined : (e.target.checked ? '1' : '0'), page: undefined })}
                        className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                    />
                    {f.label}
                </label>
            );
        default:
            return null;
    }
}

// ── The component ────────────────────────────────────────────────────────────

export default function DrilldownReport({ config }) {
    const router = useRouter();
    const currentUser = useSelector(state => state.user.data);

    // URL = single source of truth.
    const qs = router.query;
    const branchId = str(qs.branchId);
    const loId = str(qs.loId);
    const urlSearch = str(qs.q);
    const urlSortBy = str(qs.sortBy);
    const urlSortDir = str(qs.sortDir);
    const showEmpty = str(qs.showEmpty) === '1';
    const page = parseInt(str(qs.page), 10) || 1;
    const limit = PAGE_SIZES.includes(parseInt(str(qs.limit), 10)) ? parseInt(str(qs.limit), 10) : DEFAULT_PAGE_SIZE;

    const filterValues = readFilters(config, qs);
    const dateFilter = config.filters.find(f => f.kind === 'date');
    // Drilling or jumping level also clears the browser-side filters that only make sense for the old level.
    const dataKeys = config.filters.filter(f => f.kind === 'dataSelect').map(f => f.key);
    const reset = { ...RESET, ...Object.fromEntries(dataKeys.map(k => [k, undefined])) };

    // A date that is in the URL must be real; otherwise don't even ask the server.
    const badDate = config.filters.some(f => f.kind === 'date' && str(qs[f.key]) && !isValidDate(str(qs[f.key])));

    // Only things that change WHAT the database returns go to the hook. Sort / search / page /
    // empty-toggle / local filters are applied below, so they never trigger a request.
    const { data, summary, scope, error: queryError, loading, refetch } = useReportQuery({
        endpoint: config.endpoint,
        params: { ...serverParams(config, qs), branchId, loId, all: '1' },
        enabled: router.isReady && !!currentUser?._id && !badDate,
    });
    const error = badDate ? 'The date in this link is not valid.' : queryError;

    // Read the router at call time: debounced URL writes would otherwise merge into a stale query
    // and silently undo a filter change made inside the debounce window.
    const routerRef = useRef(router);
    routerRef.current = router;

    const navigate = useCallback((patch, { push = false } = {}) => {
        const r = routerRef.current;
        const next = { ...r.query, ...patch };
        Object.keys(next).forEach(k => {
            if (next[k] === undefined || next[k] === null || next[k] === '') delete next[k];
        });
        r[push ? 'push' : 'replace']({ pathname: r.pathname, query: next }, undefined, { shallow: true });
    }, []);

    // Search: filtering is instant (local state); only the URL write is debounced.
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        // Re-sync when the router first becomes ready or the user drills (q was cleared).
        // Deliberately NOT keyed on urlSearch, or a slow route update would overwrite fast typing.
        if (router.isReady) setSearchInput(str(router.query.q) ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady, branchId, loId]);

    useEffect(() => {
        if (!router.isReady) return undefined;
        const next = searchInput.trim();
        if (next === (urlSearch ?? '')) return undefined;
        const t = setTimeout(() => navigate({ q: next || undefined }), URL_DEBOUNCE_MS);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchInput]);

    // Everything below renders from `scope` (same response as `data`), never from the URL, so rows
    // and columns can't disagree for a frame while a drill-down loads.
    const level = scope?.level;
    const levelCfg = level ? config.levels[level] : null;
    const firstLoad = !scope && !error;
    const hideEmpty = !showEmpty;

    const cols = useMemo(() => (levelCfg ? visibleColumns(levelCfg, data) : []), [levelCfg, data]);

    const sort = useMemo(() => {
        const valid = levelCfg && levelCfg.columns.some(c => c.key === urlSortBy);
        return valid
            ? { by: urlSortBy, dir: urlSortDir === 'desc' ? 'desc' : 'asc' }
            : { by: scope?.sort?.by, dir: scope?.sort?.dir ?? 'asc' };
    }, [levelCfg, urlSortBy, urlSortDir, scope]);

    // Data-derived filters (group, cycle, ...): options come from the rows on screen. A URL value that isn't
    // one of them any more (other LO, old link) is ignored rather than silently hiding everything.
    const dataFilters = useMemo(() => {
        if (!levelCfg) return [];
        return config.filters
            .filter(f => f.kind === 'dataSelect' && (!f.levels || f.levels.includes(level)))
            .map(f => ({ f, options: f.options(data) }));
    }, [config, levelCfg, level, data]);
    const dataOptions = Object.fromEntries(dataFilters.map(({ f, options }) => [f.key, options]));
    const activeData = dataFilters
        .map(({ f, options }) => ({ f, v: filterValues[f.key], ok: options.some(o => o.value === filterValues[f.key]) }))
        .filter(a => a.v !== 'all' && a.ok);
    // The select shows the effective value, so a stale URL value reads "All", not a blank option.
    dataFilters.forEach(({ f, options }) => {
        if (!options.some(o => o.value === filterValues[f.key])) filterValues[f.key] = 'all';
    });

    // Local filters are part of the view key via their serialised value.
    const localKey = JSON.stringify([
        ...config.filters.filter(f => f.local).map(f => filterValues[f.key]),
        ...activeData.map(a => a.v),
    ]);
    const visible = useMemo(() => {
        if (!levelCfg) return [];
        const rowFilter = (row) =>
            (!config.rowFilter || config.rowFilter(row, level, filterValues))
            && activeData.every(({ f, v }) => f.match(row, v));
        return viewRows(data, levelCfg, { search: searchInput, sortBy: sort.by, sortDir: sort.dir, hideEmpty, rowFilter });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [levelCfg, data, level, searchInput, sort.by, sort.dir, hideEmpty, localKey]);

    const totalPages = Math.max(1, Math.ceil(visible.length / limit));
    const safePage = Math.min(page, totalPages);
    const pageRows = visible.slice((safePage - 1) * limit, safePage * limit);

    const [containerRef, width] = useContainerWidth();
    const dense = !levelCfg ? true : (width === null
        ? (typeof window !== 'undefined' ? window.innerWidth >= 1100 : true)
        : width >= levelCfg.denseMin);

    const openRow = levelCfg?.drill ? (row) => navigate({ ...levelCfg.drill(row), ...reset }, { push: true }) : null;

    const onSort = (c) => {
        const dir = sort.by === c.key ? (sort.dir === 'asc' ? 'desc' : 'asc') : (isNumeric(c) ? 'desc' : 'asc');
        navigate({ sortBy: c.key, sortDir: dir, page: undefined });
    };

    // Breadcrumbs: only levels this role can reach (scope.topLevel) are links.
    const crumbs = [];
    if (scope) {
        const top = LEVEL_RANK[scope.topLevel ?? 'branch'];
        if (top <= LEVEL_RANK.branch) {
            crumbs.push({
                label: 'All branches',
                active: level === 'branch',
                onClick: () => navigate({ branchId: undefined, loId: undefined, ...reset }, { push: true }),
            });
        }
        if (level !== 'branch' && scope.branch && top <= LEVEL_RANK.lo) {
            crumbs.push({
                label: scope.branch.name,
                active: level === 'lo',
                onClick: () => navigate({ branchId: scope.branch._id, loId: undefined, ...reset }, { push: true }),
            });
        }
        if (level === 'client' && scope.lo) crumbs.push({ label: scope.lo.name, active: true });
    }

    // Branch / Loan officer pickers (lateral moves). Nothing to pick for rep 3 / rep 4 or a one-branch supervisor.
    const pickers = config.scopeSelectors ?? [];
    const canLeaveLo = !!scope && scope.topLevel !== 'client';
    const branchOptions = useBranchOptions(scope, pickers.includes('branch') && canLeaveLo);
    const loOptions = useLoOptions(scope?.branch, pickers.includes('lo') && level === 'client' && canLeaveLo);
    const showBranchPicker = level !== 'branch' && branchOptions.length > 1;   // at branch level the table IS the list
    const showLoPicker = loOptions.length > 1 && !!scope?.lo;

    const needle = searchInput.trim();

    let body;
    if (error) {
        body = (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-8 flex flex-col items-center text-center gap-3" role="alert">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
                <p className="text-sm text-gray-700">{error}</p>
                <div className="flex gap-2 text-sm">
                    {!badDate && (
                        <button type="button" onClick={refetch} className="rounded-md bg-teal-600 px-3 py-1.5 text-white hover:bg-teal-700">Retry</button>
                    )}
                    <button
                        type="button"
                        onClick={() => routerRef.current.replace({ pathname: routerRef.current.pathname }, undefined, { shallow: true })}
                        className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
                    >
                        Reset filters
                    </button>
                </div>
            </div>
        );
    } else if (firstLoad || !levelCfg) {
        body = <SkeletonRows />;
    } else if (visible.length === 0 && !loading) {
        const hiddenCount = hideEmpty && levelCfg.countKey && !needle ? data.length : 0;
        body = (
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm py-14 flex flex-col items-center gap-2 text-center">
                <Inbox className="w-7 h-7 text-gray-300" />
                <p className="text-sm font-medium text-gray-700">
                    {needle ? `No ${levelCfg.noun} match “${needle}”` : config.emptyTitle(scope)}
                </p>
                <div className="mt-1 flex gap-2 text-sm">
                    {!needle && dateFilter && (
                        <button type="button" onClick={() => navigate({ [dateFilter.key]: shiftDay(scope[dateFilter.key], -1), page: undefined })} className="rounded-md border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50">
                            Previous day
                        </button>
                    )}
                    {hiddenCount > 0 && (
                        <button type="button" onClick={() => navigate({ showEmpty: '1', page: undefined })} className="rounded-md border border-gray-200 px-3 py-1 text-gray-700 hover:bg-gray-50">
                            Show all {hiddenCount} {levelCfg.noun}
                        </button>
                    )}
                </div>
            </div>
        );
    } else {
        body = (
            <div className={`space-y-3 transition-opacity ${loading ? 'opacity-50 pointer-events-none' : ''}`}>
                {dense
                    ? (
                        <DenseTable
                            cols={cols}
                            template={templateFor(cols, !!openRow)}
                            denseMin={levelCfg.denseMin}
                            rowKey={levelCfg.rowKey}
                            rows={pageRows}
                            sort={sort}
                            onSort={onSort}
                            onOpen={openRow}
                        />
                    )
                    : <CompactCards levelCfg={levelCfg} cols={cols} rows={pageRows} onOpen={openRow} />}
                <Pager
                    total={visible.length}
                    page={safePage}
                    limit={limit}
                    onPage={(p) => navigate({ page: p === 1 ? undefined : p })}
                    onLimit={(n) => navigate({ limit: n === DEFAULT_PAGE_SIZE ? undefined : n, page: undefined })}
                />
            </div>
        );
    }

    return (
        // The page title is already shown by the top HeaderComponent, so no h1 here.
        <div className="p-4 space-y-3" ref={containerRef}>
            {/* Toolbar: row 1 = where am I + search, row 2 = filters. Wraps cleanly (flex-basis, no breakpoints). */}
            <div className="bg-white rounded-lg border border-gray-100 shadow-sm px-4 py-3 space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div style={{ flex: '1 1 220px', minWidth: 0 }}><Breadcrumbs crumbs={crumbs} /></div>

                    <div className="relative" style={{ flex: '1 1 240px', maxWidth: 360 }}>
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={e => { setSearchInput(e.target.value); if (page !== 1) navigate({ page: undefined }); }}
                            placeholder={levelCfg?.searchPlaceholder ?? 'Search…'}
                            aria-label="Search"
                            className={`${INPUT} w-full pl-9 pr-3`}
                        />
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pt-3 border-t border-gray-100">
                    {showBranchPicker && (
                        <select
                            aria-label="Branch"
                            value={scope?.branch?._id ?? ''}
                            onChange={e => navigate({ branchId: e.target.value || undefined, loId: undefined, ...reset }, { push: true })}
                            className={`${INPUT} pl-3 pr-8`}
                            style={{ width: 220 }}
                        >
                            {scope.topLevel === 'branch' && <option value="">All branches</option>}
                            {branchOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}

                    {showLoPicker && (
                        <select
                            aria-label="Loan officer"
                            value={scope.lo._id}
                            onChange={e => navigate({ loId: e.target.value, ...reset }, { push: true })}
                            className={`${INPUT} pl-3 pr-8`}
                            style={{ width: 200 }}
                        >
                            {loOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}

                    {config.filters
                        .filter(f => !f.levels || (level && f.levels.includes(level)))
                        .filter(f => f.kind !== 'dataSelect' || (dataOptions[f.key]?.length ?? 0) > 1)
                        .map(f => (
                            <FilterControl key={f.key} f={f} values={filterValues} scope={scope} navigate={navigate} options={dataOptions[f.key]} />
                        ))}

                    {levelCfg?.countKey && (
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={hideEmpty}
                                onChange={e => navigate({ showEmpty: e.target.checked ? undefined : '1', page: undefined })}
                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                            />
                            Hide empty
                        </label>
                    )}
                </div>
            </div>

            {levelCfg && !error && <StatsStrip levelCfg={levelCfg} summary={summary} dim={loading} />}

            {body}
        </div>
    );
}