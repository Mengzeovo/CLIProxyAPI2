#!/usr/bin/env bash
# Runs the CLIProxyAPI proxy server for local development inside the Cloud Agent.
#
# Generates a local development config on first run if one is not present. The
# values below are non-secret local placeholders intended only for this dev
# environment; replace them (or provide real OAuth/API credentials under auths/
# or via the Management API) to proxy to live upstream providers.
set -euo pipefail

cd "$(dirname "$0")/.."

CONFIG_FILE="config.dev.yaml"

if [[ ! -f "${CONFIG_FILE}" ]]; then
  echo "==> Generating ${CONFIG_FILE} (local development defaults)"
  cat > "${CONFIG_FILE}" <<'YAML'
# Local development config for the Cloud Agent environment.
# Non-secret placeholders only. Do not use in production.
host: "0.0.0.0"
port: 8317
auth-dir: "./auths"
api-keys:
  - "dev-local-key"
remote-management:
  allow-remote: true
  secret-key: "dev-management-key"
debug: true
usage-statistics-enabled: true
# Demo upstream so /v1/models is populated out of the box. The api-key below is a
# non-secret placeholder; supply a real key here (or via the Management API) to
# actually proxy chat/completions requests to this provider.
openai-compatibility:
  - name: "demo-provider"
    base-url: "https://openrouter.ai/api/v1"
    api-key-entries:
      - api-key: "replace-with-a-real-openrouter-key"
    models:
      - name: "moonshotai/kimi-k2:free"
        alias: "kimi-k2"
      - name: "deepseek/deepseek-chat"
        alias: "deepseek-chat"
YAML
fi

# Ensure the binary exists (install.sh normally builds it during environment setup).
if [[ ! -x cli-proxy-api ]]; then
  echo "==> cli-proxy-api binary missing; building it now"
  go build -o cli-proxy-api ./cmd/server
fi

# --local-model uses the embedded model catalog and skips remote model fetching,
# so the server runs without external network access to model registries.
echo "==> Starting cli-proxy-api on :8317 (config: ${CONFIG_FILE})"
exec ./cli-proxy-api --config "${CONFIG_FILE}" --local-model
