#!/usr/bin/env sh
set -eu

DEPLOY_ROOT="${DEPLOY_ROOT:-}"
DIST_DIR="${DIST_DIR:-dist}"

if [ -z "$DEPLOY_ROOT" ]; then
  echo "DEPLOY_ROOT is not set. Skipping deployment."
  exit 1
fi

case "$DEPLOY_ROOT" in
  "/"|"")
    echo "Refusing to deploy to an unsafe DEPLOY_ROOT: $DEPLOY_ROOT"
    exit 1
    ;;
esac

if [ ! -d "$DIST_DIR" ]; then
  echo "Build output directory not found: $DIST_DIR"
  exit 1
fi

RELEASES_DIR="$DEPLOY_ROOT/releases"
CURRENT_LINK="$DEPLOY_ROOT/current"
RELEASE_NAME="$(date +%Y%m%d%H%M%S)"
RELEASE_DIR="$RELEASES_DIR/$RELEASE_NAME"

mkdir -p "$RELEASE_DIR"
cp -R "$DIST_DIR"/. "$RELEASE_DIR"/
ln -sfn "$RELEASE_DIR" "$CURRENT_LINK"

echo "Deployed release: $RELEASE_DIR"
echo "Current release symlink: $CURRENT_LINK"
