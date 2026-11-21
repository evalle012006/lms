// Retention for the log tables, run by the clean-up-logs cron.
//   lms_logs              7 days   (no archive: debug noise)
//   audit_logs           365 days  business events (loans, CI, groups, transfers, collections, savings ...)
//   audit_logs (noise)    30 days  expired-QR hits and super-password views (see NOISE_ACTIONS)
//   user_activity_logs    90 days
//   face_verify_attempts  30 days
// Everything except lms_logs is archived to Spaces first.
// Safety rules:
//  - Archive first, delete only what was archived. If the archive fails the table is skipped (rows stay).
//  - Face proof for FINAL loan approval reads face_verify_attempts and CLIENT_FACE_VERIFICATION_OVERRIDDEN audit
//    rows by loan id (lib/api/faceApprovalProof.js). Rows that belong to a loan still waiting for approval
//    are never deleted, however old.
//  - Bounded per run (MAX_BATCHES) so one run cannot hold the lock for hours; the next run continues.
import moment from 'moment';
import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, queryQl, deleteQl } from '@/lib/graph/graph.util';
import { withRetry, describeError } from '@/lib/retry';
import { archiveEnabled, archiveRows } from '@/lib/log-archive';
import { FACE_VERIFY_ATTEMPT_FIELDS } from '@/lib/graph.fields';

const graph = new GraphProvider();
const BATCH = 1000;
const MAX_BATCHES = 100;
const WAITING_LOAN_STATUSES = ['pending', 'tomorrow'];
// High-volume, low-value audit actions: shorter retention than business events (still archived first).
export const NOISE_ACTIONS = ['GROUP_QR_ACCESSED_EXPIRED', 'SYSTEM_SECRET_VIEWED'];

const AUDIT_FIELDS = `_id timestamp userId userName userRole branchId branchName action category severity
    entityType entityId clientId description beforeData afterData metadata success failReason ipAddress userAgent`;

/** Loan ids (from the given rows) that are still waiting for approval. */
async function waitingLoanIds(loanIds) {
    const ids = [...new Set(loanIds.filter(Boolean))];
    if (ids.length === 0) return new Set();
    const rows = await withRetry(() => graph.query(
        queryQl(createGraphType('loans', '_id')('loans'), { where: { _id: { _in: ids }, status: { _in: WAITING_LOAN_STATUSES } } })
    )).then(r => r.data?.loans ?? []);
    return new Set(rows.map(l => l._id));
}

export const RETENTION = [
    { table: 'lms_logs', idCol: 'id', dateCol: 'created_dt', days: 7, fields: 'id', archive: false },
    {
        name: 'audit_logs_noise', table: 'audit_logs', idCol: '_id', dateCol: 'timestamp', days: 30, fields: AUDIT_FIELDS, archive: true,
        where: { action: { _in: NOISE_ACTIONS } },
    },
    {
        name: 'audit_logs', table: 'audit_logs', idCol: '_id', dateCol: 'timestamp', days: 365, fields: AUDIT_FIELDS, archive: true,
        where: { action: { _nin: NOISE_ACTIONS } },
        protect: async rows => {
            const waiting = await waitingLoanIds(rows.filter(r => r.action === 'CLIENT_FACE_VERIFICATION_OVERRIDDEN').map(r => r.metadata?.loanId));
            return rows.filter(r => r.action === 'CLIENT_FACE_VERIFICATION_OVERRIDDEN' && waiting.has(r.metadata?.loanId)).map(r => r._id);
        },
    },
    { table: 'user_activity_logs', idCol: 'id', dateCol: 'created_at', days: 90, fields: 'id user_id action field old_value new_value created_at', archive: true },
    {
        table: 'face_verify_attempts', idCol: '_id', dateCol: 'captured_at', days: 30, fields: FACE_VERIFY_ATTEMPT_FIELDS, archive: true,
        protect: async rows => {
            const waiting = await waitingLoanIds(rows.map(r => r.loan_id));
            return rows.filter(r => waiting.has(r.loan_id)).map(r => r._id);
        },
    },
];

export const cutoffFor = (days, scheduledTime) =>
    (scheduledTime ? moment(scheduledTime) : moment()).utcOffset('+08:00').startOf('day').subtract(days, 'd').toISOString();

async function cleanTable(cfg, { scheduledTime, stamp }) {
    const cutoff = cutoffFor(cfg.days, scheduledTime);
    const type = createGraphType(cfg.table, cfg.fields);
    const out = { cutoff, deleted: 0, archived: 0, protected: 0, files: 0 };

    // Plain tables: one delete, as before.
    if (!cfg.archive && !cfg.protect) {
        await withRetry(() => graph.mutation(deleteQl(createGraphType(cfg.table, cfg.idCol)('result'), { [cfg.dateCol]: { _lt: cutoff }, ...(cfg.where ?? {}) })));
        return out;
    }

    const skip = [];
    for (let n = 1; n <= MAX_BATCHES; n++) {
        const where = { [cfg.dateCol]: { _lt: cutoff }, ...(cfg.where ?? {}), ...(skip.length ? { [cfg.idCol]: { _nin: skip } } : {}) };
        const rows = await withRetry(() => graph.query(
            queryQl(type('batch'), { where, order_by: [{ [cfg.dateCol]: 'asc' }], limit: BATCH })
        )).then(r => r.data?.batch ?? []);
        if (rows.length === 0) break;

        const keep = new Set(cfg.protect ? await cfg.protect(rows) : []);
        keep.forEach(id => skip.push(id));
        out.protected = skip.length;
        const doomed = rows.filter(r => !keep.has(r[cfg.idCol]));

        if (doomed.length > 0) {
            if (cfg.archive && archiveEnabled()) {
                const day = moment(doomed[0][cfg.dateCol]).utcOffset('+08:00').format('YYYY-MM-DD');
                await archiveRows(cfg.table, doomed, { day, stamp: `${stamp}${cfg.name && cfg.name !== cfg.table ? '-' + cfg.name.replace(cfg.table + '_', '') : ''}`, n }); // throws -> nothing is deleted
                out.archived += doomed.length;
                out.files += 1;
            }
            await withRetry(() => graph.mutation(
                deleteQl(createGraphType(cfg.table, cfg.idCol)('result'), { [cfg.idCol]: { _in: doomed.map(r => r[cfg.idCol]) } })
            ));
            out.deleted += doomed.length;
        }
        if (rows.length < BATCH && keep.size === 0) break;
    }
    return out;
}

/** Runs every table independently: one table failing (e.g. archive unreachable) does not block the others. */
export async function runLogRetention({ scheduledTime = null } = {}) {
    const stamp = moment().utc().format('YYYYMMDDTHHmmss');
    const stats = {};
    let failed = 0;
    for (const cfg of RETENTION) {
        try {
            stats[cfg.name ?? cfg.table] = await cleanTable(cfg, { scheduledTime, stamp });
        } catch (err) {
            failed++;
            stats[cfg.name ?? cfg.table] = { error: describeError(err) };
            console.error(`[log-retention] ${cfg.name ?? cfg.table} failed:`, err);
        }
    }
    stats.archive = archiveEnabled() ? 'spaces' : 'off';
    if (failed === RETENTION.length) throw new Error(`all tables failed: ${JSON.stringify(stats)}`);
    return stats;
}
