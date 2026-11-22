# LMS — Staging test checklist and Production runbook (updated 2026-11-22)

Branch: `duplicate-feature` (all changes uncommitted unless you pushed; push manually).
Scope of this release, in build order: **(1) Duplicate Clients feature (first build)** → (2) cron hardening (`cron_runs`, group slot trigger) → (3) logging / audit / log retention.

## 0. Database migrations in this release (`database/postgre-migrations/`)
Run order matters. Status columns: fill in per environment. "Staging" = confirm from `\d` / Hasura before assuming.

| # | File | What it does | Run | Hasura step | Staging | Prod |
|---|------|--------------|-----|-------------|---------|------|
| 004 | `004_client_fill_assignment_trg.sql` | Trigger: active client must have group + LO (heals from current loan, logs a LOG line) | before deploy | none | ? | ? |
| 005 | `005_duplicate_clients.sql` | Tables `duplicate_client_clusters`, `duplicate_scan_runs` + indexes | before deploy | **track both tables**, reload metadata | ? | ? |
| 006 | `006_duplicate_review.sql` | Review columns on clusters (review_status etc.; not touched by rescans) | before deploy, after 005 | reload metadata | ? | ? |
| 007 | `007_face_template_vec.sql` | `vector` extension, `client."faceTemplateVec" vector(128)`, sync trigger, backfill (assignment trigger disabled during backfill), function `fn_find_duplicate_faces` | before deploy | **track `fn_find_duplicate_faces` as a QUERY function** (STABLE, SETOF client), reload | ? | ? |
| 008 | `008_face_template_vec_idx.sql` | HNSW index `client_face_template_hnsw` (m=16, ef=64) | **alone**, outside a transaction (`CREATE INDEX CONCURRENTLY`), after 007 | none | ? | ? |
| 009 | `009_face_uniqueness_setting.sql` | `settings."enforceFaceUniqueness"` boolean (default ON) | **before** deploy (settings read selects it; missing column breaks every settings read) | reload metadata | ? | ? |
| 010 | `010_cron_runs.sql` | `cron_runs` lock/history table | before deploy | track `cron_runs` | ? | ? |
| 011 | `011_group_slots_trigger.sql` | Group counters/slots maintained by DB trigger | after 010 | none | ? | ? |

Also in the folder but not part of this feature: 001 offline upload, 002/003 face recapture, `006_hris_integration.sql` (note: two files are numbered 006). **Confirm 001–004 and `006_hris` are already applied on prod** before running anything: `SELECT to_regclass('client_face_enrollments'), to_regclass('hris_user_sync'), to_regclass('duplicate_client_clusters');` and `\df client_fill_assignment`.

**Production DB (decided 2026-11-22): Option B — release WITHOUT face matching first.** Prod DB runs on its own server in Docker (`apps-postgres-1`, plain `postgres:15`, Hasura `apps-lms-hasura-1` v2.37.0). The plain image has **no pgvector**, so **007 and 008 are NOT run on prod in this release**. Run on prod now: 004 (only if missing), 005, 006_duplicate_review, 009, 010, 011. Staging already has pgvector (0.8.6) and keeps testing 007–009.
- Why this is safe: the code never selects `faceTemplateVec`; `lib/face-duplicate.js` catches the missing `fn_find_duplicate_faces` and returns `available:false` (no face check, no block) — **even with Enforce Face Uniqueness ON**. 009 is still required (settings read selects `enforceFaceUniqueness`).
- Consequence: face-duplicate blocking does not work on prod until the later window below. Name/birthdate/contact duplicate detection, the scan, merge and the entry guard all work without it.
- **Later window (face matching on prod):** full `pg_dump` backup → change the compose image to `pgvector/pgvector:pg15` (same Postgres 15, same volume; confirm with `docker inspect apps-postgres-1` that data is on a named volume or bind mount) → `docker compose up -d postgres` (~10–30 s DB downtime, do it at night) → reload Hasura → verify `SELECT default_version FROM pg_available_extensions WHERE name='vector';` → run 007, then 008 (alone), then track `fn_find_duplicate_faces`, reload metadata, test.
- Run SQL on prod through the container: `docker exec -i apps-postgres-1 psql -U postgres -d <db> -v ON_ERROR_STOP=1 < file.sql` (confirm DB name/user against `DATABASE_URL`). Copy the files to the DB server first.
- Prod check before running anything: `docker exec -it apps-postgres-1 psql -U postgres -d <db> -c "SELECT to_regclass('client_face_enrollments'), to_regclass('hris_user_sync'), to_regclass('duplicate_client_clusters');"` and `\df client_fill_assignment`.

### Production progress (as reported 2026-11-22 02:41 PHT)
- [x] Migrations run on prod (per Donie): all of section 0 **except 007 and 008** (deferred, pgvector).
- [x] Hasura tracking done (confirmed 2026-11-22 02:45 PHT): `duplicate_client_clusters` (empty until first scan), `duplicate_scan_runs`, `cron_runs`, `settings.enforceFaceUniqueness`.
- [x] `x-webhook-api-key` header set on all four cron triggers.
- [x] **Production deployed** (2026-11-22). System settings page shows Enforce Face Uniqueness OFF.
- [x] `update-advance-days-loan` URL now `/api/v2/cronjobs/update-advance-days-loan`.
- [ ] Confirm in the prod app container env: `WEBHOOK_API_KEY`, `ENABLE_DB_LOGGING=true`, `SPACES_ACCESS_KEY/SECRET_KEY/BUCKET/ROOT`.
- [ ] Prod smoke test: Settings → Duplicate Clients → **Scan now** (off-peak); `duplicate_scan_runs` ends success; clusters appear; Duplicate Alerts widget loads.
- [ ] Section 8b (retention/archive) has not been run live anywhere yet — run it on staging before the first prod `clean-up-logs` fire (Mon 23 Nov 02:00 PHT), or disable that trigger until verified.
- [ ] Optional: `update-advance-days-loan` retries = 0, tolerance 21600 s. Consider 2 retries (the app answers `skipped` if a run is in progress, so retries are safe) so one failed call does not skip the weekly reset.
- [x] Hasura cron triggers set (screenshots): `clean-up-logs` `0 18 * * *`, `clean-up-loan-history` `0 19 * * *`, `detect-duplicate-clients` `0 17 * * *`, `update-advance-days-loan` `0 16 * * 6`.
- [x] (done) Deploy was before the first fires: `detect-duplicate-clients` 01:00 PHT, `clean-up-logs` 02:00 PHT, `clean-up-loan-history` 03:00 PHT (Mon 23 Nov), `update-advance-days-loan` Sun 00:00 PHT (Nov 29). On the old build the new routes answer 404 (harmless; Hasura retries).

## A. Staging tests (after deploy)

### Cron jobs
| # | Test | Status |
|---|------|--------|
| 1 | Old duplicate routes return 404 | PASS |
| 2 | New `/api/v2/cronjobs/*` return "Invalid Token" without `x-webhook-api-key` | PASS |
| 3 | With key: `cron_runs` gets a `success` row | PASS |
| 4 | Second call while first runs → `{skipped:true}` | PASS |
| 5 | clean-up-logs run row has stats | PASS (old format; now per-table, see 8b) |
| 6 | Stale `running` row expires after `staleMinutes` | PASS |
| 7 | Sunday advanceDays reset: 1→0 on loans only | PASS |
| 7b | Verify `cashCollections.advanceDays` untouched after the reset | TODO |
| 7c | `detect-duplicate-clients` fired twice at once → second returns `already_running`; `cron_runs` row `detect-duplicate-clients` ends `success` | TODO |

### 8. lms_logs
Writer confirmed working on staging (2026-11-21). Rule in the new build: persisted = level warn/error OR any entry with `user_id` **or `userId`**. Writes are batched (≤2 s / 50 rows). Needs `ENABLE_DB_LOGGING=true`.
- [ ] After deploying the new build: Loan save / LOR submit → rows appear within ~3 s, `user_id` filled.
- [ ] Login rows (`userId`) are still stored; anonymous info/debug lines (no id) are NOT.
- [ ] Force an error (bad payload) → error row appears.
- [ ] Hasura down for a moment → requests still succeed; no log loop.

### 8b. Log retention / archive (`clean-up-logs`)
Windows: lms_logs 7d (no dump) · audit_logs 365d business events · audit_logs 30d noise (`GROUP_QR_ACCESSED_EXPIRED`, `SYSTEM_SECRET_VIEWED`) · user_activity_logs 90d · face_verify_attempts 30d. Everything except lms_logs is dumped to Spaces (`<SPACES_ROOT>/log-archive/<table>/<date>/…ndjson.gz`) before deletion. Runs in the background; max 100,000 rows per table per run.
- [ ] Call the route with the key → immediate 200; `cron_runs` row ends `success` with one stats entry per pass (`lms_logs`, `audit_logs_noise`, `audit_logs`, `user_activity_logs`, `face_verify_attempts`, `archive: "spaces"`).
- [ ] Files appear in Spaces; download one, `gunzip`, check rows and that no `faceTemplate` is present.
- [ ] Rows for a loan still `pending`/`tomorrow` are NOT deleted (face_verify_attempts and `CLIENT_FACE_VERIFICATION_OVERRIDDEN` audit rows).
- [ ] Set `LOG_ARCHIVE_DISABLE=true` → run still deletes, `archive: "off"`, no files.
- [ ] Archive switch logic (`lib/log-archive.js`): archive is ON when `LOG_ARCHIVE_DISABLE` is **absent or anything other than `true`** AND `SPACES_ACCESS_KEY` + `SPACES_BUCKET` are set. If either Spaces var is missing, or `LOG_ARCHIVE_DISABLE=true`, the job **deletes without dumping** and reports `archive: "off"`. So `LOG_ARCHIVE_DISABLE` does not need to exist; never set it to `true` on prod. Always check `archive: "spaces"` in the `cron_runs` stats.
- [ ] WRONG Spaces keys / bucket (vars present but rejected) → that table reports an error and keeps its rows; other tables still run.
- [ ] An app rebuild/restart while a background job runs kills it (in-process). The `cron_runs` / `duplicate_scan_runs` row stays `running` until the 30 min (scan) / 60 min (clean-up-logs) stale expiry, then a new run is allowed. No data damage: the scan only resolves old clusters at its last step, and retention archives before it deletes.
- [ ] Compliance: confirm there is no mandated minimum retention for audit records (overrides the windows above).

### 9. Group slot trigger (011)
- [ ] Add loan / reject loan / offset → `noOfClients`, `availableSlots`, `status` update without the cron.
- [ ] Mismatch query returns 0 rows after the tests.

### 10–11. Transfers and schedule recalculation
- [ ] Weekly standard → weekly accelerated: loan recalculated to 12 terms; `weeklyScheduleType` = accelerated.
- [ ] Accelerated → standard: 24 terms.
- [ ] Daily ↔ weekly still recalculates as before.
- [ ] Group edit: changing schedule/occurence is blocked while `noOfClients > 0`.

### 12. Duplicate Clients — admin page (Settings → Duplicate Clients; admin/root only)
Preconditions: migrations 005–009 applied, tables/function tracked, metadata reloaded. Seed at least one pair per scenario (same name+birthdate; same name+contact; typo variant; different branch; one closed record).
- [ ] Page opens for admin/root; a non-admin gets no access (menu hidden and API rejects).
- [ ] **Scan now** → progress shows, run row in `duplicate_scan_runs` ends success; clusters appear. Clicking Scan while one runs → "already running" (lock).
- [ ] Failed/aborted scan → can retry; stale run does not block forever.
- [ ] Confidence labels correct: exact / high / possible; sample pairs land in the right bucket.
- [ ] Views: Active / Closed / Same client each show the right clusters; counts in the header (metrics API) match the list.
- [ ] Pagination and sorting; filters by branch, LO, group, confidence, review status; filters combine correctly.
- [ ] Scoping: a branch-limited viewer (if allowed) sees only clusters touching their branch; admin sees cross-branch ones.
- [ ] Cluster membership: cluster `_id` stays stable after a rescan when a member is added.
- [ ] **Excel export**: all, selected rows, and filtered set; file opens; columns and row counts match the screen; no biometric data in the file.
- [ ] Review: mark **Confirmed duplicate** / **Not a duplicate** (with note) → saved, audited, and **still there after a rescan** (006 columns not overwritten).
- [ ] Rescan single cluster / full rescan does not duplicate clusters.

### 13. Duplicate Clients — merge
- [ ] Merge two records (master + duplicate): loans, cashCollections, savings/other child rows move to master; duplicate ends `merged` and drops out of lists.
- [ ] Both clients with an **active loan** → merge is blocked with a clear message (one must be closed/offset first).
- [ ] Merge with a closed record works; cluster disappears/updates (`onClientMerged`); audit row created.
- [ ] Caller who cannot see either side cannot merge.
- [ ] Known open item: `loanCycle` collisions after merge (see E) — record what happens.

### 14. Duplicate guard at entry
Policy: exact/high match to a client with an ACTIVE or PENDING loan → **block**; any other match → **warn only**. Admin/supervisor may override with a reason (audited).
- [ ] Add client (legacy drawer / `clients/save`) with data matching an active-loan client → 409-style block with match list.
- [ ] Same, as admin/supervisor with `overrideDuplicate` + reason → saves, audit `DUPLICATE_BLOCK_OVERRIDDEN` with reason and matches; override without reason or as branch-level user → still blocked.
- [ ] Match only a closed client or a "possible" confidence → warning only, save allowed.
- [ ] **LAF promote** (`laf/promote/[refCode]`): new client blocked the same way; skipped when an admin already reviewed the application at the duplicate-validation step.
- [ ] **Public LAF submit**: matching application is flagged (`isDuplicateFlagged`, candidate ids stored); public caller never sees match details and is never hard-blocked; a lookup error does not block submission.
- [ ] Guard failure (stop Hasura briefly) → save continues (fail-open) and an error is logged.

### 15. Dashboard widget, CI review panel, face matching, settings
- [ ] Dashboard **Duplicate Alerts** widget shows counts for the logged-in role/scope; clicking opens the modal with the right clients; counts agree with the admin page.
- [ ] CI review panel (CIReviewPanel) shows possible duplicates for the applicant; no data leaks to roles that should not see other branches.
- [ ] Face matching: enroll a client with a face already enrolled on another client → flagged/blocked per setting; response time acceptable (HNSW index used: `EXPLAIN` shows `client_face_template_hnsw`).
- [ ] Recapture-face and enroll-face keep `faceTemplateVec` in sync (trigger) — check column is populated after a new enrollment.
- [ ] **System Settings → Enforce Face Uniqueness**: ON blocks a duplicate face; OFF allows it; toggle persists and Hasura settings read still works.
- [ ] Face-matching function missing (rename it temporarily) → app still works, checks skipped (fail-soft).
- [ ] Nightly cron `detect-duplicate-clients` triggered with the key → run row success, clusters refreshed, review decisions preserved.
- [ ] Merge with `migration` (PR #526): confirm our newer version of `duplicate-clients-job.js`, `duplicates/list.js`, `settings/duplicate-clients/index.js` is what is deployed (we kept ours in all 3 conflicts).

### 16–17. LOR pre-save
- [ ] Pre-save row copies `advanceDays` from the loan (both 2026-11-17 samples should no longer be blank).
- [ ] Weekend/holiday: no weekly pre-save rows.

### 18. Audit logs (Settings → System → Audit Logs)
New categories: GROUP, BRANCH, TRANSFER, COLLECTION, SAVINGS. User name, role and branch name are now resolved from the ids (new rows only; the old "—" user column should be gone). Check each action creates exactly one row with correct user, branch, client and before/after:

| Area | Action to perform | Expected audit action |
|------|-------------------|----------------------|
| Duplicates | Review / merge / override guard | duplicate review, merge, `DUPLICATE_BLOCK_OVERRIDDEN`, `CLIENT_FACE_VERIFICATION_OVERRIDDEN` |
| CI | Approve / decline a CI | `CI_APPROVED` / `CI_DECLINED` (reason in afterData) |
| Loans | Add loan application | `LOAN_CREATED` |
| Loans | LDF approve / unapprove | `LOAN_LDF_APPROVED` / `LOAN_LDF_UNAPPROVED` |
| Loans | Final approve | `LOAN_FINAL_APPROVED` (or `LOAN_APPROVED` from single approve) |
| Loans | Reject loan (new and reloan) | `LOAN_REJECTED`, metadata.reloan true for cycle > 1 |
| Loans | Pending loan update with Reloaner / Offset | `PENDING_LOANS_UPDATED` |
| Loans | Close account | `CLIENT_ACCOUNT_CLOSED` |
| Groups | Create / edit / delete | `GROUP_CREATED` / `GROUP_UPDATED` (changed fields only) / `GROUP_DELETED` |
| Branches | Create / edit / lock / delete | `BRANCH_CREATED` / `BRANCH_UPDATED` / `BRANCH_LOCK_UPDATED` / `BRANCH_DELETED` |
| Transfers | Request / edit / delete pending | `TRANSFER_REQUESTED` / `TRANSFER_UPDATED` / `TRANSFER_DELETED` |
| Transfers | Approve / reject | `TRANSFER_APPROVED` / `TRANSFER_REJECTED` |
| Transfers | Revert / repair | `TRANSFER_REVERTED` / `TRANSFER_REPAIRED` |
| LOR | Save Draft / Submit | `COLLECTION_DRAFT_SAVED` / `COLLECTION_SUBMITTED` with MCBU/CSF totals |
| LOR | Reloaner row | `LOR_RELOANER` (WARNING if a balance remains) |
| LOR | Offset row | `LOR_OFFSET` (WARNING if no close reason) |
| LOR | Revert offset / reloan / payment | `LOR_REVERT_OFFSET` / `_RELOAN` / `_RELOANER` / `_PAYMENT` |
| LOR | Close / reopen LO or branch transactions | `LO_TRANSACTIONS_CLOSED/OPENED`, `BRANCH_TRANSACTIONS_CLOSED/OPENED` (blocked attempts success=false) |
| Savings | MCBU/CSF return or withdrawal on a row | `SAVINGS_RETURN_OR_WITHDRAWAL` |
| Savings | Withdrawal request / edit / delete | `SAVINGS_WITHDRAWAL_REQUESTED` / `_UPDATED` / `_DELETED` |
| Savings | Bulk approve / reject | `SAVINGS_WITHDRAWAL_APPROVED` / `_REJECTED` |
| Safety nets | (only if saveV2 repaired data) | `COLLECTION_AUTO_HEALED`, `LOAN_AUTO_HEALED_CLOSE` (CRITICAL) — should never appear normally |

Also check: no passwords or biometric data in any `beforeData/afterData/metadata`; a failed audit insert never breaks the user action.

## B. Recurring bug watch (every QA run)
Use the audit totals + DB: saved `mcbu` vs `mcbuCol`, `csf` vs `csfCollection`, MCBU collection added to `loans.mcbu` and `cashCollections`; missing cashCollections after reloan; closed cashCollections row with an unclosed loan; advanceDays drift between loan and collection.

## C. Production steps (in order)
1. Back up DB. Check prerequisites in section 0 (pgvector available; which of 001–004 / `006_hris` are already applied).
2. Run migrations in order, **before** the deploy, via `docker exec -i apps-postgres-1 psql ...` (see section 0): 004 (if not applied) → 005 → 006_duplicate_review → 009 → 010 → 011. **Skip 007 and 008 on prod** (no pgvector; deferred to the later window in section 0).
3. Hasura (`apps-lms-hasura-1`): track `duplicate_client_clusters`, `duplicate_scan_runs`, `cron_runs`; reload metadata; confirm `settings.enforceFaceUniqueness` is visible. Do NOT track `fn_find_duplicate_faces` (does not exist on prod yet).
4. Group-slot mismatch check after 011 (expect 0 rows).
5. Deploy app build. Confirm in all containers: `WEBHOOK_API_KEY`, `ENABLE_DB_LOGGING=true`, `SPACES_ACCESS_KEY/SECRET_KEY/BUCKET/ROOT` (log archive).
6. Update Hasura cron triggers — see section F (includes adding `detect-duplicate-clients`).
7. Run the 48-loan label repair SQL (expect `UPDATE 48`).
8. Turn **Enforce Face Uniqueness** OFF in System Settings until threshold calibration (the column defaults to ON, so do this right after the deploy; it has no effect on prod until pgvector is installed). Then run a first manual **Scan now** from the Duplicate Clients page and review the results with the business before enabling blocking by default.
9. Verify: `cron_runs` success rows, `duplicate_scan_runs` success, `lms_logs` rows, Audit Logs page shows new categories and user names after first real transactions, Duplicate Alerts widget loads.
10. After the first nightly `clean-up-logs`, confirm archive files in Spaces before relying on it (first run may delete a large backlog; capped per run).

## D. Rollback
App: redeploy previous build. (Image swap to pgvector, when done later: revert the compose image line and recreate; the `vector` column and extension are additive and harmless to leave.) DB: `DROP TRIGGER trg_loans_refresh_group_ins/_upd/_del ON loans;` (counters stay as last computed; re-enable the update-group-clients cron). New tables/columns (005, 006, 009, 010, `faceTemplateVec`) are additive and can stay; the old build ignores them. If face matching misbehaves, set Enforce Face Uniqueness OFF instead of rolling back. `cron_runs` can stay. Audit/log writes are additive and safe to leave. Archive files in Spaces are never deleted by the app.

## E. Open items
Face threshold calibration (`FACE_MATCH_THRESHOLD` 0.5 is a starting value); merge loanCycle collisions; compliance minimum retention for audit records; UTC vs PH cron convention; first-run backlog size for retention; pre-existing failing test files: transfer-offset-current-loss, presave-sql-repair-retention (X2/X3), rollback-advance-network (mock lacks `getNonWorkingReason`), index/db tests (ObjectId).

## F. Hasura cron trigger schedule changes
Hasura cron expressions are **UTC**; PHT = UTC+8 (a "00:00 PHT" job is `16:00` UTC the day before). The app guard (`cron_runs`) makes overlaps safe, but stagger heavy jobs anyway. Fill the "Current" column from Hasura before changing anything; the "Recommended" column is a suggestion to confirm, not a copy of what is set today.

| Job (URL under `/api/v2/cronjobs/`) | Change | Recommended schedule |
|---|---|---|
| `update-advance-days-loan` | The only advanceDays job (there is no `clean-advance-days-loan`). Sets `loans.advanceDays` to 0 where > 0 (weekly Sunday reset rule). Repoint URL from the old `/transactions/loans/update-advance-days-loan` to `/cronjobs/update-advance-days-loan`. Keep today's schedule; if it is not already Sunday PHT, set it. | Sunday 00:00 PHT = `0 16 * * 6` (Sat 16:00 UTC) — confirm against current Hasura |
| `update-group-clients` | Repoint to the new route for now; **delete the trigger** after one verified business day (group counters now maintained by the DB trigger 011). | remove |
| `clean-up-logs` | Keep. Now also cleans audit_logs, user_activity_logs, face_verify_attempts and dumps to Spaces; runs in background and can take longer. Run once daily off-peak. | daily 02:00 PHT = `0 18 * * *` |
| `clean-up-loan-history` | Keep (3-day retention, unchanged). Do not overlap with clean-up-logs. | daily 03:00 PHT = `0 19 * * *` |
| `detect-duplicate-clients` | NEW: add the nightly trigger if not present yet (locked via `cron_runs`). | daily 01:00 PHT = `0 17 * * *` |

Checklist for the change:
- [ ] Screenshot or note the current schedule of every trigger before editing (rollback reference).
- [ ] Decide once: schedules written in UTC or PH-equivalent; convert all of them consistently.
- [ ] Each trigger: webhook URL points to `https://<prod host>/api/v2/cronjobs/<job>`, header `x-webhook-api-key` set, retry config sane (the app answers 200 `skipped` when a run is already in progress, so no retry storm).
- [ ] No two heavy jobs start in the same minute.
- [ ] After the first scheduled run of each: `cron_runs` has a row with the expected `trigger = cron` and `success`.
- [ ] Old duplicate triggers (pointing at removed routes) deleted — they would 404.
