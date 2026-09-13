#!/bin/bash
# =============================================================================
# LMS Selective Branch Copy: Production -> Development
# Copies specific branches + their org-hierarchy ancestors (divisions/regions/
# areas) and their users, from PROD into DEV, WITHOUT touching anything else.
#
# Behavior (confirmed with Donie):
#   - divisions, regions, areas: UPSERT (prod overwrites dev if row exists)
#   - branches, users:           INSERT-IF-MISSING ONLY (never overwrite dev)
#   - clients, loans, cashCollections: explicitly OUT OF SCOPE, not touched
#
# This is intentionally NOT the same tool as the full migrate_prod_to_dev.sh —
# it never drops a schema and never touches tables outside the five listed
# above. Do not merge these two scripts.
# =============================================================================
# PROD: SSH tunnel -> acdbadmin@188.166.226.53  -> localhost:5432
# DEV:  SSH tunnel -> lmsdbadmin@143.198.90.76  -> localhost:5432
# =============================================================================

set -uo pipefail

# =============================================================================
# CONFIGURATION — edit before running. Prefer env vars over hardcoding.
# =============================================================================

PROD_SSH_HOST="188.166.226.53"
PROD_SSH_PORT="22"
PROD_SSH_USER="acdbadmin"
PROD_SSH_PASSWORD="${PROD_SSH_PASSWORD:-}"      # leave empty to use SSH key
PROD_SSH_KEY="${PROD_SSH_KEY:-}"
PROD_TUNNEL_PORT="15432"

PROD_DB_HOST="localhost"
PROD_DB_PORT="$PROD_TUNNEL_PORT"
PROD_DB_NAME="acloandb"
PROD_DB_USER="postgres"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:?Set PROD_DB_PASSWORD as an env var, do not hardcode it here}"

DEV_SSH_HOST="143.198.90.76"
DEV_SSH_PORT="22"
DEV_SSH_USER="lmsdbadmin"
DEV_SSH_PASSWORD="${DEV_SSH_PASSWORD:-}"
DEV_SSH_KEY="${DEV_SSH_KEY:-}"
DEV_TUNNEL_PORT="15433"

DEV_DB_HOST="localhost"
DEV_DB_PORT="$DEV_TUNNEL_PORT"
DEV_DB_NAME="postgres"   # confirm this is really the app DB name on dev, not the system default
DEV_DB_USER="postgres"
DEV_DB_PASSWORD="${DEV_DB_PASSWORD:?Set DEV_DB_PASSWORD as an env var, do not hardcode it here}"

SCHEMA="public"
DUMP_DIR="/tmp/lms_branch_copy_$(date +%Y%m%d_%H%M%S)"

# ---- EDIT THIS: the branch IDs you want to copy -----------------------------
# Verify these are real UUIDs from PROD.branches.id before running.
BRANCH_IDS_SQL="('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002')"
# ------------------------------------------------------------------------------

# =============================================================================
# COLORS / LOGGING (same as existing script)
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

trap 'close_all_tunnels' EXIT

# =============================================================================
# TUNNELS (identical pattern to existing script)
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

test_connections() {
  local OUT RC
  OUT=$(prod_psql -t -A -c "SELECT current_database()||'/'||current_user;" 2>&1); RC=$?
  [ $RC -ne 0 ] && { echo "$OUT"; error "PROD connection failed."; }
  success "PROD: $OUT"

  OUT=$(dev_psql -t -A -c "SELECT current_database()||'/'||current_user;" 2>&1); RC=$?
  [ $RC -ne 0 ] && { echo "$OUT"; error "DEV connection failed."; }
  success "DEV:  $OUT"
}

# =============================================================================
# DUMP a WHERE-filtered table from PROD to CSV
# =============================================================================

dump_table_to_csv() {
  local TABLE=$1
  local WHERE_CLAUSE=$2
  local OUTFILE="$DUMP_DIR/${TABLE}.csv"
  local TMPFILE="$DUMP_DIR/.copy_${TABLE}.sql"

  # \COPY is a psql meta-command and MUST be a single line — collapse any
  # newlines/extra whitespace in the WHERE clause before building it, or the
  # command silently truncates at the first newline.
  local WHERE_ONELINE
  WHERE_ONELINE=$(echo "$WHERE_CLAUSE" | tr '\n' ' ' | tr -s ' ')

  printf '\\COPY (SELECT * FROM %s."%s" WHERE %s) TO STDOUT WITH CSV HEADER\n' \
    "$SCHEMA" "$TABLE" "$WHERE_ONELINE" > "$TMPFILE"

  # -v ON_ERROR_STOP=1 so a broken command fails loudly (non-zero exit) instead
  # of silently exiting 0 with an empty file.
  prod_psql -v ON_ERROR_STOP=1 -f "$TMPFILE" > "$OUTFILE" 2>"$DUMP_DIR/.err_${TABLE}.txt"
  local RC=$?
  rm -f "$TMPFILE"

  if [ $RC -ne 0 ]; then
    warn "[$TABLE] dump failed: $(cat "$DUMP_DIR/.err_${TABLE}.txt")"
    return 1
  fi

  local ROWS=$(( $(wc -l < "$OUTFILE") - 1 ))
  success "[$TABLE] dumped $ROWS row(s) -> $(basename "$OUTFILE")"
  [ "$ROWS" -eq 0 ] && warn "[$TABLE] zero rows — check BRANCH_IDS_SQL and FK column names"
  return 0
}

# =============================================================================
# LOAD into DEV via a staging table, then either UPSERT or SKIP-IF-EXISTS.
# Avoids raw \COPY into the real table, which fails outright on any PK
# conflict — staging + explicit ON CONFLICT is the only safe way to do this
# without disabling FK checks.
# =============================================================================

# =============================================================================
# PREFLIGHT: confirm _id actually has a unique/PK constraint on DEV before we
# rely on ON CONFLICT (_id) anywhere. Fail fast and clearly instead of letting
# every table fail individually mid-run.
# =============================================================================

check_pk_constraint() {
  local TABLE=$1
  local COUNT
  COUNT=$(dev_psql -t -A -c "
    SELECT COUNT(*) FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE t.relname = '${TABLE}' AND a.attname = '_id' AND c.contype IN ('p','u');
  " 2>/dev/null)
  if [ -z "$COUNT" ] || [ "$COUNT" -eq 0 ] 2>/dev/null; then
    error "[$TABLE] has no PRIMARY KEY or UNIQUE constraint on _id on DEV — ON CONFLICT (_id) cannot work. Fix the schema, or this script, before proceeding."
  fi
  success "[$TABLE] _id has a unique/PK constraint on DEV"
}

# =============================================================================
# LOAD one table: single psql session does CREATE TEMP TABLE + \COPY + the
# insert, so the temp table survives long enough to be used (a prior version
# of this script split these across separate psql invocations, each of which
# is its own connection — temp tables don't survive across connections, which
# is why you saw "relation staging_x does not exist").
# =============================================================================

_load_table() {
  local TABLE=$1
  local MODE=$2   # "upsert" (prod wins on conflict) or "skip" (dev wins, insert-if-missing)
  local CSVFILE="$DUMP_DIR/${TABLE}.csv"
  local SQLFILE="$DUMP_DIR/.load_${TABLE}.sql"

  [ -s "$CSVFILE" ] || { warn "[$TABLE] no CSV / zero rows — skipping load"; return 0; }

  {
    echo "CREATE TEMP TABLE staging_${TABLE} (LIKE ${SCHEMA}.\"${TABLE}\" INCLUDING ALL);"
    echo "\\COPY staging_${TABLE} FROM '${CSVFILE}' WITH CSV HEADER"
    if [ "$MODE" = "upsert" ]; then
      cat <<SQL
DO \$do\$
DECLARE cols text;
BEGIN
  SELECT string_agg(format('%I = EXCLUDED.%I', column_name, column_name), ', ')
  INTO cols
  FROM information_schema.columns
  WHERE table_schema = '${SCHEMA}' AND table_name = '${TABLE}' AND column_name <> '_id';

  EXECUTE format(
    'INSERT INTO ${SCHEMA}.%I SELECT * FROM staging_${TABLE} ON CONFLICT (_id) DO UPDATE SET %s',
    '${TABLE}', cols
  );
END \$do\$;
SQL
    else
      echo "INSERT INTO ${SCHEMA}.\"${TABLE}\" SELECT * FROM staging_${TABLE} ON CONFLICT (_id) DO NOTHING;"
    fi
  } > "$SQLFILE"

  dev_psql -v ON_ERROR_STOP=1 -q -f "$SQLFILE" >/dev/null 2>"$DUMP_DIR/.err_load_${TABLE}.txt"
  local RC=$?
  if [ $RC -ne 0 ]; then
    warn "[$TABLE] load failed: $(cat "$DUMP_DIR/.err_load_${TABLE}.txt")"
    return 1
  fi

  local COUNT
  COUNT=$(dev_psql -t -A -c "SELECT COUNT(*) FROM ${SCHEMA}.\"${TABLE}\";")
  success "[$TABLE] loaded (${MODE}); dev now has $COUNT total row(s)"
}

# =============================================================================
# MAIN
# =============================================================================

echo ""
echo -e "${BOLD}============================================================${NC}"
echo -e "${BOLD}  LMS: Selective Branch Copy — PROD -> DEV${NC}"
echo -e "  Branches: ${BRANCH_IDS_SQL}"
echo -e "  Scope:    divisions, regions, areas (upsert) + branches, users (insert-if-missing)"
echo -e "  Excluded: everything else — clients, loans, cashCollections, etc."
echo -e "${BOLD}============================================================${NC}"
echo ""

for CMD in psql ssh nc lsof; do
  command -v "$CMD" >/dev/null 2>&1 || error "$CMD not found."
done

mkdir -p "$DUMP_DIR"
open_tunnels
test_connections
echo ""

# --- Dump, in dependency order, all computed against PROD directly ----------
log "Dumping from PROD..."

# NOTE: PK confirmed as "_id". FK derivation simplified — "branches" already
# carries areaId/regionId/divisionId directly (flattened/denormalized), so we
# read ancestors straight off branches instead of walking areas -> regions ->
# divisions. users links to branches via "designatedBranchId", not "branchId".

check_pk_constraint divisions
check_pk_constraint regions
check_pk_constraint areas
check_pk_constraint branches
check_pk_constraint users
echo ""

dump_table_to_csv divisions "_id IN (SELECT \"divisionId\" FROM branches WHERE _id IN ${BRANCH_IDS_SQL})"
dump_table_to_csv regions   "_id IN (SELECT \"regionId\" FROM branches WHERE _id IN ${BRANCH_IDS_SQL})"
dump_table_to_csv areas     "_id IN (SELECT \"areaId\" FROM branches WHERE _id IN ${BRANCH_IDS_SQL})"
dump_table_to_csv branches  "_id IN ${BRANCH_IDS_SQL}"
dump_table_to_csv users     "\"designatedBranchId\" IN ${BRANCH_IDS_SQL}"

echo ""
log "Loading into DEV (parents first, so FK constraints are satisfied naturally)..."

_load_table divisions upsert
_load_table regions   upsert
_load_table areas     upsert
_load_table branches  skip
_load_table users     skip

echo ""
success "Done. Dump files kept at: $DUMP_DIR"
warn "Spot-check: confirm the copied branches' areaId/regionId/divisionId actually point at rows that now exist in dev."