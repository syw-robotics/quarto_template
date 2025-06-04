#!/usr/bin/env bash


# check if "main_files" exists
if [ ! -d "./main_files" ]; then
  echo -e "\033[31m === \"main_files\" directory not found! Run \"./preview.sh\" first === \n\033[0m"
  exit 1
fi

cp -r ./assets/fonts/latinmodern-sans/ ./main_files/libs/revealjs/dist/theme/fonts/

echo -e "\033[32m === Moved latinmodern-sans to main_files === \n\033[0m"

