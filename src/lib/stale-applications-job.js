// Server only. Nightly cleanup of stale PROSPECT LAF applications.
//
//   1. excluded > 1 month            -> wipe  (row + CI investigation + Spaces files)
//   2. pending  > 7 days             -> wipe
//   3. CI approved > 14 days (counted from the approval, i.e. ciInvestigations.investigatedAt,
//      falling back to submittedAt) -> status 'ci_declined' + excludedAt set
//
// Order matters: purge old exclusions first so what step 3 excludes today is not purged today.
// Only clientType = 'prospect' is touched; Reloaner / Balik applications are never selected.
// Files are deleted BEFORE the rows, and a row is kept if its files could not be deleted, so a
// storage failure is retried on the next run instead of orphaning the files.
// dryRun lists and counts everything but changes nothing.

import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, updateQl, deleteQl } from '@/lib/graph/graph.util';
import { withRetry, describeError } from '@/lib/retry';
import { expandKeys, deleteKeys, APPLICATION_KEY_FIELDS } from '@/lib/stale-application-files';

const graph = new GraphProvider();

export const PENDING_RETENTION_DAYS  = 7;
export const APPROVED_RETENTION_DAYS = 14;
export const EXCLUDED_RETENTION_MONTHS = 1;

// excludedAt is added by migration 013. The pending wipe does not select it, so it keeps working
// even if the migration has not been applied yet (the other two steps then report an error).
const BASE_FIELDS = `_id ciReferenceCode clientType status submittedAt ${APPLICATION_KEY_FIELDS.join(' ')}`;
const APP_BASE = createGraphType('temporaryLoanApplications', BASE_FIELDS);
const APP_EXCL = createGraphType('temporaryLoanApplications', `${BASE_FIELDS} excludedAt`);
const CI_TYPE  = createGraphType('ciInvestigations', '_id tempApplicationId ciReferenceCode investigatedAt selfieKey');

const SAMPLE_CAP = 100;

export function cutoffs(now = moment()) {
    const n = moment(now);
    return {
        pending:  moment(n).subtract(PENDING_RETENTION_DAYS, 'days').toISOString(),
        approved: moment(n).subtract(APPROVED_RETENTION_DAYS, 'days').toISOString(),
        excluded: moment(n).subtract(EXCLUDED_RETENTION_MONTHS, 'months').toISOString(),
    };
}

const fetchCiRows = (apps) => graph.query(queryQl(CI_TYPE('ci'), {
    where: { _or: [
        { tempApplicationId: { _in: apps.map(a => a._id) } },
        { ciReferenceCode:   { _in: apps.map(a => a.ciReferenceCode).filter(Boolean) } },
    ] },
})).then(r => r.data?.ci ?? []);

/** Wipe a batch: files first, then CI investigations, then the applications. */
async function wipeBatch(apps, { dryRun, guard }) {
    const ci = await fetchCiRows(apps);
    const keys = [
        ...apps.flatMap(a => APPLICATION_KEY_FIELDS.map(f => a[f])),
        ...ci.map(c => c.selfieKey),
    ];
    const files = await expandKeys(keys);
    if (dryRun) return { apps: apps.length, files: files.length };

    await deleteKeys(files);                       // throws -> rows are kept, retried next run
    if (ci.length) {
        await withRetry(() => graph.mutation(
            deleteQl(CI_TYPE('delCi'), { _id: { _in: ci.map(c => c._id) } })
        ));
    }
    // re-assert the guard so a row that changed state since it was read is left alone
    await withRetry(() => graph.mutation(deleteQl(APP_BASE('delApps'), {
        _and: [{ _id: { _in: apps.map(a => a._id) } }, guard],
    })));
    return { apps: apps.length, files: files.length };
}

/** Page through candidates. Live runs re-read from the start (handled rows vanish); skipped rows advance the offset. */
async function scan({ type, where, size, maxBatches, dryRun, handle, filter }) {
    const out = { found: 0, done: 0, files: 0, skipped: 0, codes: [] };
    let seen = 0;
    for (let b = 0; b < maxBatches; b++) {
        const offset = dryRun ? seen : out.skipped;
        const rows = await graph.query(queryQl(type('rows'), {
            where, order_by: [{ submittedAt: 'asc' }], limit: size, offset,
        })).then(r => r.data?.rows ?? []);
        if (rows.length === 0) break;
        seen += rows.length;

        const batch = filter ? await filter(rows) : rows;
        out.skipped += rows.length - batch.length;
        out.found += batch.length;
        if (batch.length) {
            const r = await handle(batch);
            out.done  += r.apps;
            out.files += r.files ?? 0;
            for (const a of batch) if (out.codes.length < SAMPLE_CAP) out.codes.push(a.ciReferenceCode);
        }
        if (rows.length < size) break;
    }
    return out;
}

export async function runStaleApplicationCleanup({ dryRun = true, now = moment(), size = 100, maxBatches = 50 } = {}) {
    const cut = cutoffs(now);
    const stats = { dryRun, cutoffs: cut, excluded: null, pending: null, approved: null, errors: [] };
    const stage = async (name, fn) => {
        try { stats[name] = await fn(); }
        catch (err) { stats.errors.push(`${name}: ${describeError(err)}`); }
    };

    // 1. excluded for more than a month
    await stage('excluded', () => {
        const guard = { clientType: { _eq: 'prospect' }, excludedAt: { _lt: cut.excluded } };
        return scan({
            type: APP_EXCL, where: guard, size, maxBatches, dryRun,
            handle: (apps) => wipeBatch(apps, { dryRun, guard }),
        });
    });

    // 2. pending prospects older than 7 days
    await stage('pending', () => {
        const guard = { clientType: { _eq: 'prospect' }, status: { _eq: 'pending' }, submittedAt: { _lt: cut.pending } };
        return scan({
            type: APP_BASE, where: guard, size, maxBatches, dryRun,
            handle: (apps) => wipeBatch(apps, { dryRun, guard }),
        });
    });

    // 3. CI-approved prospects not promoted within 14 days of approval -> declined + excluded
    await stage('approved', () => scan({
        type: APP_EXCL, size, maxBatches, dryRun,
        where: {
            clientType: { _eq: 'prospect' }, status: { _eq: 'ci_approved' },
            excludedAt: { _is_null: true }, submittedAt: { _lt: cut.approved },
        },
        // submittedAt is only a coarse pre-filter: the 14 days run from the approval
        filter: async (apps) => {
            const ci = await fetchCiRows(apps);
            const approvedAt = {};
            for (const c of ci) {
                const t = c.investigatedAt && moment(c.investigatedAt);
                if (!t?.isValid()) continue;
                for (const id of [c.tempApplicationId, c.ciReferenceCode]) {
                    if (id && (!approvedAt[id] || t.isAfter(approvedAt[id]))) approvedAt[id] = t;
                }
            }
            const limit = moment(cut.approved);
            return apps.filter(a => {
                const t = approvedAt[a._id] || approvedAt[a.ciReferenceCode] || moment(a.submittedAt);
                return t.isBefore(limit);
            });
        },
        handle: async (apps) => {
            if (!dryRun) {
                await withRetry(() => graph.mutation(updateQl(APP_EXCL('exclude'), {
                    set: {
                        status: 'ci_declined',
                        excludedAt: moment(now).toISOString(),
                        excludedReason: `Auto-declined: CI approved but not promoted within ${APPROVED_RETENTION_DAYS} days`,
                    },
                    // re-assert so a row promoted since it was read is left alone
                    where: { _id: { _in: apps.map(a => a._id) }, status: { _eq: 'ci_approved' } },
                })));
            }
            return { apps: apps.length };
        },
    }));

    return stats;
}
