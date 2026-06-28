# RevealJS Themes

This folder contains local Quarto RevealJS theme entries. Use a theme by setting
the `theme` field in your `.qmd` front matter:

```yaml
format:
  revealjs:
    theme: assets/themes/claude.scss
```

## Local Fonts

All theme fonts are loaded from this repository under `assets/fonts/`; no theme
requires web fonts at presentation time.

| Font family | Directory | Main use |
| --- | --- | --- |
| Latin Modern Sans | `assets/fonts/latinmodern-sans/` | Default and English text |
| LXGW WenKai | `assets/fonts/lxgw-wenkai/` | Default Chinese text |
| Newsreader | `assets/fonts/newsreader/` | Claude-style English text |
| Source Han Sans SC | `assets/fonts/source-han-sans-sc/` | Claude-style Chinese text |
| Noto Sans CJK SC | `assets/fonts/noto-sans-cjk-sc/` | Minimal and SUSTech Chinese text |
| Montserrat | `assets/fonts/montserrat/` | SUSTech English text |
| PT Serif | `assets/fonts/pt-serif/` | [Slidev](https://sli.dev/) default seriph English text |
| Gelasio | `assets/fonts/gelasio/` | Available serif English option |
| Nunito | `assets/fonts/nunito/` | Available rounded sans English option |

Note: `Source Han Sans SC` is currently a local alias stylesheet that reuses the
bundled `Noto Sans CJK SC` font files. The portable HTML exporter handles this
dependency automatically.

## Theme Gallery

| Theme | Preview | Fonts | Character |
| --- | --- | --- | --- |
| [`default.scss`](https://syw-robotics.github.io/quarto_template/default/) | [![Default theme preview](previews/default.png)](https://syw-robotics.github.io/quarto_template/default/) | Latin Modern Sans + LXGW WenKai | Clean default academic style with red accents and bracket footnotes. |
| [`claude.scss`](https://syw-robotics.github.io/quarto_template/claude/) | [![Claude theme preview](previews/claude.png)](https://syw-robotics.github.io/quarto_template/claude/) | Newsreader + Source Han Sans SC | Warm style inspired by Claude/Anthropic colors, with serif Latin typography and soft rust accents. |
| [`minimal.scss`](https://syw-robotics.github.io/quarto_template/minimal/) | [![Minimal theme preview](previews/minimal.png)](https://syw-robotics.github.io/quarto_template/minimal/) | Latin Modern Sans + Noto Sans CJK SC | Neutral compact style for dense technical presentations. |
| [`sustech.scss`](https://syw-robotics.github.io/quarto_template/sustech/) | [![SUSTech theme preview](previews/sustech.png)](https://syw-robotics.github.io/quarto_template/sustech/) | Montserrat + Noto Sans CJK SC | SUSTech university style with green and orange accents. |

## Structure

- `*.scss` files in this folder are user-facing theme entries.
- `base/` contains shared SCSS modules for fonts, defaults, layout, typography,
  footnotes, and title-slide styling.
