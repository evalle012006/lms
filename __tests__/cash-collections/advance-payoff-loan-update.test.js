/**
 * Regression: advance (reloaner) payoff rows. The page sends a fully-paid client who already has a pending
 * reloan as status 'pending', which used to skip updateLoan, so the loan kept its old loanBalance / activeLoan /
 * mcbu / noOfPayments / fullPaymentDate (only savePendingLoans' else branch flipped the status to 'completed').
 *
 * REAL handler: saveV2. Fake Hasura: __mocks__/cc-harness.js
 */

jest.mock('@/lib/graph/graph.util', () => require('../../__mocks__/cc-harness').graphUtilMock());
jest.mock('@/lib/graph/graph.provider', () => require('../../__mocks__/cc-harness').graphProviderMock());
jest.mock('@/logger', () => ({ __esModule: true, default: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h.post || h }));
jest.mock('@/lib/notification-service', () => ({
    notifyLoanOffset: jest.fn(), notifySuccessiveDelinquent: jest.fn(), notifyDelinquentAsReloaner: jest.fn(), isNotificationEnabled: jest.fn(),
}));
jest.mock('@/lib/date-utils', () => ({ getSystemDate: () => global.__SYSTEM_DATE__, getNonWorkingReason: () => null }));
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

const payoff = (n = 1, o = {}) => row(n, {
    status: 'pending', advance: true, loanBalance: 0, paymentCollection: 4000, mcbu: 4065, mcbuCol: 260, noOfPayments: 12,
    remarks: { label: 'Reloaner', value: 'reloaner' }, closeRemarks: '', clientStatus: undefined, ...o,
});

describe('advance payoff rows apply the payoff to the loan', () => {
    test('[OK] P1 pending + advance + balance 0 on an active loan updates the loan like a normal payoff', async () => {
        seed();
        await save([payoff()]);
        expect(loan()).toMatchObject({
            status: 'completed', loanBalance: 0, activeLoan: 0, amountRelease: 0, mcbu: 4065, noOfPayments: 12,
            fullPaymentDate: DAY, lastUpdated: DAY,
        });
        expect(snaps()).toHaveLength(1);
        expect(savePendingLoans).toHaveBeenCalledTimes(1);      // the reloan release still runs afterwards
    });

    test('[GUARD] P2 the reloan release row (its loan is pending) is not treated as a payoff', async () => {
        seed();
        Object.assign(loan(), { status: 'pending', loanBalance: 7200 });
        await save([payoff(1, { loanBalance: 0 })]);
        expect(loan()).toMatchObject({ status: 'pending', loanBalance: 7200 });
    });

    test('[GUARD] P3 advance row with a balance left is not a payoff', async () => {
        seed();
        await save([payoff(1, { loanBalance: 3300, paymentCollection: 700 })]);
        expect(loan()).toMatchObject({ status: 'active', loanBalance: 4000 });
    });

    test('[GUARD] P4 a non-advance full payment still takes the normal path', async () => {
        seed();
        await save([payoff(1, { status: 'completed', advance: false })]);
        expect(loan()).toMatchObject({ status: 'completed', loanBalance: 0, activeLoan: 0 });
    });
});
