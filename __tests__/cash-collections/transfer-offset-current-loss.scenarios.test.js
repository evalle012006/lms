/**
 * Scenario suite: why a cashCollections row ("current") goes missing after a Daily→Weekly transfer
 * followed by a full-payment (offset / reloaner) on the next transaction date.
 *
 * REAL handlers: saveV2, auto-heal-loans. Data layer: in-memory fake Hasura (__mocks__/cc-harness.js),
 * including a JS port of the get_loans_per_group_cashcollection_collection_day_by_type native query.
 *
 * Tests tagged [REPRO] demonstrate a way `current` ends up blank/hidden. Tests tagged [OK] prove the
 * healthy path. Tests tagged [GUARD] pin negative behaviour (rejections, atomicity).
 */

jest.mock('@/lib/graph/graph.util', () => require('../../__mocks__/cc-harness').graphUtilMock());
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/cc-harness').graphProviderMock());
jest.mock('@/logger', () => ({ __esModule: true, default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h.post || h }));
jest.mock('@/lib/notification-service', () => ({
    notifyLoanOffset: jest.fn(), notifySuccessiveDelinquent: jest.fn(),
    notifyDelinquentAsReloaner: jest.fn(), isNotificationEnabled: jest.fn(),
}));
jest.mock('@/lib/date-utils', () => ({ getSystemDate: () => global.__SYSTEM_DATE__ }));
jest.mock('@/lib/csf-config-server', () => ({ loadCsfEnabled: async () => true }));
jest.mock('@/pages/api/v2/transactions/cash-collections/update-pending-loans', () => ({ savePendingLoans: jest.fn() }));
jest.mock('@/lib/graph.functions', () => {
    const h = require('../../__mocks__/cc-harness');
    const find = (table) => async (where) => h.db[table].filter(r => h.match(r, where)).map(h.clone);
    return {
        findGroups: find('groups'), findBranches: find('branches'), findClients: find('client'),
        findLoans: find('loans'), findCashCollections: find('cashCollections'),
        findUserById: async (id) => ({ _id: id, firstName: 'Test', lastName: 'LO', role: { rep: 4 } }),
    };
});

const h = require('../../__mocks__/cc-harness');
const saveV2 = require('@/pages/api/v2/transactions/cash-collections/saveV2').default;
const autoHeal = require('@/pages/api/v2/transactions/cash-collections/auto-heal-loans').default;

/* ───────── ids / dates ───────── */
const BLUE = 'grp-blue-daily', HAWK = 'grp-hawk-weekly', BRANCH = 'br-1', LO = 'lo-1';
const CLIENT = 'cl-1', OLD_LOAN = 'loan-old-blue', NEW_LOAN = 'loan-new-hawk';
const TRF_DATE = '2026-10-23', TXN_DATE = '2026-10-26';

const flush = () => new Promise(r => setImmediate(r));
const ccOn = (date, where = () => true) => h.db.cashCollections.filter(c => String(c.dateAdded).slice(0, 10) === date && where(c));
const view = (group = HAWK, type = 'current', date = TXN_DATE) => h.viewRows({ curr_date: date, curr_type: type, group_id: group });

function seed({ preSave = true, loanCycleExtras = {} } = {}) {
    h.db.branches.push({ _id: BRANCH, name: 'Branch 1', areaId: 'a', regionId: 'r', divisionId: 'd' });
    h.db.groups.push(
        { _id: BLUE, name: 'BLUE', loanOfficerId: LO, noOfClients: 1, status: 'available', availableSlots: [], occurence: 'daily' },
        { _id: HAWK, name: 'HAWK', loanOfficerId: LO, noOfClients: 3, status: 'available', availableSlots: [], occurence: 'weekly' },
    );
    h.db.client.push({ _id: CLIENT, firstName: 'Ana', lastName: 'Cruz', groupId: HAWK, loId: LO, status: 'active' });
    // old daily loan closed by the transfer
    h.db.loans.push({ _id: OLD_LOAN, clientId: CLIENT, groupId: BLUE, status: 'closed', transferred: true, transferredDate: TRF_DATE, startDate: '2026-09-01', loanBalance: 4000, slotNo: 1, occurence: 'daily' });
    // new weekly loan created in the target group
    h.db.loans.push({
        _id: NEW_LOAN, clientId: CLIENT, groupId: HAWK, status: 'active', transfer: true, startDate: TRF_DATE,
        loanBalance: 4000, amountRelease: 4000, activeLoan: 4000, slotNo: 1, occurence: 'weekly', mispayment: 0,
        mcbu: 0, mcbuCollection: 0, loanCycle: 2, history: { amountRelease: 4000 }, ...loanCycleExtras,
    });
    // rows written by transfer-client/approve-reject.js
    h.db.cashCollections.push(
        { _id: 'trf-target', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TRF_DATE, origin: 'automation-trf', transfer: true, groupStatus: 'closed', status: 'active', loanBalance: 4000 },
        { _id: 'trf-source', clientId: CLIENT, groupId: BLUE, loanId: OLD_LOAN, dateAdded: TRF_DATE, origin: 'automation-trf', transferred: true, groupStatus: 'closed', status: 'closed', loanBalance: 4000 },
    );
    if (preSave) {
        // row written by pre-save-collections.js for the next collection day
        h.db.cashCollections.push({ _id: 'pre-1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, origin: 'pre-save', draft: true, status: 'active', loanBalance: 4000, slotNo: 1 });
    }
}

/** What the page posts for an offset / reloaner full payment. */
function row(overrides = {}) {
    return {
        _id: 'pre-1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, branchId: BRANCH, loId: LO, slotNo: 1,
        fullName: 'Ana Cruz', status: 'completed', draft: false, loanBalance: 0, paymentCollection: 4000,
        remarks: { value: 'offset' }, closeRemarks: { value: 'offset' }, clientStatus: 'offset', mcbuCol: 0, mcbu: 0, mcbuWithdrawal: 0,
        history: { amountRelease: 0, collection: 4000, activeLoan: 0 }, noOfPayments: 1, loanTerms: 15,
        dateAdded: TXN_DATE, ...overrides,
    };
}

const post = async (collection, { date = TXN_DATE } = {}) => {
    const res = { code: null, body: null, status(c) { this.code = c; return this; }, json(b) { this.body = b; return this; } };
    await saveV2({ auth: { sub: 'u-1' }, body: { currentDate: date, currentTime: '10:00:00', collection } }, res);
    return res;
};

beforeEach(() => {
    h.reset();
    global.__SYSTEM_DATE__ = new Date('2026-10-26T02:00:00Z'); // 10:00 Manila
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; }); // skip saveV2 retry sleeps
});
afterEach(() => jest.restoreAllMocks());

/* ═════════════════════════ A. baseline data shape after transfer ═════════════════════════ */
describe('A. state right after the transfer (before any transaction)', () => {
    test('[OK] A1 pre-save row exists on txn date and is surfaced as `current` for HAWK', () => {
        seed();
        const [r] = view();
        expect(r._id).toBe(NEW_LOAN);
        expect(r.current.map(c => c._id)).toEqual(['pre-1']);
    });

    test('[REPRO] A2 without a pre-save row the loan is still listed but `current` is blank', () => {
        seed({ preSave: false });
        const [r] = view();
        expect(r._id).toBe(NEW_LOAN);
        expect(r.current).toEqual([]);                 // exactly the symptom: loan.history only
    });

    test('[OK] A3 old BLUE loan is NOT listed for BLUE on txn date (closed + transferredDate != txn date)', () => {
        seed();
        expect(view(BLUE).map(r => r._id)).not.toContain(OLD_LOAN);
    });

    test('[OK] A4 on the transfer date itself both automation-trf rows exist', () => {
        seed();
        expect(ccOn(TRF_DATE).map(c => c._id).sort()).toEqual(['trf-source', 'trf-target']);
    });
});

/* ═════════════════════════ B. saveV2 positive paths ═════════════════════════ */
describe('B. saveV2 – healthy offset / reloaner on the pre-save row', () => {
    test('[OK] B1 offset updates the pre-save row in place, keeps it for the day, closes loan', async () => {
        seed();
        const res = await post([row()]);
        expect(res.body.success).toBe(true);
        const [cc] = ccOn(TXN_DATE);
        expect(cc._id).toBe('pre-1');
        expect(cc.draft).toBe(false);
        expect(cc.origin).toBeNull();                   // placeholder marker cleared
        expect(cc.status).toBe('closed');
        const loan = h.db.loans.find(l => l._id === NEW_LOAN);
        expect(loan.status).toBe('closed');
        expect(loan.closedDate).toBe(TXN_DATE);
        expect(h.db.client[0].groupId).toBeNull();      // updateClient on offset
    });

    test('[OK] B2 after offset the closed loan is listed (closedDate == txn date) AND current is populated', async () => {
        seed();
        await post([row()]);
        const [r] = view();
        expect(r._id).toBe(NEW_LOAN);
        expect(r.status).toBe('closed');
        expect(r.current).toHaveLength(1);
        expect(r.current[0].loanId).toBe(NEW_LOAN);
    });

    test('[OK] B3 reloaner remark keeps the loan active and the row present', async () => {
        seed();
        const res = await post([row({ status: 'completed', remarks: { value: 'reloaner-cont' }, closeRemarks: undefined, clientStatus: 'active' })]);
        expect(res.body.success).toBe(true);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
        expect(view()[0].current).toHaveLength(1);
    });

    test('[OK] B4 a loans_history snapshot is written before the loan changes (rollback prerequisite)', async () => {
        seed();
        await post([row()]);
        const snap = h.db.loans_history.find(s => s.loan_id === NEW_LOAN);
        expect(snap).toBeDefined();
        expect(snap.data.status).toBe('active');
        expect(snap.data.loanBalance).toBe(4000);
    });

    test('[OK] B5 draft=true then draft=false keeps exactly one row and only the final save touches the loan', async () => {
        seed();
        await post([row({ draft: true, remarks: { value: 'reloaner-cont' }, loanBalance: 4000, status: 'active' })]);
        expect(h.db.loans.find(l => l._id === NEW_LOAN).status).toBe('active');
        expect(ccOn(TXN_DATE)).toHaveLength(1);
        await post([row()]);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
        expect(h.db.loans.find(l => l._id === NEW_LOAN).status).toBe('closed');
    });
});

/* ═════════════════════════ C. saveV2 negative paths that REMOVE / HIDE current ═════════════════════════ */
describe('C. saveV2 – ways the row is lost', () => {
    test('[REPRO] C1 loan id not found → row silently skipped, API still answers success:true', async () => {
        seed();
        const res = await post([row({ loanId: 'loan-does-not-exist' })]);
        expect(res.body.success).toBe(true);            // caller believes it saved
        const stillPlaceholder = ccOn(TXN_DATE)[0];
        expect(stillPlaceholder.draft).toBe(true);      // never updated
        expect(h.db.loans.find(l => l._id === NEW_LOAN).status).toBe('active');
    });

    test('[REPRO] C2 UI sends _id == loanId (blank `current` fallback) and no pre-save row → INSERT with PK = loanId', async () => {
        seed({ preSave: false });
        const res = await post([row({ _id: NEW_LOAN })]);
        expect(res.body.success).toBe(true);
        const [cc] = ccOn(TXN_DATE);
        expect(cc._id).toBe(NEW_LOAN);                  // cc PK collides with loan PK namespace
    });

    test('[REPRO] C3 the same PK = loanId pattern fails on the NEXT collection date (uniqueness) → SAVE_FAILED after 3 tries', async () => {
        seed({ preSave: false, loanCycleExtras: {} });
        await post([row({ _id: NEW_LOAN, remarks: { value: 'reloaner-cont' }, closeRemarks: undefined })]);
        // next weekly date, UI again falls back to _id = loanId
        global.__SYSTEM_DATE__ = new Date('2026-11-02T02:00:00Z');
        const res = await post([row({ _id: NEW_LOAN, dateAdded: '2026-11-02', remarks: { value: 'reloaner-cont' }, closeRemarks: undefined })], { date: '2026-11-02' });
        expect(res.code).toBe(500);
        expect(res.body.errorCode).toBe('SAVE_FAILED');
        expect(ccOn('2026-11-02')).toHaveLength(0);
    });

    test('[REPRO] C4 payload dateAdded from an older day on the UPDATE path moves/keeps the row off the txn date', async () => {
        seed();
        await post([row({ dateAdded: TRF_DATE })]);     // stale value carried by the page state
        const onTxn = ccOn(TXN_DATE).length;
        const onTrf = ccOn(TRF_DATE, c => c._id === 'pre-1').length;
        // Pins what the code really does: report instead of assuming.
        console.info(`[C4] update path with stale dateAdded → rows on txn date: ${onTxn}, moved to transfer date: ${onTrf}`);
        expect(onTxn + onTrf).toBe(1);
    });

    test('[REPRO] C5 stale groupId (BLUE) on the row: `current` survives (lateral is client+date only) but the HAWK `filter` branch loses it', async () => {
        seed();
        await post([row({ groupId: BLUE })]);
        expect(view(HAWK, 'current')[0].current).toHaveLength(1);
        expect(view(HAWK, 'filter').map(r => r._id)).not.toContain('pre-1');
        expect(view(BLUE, 'filter').map(r => r._id)).toContain('pre-1');
    });

    test('[GUARD] C6 date mismatch → 400, nothing written', async () => {
        seed();
        const before = JSON.stringify(h.db);
        const res = await post([row()], { date: '2026-10-25' });
        expect(res.code).toBe(400);
        expect(res.body.errorCode).toBe('DATE_MISMATCH');
        expect(JSON.stringify(h.db)).toBe(before);
    });

    test('[GUARD] C7 persistent Hasura failure → 500 SAVE_FAILED and mutation is atomic (no partial writes)', async () => {
        seed();
        h.setFault({ times: 99, message: 'hasura down' });
        const before = JSON.stringify(h.db);
        const res = await post([row()]);
        expect(res.code).toBe(500);
        expect(res.body.errorCode).toBe('SAVE_FAILED');
        expect(JSON.stringify(h.db)).toBe(before);
    });

    test('[GUARD] C8 one transient failure → retry succeeds, single row, loan closed once', async () => {
        seed();
        h.setFault({ times: 1 });
        const res = await post([row()]);
        expect(res.body.success).toBe(true);
        expect(res.body.attempts).toBe(2);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
    });

    test('[REPRO] C9 response lost AFTER commit on the INSERT path → retry inserts a second row (non-idempotent)', async () => {
        seed({ preSave: false });
        h.setFault({ times: 1, afterCommit: true });
        const res = await post([row({ _id: undefined })]);
        expect(res.body.success).toBe(true);
        expect(ccOn(TXN_DATE).length).toBeGreaterThan(1); // duplicates → later "fixed" by auto-heal (see D)
    });

    test('[GUARD] C10 UPDATE path retry after lost response is idempotent (still one row)', async () => {
        seed();
        h.setFault({ times: 1, afterCommit: true });
        await post([row()]);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
    });

    test('[GUARD] C11 totals rows are ignored', async () => {
        seed();
        const res = await post([row(), { status: 'totals' }]);
        expect(res.body.success).toBe(true);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
    });

    test('[GUARD] C12 collection arriving as JSON string is parsed', async () => {
        seed();
        const res = await post(JSON.stringify([row()]));
        expect(res.body.success).toBe(true);
    });

    test('[GUARD] C13 empty collection is a no-op success', async () => {
        seed();
        const res = await post([]);
        expect(res.body.success).toBe(true);
        expect(ccOn(TXN_DATE)).toHaveLength(1);
    });

    test('[GUARD] C14 row without groupId fails (fixCashCollectionReference) → SAVE_FAILED, placeholder untouched', async () => {
        seed();
        const res = await post([row({ groupId: undefined })]);
        expect(res.code).toBe(500);
        expect(ccOn(TXN_DATE)[0].draft).toBe(true);
    });

    test('[GUARD] C15 row whose group does not exist fails → SAVE_FAILED', async () => {
        seed();
        const res = await post([row({ groupId: 'ghost-group' })]);
        expect(res.code).toBe(500);
    });
});

/* ═════════════════════════ D. auto-heal dedupe ═════════════════════════ */
describe('D. auto-heal-loans removeDoubleCC', () => {
    const run = async () => { await autoHeal({ body: { loId: LO, currentDate: TXN_DATE }, auth: { sub: 'u' } }, { send: jest.fn() }); await flush(); };

    test('[OK] D1 no duplicates → nothing deleted', async () => {
        seed();
        await post([row()]);
        await run();
        expect(ccOn(TXN_DATE)).toHaveLength(1);
    });

    test('[REPRO] D2 duplicate (same client/loan/balance/date) → the LATER row in query order is deleted', async () => {
        seed();
        await post([row()]);                            // real, finalized row (loanBalance 0)
        // a second row for the same client+loan+balance (e.g. duplicate from C9, or a transfer artefact dated the same day)
        h.db.cashCollections.push({ _id: 'dup-placeholder', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, origin: 'pre-save', draft: true, loanBalance: 0 });
        await run();
        expect(ccOn(TXN_DATE).map(c => c._id)).toEqual(['pre-1']);   // later-in-order row is deleted
    });

    test('[REPRO] D3 if a placeholder sorts first, the FINALIZED offset row is the one deleted (finality never compared) → `current` blank', async () => {
        seed();
        await post([row()]);
        // put a same-key placeholder in front of the real row
        h.db.cashCollections.unshift({ _id: 'dup-first', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, origin: 'pre-save', draft: true, loanBalance: 0 });
        await run();
        const left = ccOn(TXN_DATE);
        expect(left.map(c => c._id)).toEqual(['dup-first']);   // the real transaction row was deleted
        expect(left[0].draft).toBe(true);
    });

    test('[REPRO] D4 self-compare bug: paymentCollection is never actually compared (c.x === c.x)', async () => {
        seed();
        h.db.cashCollections.push(
            { _id: 'r1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 100, paymentCollection: 500 },
            { _id: 'r2', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 100, paymentCollection: 999 },
        );
        await run();
        expect(ccOn(TXN_DATE, c => c._id === 'r1' || c._id === 'r2')).toHaveLength(1); // different payments, still "duplicates"
    });

    test('[GUARD] D5 different loanId or different balance are kept', async () => {
        seed();
        h.db.cashCollections.push(
            { _id: 'k1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 100 },
            { _id: 'k2', clientId: CLIENT, groupId: HAWK, loanId: 'other-loan', dateAdded: TXN_DATE, loanBalance: 100 },
            { _id: 'k3', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 50 },
        );
        await run();
        expect(ccOn(TXN_DATE, c => c._id.startsWith('k'))).toHaveLength(3);
    });

    test('[GUARD] D6 only the LO\'s groups with clients, only the given date are touched', async () => {
        seed();
        h.db.cashCollections.push({ _id: 'old-dup', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TRF_DATE, loanBalance: 4000 });
        await run();
        expect(ccOn(TRF_DATE).map(c => c._id)).toContain('old-dup');
    });

    test('[GUARD] D8 groups with noOfClients = 0 are skipped entirely (e.g. last client offset) → duplicates stay', async () => {
        seed();
        h.db.groups.find(g => g._id === HAWK).noOfClients = 0;
        h.db.cashCollections.push(
            { _id: 'z1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 9 },
            { _id: 'z2', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 9 },
        );
        await run();
        expect(ccOn(TXN_DATE, c => c._id.startsWith('z'))).toHaveLength(2);
    });

    test('[REPRO] D7 deletes are fire-and-forget: handler responds before they finish', async () => {
        seed();
        h.db.cashCollections.push(
            { _id: 'x1', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 7 },
            { _id: 'x2', clientId: CLIENT, groupId: HAWK, loanId: NEW_LOAN, dateAdded: TXN_DATE, loanBalance: 7 },
        );
        const send = jest.fn();
        await autoHeal({ body: { loId: LO, currentDate: TXN_DATE }, auth: { sub: 'u' } }, { send });
        expect(send).toHaveBeenCalledWith({ success: true });  // already answered
        await flush();
        expect(ccOn(TXN_DATE, c => c._id.startsWith('x'))).toHaveLength(1);
    });
});

/* ═════════════════════════ E. page mirror: closed-row branch ═════════════════════════ */
describe('E. page `status === "closed"` branch (current.find(transfer !== true))', () => {
    test('[OK] E1 a real row is picked → ids come from the cash collection', async () => {
        seed();
        await post([row()]);
        const p = h.pickCurrentForClosedRow(view()[0]);
        expect(p.usesCurrent).toBe(true);
        expect(p.ccId).toBe('pre-1');
    });

    test('[REPRO] E2b on the transfer date BOTH automation rows are in `current`; the page picks the SOURCE row (old loan id, BLUE group)', () => {
        seed({ preSave: false });
        const rows = h.viewRows({ curr_date: TRF_DATE, curr_type: 'current', group_id: HAWK });
        const p = h.pickCurrentForClosedRow({ ...rows[0], status: 'closed' });
        expect(p.usesCurrent).toBe(true);
        expect(p.ccId).toBe('trf-source');
        expect(p.loanId).toBe(OLD_LOAN);               // wrong loan for a HAWK row → saveV2 snapshot/update hits the closed BLUE loan
    });

    test('[REPRO] E2 only a transfer-flagged row on that date → ignored; falls back to loan id + loan.history', () => {
        seed({ preSave: false });
        h.db.cashCollections = h.db.cashCollections.filter(c => c._id !== 'trf-source'); // only the target-side row exists
        const rows = h.viewRows({ curr_date: TRF_DATE, curr_type: 'current', group_id: HAWK });
        const p = h.pickCurrentForClosedRow({ ...rows[0], status: 'closed' });
        expect(rows[0].current.some(c => c.transfer === true)).toBe(true);
        expect(p.usesCurrent).toBe(false);
        expect(p.ccId).toBe(NEW_LOAN);                  // → next save sends _id == loanId (see C2/C3)
    });

    test('[REPRO] E3 blank current on a closed loan → cc id/loan id both = loan id', () => {
        seed({ preSave: false });
        h.db.loans.find(l => l._id === NEW_LOAN).status = 'closed';
        h.db.loans.find(l => l._id === NEW_LOAN).closedDate = TXN_DATE;
        const p = h.pickCurrentForClosedRow(view()[0]);
        expect(p.usesCurrent).toBe(false);
        expect(p.ccId).toBe(p.loanId);
    });
});

/* ═════════════════════════ F. native query semantics ═════════════════════════ */
describe('F. native query port (get_loans_per_group_cashcollection_collection_day_by_type)', () => {
    test('[OK] F1 rejected loans never listed', () => {
        seed();
        h.db.loans.find(l => l._id === NEW_LOAN).status = 'reject';
        expect(view('HAWK-none')).toEqual([]);
        expect(view().map(r => r._id)).not.toContain(NEW_LOAN);
    });

    test('[OK] F2 loan with future startDate is not listed unless flagged transfer', () => {
        seed();
        const l = h.db.loans.find(x => x._id === NEW_LOAN);
        l.startDate = '2026-11-30'; l.transfer = false;
        expect(view().map(r => r._id)).not.toContain(NEW_LOAN);
        l.transfer = true;
        expect(view().map(r => r._id)).toContain(NEW_LOAN);
    });

    test('[REPRO] F3 closed loan with NULL transferredReleased and fullPaymentDate==date is excluded by SQL three-valued logic (NULL != true)', () => {
        seed({ preSave: false });
        const l = h.db.loans.find(x => x._id === NEW_LOAN);
        Object.assign(l, { status: 'closed', fullPaymentDate: TXN_DATE, closedDate: null, transferredReleased: undefined });
        expect(view().map(r => r._id)).not.toContain(NEW_LOAN);       // vanishes
        l.transferredReleased = false;
        expect(view().map(r => r._id)).toContain(NEW_LOAN);
    });

    test('[OK] F4 closed loan appears via closedDate even if fullPaymentDate is unset', () => {
        seed({ preSave: false });
        Object.assign(h.db.loans.find(x => x._id === NEW_LOAN), { status: 'closed', closedDate: TXN_DATE });
        expect(view().map(r => r._id)).toContain(NEW_LOAN);
    });

    test('[REPRO] F5 closed loan whose closedDate is a DIFFERENT day vanishes from `current`; only the cc `filter` branch can still show it', async () => {
        seed();
        await post([row()]);
        h.db.loans.find(x => x._id === NEW_LOAN).closedDate = '2026-10-27';
        h.db.loans.find(x => x._id === NEW_LOAN).fullPaymentDate = '2026-10-27';
        expect(view(HAWK, 'current').map(r => r._id)).not.toContain(NEW_LOAN);
        expect(view(HAWK, 'filter').map(r => r._id)).toContain('pre-1');
    });

    test('[GUARD] F6 client or group missing → row dropped by the inner joins', () => {
        seed();
        h.db.client.length = 0;
        expect(view()).toEqual([]);
    });

    test('[OK] F7 `current` is NOT scoped by group or loan: another loan\'s row for the same client/date leaks in', () => {
        seed();
        h.db.cashCollections.push({ _id: 'other-grp', clientId: CLIENT, groupId: 'x', loanId: 'zzz', dateAdded: TXN_DATE });
        expect(view()[0].current.map(c => c._id).sort()).toEqual(['other-grp', 'pre-1']);
    });
});
