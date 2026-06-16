#!/usr/bin/env bash
set -euo pipefail

cd /root/project/CLIProxyAPI2

ts=$(date +%Y%m%d%H%M%S)
cp -p cli-proxy-api "cli-proxy-api.bak-$ts"
echo "backup=cli-proxy-api.bak-$ts"

oldpid=$(cat cli-proxy-api.pid)
echo "killing pid=$oldpid"
kill "$oldpid" 2>/dev/null || true
for i in $(seq 1 10); do
  if kill -0 "$oldpid" 2>/dev/null; then sleep 1; else break; fi
done
if kill -0 "$oldpid" 2>/dev/null; then
  echo "WARN still alive, force kill"
  kill -9 "$oldpid" || true
  sleep 1
else
  echo "process stopped"
fi

mv cli-proxy-api.new cli-proxy-api
echo "replaced"

setsid ./cli-proxy-api -config config.yaml >> logs/cli-proxy-api.out 2>&1 < /dev/null &
sleep 3

newpid=$(pgrep -f './cli-proxy-api -config config.yaml' | head -1)
echo "$newpid" > cli-proxy-api.pid
echo "newpid=$newpid"

ls -l cli-proxy-api
echo "--- tail log ---"
tail -8 logs/cli-proxy-api.out
