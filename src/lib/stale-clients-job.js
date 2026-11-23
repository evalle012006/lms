// Server only. Nightly cleanup of stale PENDING PROSPECT CLIENTS: both clients created by the CI
// promote flow (temporaryLoanApplications.promotedClientId) and legacy / migrated pending clients
// that never went through it. Clients flagged duplicate = true are skipped (they are in duplicate
// review). Excluded works exactly like the manual "Exclude Client" action: archived = true.
//
//   W. any excluded client (archived, still pending; manual or by this job) archived for more than
//      1 month -> wipe (client, its rejected loans, applications, CI investigations, Spaces files)
//   X. pending loan not modified for 30 days (not pre-approved / LDF-approved)
//        -> loan status 'reject' (loanCycle 0, rejectReason set); if every loan the client has is
//           loanCycle 1 the client is excluded as well
//   E. client with NO loan, or ONLY rejected loans, and no activity for 14 days
//        -> excluded (archived)
//
// "Activity" = the latest of: client.dateAdded, application.promotedAt, loan.dateModified/dateAdded.
// Excluded = client.archived = true; this job records archivedBy = EXCLUDER_ID, archivedDate = today.
// Clients with a loan that is active / completed / closed, any loanCycle above 1, or any cash /
// bad-debt collection are never touched.
// Rejecting a loan frees its group slot through the DB trigger from migration 011
// (refresh_group_slots); that migration must be deployed before this runs live.
// dryRun counts and samples everything and changes nothing.

import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, deleteQl } from '@/lib/graph/graph.util';
import { withRetry, describeError } from '@/lib/retry';
import { expandKeys, deleteKeys, APPLICATION_KEY_FIELDS } from '@/lib/stale-application-files';

const graph = new GraphProvider();

export const EXCLUDER_ID = 'system:stale-cleanup';
export const NO_ACTIVITY_DAYS = 14;
export const PENDING_LOAN_DAYS = 30;
export const EXCLUDED_RETENTION_MONTHS = 1;
const SAMPLE_CAP = 100;

// Per-run caps. Excluding is reversible (Restore Client) so its cap is generous; wiping is not, so its
// cap stays small. Override per call ({ wipeCap, excludeCap }) or with STALE_CLIENT_WIPE_CAP /
// STALE_CLIENT_EXCLUDE_CAP. A run that hits a cap stops that stage and reports capped: true.
const envInt = (name, dflt) => { const n = parseInt(process.env[name], 10); return Number.isFinite(n) && n > 0 ? n : dflt; };
export const DEFAULT_EXCLUDE_CAP = () => envInt('STALE_CLIENT_EXCLUDE_CAP', 5000);
export const DEFAULT_WIPE_CAP    = () => envInt('STALE_CLIENT_WIPE_CAP', 500);

/** Legacy ids are Mongo ObjectIds: the first 8 hex digits are the creation time. */
export function objectIdDate(id) {
    if (typeof id !== 'string' || !/^[0-9a-f]{24}$/i.test(id)) return null;
    const m = moment.unix(parseInt(id.slice(0, 8), 16));
    return m.isValid() ? m : null;
}

const CLIENT_KEYS = ['governmentIdPhotoKey', 'selfieWithIdPhotoKey', 'faceEnrollPhotoKey'];
const LOAN_KEYS   = ['disbursementPhotoKey', 'guarantorPhotoKey', 'guarantorIdPhotoKey'];

const APP    = createGraphType('temporaryLoanApplications',
    `_id ciReferenceCode status promotedClientId promotedAt submittedAt ${APPLICATION_KEY_FIELDS.join(' ')}`);
const CLIENT = createGraphType('client',
    `_id fullName status archived archivedBy archivedDate dateAdded duplicate ${CLIENT_KEYS.join(' ')}`);
const LOAN   = createGraphType('loans',
    `_id clientId status loanCycle dateAdded dateModified preApproved ldfApproved ${LOAN_KEYS.join(' ')}`);
const CI     = createGraphType('ciInvestigations', '_id tempApplicationId selfieKey');

export function cutoffs(now = moment()) {
    const n = moment(now);
    return {
        noActivity:  moment(n).subtract(NO_ACTIVITY_DAYS, 'days'),
        pendingLoan: moment(n).subtract(PENDING_LOAN_DAYS, 'days'),
        excluded:    moment(n).subtract(EXCLUDED_RETENTION_MONTHS, 'months'),
    };
}

const latest = (dates) => dates.filter(Boolean).map(d => moment(d)).filter(m => m.isValid())
    .reduce((a, b) => (!a || b.isAfter(a) ? b : a), null);

/**
 * Pure decision for one pending prospect client.
 * Returns { action: 'exclude' | 'reject-and-exclude' | 'reject' | 'skip', rejectLoanIds, reason }.
 */
export function decideClient({ client, apps, loans, hasCollections = false }, cut) {
    const skip = (reason) => ({ action: 'skip', rejectLoanIds: [], reason });
    if (client.status !== 'pending' || client.archived) return skip('not-pending');
    if (client.duplicate) return skip('duplicate-review');
    if (hasCollections) return skip('has-collections');

    const blocking = loans.filter(l => !['pending', 'reject'].includes(l.status));
    if (blocking.length) return skip('has-active-or-closed-loan');
    if (loans.some(l => Number(l.loanCycle) > 1)) return skip('loan-cycle-above-1');

    const pending = loans.filter(l => l.status === 'pending');
    const allCycleOne = loans.every(l => Number(l.loanCycle) === 1 || l.status === 'reject');

    if (pending.length) {
        if (pending.some(l => l.preApproved || l.ldfApproved)) return skip('pre-approved-or-ldf');
        const lastTouch = latest(pending.map(l => l.dateModified || l.dateAdded || objectIdDate(l._id)));
        if (!lastTouch) return skip('pending-loan-no-date');
        if (!lastTouch.isBefore(cut.pendingLoan)) return skip('pending-loan-recent');
        // a loan the client was never approved for: reject it; exclude only if loanCycle 1 throughout
        const cycleOne = pending.every(l => Number(l.loanCycle) === 1);
        return {
            action: cycleOne ? 'reject-and-exclude' : 'reject',
            rejectLoanIds: pending.map(l => l._id),
            reason: 'pending-loan-stale',
        };
    }

    // no loan at all, or only rejected loans
    const touch = latest([
        client.dateAdded,
        ...apps.map(a => a.promotedAt),
        ...loans.map(l => l.dateModified || l.dateAdded || objectIdDate(l._id)),
    ]);
    if (!touch) return skip('no-date');
    if (!touch.isBefore(cut.noActivity)) return skip('recent-activity');
    return { action: 'exclude', rejectLoanIds: [], reason: loans.length ? 'reject-only' : 'no-loan' };
}

const rows = (type, alias, args) => graph.query(queryQl(type(alias), args)).then(r => r.data?.[alias] ?? []);

const group = (list, key) => list.reduce((m, x) => ((m[x[key]] ||= []).push(x), m), {});

const collectionClientIds = async (ids) => {
    const [cc, bd] = await Promise.all([
        rows(createGraphType('cashCollections', '_id clientId'), 'cc', { where: { clientId: { _in: ids } } }),
        rows(createGraphType('badDebtCollections', '_id clientId'), 'bd', { where: { clientId: { _in: ids } } }),
    ]);
    return new Set([...cc, ...bd].map(r => r.clientId));
};

/** Stage E + X. Scan every pending, non-archived client older than the idle window (promoted and legacy). */
async function excludeStage({ dryRun, now, cut, size, maxBatches, cap }) {
    let acted = 0;
    const out = { cap, capped: false, scanned: 0, exclude: 0, rejectAndExclude: 0, rejectOnly: 0, rejectedLoans: 0,
        promoted: 0, legacy: 0, skipped: {}, samples: [] };
    const where = {
        status: { _eq: 'pending' }, archived: { _neq: true },
        dateAdded: { _lt: cut.noActivity.toISOString() },
    };
    let skippedTotal = 0;
    for (let b = 0; b < maxBatches; b++) {
        // live runs exclude what they handle (leaves the filter), so re-read from the start and step over skipped rows
        const offset = dryRun ? b * size : skippedTotal;
        const clients = await rows(CLIENT, 'clients', { where, order_by: [{ dateAdded: 'asc' }], limit: size, offset });
        if (!clients.length) break;

        const ids = clients.map(c => c._id);
        const [apps, loans, withCollections] = await Promise.all([
            rows(APP, 'apps', { where: { promotedClientId: { _in: ids } } }),
            rows(LOAN, 'loans', { where: { clientId: { _in: ids } } }),
            collectionClientIds(ids),
        ]);
        const appsBy = group(apps, 'promotedClientId');
        const loansBy = group(loans, 'clientId');

        const toExclude = [];
        const toReject = [];
        for (const client of clients) {
            if (acted >= cap) { out.capped = true; break; }
            out.scanned++;
            const d = decideClient({
                client, apps: appsBy[client._id] || [], loans: loansBy[client._id] || [],
                hasCollections: withCollections.has(client._id),
            }, cut);
            if (d.action === 'skip') {
                out.skipped[d.reason] = (out.skipped[d.reason] || 0) + 1;
                skippedTotal++;
                continue;
            }
            acted++;
            const source = (appsBy[client._id] || []).length ? 'promoted' : 'legacy';
            out[source]++;
            if (d.action === 'exclude') out.exclude++;
            if (d.action === 'reject-and-exclude') out.rejectAndExclude++;
            if (d.action === 'reject') { out.rejectOnly++; skippedTotal++; }
            out.rejectedLoans += d.rejectLoanIds.length;
            if (d.action !== 'reject') toExclude.push(client._id);
            toReject.push(...d.rejectLoanIds);
            if (out.samples.length < SAMPLE_CAP) out.samples.push({ clientId: client._id, name: client.fullName, source, action: d.action, reason: d.reason });
        }

        if (!dryRun) {
            if (toReject.length) {
                await withRetry(() => graph.mutation(updateQl(LOAN('rejectLoans'), {
                    // re-assert pending so a loan approved since it was read is left alone
                    where: { _id: { _in: toReject }, status: { _eq: 'pending' } },
                    set: {
                        status: 'reject', loanCycle: 0, dateModified: moment(now).format('YYYY-MM-DD'),
                        rejectReason: `Auto-rejected: pending for more than ${PENDING_LOAN_DAYS} days without changes`,
                    },
                })));
            }
            if (toExclude.length) {
                await withRetry(() => graph.mutation(updateQl(CLIENT('excludeClients'), {
                    where: { _id: { _in: toExclude }, status: { _eq: 'pending' }, archived: { _neq: true } },
                    set: { archived: true, archivedBy: EXCLUDER_ID, archivedDate: moment(now).format('YYYY-MM-DD') },
                })));
            }
        }
        if (out.capped || clients.length < size) break;
    }
    return out;
}

/** Stage W. Wipe clients this job excluded more than a month ago. */
async function wipeStage({ dryRun, cut, size, maxBatches, cap }) {
    const out = { cap, capped: false, found: 0, wiped: 0, files: 0, skipped: {}, samples: [] };
    const where = {
        archived: { _eq: true }, status: { _eq: 'pending' },
        archivedDate: { _lt: cut.excluded.toISOString() },
    };
    let skippedTotal = 0;
    for (let b = 0; b < maxBatches; b++) {
        // live runs delete what they handle, so re-read from the start and step over skipped rows
        const offset = dryRun ? b * size : skippedTotal;
        const clients = await rows(CLIENT, 'clients', { where, order_by: [{ archivedDate: 'asc' }], limit: size, offset });
        if (!clients.length) break;

        const ids = clients.map(c => c._id);
        const [loans, apps, withCollections] = await Promise.all([
            rows(LOAN, 'loans', { where: { clientId: { _in: ids } } }),
            rows(APP, 'apps', { where: { promotedClientId: { _in: ids } } }),
            collectionClientIds(ids),
        ]);
        const loansBy = group(loans, 'clientId');
        const appsBy = group(apps, 'promotedClientId');

        // never wipe a client that has a real loan or any collection history
        const safe = clients.filter(c => {
            const why = withCollections.has(c._id) ? 'has-collections'
                : (loansBy[c._id] || []).some(l => l.status !== 'reject') ? 'has-non-rejected-loan' : null;
            if (why) out.skipped[why] = (out.skipped[why] || 0) + 1;
            return !why;
        });
        skippedTotal += clients.length - safe.length;
        const room = cap - out.found;
        if (safe.length > room) { safe.length = Math.max(room, 0); out.capped = true; }
        out.found += safe.length;

        if (safe.length) {
            const safeIds = safe.map(c => c._id);
            const safeApps = safe.flatMap(c => appsBy[c._id] || []);
            const safeLoans = safe.flatMap(c => loansBy[c._id] || []);
            const ci = safeApps.length
                ? await rows(CI, 'ci', { where: { tempApplicationId: { _in: safeApps.map(a => a._id) } } })
                : [];
            const keys = [
                ...safe.flatMap(c => CLIENT_KEYS.map(k => c[k])),
                ...safeApps.flatMap(a => APPLICATION_KEY_FIELDS.map(k => a[k])),
                ...safeLoans.flatMap(l => LOAN_KEYS.map(k => l[k])),
                ...ci.map(c => c.selfieKey),
            ];
            const files = await expandKeys(keys);
            out.files += files.length;
            for (const c of safe) if (out.samples.length < SAMPLE_CAP) out.samples.push({ clientId: c._id, name: c.fullName });

            if (!dryRun) {
                await deleteKeys(files);                 // throws -> rows kept, retried next run
                if (ci.length) await withRetry(() => graph.mutation(deleteQl(CI('delCi'), { _id: { _in: ci.map(c => c._id) } })));
                if (safeApps.length) await withRetry(() => graph.mutation(deleteQl(APP('delApps'), { _id: { _in: safeApps.map(a => a._id) } })));
                if (safeLoans.length) await withRetry(() => graph.mutation(deleteQl(LOAN('delLoans'), { _id: { _in: safeLoans.map(l => l._id) }, status: { _eq: 'reject' } })));
                await withRetry(() => graph.mutation(deleteQl(CLIENT('delClients'), {
                    _id: { _in: safeIds }, archived: { _eq: true },
                })));
                out.wiped += safe.length;
            }
        }
        if (clients.length < size) break;
    }
    return out;
}

export async function runStaleClientCleanup({ dryRun = true, now = moment(), size = 200, maxBatches = 200,
    wipeCap = DEFAULT_WIPE_CAP(), excludeCap = DEFAULT_EXCLUDE_CAP() } = {}) {
    const cut = cutoffs(now);
    const stats = { dryRun, wipe: null, exclude: null, errors: [] };
    const stage = async (name, fn) => {
        try { stats[name] = await fn(); } catch (err) { stats.errors.push(`${name}: ${describeError(err)}`); }
    };
    // wipe first so what is excluded today is not purged today
    await stage('wipe', () => wipeStage({ dryRun, cut, size, maxBatches, cap: wipeCap }));
    await stage('exclude', () => excludeStage({ dryRun, now, cut, size, maxBatches, cap: excludeCap }));
    return stats;
}
