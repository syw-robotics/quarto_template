#!/usr/bin/env bash

set -euo pipefail

# Resolve paths relative to this script so it can be run from any directory.
script_dir="$(cd "$(dirname "$0")" && pwd -P)"
source_dir="${script_dir}/assets/fonts"
input="${1:-main.qmd}"

input_file="$(cd "$(dirname "$input")" && pwd -P)/$(basename "$input")"
if [[ ! -f "$input_file" ]]; then
  echo "Error: input file not found: ${input}" >&2
  exit 1
fi

input_dir="$(cd "$(dirname "$input_file")" && pwd -P)"

theme_value="$(
  sed -nE '
    /^[[:space:]]*#/d
    s/^[[:space:]]*theme:[[:space:]]*([^#]+).*/\1/p
  ' "$input_file" |
    head -n 1
)"
theme_rel="$(printf '%s\n' "$theme_value" | grep -oE '([[:alnum:]_.-]+/)*[[:alnum:]_.-]+\.scss' | head -n 1 || true)"

if [[ -z "$theme_rel" ]]; then
  theme_file="${script_dir}/assets/themes/default.scss"
elif [[ "$theme_rel" = /* ]]; then
  theme_file="$theme_rel"
elif [[ -f "${input_dir}/${theme_rel}" ]]; then
  theme_file="${input_dir}/${theme_rel}"
else
  theme_file="${script_dir}/${theme_rel}"
fi

if [[ ! -f "$theme_file" ]]; then
  echo "Error: theme file not found: ${theme_file}" >&2
  exit 1
fi

if [[ ! -d "$source_dir" ]]; then
  echo -e "\033[31m === Error: assets/fonts directory not found === \n\033[0m" >&2
  exit 1
fi

# Font family names used in theme SCSS files must map to local directories under
# assets/fonts/. Keep this list in sync with assets/themes/base/fonts.scss.
declare -A FONT_DIRS=(
  ["Latin Modern Sans"]="latinmodern-sans"
  ["Gelasio"]="gelasio"
  ["Newsreader"]="newsreader"
  ["Nunito"]="nunito"
  ["Montserrat"]="montserrat"
  ["PT Serif"]="pt-serif"
  ["LXGW WenKai"]="lxgw-wenkai"
  ["Source Han Sans SC"]="source-han-sans-sc"
  ["Noto Sans CJK SC"]="noto-sans-cjk-sc"
)

# Read a simple SCSS variable assignment such as:
# $theme-font-en: "Latin Modern Sans";
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

english_font="$(read_font_var "theme-font-en")"
chinese_font="$(read_font_var "theme-font-cn")"

# Convert the selected font family names into existing local font directories.
mapfile -t active_dirs < <(
  for family in "${!FONT_DIRS[@]}"; do
    if [[ "$family" != "$english_font" && "$family" != "$chinese_font" ]] &&
       ! grep -Fqs "\"$family\"" "${input_dir}/assets/layout/edits.js"; then
      continue
    fi
    dir="${FONT_DIRS[$family]:-}"
    if [[ -n "$dir" ]] && [[ -d "${source_dir}/${dir}" ]]; then
      echo "$dir"
    fi
  done | sort -u
)

# Source Han Sans SC is a local alias CSS that reuses the bundled
# Noto Sans CJK SC font files.
if printf '%s\n' "${active_dirs[@]}" | grep -qx "source-han-sans-sc"; then
  mapfile -t active_dirs < <(
    printf '%s\n' "${active_dirs[@]}" "noto-sans-cjk-sc" | sort -u
  )
fi

if [[ ${#active_dirs[@]} -eq 0 ]]; then
  echo -e "\033[31m === Error: no matching font directories found for '$english_font' / '$chinese_font' === \n\033[0m" >&2
  exit 1
fi

echo "Active fonts: ${active_dirs[*]}"

# Quarto writes rendered revealjs assets next to the HTML as <name>_files.
input_base="$(basename "${input_file%.*}")"
html_file="${input_dir}/${input_base}.html"
output_dir="${input_dir}/${input_base}_files"

if [[ ! -f "$html_file" || ! -d "$output_dir" ]]; then
  echo -e "\033[31m === Error: rendered output not found for ${input_base}. Run \`quarto render ${input}\` first === \n\033[0m" >&2
  exit 1
fi

# Create a self-contained folder with the HTML file, its *_files assets, and
# project assets referenced by the rendered document.
export_dir="${input_dir}/exported_html"

rm -rf "$export_dir"
mkdir -p "$export_dir"
cp "$html_file" "$export_dir/"
cp -R "$output_dir" "$export_dir/"
mkdir -p "${export_dir}/assets"
cp "${script_dir}/assets/include_after_body.js" "${export_dir}/assets/"
if grep -Fq 'src="assets/layout/playback.js"' "$html_file"; then
  mkdir -p "${export_dir}/assets/layout"
  cp "${input_dir}/assets/layout/"{edits,citations,playback}.js "${export_dir}/assets/layout/"
fi
if grep -Fq 'href="assets/slides.css"' "$html_file"; then
  cp "${input_dir}/assets/slides.css" "${export_dir}/assets/"
fi
mkdir -p "${export_dir}/assets/fonts"
for font_dir in "${active_dirs[@]}"; do
  cp -R "${source_dir}/${font_dir}" "${export_dir}/assets/fonts/"
done

# Media may live in arbitrary nested directories (for example
# assets/kaiti/proof/...), so preserve every image/video path under assets/
# instead of only copying the legacy assets/images and assets/videos folders.
copy_media_assets() {
  local assets_root="$1"
  local media_file relative_path destination media_list

  [[ -d "$assets_root" ]] || return 0

  # Keep project media together, including subtitles, audio and linked files.
  if [[ -d "$assets_root/media" ]]; then
    mkdir -p "$export_dir/assets/media"
    cp -R "$assets_root/media/." "$export_dir/assets/media/"
  fi
  media_list="$(mktemp)"
  find "$assets_root" -path "$assets_root/media" -prune -o -type f -iregex \
    '.*\.\(png\|jpe?g\|gif\|svg\|webp\|avif\|bmp\|tiff?\|mp4\|webm\|mov\|m4v\|ogv\)$' \
    -print0 >"$media_list"

  while IFS= read -r -d '' media_file; do
    relative_path="${media_file#"${assets_root}/"}"
    destination="${export_dir}/assets/${relative_path}"
    mkdir -p "$(dirname "$destination")"
    cp "$media_file" "$destination"
  done <"$media_list"
  rm -f "$media_list"
}

copy_media_assets "${input_dir}/assets"

echo -e "\033[32m === Bundled fonts into exported_html/assets/fonts === \n\033[0m"
echo -e "\033[32m === Bundled images and videos into exported_html/assets === \n\033[0m"
echo -e "\033[32m === Packaged into ${export_dir} === \n\033[0m"
