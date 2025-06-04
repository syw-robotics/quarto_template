#!/usr/bin/env bash

for file in *.qmd; do
  name=$(basename "$file" .qmd)
  rm  "$name.html"
  # remove the corresponding folder
  rm -r "${name}_files"

done

echo -e "\033[32m === Auxiliary Files Cleaned === \n\033[0m"

