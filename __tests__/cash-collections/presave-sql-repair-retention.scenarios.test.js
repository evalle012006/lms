/**
 * Scenario suite #3: findings from the production SQL / code review.
 *
 *  X. get_pre_save_collection_data (real SQL ported below): why a lost cc row for a CLOSED loan is never healed,
 *     while a lost row for an ACTIVE loan silently comes back as a placeholder.
 *  Y. transfer-client/repair.js (admin "Repair" button) – deletes / duplicates / junk inserts.
 *  Z. cronjobs/clean-up-loan-history – the 3-day retention that limits rollback and post-mortem evidence.
 *
 * REAL handlers: saveV2, pre-save-collections, repair, clean-up-loan-history. Fake Hasura: __mocks__/cc-harness.js
 * Tags: [OK] healthy · [REPRO] demonstrates a defect/hazard · [GUARD] a protection that must keep working
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
jest.mock('node_modules/moment/moment', () => require('moment'), { virtual: true });
jest.mock('@/pages/api/v2/transactions/cash-collections/update-pending-loans', () => ({ savePendingLoans: jest.fn() }));
jest.mock('@/lib/graph.functions', () => {
    const h = require('../../__mocks__/cc-harness');
    const find = (table) => async (where) => h.db[table].filter(r => h.match(r, where)).map(h.clone);
    return {
        findGroups: find('groups'), findBranches: find('branches'), findClients: find('client'),
        findLoans: find('loans'), findCashCollections: find('cashCollections'), findTransferClients: find('transferClients'),
        findUserById: async (id) => ({ _id: id, firstName: 'Test', lastName: 'User', role: { rep: 4 } }),
    };
});

const h = require('../../__mocks__/cc-harness');
const saveV2 = require('@/pages/api/v2/transactions/cash-collections/saveV2').default;
const preSaveH = require('@/pages/api/v2/transactions/cash-collections/pre-save-collections').default;
const repairH = require('@/pages/api/v2/transactions/transfer-client/repair').default;
const cleanupH = require('@/pages/api/v2/cronjobs/clean-up-loan-history').default;

const HAWK = 'grp-hawk', BLUE = 'grp-blue', BRANCH = 'br-1', LO = 'lo-1', CLIENT = 'cl-1', LOAN = 'loan-1', DAY = '2026-10-26';

const mkRes = () => ({
    code: null, data: null,
    status(c) { this.code = c; return this; }, setHeader() { return this; },
    end(s) { this.data = JSON.parse(s); return this; }, json(b) { this.data = b; return this; }, send(b) { this.data = b; return this; },
});
const ccOn = (date = DAY, f = () => true) => h.db.cashCollections.filter(c => String(c.dateAdded).slice(0, 10) === date && f(c));
const view = () => h.viewRows({ curr_date: DAY, curr_type: 'current', group_id: HAWK });
const loan = (id = LOAN) => h.db.loans.find(l => l._id === id);
const dropCC = (id) => h.db.cashCollections.splice(h.db.cashCollections.findIndex(c => c._id === id), 1);

function seed({ preSave = true, occurence = 'weekly' } = {}) {
    h.db.branches.push({ _id: BRANCH, name: 'B', areaId: 'a', regionId: 'r', divisionId: 'd' });
    h.db.groups.push({ _id: HAWK, name: 'HAWK', loanOfficerId: LO, noOfClients: 3, capacity: 30, status: 'available', availableSlots: [], occurence });
    h.db.client.push({ _id: CLIENT, firstName: 'C1', lastName: 'X', groupId: HAWK, loId: LO, status: 'active' });
    h.db.loans.push({
        _id: LOAN, clientId: CLIENT, groupId: HAWK, loId: LO, status: 'active', startDate: '2026-10-24', transfer: true, slotNo: 1,
        loanBalance: 4000, amountRelease: 4000, activeLoan: 700, occurence, mispayment: 0, mcbu: 0, mcbuCollection: 0,
        loanCycle: 2, history: { amountRelease: 4000 },
    });
    if (preSave) h.db.cashCollections.push({ _id: 'pre-1', clientId: CLIENT, groupId: HAWK, loanId: LOAN, dateAdded: DAY, origin: 'pre-save', status: 'active', loanBalance: 4000 });
}
const row = (o = {}) => ({
    _id: 'pre-1', clientId: CLIENT, groupId: HAWK, loanId: LOAN, branchId: BRANCH, loId: LO, slotNo: 1, fullName: 'C1 X',
    status: 'completed', draft: false, loanBalance: 0, paymentCollection: 4000, remarks: { value: 'offset' }, closeRemarks: { value: 'offset' },
    clientStatus: 'offset', mcbuCol: 0, mcbu: 0, mcbuWithdrawal: 0, history: { loanBalance: 0 }, noOfPayments: 1, loanTerms: 12,
    groupName: 'HAWK', dateAdded: DAY, ...o,
});
const noId = (r) => { const c = { ...r }; delete c._id; return c; };
const save = async (collection, date = DAY) => {
    const res = mkRes();
    await saveV2({ auth: { sub: 'u-1' }, body: { currentDate: date, currentTime: '1:24:35 PM', collection } }, res);
    return res;
};
const preSave = async () => { const res = mkRes(); await preSaveH({ body: { loId: LO, currentDate: DAY, mode: 'single' } }, res); return res; };

/** JS port of get_pre_save_collection_data (the SQL supplied from production). */
const sqlPreSave = ({ loId, curr_date }) => h.db.loans
    .filter(l => ['active', 'completed'].includes(l.status)
        && l.loId === loId
        && l.occurence === 'weekly'
        && !h.db.cashCollections.some(cc => cc.clientId === l.clientId && String(cc.dateAdded).slice(0, 10) === curr_date))
    .map(l => ({
        _id: l._id,
        loan: { ...l, groupName: 'HAWK', branchId: BRANCH, noOfPayments: 3, activeLoan: 700, loanTerms: 12, coMaker: 1 },
        group: { occurence: 'weekly', day: 'monday', weeklyScheduleType: 'accelerated' },
    }));

beforeEach(() => {
    h.reset();
    global.__SYSTEM_DATE__ = new Date('2026-10-26T02:00:00Z');
    h.state.preSaveCandidates = (args) => sqlPreSave(args);
    jest.spyOn(global, 'setTimeout').mockImplementation((fn) => { fn(); return 0; });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/* ═════════════════ X. get_pre_save_collection_data semantics ═════════════════ */
describe('X. pre-save SQL', () => {
    test('[GUARD] X1 a client with ANY row for the date (finalized, origin null) gets no placeholder', async () => {
        seed({ preSave: false });
        h.db.cashCollections.push({ _id: 'fin-1', clientId: CLIENT, groupId: HAWK, loanId: LOAN, dateAdded: DAY, status: 'active', origin: null, draft: false });
        await preSave();
        expect(ccOn()).toHaveLength(1);
        expect(ccOn()[0]._id).toBe('fin-1');
    });

    test('[REPRO] X2 offset saved, then its cc row is lost → the CLOSED loan is never re-listed by pre-save: current stays [] for good', async () => {
        seed({ preSave: false });
        await save([noId(row())]);
        expect(loan().status).toBe('closed');
        expect(view()[0].current).toHaveLength(1);                 // healthy right after save
        dropCC(ccOn()[0]._id);                                      // unknown deleter / manual delete
        await preSave();                                            // user reopens the page, pre-save fires
        expect(ccOn()).toHaveLength(0);                             // nothing re-created: loan is closed
        expect(view()).toHaveLength(1);                             // loan is still listed (closedDate = DAY)…
        expect(view()[0].current).toEqual([]);                      // …with a blank `current` = the production symptom
    });

    test('[REPRO] X3 same loss on an ACTIVE loan is silently re-created as a placeholder (so it never shows up as a bug)', async () => {
        seed();
        dropCC('pre-1');
        const res = await preSave();
        expect(res.data.count).toBe(1);
        expect(ccOn()).toHaveLength(1);
        expect(ccOn()[0]).toMatchObject({ origin: 'pre-save', clientId: CLIENT });
        expect(ccOn()[0].draft == null).toBe(true);
    });

    test('[REPRO] X4 the check is per CLIENT not per loan: a stray row from the old (BLUE) group on that day suppresses the weekly placeholder', async () => {
        seed({ preSave: false });
        h.db.cashCollections.push({ _id: 'old-blue', clientId: CLIENT, groupId: BLUE, loanId: 'old-loan', dateAdded: DAY, status: 'closed' });
        await preSave();
        expect(ccOn(DAY, c => c.groupId === HAWK)).toHaveLength(0);
    });

    test('[GUARD] X5 only weekly loans are candidates (daily loans are not pre-saved by this SQL)', async () => {
        seed({ preSave: false, occurence: 'daily' });
        await preSave();
        expect(ccOn()).toHaveLength(0);
    });
});

/* ═════════════════ Y. transfer-client/repair.js ═════════════════ */
describe('Y. repair', () => {
    const TD = '2026-10-23';
    function seedTransfer({ source = [], target = [] } = {}) {
        h.db.transferClients.push({ _id: 't1', approveRejectDate: TD, sameLo: true, loToLo: false, branchToBranch: false });
        h.db.loans.push(
            { _id: 'old-loan', clientId: CLIENT, groupId: BLUE, branchId: BRANCH, loId: LO, slotNo: 1, status: 'closed', transferId: 't1' },
            { _id: 'new-loan', clientId: CLIENT, groupId: HAWK, branchId: BRANCH, loId: LO, slotNo: 5, status: 'active', transferId: 't1' },
        );
        h.db.client.push({ _id: CLIENT, firstName: 'C1', lastName: 'X', groupId: BLUE, loId: LO, status: 'active' });
        source.forEach((s, i) => h.db.cashCollections.push({ _id: `src-${i}`, groupId: BLUE, slotNo: 1, dateAdded: TD, status: 'closed', ...s }));
        target.forEach((s, i) => h.db.cashCollections.push({ _id: `tgt-${i}`, groupId: HAWK, slotNo: 5, dateAdded: TD, status: 'active', ...s }));
    }
    const run = async () => { const res = mkRes(); await repairH({ body: { _id: 't1' } }, res); return res; };

    test('[GUARD] Y1 two source rows (one with null clientId): only the invalid one is deleted, the valid one is marked transferred', async () => {
        seedTransfer({ source: [{ clientId: CLIENT, loanId: 'old-loan' }, { clientId: null }], target: [{ clientId: CLIENT, loanId: 'new-loan' }] });
        const res = await run();
        expect(res.data).toEqual({ success: true });
        const src = h.db.cashCollections.filter(c => c.groupId === BLUE);
        expect(src).toHaveLength(1);
        expect(src[0]).toMatchObject({ _id: 'src-0', transferred: true, transferredDate: TD });
        expect(h.db.client[0].groupId).toBe(HAWK);
    });

    test('[REPRO] Y2 exactly TWO target rows fall into the "no transferCC" branch (check is `> 2`) → a third row is inserted', async () => {
        seedTransfer({ source: [{ clientId: CLIENT, loanId: 'old-loan' }], target: [{ clientId: CLIENT }, { clientId: CLIENT }] });
        await run();
        expect(h.db.cashCollections.filter(c => c.groupId === HAWK && c.slotNo === 5)).toHaveLength(3);
    });

    test('[REPRO] Y3 no source and no target row → repair inserts a junk row with no dateAdded (invisible to every date query)', async () => {
        seedTransfer();
        await run();
        const junk = h.db.cashCollections.filter(c => c.groupId === HAWK);
        expect(junk).toHaveLength(1);
        expect(junk[0].dateAdded == null).toBe(true);
        expect(junk[0]).toMatchObject({ clientId: CLIENT, transfer: true });
    });

    test('[OK] Y4 repair never deletes a valid (clientId set) row, whichever date it is on', async () => {
        seedTransfer({ source: [{ clientId: CLIENT }], target: [{ clientId: CLIENT }] });
        h.db.cashCollections.push({ _id: 'other-day', clientId: CLIENT, groupId: HAWK, slotNo: 5, dateAdded: '2026-10-26', status: 'completed' });
        await run();
        expect(h.db.cashCollections.some(c => c._id === 'other-day')).toBe(true);
        expect(h.db.cashCollections.some(c => c._id === 'src-0')).toBe(true);
    });
});

/* ═════════════════ Z. loans_history retention cron ═════════════════ */
describe('Z. clean-up-loan-history', () => {
    const snap = (id, created_dt) => h.db.loans_history.push({ _id: id, loan_id: LOAN, created_dt });
    const cron = async (scheduled_time) => { const res = mkRes(); await cleanupH({ body: { scheduled_time } }, res); return res; };

    test('[GUARD] Z1 keeps today-3d and newer, purges older (cron at 2026-11-14 PHT keeps the 11-11 snapshots)', async () => {
        snap('s10', '2026-11-10T09:00:00.000Z'); snap('s11', '2026-11-11T09:08:15.000Z'); snap('s13', '2026-11-13T01:00:00.000Z');
        await cron('2026-11-14T06:00:00.000Z');
        expect(h.db.loans_history.map(s => s._id).sort()).toEqual(['s11', 's13']);
    });

    test('[REPRO] Z2 one day later the 11-11 snapshots (the evidence for the 09:08 batch) are gone', async () => {
        snap('s11', '2026-11-11T09:08:15.000Z'); snap('s13', '2026-11-13T01:00:00.000Z');
        await cron('2026-11-15T06:00:00.000Z');
        expect(h.db.loans_history.map(s => s._id)).toEqual(['s13']);
    });

    test('[OK] Z3 the cron date is taken in PHT: 22:00 UTC on 11-14 is already 11-15 in Manila', async () => {
        snap('s11', '2026-11-11T09:08:15.000Z');
        await cron('2026-11-14T22:00:00.000Z');
        expect(h.db.loans_history).toHaveLength(0);
    });
});
