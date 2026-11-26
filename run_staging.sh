#!/bin/bash

# ============================================================
#  lms-staging-v2 — Auto Deploy Script
#  Updated for Host Networking & Port 3001
# ============================================================

set -e  # Exit immediately on any error

# ── Config ───────────────────────────────────────────────────
APP_DIR=~/lms-app
BRANCH=${1:-migration}
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
MIN_FREE_GB=${MIN_FREE_GB:-5}   # minimum free disk space (GB) required before building

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' 

# ── Helpers ──────────────────────────────────────────────────
log()     { echo -e "${CYAN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✘ $1${NC}"; exit 1; }

free_gb() { df -P --output=avail -BG "$APP_DIR" | tail -1 | tr -dc '0-9'; }

cleanup_disk() {
  log "Reclaiming disk space..."
  docker builder prune -af                                   || warn "builder prune failed"
  docker image prune -af --filter "until=72h"                || warn "image prune failed"
  docker container prune -f --filter "until=72h"             || warn "container prune failed"
  docker volume prune -f                                     || warn "volume prune failed"
  rm -rf "$APP_DIR/.next/cache"
  npm cache clean --force >/dev/null 2>&1                    || warn "npm cache clean failed"
  success "Cleanup done. Free space: $(free_gb)GB"
}

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        lms-staging-v2 — Auto Deployment          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check project directory ──────────────────────────────────
log "Checking project directory..."
cd "$APP_DIR" || error "Project directory $APP_DIR not found."
success "Project directory found: $APP_DIR"

# ── Git Operations ──────────────────────────────────────────
log "Fetching latest code from branch: ${YELLOW}$BRANCH${NC}..."
git fetch origin
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"   # force-push safe; staging config lives in untracked override files
success "Code updated to latest on branch: $BRANCH"

# ── Verify Files ───────────────────────────────────────────
log "Checking environment and config files..."
[ -f ".env" ] || error ".env missing!"
[ -f "docker-compose.yml" ] || error "docker-compose.yml missing!"
success "Configuration files verified."

# ── Disk space guard ────────────────────────────────────────
log "Checking disk space (need >= ${MIN_FREE_GB}GB free)..."
if [ "$(free_gb)" -lt "$MIN_FREE_GB" ]; then
  warn "Low disk space: $(free_gb)GB free."
  cleanup_disk
  [ "$(free_gb)" -ge "$MIN_FREE_GB" ] || error "Only $(free_gb)GB free after cleanup (need ${MIN_FREE_GB}GB). Free space manually."
fi
success "Disk OK: $(free_gb)GB free."

# ── Install dependencies & Build ────────────────────────────
log "Installing dependencies..."
npm install --quiet
success "Dependencies installed."

log "Building Next.js application..."
npm run build
success "Build completed."

# ── Container Management ────────────────────────────────────
log "Stopping existing containers..."
# Note: Host mode doesn't support scaling, so we ensure a clean slate
docker compose down --remove-orphans
success "Containers stopped."

log "Starting containers in Host Mode..."
# Removed --scale because Host Networking only allows 1 process per port
docker compose up -d 
success "Containers started."

# ── Cleanup ──────────────────────────────────────────────────
log "Cleaning up old Docker images and build cache..."
docker image prune -f                              # dangling images
docker image prune -af --filter "until=72h"        # unused images older than 72h (running ones are untouched)
docker builder prune -f --filter "until=72h"       # old build cache
success "Cleanup done. Free space: $(free_gb)GB"

# ── Show Status ──────────────────────────────────────────────
echo ""
log "Container status:"
docker compose ps
echo ""
log "Port Status (LMS on 3001, Nginx on 3000):"
ss -ltn '( sport = :3000 or sport = :3001 )' || warn "Could not verify ports. Check logs."

# ── Final Message ────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment complete! 🚀          ║${NC}"
echo -e "${GREEN}║      https://lmsv2.ambercashph.com       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""