/**
 * In-memory Hasura stand-in for cash-collection scenario tests.
 *
 *  - graphUtilMock()     : queryQl/insertQl/updateQl/deleteQl return plain descriptors
 *  - graphProviderMock() : GraphProvider whose query()/mutation() run against `db`
 *                          (mutations are atomic: any failure restores the snapshot, like one Hasura request)
 *  - collectionDay()     : JS port of the native query get_loans_per_group_cashcollection_collection_day_by_type
 *  - viewRows()          : what get-loan-by-group-cash-collection hands to the page (no QR overlay)
 *  - pickCurrentForClosedRow() : mirror of the page's `cc.status === "closed"` branch (see PAGE_MIRROR note)
 *
 * Handlers under test are the REAL files; only the data layer is replaced.
 */

const TABLES = [
    'cashCollections', 'loans', 'client', 'groups', 'loans_history', 'users', 'branches',
    'denomination', 'qr_cash_collection_entries', 'transactionSettings', 'mcbu_withdrawals', 'transferClients',
];

const db = {};
TABLES.forEach(t => { db[t] = []; });

const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));

let uuidN = 0;
let clockMs = Date.parse('2026-10-26T05:00:00.000Z');
const state = { fault: null, ops: [], queries: [], preSaveCandidates: () => [] };

const generateUUID = () => `gen-${String(++uuidN).padStart(4, '0')}`;
const nowIso = () => new Date(clockMs++).toISOString();
const setNow = (iso) => { clockMs = Date.parse(iso); };

function reset() {
    TABLES.forEach(t => { db[t].length = 0; });
    uuidN = 0;
    clockMs = Date.parse('2026-10-26T05:00:00.000Z');
    state.fault = null;
    state.preSaveCandidates = () => [];
    state.ops.length = 0;
    state.queries.length = 0;
}

/* ───────────── where evaluation (Hasura bool_exp subset, SQL null semantics) ───────────── */
function match(row, where) {
    if (!where) return true;
    return Object.entries(where).every(([k, v]) => {
        if (k === '_and') return v.every(x => match(row, x));
        if (k === '_or') return v.some(x => match(row, x));
        if (k === '_not') return !match(row, v);
        const val = row[k];
        if (v === null || typeof v !== 'object') return val === v;
        return Object.entries(v).every(([op, arg]) => {
            switch (op) {
                case '_eq': return val !== undefined && val !== null && val === arg;
                case '_neq': return val !== undefined && val !== null && val !== arg;
                case '_in': return val !== undefined && val !== null && arg.includes(val);
                case '_nin': return val !== undefined && val !== null && !arg.includes(val);
                case '_gt': return val != null && val > arg;
                case '_gte': return val != null && val >= arg;
                case '_lt': return val != null && val < arg;
                case '_lte': return val != null && val <= arg;
                case '_is_null': return arg ? val == null : val != null;
                default: throw new Error(`fake-hasura: unsupported operator ${op}`);
            }
        });
    });
}

function select(row, fields) {
    if (!fields || /[{}]/.test(fields)) return clone(row);
    const keys = fields.split(/\s+/).filter(Boolean);
    const out = {};
    keys.forEach(k => { if (k in row) out[k] = clone(row[k]); });
    return out;
}

/* ───────────── util mock ───────────── */
function graphUtilMock() {
    const createGraphType = (name, fields) => (alias = name) => ({ name, fields, alias: alias ?? name });
    return {
        createGraphType,
        queryQl: (type, cond = {}) => ({ kind: 'query', type, cond }),
        aggregateQl: (type, aggregate, where) => ({ kind: 'aggregate', type, where }),
        insertQl: (type, data) => ({ kind: 'insert', type, objects: Array.isArray(data.objects) ? data.objects : [data.objects] }),
        updateQl: (type, data) => ({ kind: 'update', type, set: data.set, where: data.where }),
        deleteQl: (type, where) => ({ kind: 'delete', type, where }),
    };
}

/* ───────────── provider mock ───────────── */
function runQuery(stmt) {
    const { type, cond } = stmt;
    state.queries.push({ table: type.name, where: cond.where });
    let rows = db[type.name].filter(r => match(r, cond.where));
    (cond.order_by || []).slice().reverse().forEach(o => {
        const [f, dir] = Object.entries(o)[0];
        rows.sort((a, b) => (a[f] < b[f] ? -1 : a[f] > b[f] ? 1 : 0) * (String(dir).startsWith('desc') ? -1 : 1));
    });
    if (cond.limit) rows = rows.slice(0, cond.limit);
    return rows.map(r => select(r, type.fields));
}

function applyMutation(stmt) {
    const { type } = stmt;
    const table = db[type.name];
    if (!table) throw new Error(`fake-hasura: unknown table ${type.name}`);
    state.ops.push({ kind: stmt.kind, table: type.name, where: stmt.where, set: stmt.set, objects: stmt.objects });

    if (stmt.kind === 'insert') {
        const returning = stmt.objects.map(o => {
            const row = clone(o);
            if (!row._id) row._id = generateUUID();
            if (type.name === 'loans_history' && !row.created_dt) row.created_dt = nowIso();
            if (table.some(r => r._id === row._id)) {
                throw new Error(`Uniqueness violation. duplicate key value violates unique constraint "${type.name}_pkey" (${row._id})`);
            }
            table.push(row);
            return select(row, type.fields);
        });
        return { affected_rows: returning.length, returning };
    }
    if (stmt.kind === 'update') {
        const hit = table.filter(r => match(r, stmt.where));
        hit.forEach(r => Object.assign(r, clone(stmt.set)));
        return { affected_rows: hit.length, returning: hit.map(r => select(r, type.fields)) };
    }
    if (stmt.kind === 'delete') {
        const hit = table.filter(r => match(r, stmt.where));
        hit.forEach(r => table.splice(table.indexOf(r), 1));
        return { affected_rows: hit.length, returning: hit.map(r => select(r, type.fields)) };
    }
    throw new Error(`fake-hasura: unsupported mutation ${stmt.kind}`);
}

function graphProviderMock() {
    class GraphProvider {
        constructor() { this.apollo = { query: jest.fn(async (opts) => apolloQuery(opts)), mutate: jest.fn() }; }

        async query(...stmts) {
            const data = {};
            stmts.forEach(s => {
                if (s.kind === 'aggregate') {
                    data[s.type.alias] = { aggregate: { count: db[s.type.name].filter(r => match(r, s.where)).length } };
                } else {
                    data[s.type.alias] = runQuery(s);
                }
            });
            return { data };
        }

        async mutation(...stmts) {
            const snapshot = clone(db);
            const f = state.fault;
            if (f && f.times > 0 && !f.afterCommit) { f.times--; throw new Error(f.message || 'fake-hasura: injected failure'); }
            try {
                const data = {};
                stmts.forEach(s => { data[s.type.alias] = applyMutation(s); });
                if (f && f.times > 0 && f.afterCommit) { f.times--; throw new Error(f.message || 'fake-hasura: response lost after commit'); }
                return { data };
            } catch (e) {
                if (!(f && f.afterCommit)) {
                    TABLES.forEach(t => { db[t].length = 0; db[t].push(...snapshot[t]); }); // atomic: roll back
                }
                throw e;
            }
        }
    }
    return { GraphProvider };
}

/* apollo.query used directly by pre-save-collections.js */
async function apolloQuery({ query, variables }) {
    await Promise.resolve();
    const q = String(query);
    if (q.includes('get_pre_save_collection_data')) {
        const c = state.preSaveCandidates(variables.args);
        if (c instanceof Error) throw c;
        return { data: { collections: clone(c) } };
    }
    if (q.includes('checkExisting')) {
        const rows = db.cashCollections.filter(c => variables.clientIds.includes(c.clientId)
            && String(c.dateAdded).slice(0, 10) === variables.currentDate
            && ['pre-save', 'offline'].includes(c.origin));
        return { data: { cashCollections: rows.map(r => ({ clientId: r.clientId })) } };
    }
    throw new Error('fake-hasura: unsupported apollo query');
}

/**
 * PAGE_MIRROR (submit validation, cash-collection page ~L1835-1900). Only the rules relevant to
 * offset / MCBU are mirrored. The MCBU checks sit INSIDE the `status==='active' && loanBalance>0` block.
 * weeklyMin = getWeeklyMinMcbu(...) (75 for 'accelerated' in the sample data).
 */
function validateRow(cc, { dayName = 'monday', draft = false, weeklyMin = 75 } = {}) {
    const errs = new Set();
    if (cc.status !== 'totals' && cc.status === 'active' && cc.loanBalance > 0 && !draft && !cc.maturedPD
        && (cc.transferStr == null || cc.transferStr === '-')) {
        if (cc.group.day === dayName
            && parseFloat(cc.loanBalance) && cc.remarks?.value?.startsWith('offset') && !cc.maturedPDPrevTransaction) {
            errs.add('FULL_BALANCE');
        }
        if (cc.mcbuError) errs.add('MCBU_COL_WITHDRAW');
        if (cc.groupDay === dayName || cc.offsetTransFlag) {
            if (!cc.mcbuCol || parseFloat(cc.mcbuCol) < weeklyMin) {
                const v = cc.remarks?.value;
                const exempt = v === 'past due' || v === 'past due collection' || v?.startsWith('excused-') || v?.startsWith('delinquent');
                if (!cc.remarks || !exempt) errs.add('INVALID_MCBU');
            }
        }
    }
    return [...errs];
}

const setFault = (fault) => { state.fault = fault; };

/* ───────────── port of get_loans_per_group_cashcollection_collection_day_by_type ───────────── */
const d = (v) => (v == null ? null : String(v).slice(0, 10));

function collectionDay({ curr_date, curr_type, group_id }) {
    const eq = (a, b) => a != null && b != null && a === b;       // SQL "=" : NULL -> not true
    const loanRows = db.loans
        .filter(l => l.status !== 'reject')
        .filter(l => curr_date >= d(l.startDate)
            || l.transfer === true
            || (l.status === 'closed' && l.transferred === true && d(l.startDate) > curr_date))
        .filter(l => ['completed', 'active'].includes(l.status)
            || (l.status === 'closed' && eq(d(l.fullPaymentDate), curr_date) && l.transferredReleased != null && l.transferredReleased !== true) // NULL != true is NULL
            || (l.status === 'closed' && eq(d(l.closedDate), curr_date))
            || (l.status === 'closed' && l.transferred === true && eq(d(l.transferredDate), curr_date))
            || (l.status === 'closed' && l.advance === true && eq(d(l.advanceDate), curr_date)))
        .map(l => ({ details: clone(l), _id: l._id, loanId: l._id, clientId: l.clientId, groupId: l.groupId, curr_type: 'current' }));

    const ccRows = db.cashCollections
        .filter(cc => d(cc.dateAdded) === curr_date)
        .map(cc => ({ details: clone(cc), _id: cc._id, loanId: cc.loanId ?? null, clientId: cc.clientId, groupId: cc.groupId, curr_type: 'filter' }));

    return [...loanRows, ...ccRows]
        .filter(o => db.client.some(c => c._id === o.clientId))              // inner join client
        .filter(o => db.groups.some(g => g._id === o.groupId))               // inner join groups
        .filter(o => o.groupId === group_id && o.curr_type === curr_type)
        .map(o => {
            const current = db.cashCollections.filter(cc => cc.clientId === o.clientId && d(cc.dateAdded) === curr_date);
            const fp = db.loans.filter(l => l.clientId === o.clientId
                && (['completed', 'closed'].includes(l.status) || l.loanBalance <= 0)
                && eq(d(l.fullPaymentDate), curr_date));
            return {
                _id: o._id,
                data: {
                    ...o,
                    current: current.length ? clone(current) : null,
                    currentRelease: null,
                    fullPayment: fp.length ? [{ _id: o.clientId, fullPaymentAmount: fp.reduce((s, l) => s + Number(l.history?.amountRelease ?? 0), 0), noOfFullPayment: fp.length }] : null,
                    mcbuWithdrawals: null,
                    client: clone(db.client.find(c => c._id === o.clientId)),
                    group: clone(db.groups.find(g => g._id === o.groupId)),
                },
            };
        });
}

/** What the API route returns per row (same mapping as get-loan-by-group-cash-collection.js, minus the QR overlay). */
function viewRows(args) {
    return collectionDay(args).map(r => r.data).map(c => ({
        ...c.details,
        type: c.curr_type,
        client: c.client,
        group: c.group,
        current: c.current ?? [],
        currentRelease: c.currentRelease ?? [],
        fullPayment: c.fullPayment ?? [],
    })).sort((a, b) => a.slotNo - b.slotNo);
}

/**
 * PAGE_MIRROR: mirrors the `cc.status === "closed"` branch of the cash-collection group page
 * (lines ~658-731): the transaction row is found with `current.find(cur => cur?.transfer !== true)`;
 * when nothing is found the row silently falls back to the LOAN id and to loan.history.
 * Keep in sync with the page.
 */
function pickCurrentForClosedRow(cc) {
    const found = cc?.current?.length > 0 ? cc.current.find(cur => cur?.transfer !== true) : undefined;
    return {
        usesCurrent: !!found,
        ccId: found ? found._id : cc._id,
        loanId: found ? found.loanId : cc._id,
        amountsFrom: 'loan.history',          // activeLoan / paymentCollection are always read from cc.history in this branch
        history: cc.history,
    };
}

module.exports = {
    db, reset, clone, state, setFault, setNow, nowIso, generateUUID,
    graphUtilMock, graphProviderMock, collectionDay, viewRows, pickCurrentForClosedRow, validateRow, match,
};
