<!-- Not show on Github! -->
<!-- <p style="font-size: 36px; text-align: center; font-family: Arial, sans-serif;"> -->
<!--     [> <b>Quarto Template</b>  <] -->
<!--     Quarto Template -->
<!-- </p>  -->
<!-- Not show on Github! -->

<!-- <h1 align="center"> -->
<!--     Quarto Template -->
<!-- </h1> -->

<h1  align="center" style="margin-bottom: 70px;">
    Quarto Template
    <br>
    <img
        alt="Neovim Version Capability"
        src="https://img.shields.io/badge/quarto-v1.7.30-90bbe3?style=for-the-badge&colorA=363A4F&logo=quarto&logoColor=D9E0EE">
    <img
        alt="Code Size"
        src="https://img.shields.io/github/languages/code-size/syw-robotics/quarto_template?colorA=363A4F&colorB=d0aee2&logo=gitlfs&logoColor=D9E0EE&style=for-the-badge">
</h1>


<br>


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
