#!/bin/bash
# =============================================================================
# LMS Database Migration: Production -> Development
# Compatible with bash 3.2+ (macOS default)
# =============================================================================
# PROD: SSH tunnel -> acdbadmin@188.166.226.53  -> localhost:5432
# DEV:  SSH tunnel -> lmsdbadmin@143.198.90.76  -> localhost:5432
# =============================================================================

set -uo pipefail

# =============================================================================
# CONFIGURATION — edit these before running
# =============================================================================

PROD_SSH_HOST="188.166.226.53"
PROD_SSH_PORT="22"
PROD_SSH_USER="acdbadmin"
PROD_SSH_PASSWORD=""      # leave empty to use SSH key
PROD_SSH_KEY=""
PROD_TUNNEL_PORT="15432"

PROD_DB_HOST="localhost"
PROD_DB_PORT="$PROD_TUNNEL_PORT"
PROD_DB_NAME="acloandb"
PROD_DB_USER="postgres"
PROD_DB_PASSWORD="Ac_db_Admin"

DEV_SSH_HOST="143.198.90.76"
DEV_SSH_PORT="22"
DEV_SSH_USER="lmsdbadmin"
DEV_SSH_PASSWORD=""
DEV_SSH_KEY=""
DEV_TUNNEL_PORT="15433"

DEV_DB_HOST="localhost"
DEV_DB_PORT="$DEV_TUNNEL_PORT"
DEV_DB_NAME="postgres"
DEV_DB_USER="postgres"
DEV_DB_PASSWORD="postgres"

DATE_FILTER="2025-10-01"
SCHEMA="public"
DUMP_DIR="/tmp/lms_migration_$(date +%Y%m%d_%H%M%S)"

# Loans filter: use dateGranted column
LOANS_DATE_COL="dateGranted"

# cashCollections filter
CC_DATE_COL="dateAdded"

# =============================================================================
# COLORS
# =============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()     { echo -e "${CYAN}[$(date '+%H:%M:%S')]${NC} $*"; }
success() { echo -e "${GREEN}[$(date '+%H:%M:%S')] OK${NC} $*"; }
warn()    { echo -e "${YELLOW}[$(date '+%H:%M:%S')] WARN${NC} $*"; }
error()   { echo -e "${RED}[$(date '+%H:%M:%S')] ERROR${NC} $*"; exit 1; }

export PGCONNECT_TIMEOUT=10
PROD_TUNNEL_PID=""
DEV_TUNNEL_PID=""

# =============================================================================
# SPINNER — writes only to stderr so it never pollutes stdout captures
# =============================================================================
SPINNER_PID=""

spinner_start() {
  local MSG="${1:-Working...}"
  ( local S=0; local C="/-\\|"
    while true; do
      printf "\r  %s %s   " "${C:$S:1}" "$MSG" >&2
      S=$(( (S+1) % 4 )); sleep 0.15
    done ) &
  SPINNER_PID=$!
}

spinner_stop() {
  if [ -n "$SPINNER_PID" ] && kill -0 "$SPINNER_PID" 2>/dev/null; then
    kill "$SPINNER_PID" 2>/dev/null
    wait "$SPINNER_PID" 2>/dev/null || true
    SPINNER_PID=""
    printf "\r\033[2K" >&2
  fi
}

trap 'spinner_stop; close_all_tunnels' EXIT

# =============================================================================
# TUNNELS
# =============================================================================

_open_tunnel() {
  local LABEL=$1 S_HOST=$2 S_PORT=$3 S_USER=$4 S_PASS=$5 S_KEY=$6 L_PORT=$7

  if nc -z localhost "$L_PORT" 2>/dev/null; then
    warn "[$LABEL] Port $L_PORT already in use — reusing"
    lsof -ti "TCP:${L_PORT}" 2>/dev/null | head -1 || true; return
  fi

  log "[$LABEL] SSH tunnel: ${S_USER}@${S_HOST} -> localhost:${L_PORT}"
  local OPTS="-N -f -o StrictHostKeyChecking=no -o ExitOnForwardFailure=yes"
  OPTS="$OPTS -o ServerAliveInterval=30 -o ServerAliveCountMax=3"
  OPTS="$OPTS -p ${S_PORT} -L ${L_PORT}:localhost:5432"
  [ -n "$S_KEY" ] && OPTS="$OPTS -i $S_KEY"

  if [ -n "$S_PASS" ]; then
    command -v sshpass >/dev/null 2>&1 || error "sshpass not installed: brew install sshpass"
    # shellcheck disable=SC2086
    sshpass -p "$S_PASS" ssh $OPTS "${S_USER}@${S_HOST}"
  else
    # shellcheck disable=SC2086
    ssh $OPTS "${S_USER}@${S_HOST}"
  fi

  local R=15
  while ! nc -z localhost "$L_PORT" 2>/dev/null; do
    R=$(( R-1 )); [ $R -eq 0 ] && error "[$LABEL] Tunnel failed on port $L_PORT"
    sleep 1
  done
  local PID; PID=$(lsof -ti "TCP:${L_PORT}" 2>/dev/null | head -1 || true)
  success "[$LABEL] Tunnel open (PID: ${PID:-?}, port: $L_PORT)"
  echo "${PID:-}"
}

open_tunnels() {
  PROD_TUNNEL_PID=$(_open_tunnel "PROD" "$PROD_SSH_HOST" "$PROD_SSH_PORT" \
    "$PROD_SSH_USER" "$PROD_SSH_PASSWORD" "$PROD_SSH_KEY" "$PROD_TUNNEL_PORT")
  DEV_TUNNEL_PID=$(_open_tunnel "DEV" "$DEV_SSH_HOST" "$DEV_SSH_PORT" \
    "$DEV_SSH_USER" "$DEV_SSH_PASSWORD" "$DEV_SSH_KEY" "$DEV_TUNNEL_PORT")
}

close_all_tunnels() {
  for PID in "$PROD_TUNNEL_PID" "$DEV_TUNNEL_PID"; do
    [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null && kill "$PID" 2>/dev/null || true
  done
}

# =============================================================================
# DB HELPERS
# =============================================================================

prod_psql() {
  PGPASSWORD="$PROD_DB_PASSWORD" psql \
    -h "$PROD_DB_HOST" -p "$PROD_DB_PORT" \
    -U "$PROD_DB_USER" -d "$PROD_DB_NAME" "$@"
}

dev_psql() {
  PGPASSWORD="$DEV_DB_PASSWORD" psql \
    -h "$DEV_DB_HOST" -p "$DEV_DB_PORT" \
    -U "$DEV_DB_USER" -d "$DEV_DB_NAME" "$@"
}

# =============================================================================
# CONNECTION TEST
# =============================================================================

test_connections() {
  spinner_start "Testing PROD DB..."
  local OUT RC
  OUT=$(prod_psql -t -A -c "SELECT current_database()||'/'||current_user;" 2>&1); RC=$?
  spinner_stop
  [ $RC -ne 0 ] && { echo "$OUT"; error "PROD connection failed. Check PROD_DB_* config."; }
  success "PROD: $OUT"

  spinner_start "Testing DEV DB..."
  OUT=$(dev_psql -t -A -c "SELECT current_database()||'/'||current_user;" 2>&1); RC=$?
  spinner_stop
  [ $RC -ne 0 ] && { echo "$OUT"; error "DEV connection failed. Check DEV_DB_* config."; }
  success "DEV:  $OUT"
}

# =============================================================================
# COPY A TABLE FROM PROD TO A CSV FILE
# Uses a temp sql file written with shell expansion, then fed to psql
# =============================================================================

dump_table_to_csv() {
  local TABLE=$1
  local WHERE_CLAUSE=$2      # empty string = no filter
  local OUTFILE="$DUMP_DIR/${TABLE}.csv"
  local TMPFILE="$DUMP_DIR/.copy_${TABLE}.sql"

  spinner_start "[$TABLE] Dumping..."

  if [ -n "$WHERE_CLAUSE" ]; then
    # Write the COPY command to a temp file using printf so vars expand
    printf '\\COPY (SELECT * FROM %s."%s" WHERE %s) TO STDOUT WITH CSV HEADER\n' \
      "$SCHEMA" "$TABLE" "$WHERE_CLAUSE" > "$TMPFILE"
  else
    printf '\\COPY (SELECT * FROM %s."%s") TO STDOUT WITH CSV HEADER\n' \
      "$SCHEMA" "$TABLE" > "$TMPFILE"
  fi

  prod_psql -f "$TMPFILE" > "$OUTFILE" 2>"$DUMP_DIR/.err_${TABLE}.txt"
  local RC=$?
  rm -f "$TMPFILE"
  spinner_stop

  if [ $RC -ne 0 ]; then
    local ERR; ERR=$(cat "$DUMP_DIR/.err_${TABLE}.txt" 2>/dev/null)
    warn "  [$TABLE] COPY failed: $ERR"
    rm -f "$OUTFILE"
    return 1
  fi

  if [ ! -s "$OUTFILE" ]; then
    warn "  [$TABLE] Empty result — table may be empty"
    # Keep the file (0 rows is valid for empty tables)
  fi

  local ROWS=$(( $(wc -l < "$OUTFILE") - 1 ))
  success "  [$TABLE] $ROWS rows -> $(basename "$OUTFILE")"
  return 0
}

# =============================================================================
# RESTORE A CSV INTO DEV
# =============================================================================

restore_table_from_csv() {
  local TABLE=$1
  local CSVFILE=$2

  spinner_start "[$TABLE] Restoring..."

  PGPASSWORD="$DEV_DB_PASSWORD" psql \
    -h "$DEV_DB_HOST" -p "$DEV_DB_PORT" \
    -U "$DEV_DB_USER" -d "$DEV_DB_NAME" \
    -c "\COPY ${SCHEMA}.\"${TABLE}\" FROM '${CSVFILE}' WITH CSV HEADER" \
    -q 2>"$DUMP_DIR/.err_restore_${TABLE}.txt"
  local RC=$?
  spinner_stop

  if [ $RC -ne 0 ]; then
    local ERR; ERR=$(cat "$DUMP_DIR/.err_restore_${TABLE}.txt" 2>/dev/null)
    warn "  [$TABLE] Restore failed: $ERR"
    return 1
  fi

  local ROWS=$(( $(wc -l < "$CSVFILE") - 1 ))
  success "  [$TABLE] $ROWS rows restored"
  return 0
}

# =============================================================================
# CHECK DATE COL TYPE — returns "cast" if string, "native" if date/timestamp, "" if missing
# =============================================================================

get_date_col_type() {
  local TABLE=$1 COL=$2
  local DT
  DT=$(prod_psql -t -A -c "SELECT data_type FROM information_schema.columns WHERE table_schema='${SCHEMA}' AND table_name='${TABLE}' AND column_name='${COL}' LIMIT 1;" 2>/dev/null) || DT=""
  case "$DT" in
    text|character\ varying|varchar|character) echo "cast" ;;
    date|timestamp*) echo "native" ;;
    *) echo "" ;;
  esac
}

# =============================================================================
# PRE-FLIGHT
# =============================================================================

preflight_checks() {
  log "Pre-flight checks..."
  for CMD in psql ssh nc lsof; do
    command -v "$CMD" >/dev/null 2>&1 || error "$CMD not found."
  done
  open_tunnels
  test_connections

  local KB; KB=$(df /tmp | awk 'NR==2{print $4}')
  [ "$KB" -lt 5242880 ] && warn "Less than 5GB free in /tmp" || success "Disk: $(( KB/1024/1024 ))GB free"
  mkdir -p "$DUMP_DIR"
  success "Dump dir: $DUMP_DIR"
}

# =============================================================================
# SCHEMA
# =============================================================================

apply_schema() {
  log "Dumping schema from PROD..."
  PGPASSWORD="$PROD_DB_PASSWORD" pg_dump \
    -h "$PROD_DB_HOST" -p "$PROD_DB_PORT" \
    -U "$PROD_DB_USER" -d "$PROD_DB_NAME" \
    --schema-only --no-owner --no-acl --schema="$SCHEMA" \
    -f "$DUMP_DIR/schema.sql"
  success "Schema dumped"

  log "Applying schema to DEV..."
  dev_psql -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;" -q 2>/dev/null || true
  dev_psql -c "CREATE SCHEMA IF NOT EXISTS ${SCHEMA};" -q 2>/dev/null || true
  PGPASSWORD="$DEV_DB_PASSWORD" psql \
    -h "$DEV_DB_HOST" -p "$DEV_DB_PORT" \
    -U "$DEV_DB_USER" -d "$DEV_DB_NAME" \
    -f "$DUMP_DIR/schema.sql" -q \
    2>&1 | grep -Ev "transaction_timeout|already exists|^$" || true
  success "Schema applied"
}

# =============================================================================
# MAIN MIGRATION
# =============================================================================

run_migrate() {
  echo ""
  echo -e "${BOLD}============================================================${NC}"
  echo -e "${BOLD}  LMS: Production -> Development Migration${NC}"
  echo -e "  PROD: ${PROD_SSH_USER}@${PROD_SSH_HOST} -> ${PROD_DB_NAME}"
  echo -e "  DEV:  ${DEV_SSH_USER}@${DEV_SSH_HOST}  -> ${DEV_DB_NAME}"
  echo -e "  Filter: loans.${LOANS_DATE_COL} & cashCollections.${CC_DATE_COL} >= ${DATE_FILTER}"
  echo -e "  Skip:   lms_logs"
  echo -e "${BOLD}============================================================${NC}"
  echo ""

  preflight_checks
  echo ""
  apply_schema
  echo ""

  # Discover all tables except lms_logs
  spinner_start "Discovering tables..."
  ALL_TABLES=$(prod_psql -t -A -c "
    SELECT tablename FROM pg_tables
    WHERE schemaname='${SCHEMA}' AND tablename NOT IN ('lms_logs')
    ORDER BY tablename;" 2>/dev/null)
  spinner_stop
  TABLE_COUNT=$(echo "$ALL_TABLES" | grep -c . || true)
  success "Found $TABLE_COUNT tables"
  echo ""

  # ── PHASE 1: DUMP ──────────────────────────────────────────────────────────
  echo -e "${BOLD}--- PHASE 1: Dump from PRODUCTION ---${NC}"
  echo ""

  MANIFEST="$DUMP_DIR/manifest.txt"
  > "$MANIFEST"
  DONE=0

  for TABLE in $ALL_TABLES; do
    DONE=$(( DONE + 1 ))
    OUTFILE="$DUMP_DIR/${TABLE}.csv"

    case "$TABLE" in

      loans)
        # Detect column type for dateGranted
        COL_KIND=$(get_date_col_type "loans" "$LOANS_DATE_COL")
        if [ "$COL_KIND" = "cast" ]; then
          WHERE="\"${LOANS_DATE_COL}\"::date >= '${DATE_FILTER}'::date"
        elif [ "$COL_KIND" = "native" ]; then
          WHERE="\"${LOANS_DATE_COL}\" >= '${DATE_FILTER}'::date"
        else
          warn "  [loans] Column ${LOANS_DATE_COL} not found — doing full dump"
          WHERE=""
        fi
        dump_table_to_csv "$TABLE" "$WHERE"
        ;;

      cashCollections)
        COL_KIND=$(get_date_col_type "cashCollections" "$CC_DATE_COL")
        if [ "$COL_KIND" = "cast" ]; then
          WHERE="\"${CC_DATE_COL}\"::date >= '${DATE_FILTER}'::date"
        elif [ "$COL_KIND" = "native" ]; then
          WHERE="\"${CC_DATE_COL}\" >= '${DATE_FILTER}'::date"
        else
          warn "  [cashCollections] Column ${CC_DATE_COL} not found — doing full dump"
          WHERE=""
        fi
        dump_table_to_csv "$TABLE" "$WHERE"
        ;;

      *)
        dump_table_to_csv "$TABLE" ""
        ;;
    esac

    # Record in manifest only if output file exists (even if empty/0 rows)
    if [ -f "$OUTFILE" ]; then
      echo "$TABLE" >> "$MANIFEST"
    fi

    log "  [$DONE/$TABLE_COUNT] $TABLE"
  done

  echo ""
  success "Phase 1 complete — dumps in $DUMP_DIR"
  echo ""

  # ── PHASE 2: RESTORE ───────────────────────────────────────────────────────
  echo -e "${BOLD}--- PHASE 2: Restore to DEVELOPMENT ---${NC}"
  echo ""

  log "Disabling FK constraints..."
  dev_psql -c "SET session_replication_role = replica;" -q

  # Restore in dependency-safe order — reference tables first
  ORDERED="roles rolesPermissions settings divisions regions areas branches users groups client loans loans_history losTotals losTotals_temp cashCollections cashCollections_dups_loanId_dateAdded denomination branchApprovals branchCOH fund_transfer mcbu_withdrawals management_account_types management_accounts management_transactions notifications badDebtCollections transferClients unclaimed_amount_transactions transactionSettings temp_loan_group holidays"

  RESTORED=""
  DONE=0
  TOTAL=$(wc -l < "$MANIFEST" | tr -d ' ')

  for TABLE in $ORDERED; do
    CSVFILE="$DUMP_DIR/${TABLE}.csv"
    if [ -f "$CSVFILE" ]; then
      DONE=$(( DONE + 1 ))
      restore_table_from_csv "$TABLE" "$CSVFILE"
      log "  [$DONE/$TOTAL] $TABLE"
      RESTORED="$RESTORED $TABLE "
    fi
  done

  # Restore any tables not in the ordered list
  while read -r TABLE; do
    case "$RESTORED" in *" $TABLE "*) continue ;; esac
    CSVFILE="$DUMP_DIR/${TABLE}.csv"
    [ -f "$CSVFILE" ] || continue
    DONE=$(( DONE + 1 ))
    warn "  [$DONE/$TOTAL] $TABLE (not in ordered list)"
    restore_table_from_csv "$TABLE" "$CSVFILE"
  done < "$MANIFEST"

  log "Re-enabling FK constraints..."
  dev_psql -c "SET session_replication_role = DEFAULT;" -q

  log "Resetting sequences..."
  dev_psql -q -c "
    DO \$\$
    DECLARE r RECORD; v BIGINT;
    BEGIN
      FOR r IN
        SELECT n.nspname AS s, c.relname AS seq, a.attname AS col, t.relname AS tbl
        FROM pg_class c
        JOIN pg_namespace n ON n.oid=c.relnamespace
        JOIN pg_depend d ON d.objid=c.oid
        JOIN pg_class t ON t.oid=d.refobjid
        JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
        WHERE c.relkind='S' AND n.nspname='${SCHEMA}'
      LOOP
        EXECUTE format('SELECT COALESCE(MAX(%I),0) FROM %I.%I', r.col,r.s,r.tbl) INTO v;
        IF v>0 THEN EXECUTE format('SELECT setval(%L,%s)', r.s||'.'||r.seq, v); END IF;
      END LOOP;
    END;\$\$;" 2>/dev/null || true
  success "Sequences reset"

  echo ""
  echo -e "${BOLD}--- DEV Table Summary ---${NC}"
  dev_psql -c "
    SELECT c.relname AS table,
      pg_size_pretty(pg_total_relation_size(c.oid)) AS size,
      pg_stat_get_live_tuples(c.oid) AS rows
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='${SCHEMA}' AND c.relkind='r'
    ORDER BY c.relname;" 2>/dev/null

  echo ""
  log "Dump files: $DUMP_DIR"
  echo ""
  success "Migration complete! Run './migrate_prod_to_dev.sh verify' to check row counts."
}

# =============================================================================
# VERIFY
# =============================================================================

run_verify() {
  echo ""
  echo -e "${BOLD}=== Migration Verification ===${NC}"
  echo -e "  PROD: ${PROD_DB_NAME} @ ${PROD_SSH_HOST}"
  echo -e "  DEV:  ${DEV_DB_NAME}  @ ${DEV_SSH_HOST}"
  echo ""
  open_tunnels
  test_connections
  echo ""

  PASS=0; FAIL=0

  chk() {
    local TABLE=$1 WHERE="${2:-}" LABEL="${3:-$1}"
    spinner_start "Checking $LABEL..."
    local PC DC
    PC=$(prod_psql -t -A -c "SELECT COUNT(*) FROM ${SCHEMA}.\"${TABLE}\" ${WHERE};" 2>/dev/null) || PC="ERR"
    DC=$(dev_psql  -t -A -c "SELECT COUNT(*) FROM ${SCHEMA}.\"${TABLE}\" ${WHERE};" 2>/dev/null) || DC="ERR"
    spinner_stop
    if [ "$PC" = "ERR" ] || [ "$DC" = "ERR" ]; then
      printf "  ${RED}FAIL${NC}  %-40s  PROD=%-8s DEV=%s\n" "$LABEL" "$PC" "$DC"
      FAIL=$(( FAIL+1 ))
    elif [ "$PC" = "$DC" ]; then
      printf "  ${GREEN}OK${NC}    %-40s  %s rows\n" "$LABEL" "$DC"
      PASS=$(( PASS+1 ))
    else
      printf "  ${RED}FAIL${NC}  %-40s  PROD=%-8s DEV=%s\n" "$LABEL" "$PC" "$DC"
      FAIL=$(( FAIL+1 ))
    fi
  }

  # Discover all prod tables dynamically
  ALL_TABLES=$(prod_psql -t -A -c "
    SELECT tablename FROM pg_tables
    WHERE schemaname='${SCHEMA}' ORDER BY tablename;" 2>/dev/null)

  for T in $ALL_TABLES; do
    case "$T" in
      lms_logs) ;;
      loans)
        COL_KIND=$(get_date_col_type "loans" "$LOANS_DATE_COL")
        if [ "$COL_KIND" = "cast" ]; then
          chk "$T" "WHERE \"${LOANS_DATE_COL}\"::date >= '${DATE_FILTER}'::date" "$T (${DATE_FILTER}+ via ${LOANS_DATE_COL})"
        elif [ "$COL_KIND" = "native" ]; then
          chk "$T" "WHERE \"${LOANS_DATE_COL}\" >= '${DATE_FILTER}'::date" "$T (${DATE_FILTER}+ via ${LOANS_DATE_COL})"
        else
          chk "$T" "" "$T (full)"
        fi
        ;;
      cashCollections)
        COL_KIND=$(get_date_col_type "cashCollections" "$CC_DATE_COL")
        if [ "$COL_KIND" = "cast" ]; then
          chk "$T" "WHERE \"${CC_DATE_COL}\"::date >= '${DATE_FILTER}'::date" "$T (${DATE_FILTER}+ via ${CC_DATE_COL})"
        elif [ "$COL_KIND" = "native" ]; then
          chk "$T" "WHERE \"${CC_DATE_COL}\" >= '${DATE_FILTER}'::date" "$T (${DATE_FILTER}+ via ${CC_DATE_COL})"
        else
          chk "$T" "" "$T (full)"
        fi
        ;;
      *) chk "$T" ;;
    esac
  done

  echo ""
  echo -e "  Result: ${GREEN}${PASS} passed${NC}  /  ${RED}${FAIL} failed${NC}"
  echo ""
}

# =============================================================================
# ROLLBACK
# =============================================================================

run_rollback() {
  warn "Dropping DEV schema..."
  open_tunnels
  dev_psql -c "DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE;" -q 2>/dev/null || true
  dev_psql -c "CREATE SCHEMA IF NOT EXISTS ${SCHEMA};" -q 2>/dev/null || true
  success "DEV schema cleared."
}

# =============================================================================
# LIST DATABASES
# =============================================================================

list_databases() {
  open_tunnels
  echo "--- PROD databases ---"
  PGPASSWORD="$PROD_DB_PASSWORD" psql -h "$PROD_DB_HOST" -p "$PROD_DB_PORT" \
    -U "$PROD_DB_USER" -d "postgres" \
    -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datistemplate=false ORDER BY datname;"
  echo "--- DEV databases ---"
  dev_psql -c "SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database WHERE datistemplate=false ORDER BY datname;"
}

# =============================================================================
# ENTRY POINT
# =============================================================================

case "${1:-migrate}" in
  migrate)  run_migrate    ;;
  verify)   run_verify     ;;
  rollback) run_rollback   ;;
  listdb)   list_databases ;;
  *)
    echo "Usage: $0 [migrate|verify|rollback|listdb]"
    exit 1 ;;
esac