#!/usr/bin/env bash
# Runs ON the EC2 box (piped in over SSH by the GitHub Actions workflow).
# Args: $1 = DEPLOY_PATH (e.g. /opt/shg/dev)  $2 = RELEASE (git sha)  $3 = SERVICE (systemd unit)
set -euo pipefail

DEPLOY_PATH="$1"
RELEASE="$2"
SERVICE="$3"

REL_DIR="$DEPLOY_PATH/releases/$RELEASE"

echo "==> Activating release $RELEASE"
cd "$REL_DIR"

echo "==> Installing production dependencies"
# Full install (not --omit=dev): the server runs via tsx, and tsx + dotenv
# live in devDependencies. This also guarantees a clean, lockfile-exact tree.
npm ci --omit=dev

echo "==> Flipping 'current' symlink"
ln -sfn "$REL_DIR" "$DEPLOY_PATH/current"

echo "==> Restarting $SERVICE"
sudo systemctl restart "$SERVICE"

echo "==> Pruning old releases (keeping newest 5)"
cd "$DEPLOY_PATH/releases"
ls -1dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "==> Done."