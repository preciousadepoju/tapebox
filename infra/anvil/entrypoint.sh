#!/bin/sh
# Shared sandbox fork. Loads the committed snapshot if present so restarts are fast and
# do not hammer the public X Layer RPC. Not exposed publicly: only the proxy reaches port 8545.
set -eu

FORK_URL="${FORK_URL:-https://rpc.xlayer.tech}"
FORK_BLOCK="${FORK_BLOCK:-77014830}"
STATE="${STATE_FILE:-/state/xlayer-fork.json}"

set -- --fork-url "$FORK_URL" --fork-block-number "$FORK_BLOCK" --chain-id 196 \
  --host 0.0.0.0 --port 8545 --base-fee 0 --gas-price 0 --no-rate-limit \
  --block-time "${BLOCK_TIME:-1}"

if [ -f "$STATE" ]; then
  echo "loading state from $STATE"
  set -- "$@" --load-state "$STATE"
else
  echo "WARNING: no snapshot at $STATE — anvil will backfill from $FORK_URL on demand,"
  echo "         which is slow and gets rate-limited. Run infra/fetch-state.sh on the host"
  echo "         before 'docker compose up' to load a published snapshot."
fi

exec anvil "$@"
