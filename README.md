<p align="center">
    <h2 align="center"> Quarto Template
    </h2>
</p>

<p align="center" style="text-decoration: none; border: none; margin-bottom: 10px;">
    <img
        alt="Quarto Version Capability"
        src="https://img.shields.io/badge/quarto-v1.8.2-90bbe3?style=for-the-badge&colorA=363A4F&logo=quarto&logoColor=D9E0EE">
    <img
        alt="Code Size"
        src="https://img.shields.io/github/languages/code-size/syw-robotics/quarto_template?colorA=363A4F&colorB=d0aee2&logo=gitlfs&logoColor=D9E0EE&style=for-the-badge">
</p>


<br>


## :cherry_blossom: Introduction

- This repo hosts my simple [Quarto](https://quarto.org/) template configured for documentation (`html` and `pdf`). 
- **Check the `revealjs` template for presentation at [here](https://github.com/syw-robotics/quarto_template/tree/pre)**
- Quarto can also export to `pptx`, but this is not elegent. Hence, I put a `pptx` slide master [at here](https://github.com/syw-robotics/quarto_template/blob/doc/assets/syw_pre_master.pptx) as a better alternative (`Latin modern Sans` font is required).

## :potted_plant: Features
- `main.tex` is the only file that needs to edit.
- Resources are stored in `assets` folder.
- Add bibliography in `assets/references.bib` file.

## :page_with_curl: Scripts

- `clear.sh`:
    - clear exported files. 
- `export.sh`
    - run `./export.sh html`, `./export.sh pdf` to export html or pdf respectively.
- `preview.sh`
    - preview rendered html.
