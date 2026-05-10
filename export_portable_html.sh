#!/usr/bin/env bash

set -euo pipefail

# Resolve paths relative to this script so it can be run from any directory.
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
source_dir="${script_dir}/assets/fonts"
theme_file="${script_dir}/assets/custom.scss"

if [[ ! -d "$source_dir" ]]; then
  echo -e "\033[31m === Error: assets/fonts directory not found === \n\033[0m" >&2
  exit 1
fi

# Font family names used in custom.scss must map to local directories under
# assets/fonts/. Keep this list in sync with the auto-import block in custom.scss.
declare -A FONT_DIRS=(
  ["Latin Modern Sans"]="latinmodern-sans"
  ["Gelasio"]="gelasio"
  ["Nunito"]="nunito"
  ["Montserrat"]="montserrat"
  ["LXGW WenKai"]="lxgw-wenkai"
  ["Source Han Sans SC"]="source-han-sans-sc"
  ["Noto Sans CJK SC"]="noto-sans-cjk-sc"
)

# Read a simple SCSS variable assignment such as:
# $presentation-english-font: "Latin Modern Sans" !default;
read_font_var() {
  local var_name="$1"
  local value

  value="$(
    sed -nE "s/^[[:space:]]*\\\$${var_name}[[:space:]]*:[[:space:]]*['\"]([^'\"]+)['\"].*/\\1/p" "$theme_file" |
      head -n 1
  )"

  if [[ -z "$value" ]]; then
    echo "Error: could not read \$${var_name} from ${theme_file}" >&2
    exit 1
  fi

  printf '%s\n' "$value"
}

english_font="$(read_font_var "presentation-english-font")"
chinese_font="$(read_font_var "presentation-chinese-font")"

# Convert the selected font family names into existing local font directories.
mapfile -t active_dirs < <(
  for family in "$english_font" "$chinese_font"; do
    dir="${FONT_DIRS[$family]:-}"
    if [[ -n "$dir" ]] && [[ -d "${source_dir}/${dir}" ]]; then
      echo "$dir"
    fi
  done | sort -u
)

if [[ ${#active_dirs[@]} -eq 0 ]]; then
  echo -e "\033[31m === Error: no matching font directories found for '$english_font' / '$chinese_font' === \n\033[0m" >&2
  exit 1
fi

# Generate a compact import file with only the selected fonts. This is copied
# next to the bundled font directories for portable HTML/PDF exports.
active_css="${source_dir}/_active_fonts.css"
: > "$active_css"
for dir in "${active_dirs[@]}"; do
  css_file="${source_dir}/${dir}/${dir}.css"
  if [[ -f "$css_file" ]]; then
    echo "@import url('./${dir}/${dir}.css');" >> "$active_css"
  fi
done
echo "Active fonts: ${active_dirs[*]}"

# Quarto writes rendered revealjs assets to directories named *_files.
mapfile -t output_dirs < <(find "$script_dir" -maxdepth 1 -type d -name '*_files' -print | sort)

if [[ ${#output_dirs[@]} -eq 0 ]]; then
  echo -e "\033[31m === Error: no Quarto *_files directory found. Run \`./preview.sh\` first === \n\033[0m" >&2
  exit 1
fi

# Place the selected font CSS and font files where the rendered revealjs theme
# expects relative ./fonts/... URLs to resolve.
for output_dir in "${output_dirs[@]}"; do
  target_dir="${output_dir}/libs/revealjs/dist/theme/fonts"
  mkdir -p "$target_dir"

  cp "$active_css" "$target_dir/"
  for font_dir in "${active_dirs[@]}"; do
    cp -R "${source_dir}/${font_dir}" "$target_dir/"
  done

  echo -e "\033[32m === Bundled fonts into ${target_dir#"$script_dir"/} === \n\033[0m"
done

# Create a self-contained folder with the HTML file, its *_files assets, and
# small project assets needed by the rendered document.
output_dir="${output_dirs[0]}"
base="${output_dir%_files}"
html_file="${base}.html"
export_dir="${script_dir}/exported_html"

rm -rf "$export_dir"
mkdir -p "$export_dir"
cp "$html_file" "$export_dir/"
cp -R "$output_dir" "$export_dir/"
mkdir -p "${export_dir}/assets"
cp "${script_dir}/assets/include_after_body.js" "${export_dir}/assets/"

echo -e "\033[32m === Packaged into ${export_dir#"$script_dir"/} === \n\033[0m"
