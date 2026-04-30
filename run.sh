#!/bin/bash

# ============================================================
#  lms-v2 — Auto Deploy Script
#  Usage: ./run.sh [branch]
#  Example: ./run.sh main
#  Default branch: main
# ============================================================

set -e  # Exit immediately on any error

# ── Config ───────────────────────────────────────────────────
APP_DIR=~/apps/lms-v2
BRANCH=${1:-production}
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ── Helpers ──────────────────────────────────────────────────
log()     { echo -e "${CYAN}[${TIMESTAMP}]${NC} $1"; }
success() { echo -e "${GREEN}✔ $1${NC}"; }
warn()    { echo -e "${YELLOW}⚠ $1${NC}"; }
error()   { echo -e "${RED}✘ $1${NC}"; exit 1; }

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        lms-v2 — Auto Deployment          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""

# ── Check project directory ──────────────────────────────────
log "Checking project directory..."
if [ ! -d "$APP_DIR" ]; then
  error "Project directory $APP_DIR not found. Please set up the project first."
fi

cd "$APP_DIR"
success "Project directory found: $APP_DIR"

# ── Check docker-compose.yml exists ──────────────────────────
if [ ! -f "docker-compose.yml" ]; then
  error "docker-compose.yml not found in $APP_DIR"
fi

# ── Git pull latest code ──────────────────────────────────────
log "Fetching latest code from branch: ${YELLOW}$BRANCH${NC}..."

if [ ! -d ".git" ]; then
  error "Not a git repository. Initialize git or clone the project first."
fi

git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

success "Code updated to latest on branch: $BRANCH"

# ── Verify .env files exist ───────────────────────────────────
log "Checking environment files..."

if [ ! -f "$APP_DIR/.env" ]; then
  error ".env not found at $APP_DIR/.env — create it from .env.example first."
fi

success "Environment files found."

# ── Install dependencies ──────────────────────────────────────
log "Installing dependencies..."
npm install
success "Dependencies installed."

# ── Build Next.js app ─────────────────────────────────────────
log "Building Next.js application..."
npm run build
success "Build completed."

# ── Stop existing containers ──────────────────────────────────
log "Stopping running containers..."
docker compose down --remove-orphans
success "Containers stopped."

# ── Build and start containers ────────────────────────────────
log "Starting containers..."
docker compose up -d --scale lms=10
success "Containers started."

# ── Show container status ─────────────────────────────────────
echo ""
log "Container status:"
docker compose ps

# ── Done ─────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment complete! 🚀          ║${NC}"
echo -e "${GREEN}║      https://lms.ambercashph.com         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════╝${NC}"
echo ""