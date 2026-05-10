<p align="center">
    <h2 align="center"> Quarto Template
    </h2>
</p>

<p align="center" style="text-decoration: none; border: none; margin-bottom: 10px;">
    <img
        alt="Quarto Version Capability"
        src="https://img.shields.io/badge/quarto-v1.9.37-90bbe3?style=for-the-badge&colorA=363A4F&logo=quarto&logoColor=D9E0EE">
    <img
        alt="Code Size"
        src="https://img.shields.io/github/languages/code-size/syw-robotics/quarto_template?colorA=363A4F&colorB=d0aee2&logo=gitlfs&logoColor=D9E0EE&style=for-the-badge">
</p>


<br>


## :cherry_blossom: Introduction

- This repo hosts my [Quarto](https://neovim.io/) `revealjs` template for presentation. 
- **Check the template configured for documentation (`html` and `pdf`) at [here](https://github.com/syw-robotics/quarto_template/tree/doc).** 
- [**Click to preview this template**](https://syw-robotics.github.io/quarto_template/main.html)

## :potted_plant: Features
- `main.tex` is the only file that needs to edit.
- Resources are stored in `assets` folder.
- Add bibliography in `assets/references.bib` file.

## :page_with_curl: Scripts

- `clear.sh`:
    - clear exported files. 
- `preview.sh`
    - preview rendered html.
- `export_pdf.sh`
    - render the Quarto `revealjs` deck and export a selectable-text PDF through the same Revealjs print view used by the HTML output.
    - requires `quarto`, `node`, and a Chrome/Chromium-compatible browser in `PATH`.
    - usage: `./export_pdf.sh` or `./export_pdf.sh your-slide.qmd`.
    - if the browser is not auto-detected, set it explicitly: `CHROME_BIN=microsoft-edge ./export_pdf.sh`.
    - the PDF exporter implementation lives in `assets/export_reveal_pdf.mjs`; the project root keeps only the `export_pdf.sh` entry script.
    - the exporter preserves internal cross-reference links, selectable text, custom footers, Revealjs slide numbers, and expands tabsets so each tab is included in the PDF.
- `export_portable_html.sh`
    - bundles the selected English + Chinese fonts from `assets/fonts/` into Quarto's rendered `*_files/libs/revealjs/dist/theme/fonts/` directory.
    - all fonts are self-contained — no dependency on locally installed fonts or internet access.
    - run it after `quarto render` to make the HTML portable to any machine.
    - `export_pdf.sh` runs this step automatically after rendering.
    - to present offline, copy the rendered `.html` file together with its matching `*_files` directory and any project assets you reference, such as `assets/`.

    Font selection is controlled in `./assets/custom.scss`:
    ```scss
    $presentation-english-font: "Latin Modern Sans" !default;
    $presentation-chinese-font: "LXGW WenKai" !default;
    ```
    `assets/custom.scss` imports the matching local font CSS automatically.
