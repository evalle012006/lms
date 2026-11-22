# LMS — Staging test checklist and Production runbook (updated 2026-11-22 12:56 PHT, exclusions verified on prod)

Branch: `duplicate-feature` (merged/deployed; Donie commits/pushes/deploys manually).
Scope of this release, in build order: **(1) Duplicate Clients feature** → (2) cron hardening (`cron_runs`, group slot trigger) → (3) logging / audit / log retention → (4) production stability fixes found during rollout (Apollo mutation-cache leak, `/_next/image` CPU).

## 0. Database migrations in this release (`database/postgre-migrations/`)
Run order matters. "Staging" = confirm from `\d` / Hasura before assuming.

| # | File | What it does | Run | Hasura step | Staging | Prod |
|---|------|--------------|-----|-------------|---------|------|
| 004 | `004_client_fill_assignment_trg.sql` | Trigger: active client must have group + LO | before deploy | none | ? | done |
| 005 | `005_duplicate_clients.sql` | Tables `duplicate_client_clusters`, `duplicate_scan_runs` + indexes | before deploy | **track both tables**, reload | ? | done |
| 006 | `006_duplicate_review.sql` | Review columns on clusters (not touched by rescans) | after 005 | reload | ? | done |
| 007 | `007_face_template_vec.sql` | `vector` ext, `faceTemplateVec`, sync trigger, backfill, `fn_find_duplicate_faces` | before deploy | **track `fn_find_duplicate_faces` as QUERY function**, reload | ? | **DEFERRED (no pgvector)** |
| 008 | `008_face_template_vec_idx.sql` | HNSW index (`CREATE INDEX CONCURRENTLY`, alone, outside a transaction) | after 007 | none | ? | **DEFERRED** |
| 009 | `009_face_uniqueness_setting.sql` | `settings."enforceFaceUniqueness"` (default ON) | **before** deploy | reload | ? | done |
| 010 | `010_cron_runs.sql` | `cron_runs` lock/history table | before deploy | track `cron_runs` | ? | done |
| 011 | `011_group_slots_trigger.sql` | Group counters/slots maintained by DB trigger | after 010 | none | ? | done |
| 012 | `012_duplicate_exclusions.sql` | Table `duplicate_client_exclusions` (`_id` 'a\|b' PK, client_a < client_b, note, created_by…) for per-row "Not same person" | before deploying the exclusion feature | track `duplicate_client_exclusions`, reload | ? | **done 2026-11-22** (constraints `_pkey` + `_check` verified) |

Also in the folder but not part of this feature: 001 offline upload, 002/003 face recapture, `006_hris_integration.sql` (two files numbered 006).

**012 deploy order (important):** (1) run SQL on the DB server: `docker exec -i apps-postgres-1 psql -U postgres -d <db> -v ON_ERROR_STOP=1 < 012_duplicate_exclusions.sql`; (2) Hasura: track the table, reload metadata; (3) deploy the app. The scan loads exclusions fail-soft (missing table → scan still runs, `timings.exclusions` shows the skip), but the "Not same person" button will fail until the table is tracked.

**Production DB: Option B — release WITHOUT face matching first.** Prod DB is `apps-postgres-1` (plain `postgres:15`), Hasura `apps-lms-hasura-1` v2.37.0, no pgvector. Code never selects `faceTemplateVec`; `lib/face-duplicate.js` returns `available:false` when `fn_find_duplicate_faces` is missing (no check, no block, even with Enforce Face Uniqueness ON). 009 is still required. `DUPLICATE_SCAN_FACES=off` on all app containers.
- **Later window (face matching):** `pg_dump` backup → compose image `pgvector/pgvector:pg15` (same volume; confirm named volume/bind mount via `docker inspect`) → `docker compose up -d postgres` (~10–30 s downtime, night) → reload Hasura → verify `pg_available_extensions` has `vector` → 007, then 008 alone, track `fn_find_duplicate_faces`, reload, test. Then set `DUPLICATE_SCAN_FACES` on and calibrate the threshold.

### Production progress (updated 2026-11-22)
- [x] Migrations 004–006, 009–011 run on prod; Hasura tracking done (`duplicate_client_clusters`, `duplicate_scan_runs`, `cron_runs`, `settings.enforceFaceUniqueness`).
- [x] `x-webhook-api-key` header on all four cron triggers; `update-advance-days-loan` URL is `/api/v2/cronjobs/update-advance-days-loan`.
- [x] Production deployed; Enforce Face Uniqueness OFF.
- [x] Prod smoke test: manual **Scan now** completes (success). Latest full scan: 105,752 clusters, 254,370 matched clients, 10,289 rejected links, 0 oversized, 1,763 new, 1,689 resolved, 4 alerts, 340,887 ms (~5.7 min), heap ~1 GB throughout.
- [x] Scan OOM fixed (Apollo mutation-cache leak, see section G). Fixes for `cron_runs` status truth, branch-name fallback, chaining (cannot-link constraints), remarks column deployed.
- [x] `/_next/image` CPU fix (`PrivateImage` `unoptimized`) deployed.
- [x] **012 + exclusion feature** applied, tracked and deployed. Verified on prod 2026-11-22: one click on "Not same person" wrote 5 rows (excluded record vs each of the 5 other members); audit `DUPLICATE_MARKED_NOT_SAME_PERSON` present; scan with exclusions loaded `exclusions: 5`, `rejectedLinks` 10,289 → 10,294 (+5), group shrank 6 → 5 and the excluded record did not return; scan 335 s, success.
- [x] **Nightly trigger restored** to `0 17 * * *` (2026-11-22) after four clean full scans. First nightly: Mon 23 Nov 01:00 PHT. E.1 scope decision deliberately left as is for now (all groups still detected and shown).
- [ ] Tomorrow: `cron_runs` row `detect-duplicate-clients` `trigger=cron` success; `alerts` ≤ 200 (cap); `clean-up-logs` row shows `archive: "spaces"`; container memory trend.
- [ ] Section 8b (retention/archive) live run still unverified anywhere. `clean-up-logs` is scheduled daily `0 18 * * *` — verify `cron_runs` stats show `archive: "spaces"` and files exist in Spaces, or disable the trigger until verified.
- [ ] Confirm in every app container: `WEBHOOK_API_KEY`, `ENABLE_DB_LOGGING=true`, `SPACES_ACCESS_KEY/SECRET_KEY/BUCKET/ROOT`.
- [ ] Optional: `update-advance-days-loan` retries 2 (app answers `skipped` when running, so retries are safe).
- [ ] Verify memory plateau across all 10 containers over a few days (section G).

### Environment variables (app containers)
| Var | Prod value | Purpose |
|---|---|---|
| `WEBHOOK_API_KEY` | set | cron route auth (`x-webhook-api-key`) |
| `ENABLE_DB_LOGGING` | `true` | `lms_logs` writer |
| `SPACES_*` | set | log archive + uploads |
| `LOG_ARCHIVE_DISABLE` | absent (never `true`) | archive off switch |
| `DUPLICATE_SCAN_FACES` | `off` | skip face phase (no pgvector) |
| `DUPLICATE_SCAN_FACE_MAX_MS` | default | cap on face phase when enabled |
| `SCAN_HEAP_GUARD` | default 0.85 of heap limit | scan aborts (after forced GC) before the container OOMs |
| `DUPLICATE_ALERT_MAX` | default 200 | more new alertable groups than this → one summary audit `DUPLICATE_CLIENTS_DETECTED` (`suppressed:true`) instead of per-group alerts |
| node `--max-old-space-size` | 6144 | heap limit |

## A. Staging tests (after deploy)

### Cron jobs
| # | Test | Status |
|---|------|--------|
| 1 | Old duplicate routes return 404 | PASS |
| 2 | New `/api/v2/cronjobs/*` return "Invalid Token" without key | PASS |
| 3 | With key: `cron_runs` gets a `success` row | PASS |
| 4 | Second call while first runs → `{skipped:true}` | PASS |
| 5 | clean-up-logs run row has stats | PASS (old format; see 8b) |
| 6 | Stale `running` row expires after `staleMinutes` | PASS |
| 7 | Sunday advanceDays reset: 1→0 on loans only | PASS |
| 7b | `cashCollections.advanceDays` untouched after the reset | TODO |
| 7c | `detect-duplicate-clients` fired twice at once → second `already_running`; row ends `success` | TODO |
| 7d | **NEW** A failing scan (e.g. force heap guard / bad payload) closes its `cron_runs` row as `failed` with the error (previously showed `success`) | TODO (verified on prod incidentally: OOM scans now show failed) |

### 8. lms_logs
Persisted = level warn/error OR any entry with `user_id` or `userId`. Batched (≤2 s / 50 rows). Needs `ENABLE_DB_LOGGING=true`.
- [ ] Loan save / LOR submit → rows within ~3 s, `user_id` filled.
- [ ] Login rows stored; anonymous info/debug lines NOT.
- [ ] Forced error → error row.
- [ ] Hasura down briefly → requests succeed; no log loop.

### 8b. Log retention / archive (`clean-up-logs`)
Windows: lms_logs 7d (no dump) · audit_logs 365d business · audit_logs 30d noise (`GROUP_QR_ACCESSED_EXPIRED`, `SYSTEM_SECRET_VIEWED`) · user_activity_logs 90d · face_verify_attempts 30d. All but lms_logs dumped to Spaces (`<SPACES_ROOT>/log-archive/<table>/<date>/…ndjson.gz`) before deletion. Background; max 100,000 rows/table/run.
- [ ] Route with key → immediate 200; `cron_runs` ends `success` with per-pass stats and `archive: "spaces"`.
- [ ] Files appear in Spaces; `gunzip` one; rows correct; no `faceTemplate`.
- [ ] Rows for loans still `pending`/`tomorrow` are NOT deleted.
- [ ] `LOG_ARCHIVE_DISABLE=true` → deletes, `archive: "off"`, no files. Archive is ON only when the var is not `true` AND `SPACES_ACCESS_KEY` + `SPACES_BUCKET` are set; otherwise it deletes WITHOUT dumping — always check `archive: "spaces"`.
- [ ] Wrong Spaces keys → that table errors and keeps rows; others still run.
- [ ] App restart mid-job kills it (in-process); row stays `running` until stale expiry (30 min scan / 60 min clean-up-logs). No data damage.
- [ ] Compliance: no mandated minimum retention for audit records (overrides windows).

### 9. Group slot trigger (011)
- [ ] Add / reject / offset loan → `noOfClients`, `availableSlots`, `status` update without cron.
- [ ] Mismatch query returns 0 rows.

### 10–11. Transfers and schedule recalculation
- [ ] Weekly standard → accelerated: 12 terms, `weeklyScheduleType` accelerated.
- [ ] Accelerated → standard: 24 terms.
- [ ] Daily ↔ weekly recalculates as before.
- [ ] Group edit: schedule/occurence change blocked while `noOfClients > 0`.

### 12. Duplicate Clients — admin page (Settings → Duplicate Clients; admin/root only)
Preconditions: 005–006, 009–011 applied (012 for exclusions), tables tracked, metadata reloaded. Seed at least one pair per scenario.
- [ ] Opens for admin/root; non-admin gets no access (menu hidden, API rejects).
- [ ] **Scan now** → progress; run ends success; clusters appear; second click → "already running".
- [ ] Failed/aborted scan → retry works; stale run does not block forever.
- [ ] Confidence labels (exact / high / possible) correct. **Group confidence = weakest link** in the group, not the strongest pair.
- [ ] Views Active / Closed / Same client; header counts match list.
- [ ] Pagination, sorting, filters (branch, LO, group, confidence, review status) combine correctly.
- [ ] **Layout (NEW)**: table uses the full page width (no empty side gutters; no horizontal scroll at 1440 px+); filters are 7 columns at ≥1024 px and stack below that. Note: this project's Tailwind config defines only the `lg` breakpoint, so use `lg:` — `sm:/md:/xl:` classes do nothing.
- [ ] **Branch / LO columns (NEW)**: Branch shows the name (falls back to branch lookup when `branchName` is empty); `-` only when the client truly has no branchId (31) or no LO (~34k clients; data cleanup item).
- [ ] **Chaining (NEW)**: A≈B and B≈C where A and C are different people (different birthdates, no shared phone) → A and C are NOT put in one group; stats show `rejectedLinks > 0`. Real duplicates (same name+birthdate, 3 records) still form one exact group. No group larger than `MAX_CLUSTER_SIZE` (60; `oversizedLinks` = 0 on prod today).
- [ ] **Remarks column (NEW)**: each member row shows how it relates to the group's reference record (best-connected one): what matches, what differs (birthdate, middle initial, branch, LO, group…); tooltips on the scenario pills explain each pill. Header reasons line only shows when there are no remarks.
- [x] **"Not same person" (needs 012)** — PASS on prod 2026-11-22: per-row button → modal (note optional; consider making it required) → member leaves the group; **one click inserts N rows** (excluded record vs every remaining member, `_id` 'a|b' sorted) so the scan cannot re-link it through another member; audit `DUPLICATE_MARKED_NOT_SAME_PERSON`; full rescan keeps the record out (`timings.exclusions` = row count, `rejectedLinks` up by that count). Known limits: cannot say "different from A but same as B" (use Merge/Confirm for that); no undo in the UI — manual undo: `DELETE FROM duplicate_client_exclusions WHERE client_a='<id>' OR client_b='<id>';` then rescan.
- [ ] Still to test: non-admin rejected; repeat click idempotent; group left with <2 members disappears; **review status after exclusion** — a rescan resolved the old 6-member cluster and created a new 5-member one (`newClusters 1`, `resolvedClusters 1`), so a Confirmed/Not-a-duplicate decision on the old cluster may not carry over. Check on a reviewed group; if lost, fix (carry review fields to the successor cluster).
- [ ] Cluster `_id` stable after a rescan when a member is added (a member REMOVED, e.g. by exclusion, produced a new cluster — see above).
- [ ] **Excel export**: all / selected / filtered; opens; columns and counts match; no biometric data.
- [ ] Review: **Confirmed duplicate** / **Not a duplicate** (note) → saved, audited, survives rescan.
- [ ] Rescan single cluster / full rescan does not duplicate clusters.
- [x] **Scan stats** (verified 2026-11-22: live heap 719–1267 MB, 335 s): `duplicate_scan_runs.stats` contains `clusters`, `matched`, `rejectedLinks`, `oversizedLinks`, `timings.liveHeapMb` {afterFetch, afterDetect, afterEnrich} (expect ~1 GB, flat). Query: `SELECT status, stats->'clusters', stats->'rejectedLinks', stats->'oversizedLinks', stats->'timings'->'liveHeapMb' FROM duplicate_scan_runs ORDER BY started_at DESC LIMIT 5;`
- [ ] First nightly run after restoring the trigger: new `both_active` groups raise alerts, capped at `DUPLICATE_ALERT_MAX` (200) with one summary audit row if exceeded.

### 13. Duplicate Clients — merge
- [ ] Merge (master + duplicate): loans, cashCollections, savings/other child rows move to master; duplicate ends `merged`, leaves lists.
- [ ] Both with an **active loan** → blocked with clear message.
- [ ] Merge with a closed record works; cluster updates (`onClientMerged`, uses `dropMember`); audit row.
- [ ] Caller who cannot see either side cannot merge.
- [ ] Known open item: `loanCycle` collisions after merge — record what happens.

### 14. Duplicate guard at entry
Policy: exact/high match to a client with ACTIVE or PENDING loan → **block**; otherwise **warn only**. Admin/supervisor may override with reason (audited).
- [ ] Add client (legacy drawer / `clients/save`) matching an active-loan client → block with match list.
- [ ] Admin/supervisor with `overrideDuplicate` + reason → saves; audit `DUPLICATE_BLOCK_OVERRIDDEN`; no reason / branch-level user → blocked.
- [ ] Match only a closed client or "possible" → warning only.
- [ ] LAF promote blocked the same way; skipped when admin already reviewed at the duplicate-validation step.
- [ ] Public LAF submit: flagged (`isDuplicateFlagged`, candidate ids); public caller never sees details, never hard-blocked; lookup error does not block.
- [ ] Guard failure (stop Hasura briefly) → save continues (fail-open), error logged.

### 15. Dashboard widget, CI review panel, face matching, settings
- [ ] Duplicate Alerts widget counts match the admin page for the role/scope; modal shows the right clients.
- [ ] CIReviewPanel shows possible duplicates; no cross-branch leaks.
- [ ] Face matching (staging only for now): enrolled face on another client → flagged/blocked per setting; HNSW index used.
- [ ] Recapture/enroll keep `faceTemplateVec` in sync.
- [ ] Enforce Face Uniqueness ON blocks / OFF allows; toggle persists.
- [ ] Face function missing → app works, checks skipped (this is the prod state today).
- [ ] Nightly cron with key → success, clusters refreshed, review decisions and exclusions preserved.
- [ ] Merge with `migration` (PR #526): our versions of `duplicate-clients-job.js`, `duplicates/list.js`, `settings/duplicate-clients/index.js` are deployed.

### 16–17. LOR pre-save
- [ ] Pre-save row copies `advanceDays` from the loan.
- [ ] Weekend/holiday: no weekly pre-save rows.

### 18. Audit logs (Settings → System → Audit Logs)
New categories: GROUP, BRANCH, TRANSFER, COLLECTION, SAVINGS. User name, role, branch name resolved from ids (new rows). Check each action creates exactly one row with correct user, branch, client, before/after:

| Area | Action | Expected audit action |
|------|--------|----------------------|
| Duplicates | Review / merge / override guard / **not-same-person** | duplicate review, merge, `DUPLICATE_BLOCK_OVERRIDDEN`, `CLIENT_FACE_VERIFICATION_OVERRIDDEN`, `DUPLICATE_MARKED_NOT_SAME_PERSON` |
| CI | Approve / decline | `CI_APPROVED` / `CI_DECLINED` |
| Loans | Add application | `LOAN_CREATED` |
| Loans | LDF approve / unapprove | `LOAN_LDF_APPROVED` / `LOAN_LDF_UNAPPROVED` |
| Loans | Final approve | `LOAN_FINAL_APPROVED` (or `LOAN_APPROVED`) |
| Loans | Reject (new/reloan) | `LOAN_REJECTED`, metadata.reloan for cycle > 1 |
| Loans | Pending loan update Reloaner/Offset | `PENDING_LOANS_UPDATED` |
| Loans | Close account | `CLIENT_ACCOUNT_CLOSED` |
| Groups | Create / edit / delete | `GROUP_CREATED` / `GROUP_UPDATED` / `GROUP_DELETED` |
| Branches | Create / edit / lock / delete | `BRANCH_CREATED` / `_UPDATED` / `_LOCK_UPDATED` / `_DELETED` |
| Transfers | Request / edit / delete | `TRANSFER_REQUESTED` / `_UPDATED` / `_DELETED` |
| Transfers | Approve / reject / revert / repair | `TRANSFER_APPROVED` / `_REJECTED` / `_REVERTED` / `_REPAIRED` |
| LOR | Save Draft / Submit | `COLLECTION_DRAFT_SAVED` / `COLLECTION_SUBMITTED` |
| LOR | Reloaner / Offset row | `LOR_RELOANER` / `LOR_OFFSET` |
| LOR | Revert offset / reloan / payment | `LOR_REVERT_OFFSET` / `_RELOAN` / `_RELOANER` / `_PAYMENT` |
| LOR | Close/reopen LO or branch transactions | `LO_TRANSACTIONS_CLOSED/OPENED`, `BRANCH_TRANSACTIONS_CLOSED/OPENED` |
| Savings | Return/withdrawal; request/edit/delete; bulk approve/reject | `SAVINGS_RETURN_OR_WITHDRAWAL`, `SAVINGS_WITHDRAWAL_*` |
| Safety nets | only if saveV2 repaired data | `COLLECTION_AUTO_HEALED`, `LOAN_AUTO_HEALED_CLOSE` (should never appear normally) |

No passwords or biometric data in any before/after/metadata; a failed audit insert never breaks the user action.

## B. Recurring bug watch (every QA run)
Saved `mcbu` vs `mcbuCol`, `csf` vs `csfCollection`; MCBU collection added to `loans.mcbu` and `cashCollections`; missing cashCollections after reloan; closed cashCollections row with unclosed loan; advanceDays drift between loan and collection.

## C. Production steps (in order)
1. Back up DB. Check prerequisites (section 0).
2. Run migrations before the deploy via `docker exec -i apps-postgres-1 psql ...`: 004 (if missing) → 005 → 006_duplicate_review → 009 → 010 → 011 → **012 (exclusion feature)**. Skip 007/008 on prod.
3. Hasura: track `duplicate_client_clusters`, `duplicate_scan_runs`, `cron_runs`, **`duplicate_client_exclusions`**; reload metadata. Do NOT track `fn_find_duplicate_faces`.
4. Group-slot mismatch check after 011 (expect 0 rows).
5. Deploy. Confirm env vars in all containers (table above).
6. Update Hasura cron triggers (section F).
7. 48-loan label repair SQL (expect `UPDATE 48`).
8. Enforce Face Uniqueness OFF; first manual **Scan now**; review with the business before enabling blocking.
9. Verify: `cron_runs` success rows, `duplicate_scan_runs` success, `lms_logs` rows, Audit Logs categories, Duplicate Alerts widget.
10. After the first nightly `clean-up-logs`, confirm archive files in Spaces (first run may delete a large backlog, capped per run).
11. After deploying the stability fixes (G): watch container memory and `/_next/image` volume for 24–48 h.

## D. Rollback
App: redeploy previous build. DB: `DROP TRIGGER trg_loans_refresh_group_ins/_upd/_del ON loans;` (counters stay; re-enable update-group-clients cron). New tables/columns (005, 006, 009, 010, 012, `faceTemplateVec`) are additive and can stay. Exclusions: the old build ignores `duplicate_client_exclusions`. If face matching misbehaves, set Enforce Face Uniqueness OFF. To stop the nightly scan without a deploy, set the trigger back to `0 17 1 1 *`. To undo an exclusion: `DELETE FROM duplicate_client_exclusions WHERE client_a='<id>' OR client_b='<id>';` then rescan. Archive files in Spaces are never deleted by the app.

## E. Open items
1. **Scan/review scope decision (left as is by Donie for now; nightly already restored).** The chaining fix reduced group size and confidence inflation (biggest active group 30 → 11, exact active 8,405 → 4,480) but did NOT reduce the total: ~105.7k groups, of which ~94.7k are Closed/Offset-only (biggest 10, 39,140 exact) and only ~11k have an active loan. Nobody can review 94k groups. Options: (a) keep detecting everything but default the page/alerts to groups with an active loan (+ `exactClosedVsActive`); (b) stop persisting closed-only groups; (c) keep all, review by priority. Recommendation: (a).
2. Face threshold calibration (`FACE_MATCH_THRESHOLD` 0.5 is a starting value) — blocked until pgvector window.
3. Data quality: 34,413 clients without LO (`loId`/`oldLoId`), 31 without branchId, 95,693 with branchId but empty `branchName` (display now falls back; data still empty).
4. Merge `loanCycle` collisions; audit-record minimum retention; UTC vs PH cron convention; first-run retention backlog size.
5. `/_next/image` follow-ups: generate thumbnails at upload time (client lists load full-size photos); some `lms/profiles/*` Spaces objects return 404 — find and fix or fall back.
6. Other dead Tailwind classes: 36 `md:grid-cols-*` (and any `sm:/xl:`) elsewhere don't apply because `theme.screens` only defines `lg`. Either add the breakpoints back or convert to `lg:` — check pages before changing (it will alter layouts).
7. Pre-existing failing test files: transfer-offset-current-loss, presave-sql-repair-retention (X2/X3), rollback-advance-network (mock lacks `getNonWorkingReason`), index/db tests (ObjectId).
8. `fetchAll` (duplicate job) now throws on a GraphQL `errors` response; previously `errorPolicy: 'all'` turned any error into an empty list (a failed client/loan fetch would have looked like "no duplicates" and resolved every cluster). Commit with the exclusion feature.
9. Live heap in the scan varied 719–1267 MB (afterFetch) across runs/containers; limit 6144 MB. Compare `timings.liveHeapMb.afterFetch` across nightly runs — a steady climb in the same container would mean a slow leak.
10. Scans run in-process in one of 10 app containers (nginx round-robin) — a restart/deploy during a scan kills it (row stays `running` until 30 min stale expiry). Consider a dedicated worker container if scan duration grows.

## F. Hasura cron trigger schedule (UTC; PHT = UTC+8)
App guard (`cron_runs`) makes overlaps safe; stagger heavy jobs anyway.

| Job (URL under `/api/v2/cronjobs/`) | Change | Schedule |
|---|---|---|
| `update-advance-days-loan` | Only advanceDays job. Sets `loans.advanceDays` = 0 where > 0 (Sunday reset). | Sun 00:00 PHT = `0 16 * * 6` (current) |
| `update-group-clients` | Repoint, then **delete the trigger** after one verified business day (DB trigger 011 maintains counters). | remove |
| `clean-up-logs` | Also cleans audit_logs, user_activity_logs, face_verify_attempts; dumps to Spaces; background. | daily 02:00 PHT = `0 18 * * *` (current) |
| `clean-up-loan-history` | 3-day retention; don't overlap with clean-up-logs. | daily 03:00 PHT = `0 19 * * *` (current) |
| `detect-duplicate-clients` | Restored to nightly 2026-11-22 (was parked at `0 17 1 1 *`); scan takes ~6 min. | daily 01:00 PHT = `0 17 * * *` (current) |

Checklist:
- [x] Current schedules noted (screenshots 2026-11-22).
- [ ] Each trigger: URL `https://<prod host>/api/v2/cronjobs/<job>`, header `x-webhook-api-key`, sane retries (app answers 200 `skipped` if running).
- [ ] No two heavy jobs start in the same minute.
- [ ] After the first scheduled run of each: `cron_runs` row with `trigger = cron` and `success` (a scan failure is now reported as `failed`, not `success`).
- [ ] Old duplicate triggers pointing at removed routes deleted (they 404).
- [x] `detect-duplicate-clients` restored to `0 17 * * *`.

## G. Production stability fixes found during rollout (verification)
**G1. Scan OOM — Apollo mutation cache leak (root cause).** Apollo Client 2.6.10 (apollo-boost) `InMemoryCache` retained every mutation's variables (~5× the payload) because `defaultOptions.mutate` lacked `fetchPolicy: 'no-cache'` (queries already had it). The leak was global (all containers, all mutations), and the scan's bulk inserts exposed it (heap hit ~5.6 GB at the save phase). Fix: `defaultOptions.mutate = { fetchPolicy: 'no-cache' }` in `src/lib/graph/graph.provider.ts`; test `__tests__/clients/graph-no-cache.test.js`. Companion hardening: heap guard forces a GC before failing, arrays released after detect, streamed persist.
- [ ] Scan: `timings.liveHeapMb` ≈ 1 GB at all three points; scan success (✔ 2026-11-22, 05:xx and 04:10 runs).
- [ ] Container memory (`docker stats`) across the 10 app containers: flat over 24–48 h instead of climbing until restart.
- [ ] Side effect to watch: code that relied on Apollo mutation results being written to cache (nothing known; watch for stale UI after mutations on pages that use `cache-first` reads — queries are `no-cache`, so none expected).

**G2. High CPU — `/_next/image`.** `PrivateImage.js` fed pre-signed Spaces URLs (unique query string each time, never cacheable) through the Next image optimizer, re-optimizing on every view (2,168 s of request time in a short window; 499s/404s). Fix: `unoptimized` on `<Image>` (browser loads from Spaces directly).
- [ ] nginx: `/_next/image` request count near zero; top-endpoint CPU/request time normal.
- [ ] Photos still load (Spaces direct URL; pre-signed URL not expired / CORS fine); no new 403s.
- [ ] Follow-up (E.5): thumbnails; missing `lms/profiles/*` objects.

**G3. Cron truthfulness.** `startDuplicateScan` closes the `cron_runs` row with the real outcome (`runScan` returns `{ok, error}`); stale rows no longer say `success` for failed scans.

**G4. Heap guard.** `SCAN_HEAP_GUARD` default 0.85 × limit; message: `memory guard: heap X MB of Y MB in <label> — stopped before the app container ran out of memory`. If it ever fires again, check `liveHeapMb` first: a high live heap means a real leak, not guard tuning.
