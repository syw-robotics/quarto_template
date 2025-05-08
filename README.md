<h1 align="center">
    Quarto Template
    <br>
    <img
        alt="Neovim Version Capability"
        src="https://img.shields.io/badge/quarto-v1.7.30-90bbe3?style=for-the-badge&colorA=363A4F&logo=quarto&logoColor=D9E0EE">
    <img
        alt="Code Size"
        src="https://img.shields.io/github/languages/code-size/syw-robotics/quarto_template?colorA=363A4F&colorB=c6a7d6&logo=gitlfs&logoColor=D9E0EE&style=for-the-badge">
</h1>
<br>

![highvim-cover](./assets.README/highvim-cover.png)

##  🪷 Introduction

- This repo hosts my simple [Quarto](https://neovim.io/) template configured for html, pdf and pptx. 
- `main.tex` is the only file that needs to edit.
- Media resources are stored in `assets` folder.
- Add bibliography in `assets/references.bib` file.

## 📃 Scripts

- `clear.sh`:
    - clear exported files. 
- `export.sh`
    - run `./export.sh html`, `./export.sh pdf`, `./export.sh pptx` to export html, pdf and pptx respectively.
- `preview.sh`
    - preview rendered html.
