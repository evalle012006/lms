const mockMutation = jest.fn();
jest.mock('@/lib/graph/graph.provider', () => ({ GraphProvider: class { mutation(...a) { return mockMutation(...a); } } }));
jest.mock('@/lib/graph/graph.util', () => ({
    createGraphType: (name) => () => ({ name }),
    insertQl: (type, d) => ({ kind: 'insert', ...d }),
}));

const { shouldPersistLog } = require('@/lib/log-filter');
const { buildLorAuditEvents, buildRevertAuditEvents } = require('@/lib/audit-lor');

describe('lms_logs filter', () => {
    test('keeps warn/error, and any entry with a user_id', () => {
        expect(shouldPersistLog({ level: 'error', message: 'x' })).toBe(true);
        expect(shouldPersistLog({ level: 'warn', message: 'x' })).toBe(true);
        expect(shouldPersistLog({ level: 'debug', user_id: 'u1', message: { page: 'p' } })).toBe(true);
        expect(shouldPersistLog({ level: 'debug', message: { user_id: 'u1' } })).toBe(true);
    });
    test('accepts userId as well as user_id', () => {
        expect(shouldPersistLog({ level: 'info', userId: 'u1', page: 'login' })).toBe(true);
        expect(shouldPersistLog({ level: 'debug', message: { userId: 'u1' } })).toBe(true);
    });
    test('drops debug/info noise without a user_id', () => {
        expect(shouldPersistLog({ level: 'debug', message: 'Processing' })).toBe(false);
        expect(shouldPersistLog({ level: 'info', message: { page: 'p' } })).toBe(false);
        expect(shouldPersistLog(null)).toBe(false);
    });
});

describe('LOR audit events', () => {
    const ctx = { transactionId: 't1', currentDate: '2026-11-21', attempts: 1 };
    const row = o => ({ _id: 'cc1', clientId: 'c1', loanId: 'l1', groupId: 'g1', branchId: 'b1', status: 'completed', draft: false, ...o });

    test('summary first, with totals for MCBU/CSF collection and returns', () => {
        const ev = buildLorAuditEvents([row({ mcbuCol: 75, csfCollection: 5, mcbuReturnAmt: 300, csfReturnAmt: 20 }), row({ _id: 'cc2', mcbuCol: 75 })], { ...ctx, draft: false });
        expect(ev[0]).toMatchObject({ action: 'COLLECTION_SUBMITTED', category: 'COLLECTION' });
        expect(ev[0].afterData.totals).toMatchObject({ mcbuCollection: 150, csfCollection: 5, mcbuReturn: 300, csfReturn: 20 });
        expect(ev.some(e => e.category === 'SAVINGS' && e.action === 'SAVINGS_RETURN_OR_WITHDRAWAL')).toBe(true);
    });
    test('offset without close reason and reloaner with balance are flagged WARNING', () => {
        const ev = buildLorAuditEvents([
            row({ remarks: { value: 'offset' }, closeRemarks: null }),
            row({ _id: 'cc2', remarks: { value: 'reloaner-cont' }, loanBalance: 500 }),
        ], ctx);
        expect(ev[0].severity).toBe('WARNING');
        expect(ev[0].metadata.warnings.map(w => w.issue).sort()).toEqual(['offset_without_close_reason', 'reloaner_with_balance']);
        expect(ev.find(e => e.action === 'LOR_OFFSET').severity).toBe('WARNING');
        expect(ev.find(e => e.action === 'LOR_RELOANER').severity).toBe('WARNING');
    });
    test('clean reloaner/offset stay INFO; drafts are labelled', () => {
        const ev = buildLorAuditEvents([row({ remarks: { value: 'offset' }, closeRemarks: 'moved', draft: false }), row({ _id: 'x', remarks: { value: 'reloaner' }, loanBalance: 0 })], { ...ctx, draft: true });
        expect(ev[0].action).toBe('COLLECTION_DRAFT_SAVED');
        expect(ev[0].severity).toBe('INFO');
    });
    test('revert events are typed by what is undone', () => {
        const ev = buildRevertAuditEvents([
            { _id: '1', status: 'closed', remarks: 'offset' },
            { _id: '2', status: 'pending', loanCycle: 3 },
            { _id: '3', status: 'active', remarks: { value: 'reloaner' } },
            { _id: '4', status: 'active' },
        ], { currentDate: '2026-11-21' });
        expect(ev.map(e => e.action)).toEqual(['LOR_REVERT_OFFSET', 'LOR_REVERT_RELOAN', 'LOR_REVERT_RELOANER', 'LOR_REVERT_PAYMENT']);
    });
    test('empty/invalid input does not throw', () => {
        expect(buildLorAuditEvents(null, ctx)[0].action).toBe('COLLECTION_SUBMITTED');
        expect(buildRevertAuditEvents(undefined)).toEqual([]);
    });
});
