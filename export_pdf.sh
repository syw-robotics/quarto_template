#!/usr/bin/env bash

set -euo pipefail

# Accept an optional .qmd path; default to the template deck.
input="${1:-main.qmd}"
base="${input%.*}"
html_file="${base}.html"
pdf_file="${base}.pdf"

# The shell script orchestrates Quarto and Node; the browser automation lives in
# assets/export_reveal_pdf.mjs.
if ! command -v quarto >/dev/null 2>&1; then
  echo "Error: quarto is not available in PATH." >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "Error: node is not available in PATH." >&2
  exit 1
fi

script_dir="$(cd "$(dirname "$0")" && pwd -P)"

# CHROME_BIN lets users choose a specific Chrome/Chromium-compatible browser.
browser="${CHROME_BIN:-}"
if [[ -n "$browser" ]] && ! command -v "$browser" >/dev/null 2>&1; then
  echo "Error: CHROME_BIN is set to '${browser}', but it is not available in PATH." >&2
  exit 1
fi

# Render the Revealjs HTML first; the PDF exporter prints this rendered output.
echo "Rendering ${input}..."
quarto render "$input"

if [[ ! -f "$html_file" ]]; then
  echo "Error: expected ${html_file} was not created." >&2
  exit 1
fi

# Bundle the selected local fonts into the rendered *_files directory before
# opening the HTML in the browser, so PDF export does not depend on the network.
"${script_dir}/export_portable_html.sh"

# Auto-detect a usable browser if CHROME_BIN was not provided.
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

# Use Revealjs' print view through browser automation to preserve selectable
# text, links, slide numbers, and footer rendering.
echo "Exporting PDF with ${browser}..."
node "${script_dir}/assets/export_reveal_pdf.mjs" "$browser" "file://${html_path}" "$pdf_file"

echo "Output created: ${pdf_file}"
