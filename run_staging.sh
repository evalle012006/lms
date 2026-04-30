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
git pull origin "$BRANCH"
success "Code updated to latest on branch: $BRANCH"

# ── Verify Files ───────────────────────────────────────────
log "Checking environment and config files..."
[ -f ".env" ] || error ".env missing!"
[ -f "docker-compose.yml" ] || error "docker-compose.yml missing!"
success "Configuration files verified."

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
log "Cleaning up old Docker images..."
docker image prune -f
success "Cleanup done."

# ── Show Status ──────────────────────────────────────────────
echo ""
log "Container status:"
docker compose ps
echo ""
log "Port Status (LMS on 3001, Nginx on 3000):"
sudo lsof -i :3000,3001 || warn "Could not verify ports. Check logs."

# ── Final Message ────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment complete! 🚀          ║${NC}"
echo -e "${GREEN}║      https://lmsv2.ambercashph.com       ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""