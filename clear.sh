#!/usr/bin/env bash

# find .qmd file and extract the name without extension
# find .qmd file and extract the name without extension
for file in *.qmd; do
  name=$(basename "$file" .qmd)
  rm  "$name.pptx"
  rm  "$name.html"
  rm  "$name.pdf"
  rm  "$name.tex"
  # remove the corresponding folder
  rm -r "${name}_files"
done

