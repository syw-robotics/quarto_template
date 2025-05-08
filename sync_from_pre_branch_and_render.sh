#!/usr/bin/env bash

cp -r ../quarto_revealjs_template/exported_html/ ./

mv exported_html docs

echo -e "\n\033[32m Opening Browser ...\033[0m"

microsoft-edge docs/main.html
