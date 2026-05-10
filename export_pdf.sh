#!/usr/bin/env bash

set -euo pipefail

input="${1:-main.qmd}"
base="${input%.*}"
html_file="${base}.html"
pdf_file="${base}.pdf"

if ! command -v quarto >/dev/null 2>&1; then
  echo "Error: quarto is not available in PATH." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not available in PATH." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd -P)"

browser="${CHROME_BIN:-}"
if [[ -n "$browser" ]] && ! command -v "$browser" >/dev/null 2>&1; then
  echo "Error: CHROME_BIN is set to '${browser}', but it is not available in PATH." >&2
  exit 1
fi

echo "Rendering ${input}..."
quarto render "$input"

if [[ ! -f "$html_file" ]]; then
  echo "Error: expected ${html_file} was not created." >&2
  exit 1
fi

if [[ -z "$browser" ]]; then
  for candidate in google-chrome-stable google-chrome chrome chromium chromium-browser microsoft-edge brave-browser; do
    if command -v "$candidate" >/dev/null 2>&1; then
      browser="$candidate"
      break
    fi
  done
fi

if [[ -z "$browser" ]]; then
  echo "Error: no Chrome/Chromium-compatible browser was found." >&2
  echo "Install Chrome/Chromium or run with CHROME_BIN=/path/to/browser." >&2
  exit 1
fi

html_path="$(cd "$(dirname "$html_file")" && pwd -P)/$(basename "$html_file")"

echo "Exporting PDF with ${browser}..."
node "${script_dir}/pdf_export/export_reveal_pdf.mjs" "$browser" "file://${html_path}" "$pdf_file"

echo "Output created: ${pdf_file}"
