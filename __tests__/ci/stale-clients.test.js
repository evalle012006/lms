import moment from 'moment';
import { decideClient, cutoffs } from '@/lib/stale-clients-job';

const now = moment('2026-11-23T12:00:00Z');
const cut = cutoffs(now);
const client = (o = {}) => ({ _id: 'c1', status: 'pending', archived: false, dateAdded: '2026-10-01', ...o });
const app = (o = {}) => ({ promotedAt: '2026-10-01T00:00:00Z', ...o });
const loan = (o = {}) => ({ _id: 'l1', status: 'pending', loanCycle: 1, dateModified: '2026-10-01', ...o });
const run = (c, apps, loans, hasCollections = false) => decideClient({ client: c, apps, loans, hasCollections }, cut);

describe('decideClient', () => {
  test('no loan, idle > 14 days -> exclude', () => {
    expect(run(client(), [app()], []).action).toBe('exclude');
  });
  test('no loan, recent activity -> skip', () => {
    expect(run(client({ dateAdded: '2026-11-20' }), [app({ promotedAt: '2026-11-20' })], []).action).toBe('skip');
  });
  test('reject-only -> exclude', () => {
    expect(run(client(), [app()], [loan({ status: 'reject', loanCycle: 0 })]).action).toBe('exclude');
  });
  test('stale pending loan cycle 1 -> reject and exclude', () => {
    const d = run(client(), [app()], [loan()]);
    expect(d.action).toBe('reject-and-exclude');
    expect(d.rejectLoanIds).toEqual(['l1']);
  });
  test('pending loan modified within 30 days -> skip', () => {
    expect(run(client(), [app()], [loan({ dateModified: '2026-11-10' })]).action).toBe('skip');
  });
  test('pre-approved / LDF-approved pending loan -> skip', () => {
    expect(run(client(), [app()], [loan({ preApproved: true })]).action).toBe('skip');
    expect(run(client(), [app()], [loan({ ldfApproved: true })]).action).toBe('skip');
  });
  test('loan cycle above 1 is never touched', () => {
    expect(run(client(), [app()], [loan({ loanCycle: 2 })]).action).toBe('skip');
  });
  test('active / completed / closed loan is never touched', () => {
    for (const status of ['active', 'completed', 'closed']) {
      expect(run(client(), [app()], [loan({ status })]).action).toBe('skip');
    }
  });
  test('already archived or not pending -> skip', () => {
    expect(run(client({ archived: true }), [app()], []).action).toBe('skip');
    expect(run(client({ status: 'active' }), [app()], []).action).toBe('skip');
  });
  test('legacy client (no application) idle > 14 days -> exclude', () => {
    expect(run(client({ dateAdded: '2024-06-02' }), [], []).action).toBe('exclude');
  });
  test('client flagged duplicate is left for review', () => {
    expect(run(client({ duplicate: true }), [app()], []).reason).toBe('duplicate-review');
  });
  test('client with any collection history is never touched', () => {
    expect(run(client(), [app()], [], true).reason).toBe('has-collections');
  });
});
