#!/usr/bin/env bash
set -euo pipefail

cd /root/project/CLIProxyAPI2

# Stop the current manually-started process so systemd can take over the port
if [ -f cli-proxy-api.pid ]; then
  oldpid=$(cat cli-proxy-api.pid)
  if kill -0 "$oldpid" 2>/dev/null; then
    echo "stopping manual process pid=$oldpid"
    kill "$oldpid" 2>/dev/null || true
    for i in $(seq 1 10); do
      if kill -0 "$oldpid" 2>/dev/null; then sleep 1; else break; fi
    done
    if kill -0 "$oldpid" 2>/dev/null; then
      echo "force kill $oldpid"
      kill -9 "$oldpid" || true
      sleep 1
    fi
  fi
fi
# Catch any stragglers
pkill -f './cli-proxy-api -config config.yaml' 2>/dev/null || true
sleep 1

systemctl daemon-reload
systemctl enable cli-proxy-api.service
systemctl restart cli-proxy-api.service
sleep 3

echo "--- status ---"
systemctl --no-pager status cli-proxy-api.service | head -12
echo "--- is-enabled ---"
systemctl is-enabled cli-proxy-api.service
echo "--- health ---"
curl -s -o /dev/null -w 'healthz=%{http_code}\n' http://127.0.0.1:8317/healthz
