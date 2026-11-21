# LMS — Staging test checklist and Production runbook (updated 2026-11-22)

Branch: `duplicate-feature` (all changes uncommitted unless you pushed; push manually).

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
- [ ] Break the Spaces keys → that table reports an error and keeps its rows; other tables still run.
- [ ] Compliance: confirm there is no mandated minimum retention for audit records (overrides the windows above).

### 9. Group slot trigger (011)
- [ ] Add loan / reject loan / offset → `noOfClients`, `availableSlots`, `status` update without the cron.
- [ ] Mismatch query returns 0 rows after the tests.

### 10–11. Transfers and schedule recalculation
- [ ] Weekly standard → weekly accelerated: loan recalculated to 12 terms; `weeklyScheduleType` = accelerated.
- [ ] Accelerated → standard: 24 terms.
- [ ] Daily ↔ weekly still recalculates as before.
- [ ] Group edit: changing schedule/occurence is blocked while `noOfClients > 0`.

### 12–15. Duplicate Clients
Scan, retry/progress, face-uniqueness toggle (keep OFF in prod until threshold calibrated), merge. (Merged with `migration` PR #526; our newer version kept in all 3 conflicts.)

### 16–17. LOR pre-save
- [ ] Pre-save row copies `advanceDays` from the loan (both 2026-11-17 samples should no longer be blank).
- [ ] Weekend/holiday: no weekly pre-save rows.

### 18. Audit logs (Settings → System → Audit Logs)
New categories: GROUP, BRANCH, TRANSFER, COLLECTION, SAVINGS. User name, role and branch name are now resolved from the ids (new rows only; the old "—" user column should be gone). Check each action creates exactly one row with correct user, branch, client and before/after:

| Area | Action to perform | Expected audit action |
|------|-------------------|----------------------|
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
1. Back up DB.
2. Run `010_cron_runs.sql`, track `cron_runs` in Hasura.
3. Run `011_group_slots_trigger.sql`; run the mismatch check (expect 0 rows).
4. Deploy app build. Confirm in all containers: `WEBHOOK_API_KEY`, `ENABLE_DB_LOGGING=true`, `SPACES_ACCESS_KEY/SECRET_KEY/BUCKET/ROOT` (needed for the log archive).
5. Update Hasura cron triggers — see section F.
6. Run the 48-loan label repair SQL (expect `UPDATE 48`).
7. Turn **Enforce Face Uniqueness** OFF until threshold calibration.
8. Verify: `cron_runs` success rows, `lms_logs` rows, Audit Logs page shows new categories and user names after first real transactions.
9. After the first nightly `clean-up-logs`, confirm archive files in Spaces before relying on it (first run may delete a large backlog; capped per run).

## D. Rollback
App: redeploy previous build. DB: `DROP TRIGGER trg_loans_refresh_group_ins/_upd/_del ON loans;` (counters stay as last computed; re-enable the update-group-clients cron). `cron_runs` can stay. Audit/log writes are additive and safe to leave. Archive files in Spaces are never deleted by the app.

## E. Open items
Face threshold calibration; merge loanCycle collisions; compliance minimum retention for audit records; pre-existing failing test files: transfer-offset-current-loss, presave-sql-repair-retention (X2/X3), rollback-advance-network (mock lacks `getNonWorkingReason`), index/db tests (ObjectId).

## F. Hasura cron trigger schedule changes
Hasura cron expressions are **UTC**; PHT = UTC+8 (a "00:00 PHT" job is `16:00` UTC the day before). The app guard (`cron_runs`) makes overlaps safe, but stagger heavy jobs anyway. Note the current schedule of each trigger from Hasura before changing anything; the "Recommended" column is a suggestion to confirm, not a copy of what is set today.

| Job (URL under `/api/v2/cronjobs/`) | Change | Recommended schedule |
|---|---|---|
| `clean-advance-days-loan` | Keep. Business rule: reset every Sunday PHT. Make sure the cron is in UTC for the intended moment. | Sunday 00:00 PHT = `0 16 * * 6` (Sat 16:00 UTC) — confirm |
| `update-advance-days-loan` | Repoint URL from the old `/transactions/loans/...` route to the new cronjobs route. Same schedule as today. | unchanged |
| `update-group-clients` | Repoint to the new route for now; **delete the trigger** after one verified business day (group counters now maintained by the DB trigger 011). | remove |
| `clean-up-logs` | Keep. Now also cleans audit_logs, user_activity_logs, face_verify_attempts and dumps to Spaces; runs in background and can take longer. Run once daily off-peak. | daily 02:00 PHT = `0 18 * * *` |
| `clean-up-loan-history` | Keep (3-day retention, unchanged). Do not overlap with clean-up-logs. | daily 03:00 PHT = `0 19 * * *` |
| `detect-duplicate-clients` | NEW from `migration`: add the nightly trigger if not present yet (now locked via `cron_runs`). | daily 01:00 PHT = `0 17 * * *` |

Checklist for the change:
- [ ] Screenshot or note the current schedule of every trigger before editing (rollback reference).
- [ ] Decide once: schedules written in UTC or PH-equivalent; convert all of them consistently.
- [ ] Each trigger: webhook URL points to `https://<prod host>/api/v2/cronjobs/<job>`, header `x-webhook-api-key` set, retry config sane (the app answers 200 `skipped` when a run is already in progress, so no retry storm).
- [ ] No two heavy jobs start in the same minute.
- [ ] After the first scheduled run of each: `cron_runs` has a row with the expected `trigger = cron` and `success`.
- [ ] Old duplicate triggers (pointing at removed routes) deleted — they would 404.
