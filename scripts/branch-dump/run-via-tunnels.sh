#!/bin/bash
# =============================================================================
# Opens SSH tunnels to PROD and DEV (same hosts/pattern as
# database/_sync_prod_to_dev_branches.sh), runs branch-dump.js through them,
# then closes the tunnels.
#
#   export PROD_DB_PASSWORD='...'  DEV_DB_PASSWORD='...'
#   export PROD_SSH_KEY=~/.ssh/id_ed25519     # or PROD_SSH_PASSWORD (needs sshpass)
#   export DEV_SSH_KEY=~/.ssh/id_ed25519      # or DEV_SSH_PASSWORD
#   bash run-via-tunnels.sh --branch <id> --replace --dry-run
#   bash run-via-tunnels.sh --branch <id> --replace --yes
#
# All other arguments are passed straight to branch-dump.js.
# SKIP_TARGET=1 -> only connect to PROD (use with --out file.sql or --dry-run)
# =============================================================================
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

PROD_SSH_HOST="${PROD_SSH_HOST:-188.166.226.53}"; PROD_SSH_PORT="${PROD_SSH_PORT:-22}"; PROD_SSH_USER="${PROD_SSH_USER:-acdbadmin}"
PROD_SSH_PASSWORD="${PROD_SSH_PASSWORD:-}";       PROD_SSH_KEY="${PROD_SSH_KEY:-}";     PROD_TUNNEL_PORT="${PROD_TUNNEL_PORT:-15432}"
PROD_DB_NAME="${PROD_DB_NAME:-acloandb}";         PROD_DB_USER="${PROD_DB_USER:-postgres}"
PROD_DB_PASSWORD="${PROD_DB_PASSWORD:?Set PROD_DB_PASSWORD as an env var}"

DEV_SSH_HOST="${DEV_SSH_HOST:-143.198.90.76}";    DEV_SSH_PORT="${DEV_SSH_PORT:-22}";   DEV_SSH_USER="${DEV_SSH_USER:-lmsdbadmin}"
DEV_SSH_PASSWORD="${DEV_SSH_PASSWORD:-}";         DEV_SSH_KEY="${DEV_SSH_KEY:-}";       DEV_TUNNEL_PORT="${DEV_TUNNEL_PORT:-15433}"
DEV_DB_NAME="${DEV_DB_NAME:-postgres}";           DEV_DB_USER="${DEV_DB_USER:-postgres}"
if [ "${SKIP_TARGET:-0}" != "1" ]; then : "${DEV_DB_PASSWORD:?Set DEV_DB_PASSWORD as an env var (or SKIP_TARGET=1)}"; fi
DEV_DB_PASSWORD="${DEV_DB_PASSWORD:-}"

for CMD in node ssh nc lsof; do command -v "$CMD" >/dev/null 2>&1 || { echo "ERROR: $CMD not found"; exit 1; }; done
[ -d "$DIR/node_modules/pg" ] || { echo "ERROR: run 'npm install' in $DIR first"; exit 1; }

PIDS=""
cleanup() { for p in $PIDS; do kill "$p" 2>/dev/null || true; done; }
trap cleanup EXIT

open_tunnel() { # label ssh_host ssh_port ssh_user ssh_pass ssh_key local_port
  local LABEL=$1 H=$2 SP=$3 U=$4 PW=$5 KEY=$6 LP=$7
  # Refuse to reuse a port: a stale tunnel could silently point at the wrong server.
  if nc -z localhost "$LP" 2>/dev/null; then
    echo "ERROR: [$LABEL] local port $LP is already in use. Close it first (lsof -ti TCP:$LP -sTCP:LISTEN | xargs kill) so we know it points at the right server."; exit 1
  fi
  echo "[$LABEL] SSH tunnel ${U}@${H} -> localhost:${LP}"
  local OPTS=(-N -f -o StrictHostKeyChecking=accept-new -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -p "$SP" -L "${LP}:localhost:5432")
  [ -n "$KEY" ] && OPTS+=(-i "$KEY")
  if [ -n "$PW" ]; then
    command -v sshpass >/dev/null 2>&1 || { echo "ERROR: sshpass not installed (brew install sshpass) or use an SSH key"; exit 1; }
    sshpass -p "$PW" ssh "${OPTS[@]}" "${U}@${H}" || { echo "ERROR: [$LABEL] ssh failed"; exit 1; }
  else
    ssh "${OPTS[@]}" "${U}@${H}" || { echo "ERROR: [$LABEL] ssh failed"; exit 1; }
  fi
  local R=15
  while ! nc -z localhost "$LP" 2>/dev/null; do R=$((R-1)); [ $R -eq 0 ] && { echo "ERROR: [$LABEL] tunnel did not come up"; exit 1; }; sleep 1; done
  PIDS="$PIDS $(lsof -ti "TCP:${LP}" -sTCP:LISTEN 2>/dev/null | head -1)"
}

enc() { node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$1"; }

open_tunnel PROD "$PROD_SSH_HOST" "$PROD_SSH_PORT" "$PROD_SSH_USER" "$PROD_SSH_PASSWORD" "$PROD_SSH_KEY" "$PROD_TUNNEL_PORT"
export SOURCE_DB_URL="postgres://${PROD_DB_USER}:$(enc "$PROD_DB_PASSWORD")@localhost:${PROD_TUNNEL_PORT}/${PROD_DB_NAME}"
if [ "${SKIP_TARGET:-0}" != "1" ]; then
  open_tunnel DEV "$DEV_SSH_HOST" "$DEV_SSH_PORT" "$DEV_SSH_USER" "$DEV_SSH_PASSWORD" "$DEV_SSH_KEY" "$DEV_TUNNEL_PORT"
  export TARGET_DB_URL="postgres://${DEV_DB_USER}:$(enc "$DEV_DB_PASSWORD")@localhost:${DEV_TUNNEL_PORT}/${DEV_DB_NAME}"
else
  unset TARGET_DB_URL
fi

echo
echo "SOURCE = PROD  (${PROD_SSH_HOST} via localhost:${PROD_TUNNEL_PORT}, db ${PROD_DB_NAME})"
[ "${SKIP_TARGET:-0}" != "1" ] && echo "TARGET = DEV   (${DEV_SSH_HOST} via localhost:${DEV_TUNNEL_PORT}, db ${DEV_DB_NAME})"
echo

node "$DIR/branch-dump.js" "$@"
exit $?
