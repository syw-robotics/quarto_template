#!/usr/bin/env bash

set -euo pipefail
cd "$(dirname "$0")"

if [[ "${1:-}" == "--edit" ]]; then
  quarto render main.qmd
  exec python3 assets/layout/serve.py
fi

echo -e "\033[32m\nIf error about *.css occurs, run ./export_portable_html.sh \033[0m"

watch_includes() {
  local last current

  last="$(
    find sections -type f -name '*.qmd' -printf '%T@\n' 2>/dev/null |
      sort -nr |
      head -n 1
  )"

  while true; do
    sleep 1
    current="$(
      find sections -type f -name '*.qmd' -printf '%T@\n' 2>/dev/null |
        sort -nr |
        head -n 1
    )"

    if [[ "${current:-}" != "${last:-}" ]]; then
      last="$current"
      touch main.qmd
    fi
  done
}

watch_includes &
watcher_pid="$!"
trap 'kill "$watcher_pid" 2>/dev/null || true' EXIT

python3 assets/layout/serve.py --preview "$@"
