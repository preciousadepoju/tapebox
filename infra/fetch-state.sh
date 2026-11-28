#!/bin/sh
# Fetch the shared fork snapshot into ./state so the hosted anvil can --load-state it on boot
# instead of backfilling from the public X Layer RPC (which rate-limits and flakes).
# State dumps are gitignored and published as release assets, so a fresh checkout has none —
# run this once before "docker compose up".
#
# Deploy sequence on the VPS (from infra/):
#   cp .env.example .env     # set ADMIN_TOKEN, DOMAIN and STATE_URL
#   ./fetch-state.sh         # downloads STATE_URL -> ../state/xlayer-fork.json
#   docker compose up -d
#
# Produce & publish the snapshot once, from a machine with anvil:
#   pnpm spike                                            # writes state/xlayer-fork.json
#   gh release create fork-state state/xlayer-fork.json   # or: gh release upload <tag> state/xlayer-fork.json
#   # then set STATE_URL to that asset's download URL
#
# Usage: ./fetch-state.sh [--force]   (--force re-downloads even if the file exists)
set -eu

cd "$(dirname "$0")"

FORCE=""
[ "${1:-}" = "--force" ] && FORCE=1

# Read STATE_URL / STATE_FILE from the environment, falling back to infra/.env (without executing it).
if [ -f .env ]; then
  [ -z "${STATE_URL:-}" ] && STATE_URL="$(grep -E '^STATE_URL=' .env | tail -n1 | cut -d= -f2-)"
  [ -z "${STATE_FILE:-}" ] && STATE_FILE="$(grep -E '^STATE_FILE=' .env | tail -n1 | cut -d= -f2-)"
fi
STATE_URL="${STATE_URL:-}"
DEST="${STATE_FILE:-../state/xlayer-fork.json}"

if [ -f "$DEST" ] && [ -z "$FORCE" ]; then
  echo "snapshot already present: $DEST ($(wc -c < "$DEST") bytes). Use --force to re-download."
  exit 0
fi

if [ -z "$STATE_URL" ]; then
  echo "STATE_URL is not set." >&2
  echo "  Set it in infra/.env to the snapshot's release-asset download URL, or generate one" >&2
  echo "  locally with 'pnpm spike' and copy state/xlayer-fork.json to $DEST." >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
tmp="${DEST}.download.$$"
trap 'rm -f "$tmp"' EXIT INT TERM

echo "downloading snapshot from $STATE_URL"
if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 -o "$tmp" "$STATE_URL"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$tmp" "$STATE_URL"
else
  echo "need curl or wget to download the snapshot" >&2
  exit 1
fi

# Reject an empty or non-JSON download before anvil tries to load it and fails to boot.
if [ ! -s "$tmp" ]; then
  echo "downloaded snapshot is empty" >&2
  exit 1
fi
first="$(dd if="$tmp" bs=1 count=1 2>/dev/null || true)"
if [ "$first" != "{" ]; then
  echo "downloaded file is not anvil state JSON (first byte: '$first'); check STATE_URL" >&2
  exit 1
fi

mv "$tmp" "$DEST"
trap - EXIT INT TERM
echo "snapshot ready: $DEST ($(wc -c < "$DEST") bytes)"
