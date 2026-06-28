#!/usr/bin/env bash

set -euo pipefail

page_dir="$(cd "$(dirname "$0")" && pwd -P)"
source_dir="${SOURCE_DIR:-${page_dir}/../quarto_revealjs_template}"
source_qmd="${SOURCE_QMD:-main.qmd}"
docs_dir="${page_dir}/docs"

themes=(default claude sustech minimal)

if [[ ! -d "$source_dir" ]]; then
  echo "Error: source repo not found: ${source_dir}" >&2
  exit 1
fi

if [[ ! -f "${source_dir}/${source_qmd}" ]]; then
  echo "Error: source deck not found: ${source_dir}/${source_qmd}" >&2
  exit 1
fi

if [[ ! -x "${source_dir}/export_portable_html.sh" ]]; then
  echo "Error: export_portable_html.sh is missing or not executable." >&2
  exit 1
fi

rm -rf "$docs_dir"
mkdir -p "$docs_dir"
touch "${docs_dir}/.nojekyll"

cleanup_theme_build() {
  local theme="$1"
  rm -rf \
    "${source_dir}/__page_build_${theme}.qmd" \
    "${source_dir}/__page_build_${theme}.html" \
    "${source_dir}/__page_build_${theme}_files"
}

for theme in "${themes[@]}"; do
  echo "=== Rendering theme: ${theme} ==="

  cleanup_theme_build "$theme"

  sed -E \
    "s#^([[:space:]]*theme:).*#\\1 assets/themes/${theme}.scss#" \
    "${source_dir}/${source_qmd}" > "${source_dir}/__page_build_${theme}.qmd"

  (
    cd "$source_dir"
    quarto render "__page_build_${theme}.qmd"
    ./export_portable_html.sh "__page_build_${theme}.qmd"
  )

  mkdir -p "${docs_dir}/${theme}"
  cp -R "${source_dir}/exported_html/." "${docs_dir}/${theme}/"
  mv \
    "${docs_dir}/${theme}/__page_build_${theme}.html" \
    "${docs_dir}/${theme}/index.html"

  cleanup_theme_build "$theme"
done

cat > "${docs_dir}/index.html" <<'EOF'
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Quarto RevealJS Theme Gallery</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f4ee;
      --fg: #24211d;
      --muted: #706a62;
      --line: #ded6ca;
      --accent: #c96442;
      --card: #fffdf8;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: var(--bg);
      color: var(--fg);
      font: 16px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    main {
      width: min(1040px, calc(100% - 32px));
      margin: 56px auto;
    }

    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 5vw, 4rem);
      line-height: 1;
      letter-spacing: 0;
    }

    p {
      max-width: 680px;
      margin: 0 0 28px;
      color: var(--muted);
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
    }

    a {
      display: block;
      min-height: 116px;
      padding: 18px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--card);
      color: inherit;
      text-decoration: none;
    }

    a:hover {
      border-color: var(--accent);
    }

    strong {
      display: block;
      margin-bottom: 8px;
      font-size: 1.15rem;
    }

    span {
      color: var(--muted);
      font-size: 0.95rem;
    }
  </style>
</head>
<body>
  <main>
    <h1>Quarto RevealJS Themes</h1>
    <p>Check the same presentation rendered with each theme.</p>
    <br>
    <div class="grid">
      <a href="./default/"><strong>Default</strong><span>Academic default with red accents.</span></a>
      <a href="./claude/"><strong>Claude</strong><span>Claude palette and serif typography.</span></a>
      <a href="./sustech/"><strong>SUSTech</strong><span>Green and orange SUSTech university style.</span></a>
      <a href="./minimal/"><strong>Minimal</strong><span>Neutral compact technical style.</span></a>
    </div>
  </main>
</body>
</html>
EOF

echo -e "\n\033[32mBuilt theme gallery in docs/:\033[0m"
for theme in "${themes[@]}"; do
  echo "  docs/${theme}/index.html"
done
echo "  docs/index.html"
