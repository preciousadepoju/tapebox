#!/bin/sh
# Nightly reset: restart anvil so it reloads the clean snapshot (drops everything users did).
# crontab -e:
#   0 3 * * * cd /opt/tapebox/infra && ./reset.sh >> /var/log/tapebox-reset.log 2>&1
set -eu
cd "$(dirname "$0")"
echo "$(date -u +%FT%TZ) resetting sandbox fork"
docker compose restart anvil
for i in $(seq 1 60); do
  if curl -fsS -X POST -H 'content-type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      "http://127.0.0.1:${PROXY_PORT:-8080}" | grep -q 0xc4; then
    echo "fork back up after ${i}s"
    exit 0
  fi
  sleep 1
done
echo "fork did not come back within 60s" >&2
exit 1
