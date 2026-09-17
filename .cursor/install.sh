#!/usr/bin/env bash
# Idempotent repository bootstrap for the CLIProxyAPI Cloud Agent environment.
# Downloads Go module dependencies and compiles the server binary.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> go version"
go version

echo "==> Downloading Go module dependencies"
go mod download

echo "==> Building server binary (cli-proxy-api)"
go build -o cli-proxy-api ./cmd/server

echo "==> Install complete: $(ls -la cli-proxy-api)"
