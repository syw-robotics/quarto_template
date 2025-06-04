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

- This repo hosts my [Quarto](https://neovim.io/) `revealjs` template for presentation. 
- **Check the template configured for documentation (`html` and `pdf`) at [here](https://github.com/syw-robotics/quarto_template/tree/doc).** 

## :potted_plant: Features
- `main.tex` is the only file that needs to edit.
- Resources are stored in `assets` folder.
- Add bibliography in `assets/references.bib` file.

## :page_with_curl: Scripts

- `clear.sh`:
    - clear exported files. 
- `preview.sh`
    - preview rendered html.
- `local_fonts.sh.sh`
    - `./assets/custom.scss` defines the theme. By default, the font adopts `Latin Modern Sans` (acquired from the internet, no need for local installation).
    - If the displaying machine does not access the internet, uncomment the `6th line` in `./assets/custom.scss`, then run `./local_fonts.sh`

    The default font config in `./assets/custom.scss` is like this:
    ```scss
    // ===== Fonts from the internet =====
    @import url('https://lalten.github.io/lmweb/style/latinmodern-sans.css');

    // ===== Fonts from local files =====
    // @import url('./fonts/latinmodern-sans/latinmodern-sans.css'); // Turn this on when the display machine can not access the internet, then run `./local_fonts.sh`

    ```
