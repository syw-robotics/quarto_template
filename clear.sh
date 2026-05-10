#!/usr/bin/env bash

for file in *.qmd; do
  name=$(basename "$file" .qmd)
  rm -f "$name.html" "$name.pdf"
  rm -f ./_quarto_internal_scss_error.scss
  # remove the corresponding folder
  rm -rf "${name}_files"
  # remove exported_html
  rm -rf ./exported_html/

done

echo -e "\033[32m === Auxiliary Files Cleaned === \n\033[0m"
