#!/usr/bin/env bash
# Installs pinned release binaries for CI (PQ-004) after verifying their
# SHA-256 checksums against the values below. Runs on the Linux and Windows
# runners (Git Bash). Usage: install-tools.sh task [golangci-lint]
#
# The versions must match Taskfile.yml (REQUIRED_TASK_VERSION,
# GOLANGCI_LINT_VERSION); `task tools:verify` fails the job if they drift.
# The checksums come from each release's official checksums file.
set -euo pipefail

TASK_VERSION="3.54.0"
GOLANGCI_LINT_VERSION="2.15.0"

declare -A SHA256=(
  ["task_linux_amd64.tar.gz"]="680859dbb4d881a9c72d4d9a8f510825450849af8567deacd7302c01124416fb"
  ["task_windows_amd64.zip"]="837f42f71899ea41d07a47acc81d4d6ea80cb41c68292345f915c656473efcb7"
  ["golangci-lint-${GOLANGCI_LINT_VERSION}-linux-amd64.tar.gz"]="9b7fe6a6bf6334b98decf8d86b11415ea7889afdabdd1959fdce23af2a9ebcea"
  ["golangci-lint-${GOLANGCI_LINT_VERSION}-windows-amd64.zip"]="cd7ea6063c95de245e17e5246e42bdc14bb221792c429dbd239ab3a6ade6ca6a"
)

case "${RUNNER_OS:-}" in
  Linux) os="linux" ext="tar.gz" exe="" ;;
  Windows) os="windows" ext="zip" exe=".exe" ;;
  *)
    echo "unsupported RUNNER_OS: '${RUNNER_OS:-}'" >&2
    exit 1
    ;;
esac

work="${RUNNER_TEMP:?RUNNER_TEMP is not set}/pq-tools"
bin="$work/bin"
mkdir -p "$bin"

# download_verified URL FILE: downloads URL to $work/FILE and checks its SHA-256.
download_verified() {
  local url="$1" file="$2"
  local expected="${SHA256[$file]:-}"
  if [ -z "$expected" ]; then
    echo "no pinned SHA-256 for $file" >&2
    exit 1
  fi
  curl -fsSL --retry 3 -o "$work/$file" "$url"
  (cd "$work" && echo "$expected  $file" | sha256sum -c -)
}

# extract FILE DIR: unpacks a .tar.gz or .zip archive from $work into DIR.
extract() {
  local file="$1" dir="$2"
  mkdir -p "$dir"
  if [ "$ext" = "zip" ]; then
    powershell.exe -NoProfile -NonInteractive -Command \
      "Expand-Archive -LiteralPath '$(cygpath -w "$work/$file")' -DestinationPath '$(cygpath -w "$dir")' -Force"
  else
    tar -xzf "$work/$file" -C "$dir"
  fi
}

install_task() {
  local file="task_${os}_amd64.${ext}"
  download_verified "https://github.com/go-task/task/releases/download/v${TASK_VERSION}/${file}" "$file"
  extract "$file" "$work/task"
  cp "$work/task/task${exe}" "$bin/"
}

install_golangci_lint() {
  local name="golangci-lint-${GOLANGCI_LINT_VERSION}-${os}-amd64"
  local file="${name}.${ext}"
  download_verified "https://github.com/golangci/golangci-lint/releases/download/v${GOLANGCI_LINT_VERSION}/${file}" "$file"
  extract "$file" "$work/golangci-lint"
  cp "$work/golangci-lint/${name}/golangci-lint${exe}" "$bin/"
}

if [ "$#" -eq 0 ]; then
  echo "usage: $0 task [golangci-lint]" >&2
  exit 1
fi

for tool in "$@"; do
  case "$tool" in
    task) install_task ;;
    golangci-lint) install_golangci_lint ;;
    *)
      echo "unknown tool: $tool" >&2
      exit 1
      ;;
  esac
done

if [ "$os" = "windows" ]; then
  cygpath -w "$bin" >>"${GITHUB_PATH:?GITHUB_PATH is not set}"
else
  echo "$bin" >>"${GITHUB_PATH:?GITHUB_PATH is not set}"
fi
