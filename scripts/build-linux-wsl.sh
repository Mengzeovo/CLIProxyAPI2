#!/usr/bin/env bash
#
# build-linux-wsl.sh - Build the CLIProxyAPI Linux/amd64 binary inside WSL.
#
# Installs Go (if missing) to /usr/local/go, then compiles ./cmd/server with
# CGO enabled (matching the official Dockerfile) so .so plugin loading works.
# Output: dist/CLIProxyAPI-linux-amd64
#
# Re-runnable: skips the Go install if the right version is already present.

set -euo pipefail

GO_VERSION="${GO_VERSION:-1.26.4}"
GO_TARBALL="go${GO_VERSION}.linux-amd64.tar.gz"
GO_URL="https://golang.google.cn/dl/${GO_TARBALL}"
GOROOT="/usr/local/go"
export PATH="${GOROOT}/bin:${PATH}"

# Resolve repo root = parent of this script's dir.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${REPO_ROOT}"

echo "==> Repo: ${REPO_ROOT}"

# --- Step 1: ensure Go ---
need_install=1
if [[ -x "${GOROOT}/bin/go" ]]; then
  have="$("${GOROOT}/bin/go" version | awk '{print $3}')"
  if [[ "${have}" == "go${GO_VERSION}" ]]; then
    echo "==> Go ${GO_VERSION} already installed (${have})."
    need_install=0
  else
    echo "==> Found ${have}, want go${GO_VERSION}; reinstalling."
  fi
fi

if [[ "${need_install}" -eq 1 ]]; then
  echo "==> Downloading ${GO_URL}"
  tmp="$(mktemp -d)"
  curl -4 -fSL --retry 3 --max-time 600 -o "${tmp}/${GO_TARBALL}" "${GO_URL}"
  echo "==> Installing Go to ${GOROOT}"
  rm -rf "${GOROOT}"
  tar -C /usr/local -xzf "${tmp}/${GO_TARBALL}"
  rm -rf "${tmp}"
fi

go version

# --- Step 2: use China module proxy (fast, reliable from WSL) ---
export GOPROXY="${GOPROXY:-https://goproxy.cn,direct}"
export GOFLAGS="-buildvcs=false"
export GOOS=linux
export GOARCH=amd64
export CGO_ENABLED=1

echo "==> GOPROXY=${GOPROXY}"
echo "==> go mod download"
go mod download

# --- Step 3: version metadata (mirrors docker-build.sh) ---
VERSION="$(git describe --tags --always --dirty 2>/dev/null || echo dev)"
COMMIT="$(git rev-parse --short HEAD 2>/dev/null || echo none)"
BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "==> Version=${VERSION} Commit=${COMMIT} BuildDate=${BUILD_DATE}"

# --- Step 4: build ---
mkdir -p dist
OUT="dist/CLIProxyAPI-linux-amd64"
echo "==> Building ${OUT}"
go build \
  -ldflags="-s -w -X 'main.Version=${VERSION}' -X 'main.Commit=${COMMIT}' -X 'main.BuildDate=${BUILD_DATE}'" \
  -o "${OUT}" \
  ./cmd/server/

# --- Step 5: verify ---
echo "==> Build OK"
ls -lh "${OUT}"
file "${OUT}" || true
echo "==> glibc deps:"
ldd "${OUT}" 2>/dev/null | sed 's/^/    /' || echo "    (static / no dynamic deps)"
