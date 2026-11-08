/**
 * /api/v2/hris/sync
 * -----------------
 * WRITE endpoint – LMS pulls staff data from ACPayroll webhook and
 * upserts it into the local `hris_user_sync` table.
 *
 * POST /api/v2/hris/sync
 *
 * Optional JSON body:
 * {
 *   "status":      "Active",    // filter — only sync Active or Inactive staff
 *   "branch":      1,           // filter — only sync a specific HRIS branch_id
 *   "withStatus":  true,        // also call /staff/:id/status per record (expensive)
 *   "employee_no": "EMP-0001"  // single-employee sync
 * }
 *
 * Omit body / send {} to sync ALL staff with no filters.
 *
 * Auth: via x-webhook-api-key header (api-handler skips JWT for this header).
 *
 * Required env:
 *   HRIS_API_URL       ACPayroll base URL
 *   WEBHOOK_API_KEY    shared with ACPayroll
 */

import { GraphProvider } from '@/lib/graph/graph.provider';
import { createGraphType, insertQl, updateQl, queryQl } from '@/lib/graph/graph.util';
import { apiHandler } from '@/services/api-handler';
import { generateUUID } from '@/lib/utils';
import {
    fetchAllHrisStaff,
    fetchHrisStaffByRef,
    fetchHrisStaffStatus,
} from '@/lib/hris-client';

const graph = new GraphProvider();

// ── GraphQL type definitions ──────────────────────────────────────────────────

const HRIS_SYNC_FIELDS = `
    _id
    hris_id
    employee_no
    lms_user_id
    lms_branch_id
    status
    last_synced_at
`;

const HRIS_SYNC_TYPE = createGraphType('hris_user_sync', HRIS_SYNC_FIELDS);

// ── Handler ──────────────────────────────────────────────────────────────────

export default apiHandler({
    post: syncStaff,
});

async function syncStaff(req, res) {
    let response = {};

    try {
        const {
            status,
            branch,
            withStatus = false,
            employee_no,
        } = req.body ?? {};

        // ── Step 1: Pull staff from HRIS ─────────────────────────────────
        let hrisRecords = [];

        if (employee_no) {
            const single = await fetchHrisStaffByRef(employee_no);
            if (!single) {
                return res.status(200)
                    .setHeader('Content-Type', 'application/json')
                    .end(JSON.stringify({
                        success: false,
                        message: `HRIS employee '${employee_no}' not found`,
                    }));
            }
            hrisRecords = [single];
        } else {
            hrisRecords = await fetchAllHrisStaff({
                status,
                branch: branch ? +branch : undefined,
            });
        }

        if (hrisRecords.length === 0) {
            return res.status(200)
                .setHeader('Content-Type', 'application/json')
                .end(JSON.stringify({
                    success: true,
                    message: 'No HRIS records matched the filter',
                    summary: { total: 0, inserted: 0, updated: 0, failed: 0 },
                }));
        }

        // ── Step 2: Optionally fetch employment status per record ─────────
        // WARNING: 1 extra HTTP call per record. Use only for single/small syncs.
        let statusMap = {}; // hris_id (string) → status response object

        if (withStatus) {
            const results = await Promise.allSettled(
                hrisRecords.map(r =>
                    fetchHrisStaffStatus(r.id)
                        .then(s => ({ hris_id: String(r.id), statusData: s }))
                )
            );
            results.forEach(res => {
                if (res.status === 'fulfilled' && res.value.statusData) {
                    statusMap[res.value.hris_id] = res.value.statusData;
                }
            });
        }

        // ── Step 3: Build email → lms_user_id lookup ─────────────────────
        const emails = hrisRecords
            .map(r => r.email)
            .filter(Boolean)
            .map(e => e.toLowerCase());

        let emailToLmsId = {};
        if (emails.length > 0) {
            const lmsUsers = await graph.query(
                queryQl(
                    createGraphType('users', '_id email')('users'),
                    { where: { email: { _in: emails }, root: { _eq: false } } }
                )
            ).then(r => r.data?.users ?? []);

            emailToLmsId = lmsUsers.reduce((acc, u) => {
                acc[u.email.toLowerCase()] = u._id;
                return acc;
            }, {});
        }

        // ── Step 4: Build branch_code → lms_branch_id lookup ─────────────
        const branchCodes = [...new Set(
            hrisRecords.map(r => r.branch_code).filter(Boolean)
        )];

        let branchCodeToLmsId = {};
        if (branchCodes.length > 0) {
            const lmsBranches = await graph.query(
                queryQl(
                    createGraphType('branches', '_id code')('branches'),
                    { where: { code: { _in: branchCodes } } }
                )
            ).then(r => r.data?.branches ?? []);

            branchCodeToLmsId = lmsBranches.reduce((acc, b) => {
                acc[b.code] = b._id;
                return acc;
            }, {});
        }

        // ── Step 5: Check which hris_ids already exist ────────────────────
        const hrisIds = hrisRecords.map(r => String(r.id));

        const existingRows = await graph.query(
            queryQl(
                createGraphType('hris_user_sync', '_id hris_id')('hris_user_sync'),
                { where: { hris_id: { _in: hrisIds } } }
            )
        ).then(r => r.data?.hris_user_sync ?? []);

        const existingMap = existingRows.reduce((acc, row) => {
            acc[row.hris_id] = row._id;
            return acc;
        }, {});

        // ── Step 6: Build insert / update payloads ────────────────────────
        const now        = new Date().toISOString();
        const actor      = 'hris_sync_pull';
        const toInsert   = [];
        const toUpdate   = [];

        for (const r of hrisRecords) {
            const hris_id       = String(r.id);
            const emailKey      = r.email?.toLowerCase();
            const lms_user_id   = emailKey ? (emailToLmsId[emailKey] ?? null) : null;
            const lms_branch_id = r.branch_code
                ? (branchCodeToLmsId[r.branch_code] ?? null)
                : null;

            const empStatus = statusMap[hris_id] ?? null;

            const record = {
                hris_id,
                employee_no:          r.employee_no          ?? null,
                lms_user_id,
                first_name:           r.first_name           ?? null,
                last_name:            r.last_name            ?? null,
                middle_name:          r.middle_name          ?? null,
                full_name:            r.fullname             ?? null,
                email:                r.email                ?? null,
                contact:              r.contact              ?? null,
                status:               r.status               ?? 'Active',
                position:             r.position             ?? null,
                department:           r.department           ?? null,
                area:                 r.area                 ?? null,
                region:               r.region               ?? null,
                division:             r.division             ?? null,
                hris_branch_id:       r.branch_id            ?? null,
                hris_branch_name:     r.branch_name          ?? null,
                hris_branch_code:     r.branch_code          ?? null,
                lms_branch_id,
                start_date:           r.start_date           ?? null,
                regularization_date:  r.regularization_date  ?? null,
                address:              r.address              ?? null,
                municipality:         r.municipality         ?? null,
                province:             r.province             ?? null,
                // Employment status snapshot (null when withStatus was false)
                on_leave:    empStatus ? JSON.stringify(empStatus.on_leave)   : null,
                transfers:   empStatus ? JSON.stringify(empStatus.transfers)  : null,
                promotions:  empStatus ? JSON.stringify(empStatus.promotions) : null,
                demotions:   empStatus ? JSON.stringify(empStatus.demotions)  : null,
                exit_record: empStatus ? JSON.stringify(empStatus.exit)       : null,
                last_synced_at: now,
                raw_payload:    JSON.stringify(r),
            };

            if (existingMap[hris_id]) {
                toUpdate.push({
                    _id:    existingMap[hris_id],
                    record: { ...record, modified_date: now, modified_by: actor },
                });
            } else {
                toInsert.push({
                    _id:           generateUUID(),
                    ...record,
                    inserted_date: now,
                    inserted_by:   actor,
                });
            }
        }

        // ── Step 7: Batch insert ──────────────────────────────────────────
        const inserted = [];
        const updated  = [];
        const failed   = [];

        if (toInsert.length > 0) {
            try {
                // ✅ Correct insertQl signature: (type, { objects: [...] })
                const result = await graph.mutation(
                    insertQl(HRIS_SYNC_TYPE('insert_hris_user_sync'), {
                        objects: toInsert,
                    })
                );
                if (result.errors?.length) {
                    throw new Error(result.errors.map(e => e.message).join(', '));
                }
                inserted.push(...toInsert.map(r => r.employee_no ?? r.hris_id));
            } catch (err) {
                console.error('[hris/sync] Batch insert failed:', err.message);
                failed.push(...toInsert.map(r => ({
                    ref:    r.employee_no ?? r.hris_id,
                    reason: err.message,
                })));
            }
        }

        // ── Step 8: Batch update ──────────────────────────────────────────
        // Each update must be a separate mutation statement because each
        // targets a different _id. We pass them all to graph.mutation() in
        // one round-trip via the spread operator.
        if (toUpdate.length > 0) {
            try {
                // ✅ Correct updateQl signature: (type, { set: {...}, where: {...} })
                const mutationList = toUpdate.map(({ _id, record }) =>
                    updateQl(
                        HRIS_SYNC_TYPE(`upd_hris_${_id.slice(0, 8)}`),
                        {
                            set:   record,
                            where: { _id: { _eq: _id } },
                        }
                    )
                );

                const result = await graph.mutation(...mutationList);
                if (result.errors?.length) {
                    throw new Error(result.errors.map(e => e.message).join(', '));
                }
                updated.push(...toUpdate.map(r => r.record.employee_no ?? r.record.hris_id));
            } catch (err) {
                console.error('[hris/sync] Batch update failed:', err.message);
                failed.push(...toUpdate.map(r => ({
                    ref:    r.record.employee_no ?? r.record.hris_id,
                    reason: err.message,
                })));
            }
        }

        response = {
            success: failed.length < hrisRecords.length,
            summary: {
                total:    hrisRecords.length,
                inserted: inserted.length,
                updated:  updated.length,
                failed:   failed.length,
            },
            matched: {
                lms_users:    Object.keys(emailToLmsId).length,
                lms_branches: Object.keys(branchCodeToLmsId).length,
            },
            ...(failed.length > 0 ? { failed } : {}),
        };

    } catch (error) {
        console.error('[hris/sync] Unexpected error:', error.message);
        response = {
            success: false,
            message: 'Sync failed due to an unexpected error',
            error:   error.message,
        };
    }

    res.status(200)
        .setHeader('Content-Type', 'application/json')
        .end(JSON.stringify(response));
}