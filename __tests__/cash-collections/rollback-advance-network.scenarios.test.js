/**
 * Scenario suite #2: rollback → re-transact, slow/failed networks, pre-save races, advance loans,
 * and the submit-validation errors seen after a revert.
 *
 * REAL handlers: saveV2, rollback-transaction, pre-save-collections. Fake Hasura: __mocks__/cc-harness.js
 * Tags: [OK] healthy path · [REPRO] demonstrates a defect/hazard · [GUARD] a protection that must keep working
 */

jest.mock('@/lib/graph/graph.util', () => require('../../__mocks__/cc-harness').graphUtilMock());
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/cc-harness').graphProviderMock());
jest.mock('@/logger', () => ({ __esModule: true, default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h.post || h }));
jest.mock('@/lib/notification-service', () => ({
    notifyLoanOffset: jest.fn(), notifySuccessiveDelinquent: jest.fn(), notifyDelinquentAsReloaner: jest.fn(), isNotificationEnabled: jest.fn(),
}));
jest.mock('@/lib/date-utils', () => ({ getSystemDate: () => global.__SYSTEM_DATE__ }));
jest.mock('@/lib/csf-config-server', () => ({ loadCsfEnabled: async () => true }));
jest.mock('@/lib/utils', () => {
    const h = require('../../__mocks__/cc-harness');
    return { generateUUID: () => h.generateUUID(), safeNumber: (v) => (Number.isFinite(Number(v)) ? Number(v) : 0) };
});
jest.mock('@/lib/mcbu-target-utils', () => ({ resolveWeeklyMcbuMinimum: () => 75 }));
jest.mock('@/lib/mcbu-withdrawal-utils', () => ({ getWeeklyMcbuTargetConfig: async () => ({}) }));
jest.mock('node_modules/apollo-boost/lib/index', () => ({ gql: (strings, ...v) => strings.reduce((a, s, i) => a + s + (v[i] ?? ''), '') }), { virtual: true });
jest.mock('@/pages/api/v2/transactions/cash-collections/update-pending-loans', () => ({ savePendingLoans: jest.fn() }));
jest.mock('@/lib/graph.functions', () => {
    const h = require('../../__mocks__/cc-harness');
    const find = (table) => async (where) => h.db[table].filter(r => h.match(r, where)).map(h.clone);
    return {
        findGroups: find('groups'), findBranches: find('branches'), findClients: find('client'),
        findLoans: find('loans'), findCashCollections: find('cashCollections'),
        findUserById: async (id) => ({ _id: id, firstName: 'Test', lastName: 'User', role: { rep: global.__ROLE_REP__ ?? 4 } }),
    };
});

const h = require('../../__mocks__/cc-harness');
const { savePendingLoans } = require('@/pages/api/v2/transactions/cash-collections/update-pending-loans');
const saveV2 = require('@/pages/api/v2/transactions/cash-collections/saveV2').default;
const rollbackH = require('@/pages/api/v2/transactions/cash-collections/rollback-transaction').default;
const preSaveH = require('@/pages/api/v2/transactions/cash-collections/pre-save-collections').default;

const HAWK = 'grp-hawk', BRANCH = 'br-1', LO = 'lo-1', CLIENT = 'cl-1', LOAN = 'loan-1', DAY = '2026-10-26';

const mkRes = () => ({
    code: null, data: null,
    status(c) { this.code = c; return this; }, setHeader() { return this; },
    end(s) { this.data = JSON.parse(s); return this; }, json(b) { this.data = b; return this; },
});
const ccOn = (date = DAY, f = () => true) => h.db.cashCollections.filter(c => String(c.dateAdded).slice(0, 10) === date && f(c));
const view = () => h.viewRows({ curr_date: DAY, curr_type: 'current', group_id: HAWK });
const loan = (id = LOAN) => h.db.loans.find(l => l._id === id);
const snaps = (id = LOAN) => h.db.loans_history.filter(s => s.loan_id === id);

function addLoan(n, extra = {}) {
    const clientId = n === 1 ? CLIENT : `cl-${n}`, loanId = n === 1 ? LOAN : `loan-${n}`;
    h.db.client.push({ _id: clientId, firstName: `C${n}`, lastName: 'X', groupId: HAWK, loId: LO, status: 'active' });
    h.db.loans.push({
        _id: loanId, clientId, groupId: HAWK, status: 'active', startDate: '2026-10-24', transfer: true, slotNo: n,
        loanBalance: 4000, amountRelease: 4000, activeLoan: 700, occurence: 'weekly', mispayment: 0, mcbu: 0, mcbuCollection: 0,
        loanCycle: 2, history: { amountRelease: 4000 }, ...extra,
    });
    return { clientId, loanId };
}
function seed({ preSave = true, loans = 1 } = {}) {
    h.db.branches.push({ _id: BRANCH, name: 'B', areaId: 'a', regionId: 'r', divisionId: 'd' });
    h.db.groups.push({ _id: HAWK, name: 'HAWK', loanOfficerId: LO, noOfClients: 3, capacity: 30, status: 'available', availableSlots: [], occurence: 'weekly' });
    for (let n = 1; n <= loans; n++) {
        const { clientId, loanId } = addLoan(n);
        if (preSave) h.db.cashCollections.push({ _id: `pre-${n}`, clientId, groupId: HAWK, loanId, dateAdded: DAY, origin: 'pre-save', status: 'active', loanBalance: 4000 });
    }
}
function row(n = 1, o = {}) {
    const clientId = n === 1 ? CLIENT : `cl-${n}`, loanId = n === 1 ? LOAN : `loan-${n}`;
    return {
        _id: `pre-${n}`, clientId, groupId: HAWK, loanId, branchId: BRANCH, loId: LO, slotNo: n, fullName: `C${n} X`,
        status: 'completed', draft: false, loanBalance: 0, paymentCollection: 4000, remarks: { value: 'offset' }, closeRemarks: { value: 'offset' },
        clientStatus: 'offset', mcbuCol: 0, mcbu: 0, mcbuWithdrawal: 0, history: { loanBalance: 0 }, noOfPayments: 1, loanTerms: 12,
        groupName: 'HAWK', dateAdded: DAY, ...o,
    };
}
const noId = (r) => { const c = { ...r }; delete c._id; return c; };
const save = async (collection, date = DAY) => {
    const res = mkRes();
    await saveV2({ auth: { sub: 'u-1' }, body: { currentDate: date, currentTime: '1:24:35 PM', collection } }, res);
    return res;
};
const rollback = async (rows) => { const res = mkRes(); await rollbackH({ auth: { sub: 'u-1' }, body: rows }, res); return res; };
const preSave = async (body = { loId: LO, currentDate: DAY, mode: 'single' }) => { const res = mkRes(); await preSaveH({ body }, res); return res; };
const candidate = (n = 1) => {
    const l = loan(n === 1 ? LOAN : `loan-${n}`);
    return { _id: l._id, loan: { ...l, groupName: 'HAWK', loId: LO, branchId: BRANCH, noOfPayments: 3, activeLoan: 700, loanTerms: 12, coMaker: 1 }, group: { occurence: 'weekly', day: 'monday', weeklyScheduleType: 'accelerated' } };
};

beforeEach(() => {
    h.reset();
    global.__SYSTEM_DATE__ = new Date('2026-10-26T02:00:00Z');
    global.__ROLE_REP__ = 4;
    savePendingLoans.mockClear();
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/* ═════════════════════ R. rollback, then transact again ═════════════════════ */
describe('R. rollback → re-transact', () => {
    test('[OK] R1 rollback of an offset deletes the row, restores loan, client and group slot', async () => {
        seed();
        await save([row()]);
        expect(loan().status).toBe('closed');
        const res = await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(res.data.success).toBe(true);
        expect(ccOn()).toHaveLength(0);
        expect(loan()).toMatchObject({ status: 'active', loanBalance: 4000, reverted: true });
        expect(h.db.client[0].groupId).toBe(HAWK);
        expect(h.db.groups[0]).toMatchObject({ noOfClients: 3, availableSlots: [] });
        expect(snaps()).toHaveLength(0);                       // snapshot consumed
    });

    test('[OK] R2 right after a revert `current` is blank by design (the "first data" in your capture)', async () => {
        seed();
        await save([row()]);
        await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        const [r] = view();
        expect(r._id).toBe(LOAN);
        expect(r.current).toEqual([]);
    });

    test('[OK] R3 transact right after revert with NO _id (stale page) → insert works, one row, origin null', async () => {
        seed();
        await save([row()]);
        await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        const res = await save([noId(row())]);
        expect(res.data.success).toBe(true);
        expect(ccOn()).toHaveLength(1);
        expect(ccOn()[0].origin == null).toBe(true);
        expect(loan().status).toBe('closed');
        expect(view()[0].current).toHaveLength(1);
    });

    test('[REPRO] R4 revert → pre-save runs for the LO → stale page (no _id) submits → TWO rows; placeholder keeps origin="pre-save"', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        const id = ccOn()[0]._id;
        await rollback([{ _id: id, loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        h.state.preSaveCandidates = () => [candidate()];
        expect((await preSave()).data.count).toBe(1);          // placeholder re-created for the reverted loan
        await save([noId(row())]);                              // page still holds the pre-revert state
        const rows = ccOn();
        expect(rows).toHaveLength(2);
        const placeholder = rows.find(r => r.origin === 'pre-save');
        expect(placeholder).toBeDefined();                      // ← "origin still pre-save after submission"
        expect(placeholder.draft == null).toBe(true);
        expect(view()[0].current).toHaveLength(2);
    });

    test('[REPRO] R5 with 2 rows in `current`, the page picks the first one; the SQL array has no ORDER BY, so it can be the empty placeholder', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        const id = ccOn()[0]._id;
        await rollback([{ _id: id, loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        h.state.preSaveCandidates = () => [candidate()];
        await preSave();
        await save([noId(row())]);
        const [r] = view();
        const picked = h.pickCurrentForClosedRow({ ...r, status: 'closed' });
        const placeholder = ccOn().find(c => c.origin === 'pre-save')._id;
        expect(r.current.map(c => c._id)).toContain(placeholder);
        expect(picked.ccId).toBe(placeholder);                  // insertion order here; unspecified in production
    });

    test('[REPRO] R6 rollback payload with _id == loanId (blank-current fallback) deletes NOTHING but still restores the loan → orphan cc row', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        const res = await rollback([{ _id: LOAN, loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(res.data.success).toBe(true);
        expect(loan().status).toBe('active');
        expect(ccOn()).toHaveLength(1);                         // closed cc row remains for an active loan
        expect(ccOn()[0].status).toBe('closed');
    });

    test('[GUARD] R7 no loans_history snapshot (e.g. purged by the 3-day cron) → revert blocked, nothing mutated', async () => {
        seed();
        await save([row()]);
        h.db.loans_history.length = 0;
        const before = JSON.stringify(h.db);
        const res = await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(res.data.success).toBe(false);
        expect(JSON.stringify(h.db)).toBe(before);
    });

    test('[GUARD] R8 branch manager: first revert allowed and stamps bmRevertCount=1; second is blocked', async () => {
        seed();
        global.__ROLE_REP__ = 3;
        await save([row()]);
        const payload = [{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }];
        expect((await rollback(payload)).data.success).toBe(true);
        expect(loan().bmRevertCount).toBe(1);
        await save([noId(row())]);
        const id = ccOn()[0]._id;
        const res = await rollback([{ ...payload[0], _id: id }]);
        expect(res.data.success).toBe(false);
        expect(res.data.message).toMatch(/one-time revert/);
        expect(loan().status).toBe('closed');                   // untouched
    });

    test('[GUARD] R9 empty / non-array body is rejected', async () => {
        seed();
        expect((await rollback([])).data.success).toBe(false);
    });

    test('[REPRO] R10 save that was RETRIED after a lost response → rollback restores the post-save state: loan stays closed, cc deleted', async () => {
        seed();
        h.setFault({ times: 1, afterCommit: true });
        const res = await save([row()]);
        expect(res.data.attempts).toBe(2);
        expect(snaps()).toHaveLength(2);
        const latest = snaps().sort((a, b) => (a.created_dt < b.created_dt ? 1 : -1))[0];
        expect(latest.data.status).toBe('closed');              // the snapshot rollback will pick
        await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(ccOn()).toHaveLength(0);
        expect(loan().status).toBe('closed');                   // "reverted" but still closed → row gone, loan closed
    });

    test('[REPRO] R11 same retry wipes client.oldGroupId/oldLoId → a later revert cannot put the client back in the group', async () => {
        seed();
        h.setFault({ times: 1, afterCommit: true });
        await save([row()]);
        expect(h.db.client[0].oldGroupId).toBeNull();           // normal single save would keep HAWK here
        await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(h.db.client[0].groupId).toBeNull();
    });
});

/* ═════════════════════ S. slow internet / retries / double submit ═════════════════════ */
describe('S. slow or flaky network', () => {
    test('[OK] S0 control: a clean single offset save keeps oldGroupId and one snapshot', async () => {
        seed();
        await save([row()]);
        expect(h.db.client[0].oldGroupId).toBe(HAWK);
        expect(snaps()).toHaveLength(1);
    });

    test('[REPRO] S1 user re-sends the identical reloaner payload after a timeout (UPDATE path) → one row, but loan.mcbuCollection is added twice', async () => {
        seed();
        const r = row(1, { remarks: { value: 'reloaner-cont' }, closeRemarks: undefined, clientStatus: 'active', status: 'active', loanBalance: 3300, mcbuCol: 75 });
        await save([r]);
        expect(loan().mcbuCollection).toBe(75);
        await save([r]);
        expect(ccOn()).toHaveLength(1);
        expect(loan().mcbuCollection).toBe(150);
        expect(snaps()).toHaveLength(2);
    });

    test('[REPRO] S2 re-submit after timeout on the INSERT path (no _id) → duplicate cc rows for the same client/day', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        await save([noId(row())]);
        expect(ccOn()).toHaveLength(2);
    });

    test('[REPRO] S3 identical offset sent twice flips the group slot back (toggle logic) → slot looks occupied although client is offset', async () => {
        seed();
        await save([row()]);
        expect(h.db.groups[0]).toMatchObject({ availableSlots: [1], noOfClients: 2 });
        await save([row()]);
        expect(h.db.groups[0]).toMatchObject({ availableSlots: [], noOfClients: 3 });
    });

    test('[GUARD] S4 request that crosses midnight Manila time is rejected before touching data', async () => {
        seed();
        global.__SYSTEM_DATE__ = new Date('2026-10-26T16:30:00Z'); // 00:30 on the 27th in Manila
        const before = JSON.stringify(h.db);
        const res = await save([row()]);
        expect(res.code).toBe(400);
        expect(res.data.errorCode).toBe('DATE_MISMATCH');
        expect(JSON.stringify(h.db)).toBe(before);
    });

    test('[REPRO] S5 two simultaneous submits (double tap on a slow link), INSERT path → both succeed, 2 rows', async () => {
        seed({ preSave: false });
        const [a, b] = await Promise.all([save([noId(row())]), save([noId(row())])]);
        expect(a.data.success && b.data.success).toBe(true);
        expect(ccOn()).toHaveLength(2);
    });

    test('[GUARD] S6 two simultaneous submits on the UPDATE path leave exactly one row', async () => {
        seed();
        await Promise.all([save([row()]), save([row()])]);
        expect(ccOn()).toHaveLength(1);
    });

    test('[GUARD] S7 total outage (3 attempts fail before commit) → 500 and data untouched, so a manual retry is safe', async () => {
        seed();
        h.setFault({ times: 99 });
        const before = JSON.stringify(h.db);
        const res = await save([row()]);
        expect(res.code).toBe(500);
        expect(JSON.stringify(h.db)).toBe(before);
    });

    test('[REPRO] S8 two offsets in the same group in ONE save: group update is read-modify-write, last one wins → a freed slot is lost', async () => {
        seed({ loans: 2 });
        await save([row(1), row(2)]);
        const g = h.db.groups[0];
        expect([...g.availableSlots].sort()).not.toEqual([1, 2]);  // should free both slots
        expect(g.availableSlots).toHaveLength(1);
    });

    test('[REPRO] S9 insert path discards assignNullValues → boolean flags stay NULL on new rows (update path stores false)', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        const inserted = ccOn()[0];
        expect(inserted.transfer).not.toBe(false);
        h.reset(); seed();
        await save([row()]);
        expect(ccOn()[0].transfer).toBe(false);
    });
});

/* ═════════════════════ P. pre-save-collections ═════════════════════ */
describe('P. pre-save-collections', () => {
    test('[OK] P1 creates placeholders: origin="pre-save", draft unset, payment 0', async () => {
        seed({ preSave: false });
        h.state.preSaveCandidates = () => [candidate()];
        const res = await preSave();
        expect(res.data).toMatchObject({ success: true, count: 1 });
        expect(ccOn()[0]).toMatchObject({ origin: 'pre-save', paymentCollection: 0, groupStatus: 'pending', loanId: LOAN });
        expect(ccOn()[0].draft == null).toBe(true);
    });

    test('[OK] P2 skips clients that already have a pre-save/offline row (the "skippedCount" in your screenshot)', async () => {
        seed();
        h.state.preSaveCandidates = () => [candidate()];
        const res = await preSave();
        expect(res.data).toMatchObject({ skipped: true });
        expect(ccOn()).toHaveLength(1);
    });

    test('[REPRO] P3 run AFTER the row was finalized (origin cleared) → the existing-row check ignores it → second placeholder with origin="pre-save"', async () => {
        seed();
        await save([row()]);
        expect(ccOn()[0].origin == null).toBe(true);
        h.state.preSaveCandidates = () => [candidate()];       // true only if get_pre_save_collection_data still returns this loan
        const res = await preSave();
        expect(res.data.count).toBe(1);
        expect(ccOn().filter(r => r.origin === 'pre-save')).toHaveLength(1);
        expect(ccOn()).toHaveLength(2);
    });

    test('[GUARD] P3b …but if the SQL function excludes loans that already have a row today, nothing is added', async () => {
        seed();
        await save([row()]);
        h.state.preSaveCandidates = () => [];
        expect((await preSave()).data.count).toBe(0);
        expect(ccOn()).toHaveLength(1);
    });

    test('[REPRO] P4 two simultaneous pre-save calls (two tabs / page revisit) → check-then-insert race → duplicates', async () => {
        seed({ preSave: false });
        h.state.preSaveCandidates = () => [candidate()];
        await Promise.all([preSave(), preSave()]);
        expect(ccOn()).toHaveLength(2);
    });

    test('[OK] P5 no candidates → success, count 0, nothing written', async () => {
        seed({ preSave: false });
        const res = await preSave();
        expect(res.data).toMatchObject({ success: true, count: 0 });
        expect(ccOn()).toHaveLength(0);
    });

    test('[GUARD] P6 invalid request → 400', async () => {
        const res = await preSave({ mode: 'single' });
        expect(res.code).toBe(400);
    });

    test('[GUARD] P7 batch: one LO failing does not abort the others', async () => {
        seed({ preSave: false });
        h.state.preSaveCandidates = ({ loId }) => (loId === 'bad' ? new Error('sql down') : [candidate()]);
        const res = await preSave({ mode: 'batch', currentDate: DAY, loanOfficers: [{ loId: 'bad', loName: 'Bad' }, { loId: LO, loName: 'Good' }] });
        expect(res.data).toMatchObject({ successCount: 1, errorCount: 1 });
        expect(ccOn()).toHaveLength(1);
    });

    test('[REPRO] P8 saveV2 update path clears origin; a row that never goes through update (insert path) never loses it', async () => {
        seed();
        await save([row()]);
        expect(ccOn()[0].origin == null).toBe(true);
        h.reset(); seed();
        await save([noId(row())]);                              // insert beside the placeholder
        expect(ccOn().find(r => r._id === 'pre-1').origin).toBe('pre-save');
    });
});

/* ═════════════════════ A. advance loans ═════════════════════ */
describe('A. advance loans', () => {
    test('[OK] A1 advance row is forwarded to savePendingLoans', async () => {
        seed();
        await save([row(1, { status: 'pending', advance: true, loanBalance: 3300, remarks: { value: 'advance payment' } })]);
        expect(savePendingLoans).toHaveBeenCalledTimes(1);
        expect(savePendingLoans.mock.calls[0][1]).toHaveLength(1);
    });

    test('[REPRO] A2 batch mixing a reverted row with an advance row → savePendingLoans is skipped for the whole batch', async () => {
        seed({ loans: 2 });
        await save([row(1, { fromReverted: true }), row(2, { status: 'pending', advance: true, loanBalance: 3300 })]);
        expect(savePendingLoans).not.toHaveBeenCalled();        // the advance loan's pending record is never created
    });

    test('[OK] A3 same batch without a reverted row does create the pending record', async () => {
        seed({ loans: 2 });
        await save([row(1), row(2, { status: 'pending', advance: true, loanBalance: 3300 })]);
        expect(savePendingLoans).toHaveBeenCalledTimes(1);
        expect(savePendingLoans.mock.calls[0][1].map(r => r.loanId)).toEqual(['loan-2']);
    });

    test('[OK] A4 advance rows flagged advance+fromReverted still reach savePendingLoans (guard is `fromReverted && !advance`)', async () => {
        seed();
        await save([row(1, { status: 'pending', advance: true, fromReverted: true, loanBalance: 3300 })]);
        expect(savePendingLoans).toHaveBeenCalledTimes(1);
    });

    test('[REPRO] A5 closed advance loan is listed only on advanceDate; on any other day `current` source disappears', () => {
        seed({ preSave: false });
        Object.assign(loan(), { status: 'closed', advance: true, advanceDate: '2026-10-27', transferredReleased: false });
        expect(view().map(r => r._id)).not.toContain(LOAN);
        loan().advanceDate = DAY;
        expect(view().map(r => r._id)).toContain(LOAN);
        expect(view()[0].current).toEqual([]);
    });

    test('[REPRO] A6 revert of an offset whose loan had advanceDays: snapshot carries advance state back, but cc row for the day is gone', async () => {
        seed();
        loan().advanceDays = 1;
        await save([row(1, { advanceDays: 0 })]);
        await rollback([{ _id: 'pre-1', loanId: LOAN, clientId: CLIENT, status: 'closed', slotNo: 1 }]);
        expect(loan().advanceDays).toBe(1);
        expect(view()[0].current).toEqual([]);
    });
});

/* ═════════════════════ V. submit validation after a revert (page mirror) ═════════════════════ */
describe('V. "full balance" / "Invalid MCBU Collection" errors', () => {
    // slot 5 after revert, from your redux capture
    const slot5 = {
        status: 'active', loanBalance: 5880, paymentCollection: 700, activeLoan: 700, mcbuCol: 0, disableMcbuCol: true,
        remarks: { label: 'For Close/Offset', value: 'offset-good' }, group: { day: 'monday' }, groupDay: 'monday', transferStr: '-',
    };

    test('[REPRO] V1 offset typed with 700 against a 5,880 balance → BOTH errors from your screenshot', () => {
        expect(h.validateRow(slot5).sort()).toEqual(['FULL_BALANCE', 'INVALID_MCBU']);
    });

    test('[OK] V2 paying the full balance (row becomes closed / balance 0) skips the whole block → no errors (what slots 2 & 3 did)', () => {
        expect(h.validateRow({ ...slot5, status: 'closed', loanBalance: 0, paymentCollection: 5880 })).toEqual([]);
    });

    test('[REPRO] V3 while balance > 0 the MCBU error cannot be fixed by the user: the MCBU input is disabled for close-account rows', () => {
        const errs = h.validateRow(slot5);
        expect(errs).toContain('INVALID_MCBU');
        expect(slot5.disableMcbuCol).toBe(true);
    });

    test('[OK] V4 MCBU >= minimum leaves only the full-balance error', () => {
        expect(h.validateRow({ ...slot5, mcbuCol: 75 })).toEqual(['FULL_BALANCE']);
    });

    test.each(['past due', 'past due collection', 'excused-sick', 'delinquent-mcbu'])('[GUARD] V5 remark "%s" is exempt from the MCBU minimum', (v) => {
        expect(h.validateRow({ ...slot5, remarks: { value: v } })).not.toContain('INVALID_MCBU');
    });

    test('[GUARD] V6 non-collection day rows are not checked for MCBU', () => {
        expect(h.validateRow({ ...slot5, groupDay: 'friday', group: { day: 'friday' } })).toEqual([]);
    });

    test('[GUARD] V7 drafts skip validation', () => {
        expect(h.validateRow(slot5, { draft: true })).toEqual([]);
    });
});
