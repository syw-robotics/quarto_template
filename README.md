# Quarto RevealJS Theme Gallery

这个仓库用于把 `quarto_revealjs_template` 中的同一份 Quarto RevealJS 演示文稿，分别渲染成多个主题版本，并发布到 GitHub Pages。

## 使用

在当前目录运行：

```bash
./sync_from_pre_branch_and_render.sh
```

脚本会从相邻目录 `../quarto_revealjs_template` 读取 `main.qmd`，依次渲染以下主题：

- `default`
- `claude`
- `sustech`
- `minimal`

生成结果会写入 `docs/`：

- `docs/index.html`：主题入口页
- `docs/default/index.html`
- `docs/claude/index.html`
- `docs/sustech/index.html`
- `docs/minimal/index.html`

## GitHub Pages

GitHub Pages 应配置为从 `docs/` 目录发布。

`docs/.nojekyll` 必须保留。Quarto/RevealJS 的资源目录名包含下划线，例如 `__page_build_default_files/`；如果没有 `.nojekyll`，GitHub Pages 的 Jekyll 处理会忽略这些目录，导致主题页面缺少 CSS/JS，页面无法正确渲染。
