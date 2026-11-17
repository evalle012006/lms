/**
 * pre-save-collections must report what was really written. The insert is ON CONFLICT DO NOTHING on the
 * deterministic row id, so a row that already exists under that id (e.g. one a stale save moved to another
 * date) makes the insert a silent no-op. Self-contained: no shared harness.
 */
const mockApolloQuery = jest.fn();
const mockMutation = jest.fn();
const mockQuery = jest.fn();

jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (name, fields) => (alias) => ({ name, fields, alias }),
    insertQl: (type, data) => ({ kind: 'insert', type, data }),
    queryQl: (type, data) => ({ kind: 'query', type, data }),
}));
jest.mock('@/lib/graph/graph.provider', () => ({
    GraphProvider: class {
        constructor() { this.apollo = { query: (...a) => mockApolloQuery(...a) }; }
        mutation(...a) { return mockMutation(...a); }
        query(...a) { return mockQuery(...a); }
    },
}));
jest.mock('@/services/api-handler', () => ({ apiHandler: (h) => h.post || h }));
jest.mock('@/pages/api/v2/settings/holidays/common', () => ({ holidayType: {} }));
jest.mock('@/lib/date-utils', () => ({ getNonWorkingReason: () => null }));
jest.mock('@/lib/mcbu-target-utils', () => ({ resolveWeeklyMcbuMinimum: () => 75 }));
jest.mock('@/lib/mcbu-withdrawal-utils', () => ({ getWeeklyMcbuTargetConfig: async () => ({}) }));
jest.mock('@/lib/utils', () => ({ generateUUID: () => 'uuid' }));
jest.mock('@/lib/graph.functions', () => ({ findGroups: async () => [] }));
jest.mock('node_modules/apollo-boost/lib/index', () => ({ gql: (s) => s }), { virtual: true });

const handler = require('@/pages/api/v2/transactions/cash-collections/pre-save-collections').default;

const loan = { _id: 'loan-13', clientId: 'cl-13', branchId: 'b', groupId: 'g', groupName: 'HONDA', loId: 'lo-1', slotNo: 13,
    loanCycle: 1, noOfPayments: 11, activeLoan: 500, amountRelease: 6000, loanBalance: 400, loanTerms: 12, mispayment: 0,
    mcbu: 840, csf: 0, status: 'active', pastDue: 0, coMaker: null };
const group = { occurence: 'weekly', day: 'monday', weeklyScheduleType: 'accelerated' };

const run = async () => {
    let body;
    const res = { status() { return this; }, setHeader() { return this; }, end(b) { body = JSON.parse(b); } };
    await handler({ body: { loId: 'lo-1', currentDate: '2026-11-16', mode: 'single' } }, res);
    return body;
};

beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ data: { holidays: [] } });
    mockApolloQuery
        .mockResolvedValueOnce({ data: { collections: [{ _id: loan._id, loan, group }] } })   // get_pre_save_collection_data
        .mockResolvedValueOnce({ data: { cashCollections: [] } });                            // existing rows for the date
});

test('reports the rows actually written', async () => {
    mockMutation.mockResolvedValue({ data: { collections: { affected_rows: 1 } } });
    const out = await run();
    expect(out).toMatchObject({ success: true, count: 1, attemptedCount: 1, conflictCount: 0, message: 'Collections pre-saved successfully' });
});

test('an existing row id makes the insert a no-op and is reported, not hidden behind count 1', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockMutation.mockResolvedValue({ data: { collections: { affected_rows: 0 } } });
    const out = await run();
    expect(out).toMatchObject({ success: true, count: 0, attemptedCount: 1, conflictCount: 1 });
    expect(out.message).toMatch(/skipped because a row with the same id already exists/);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
});

test('falls back to the attempted count when the mutation result has no affected_rows', async () => {
    mockMutation.mockResolvedValue({ data: {} });
    const out = await run();
    expect(out).toMatchObject({ count: 1, attemptedCount: 1, conflictCount: 0 });
});
