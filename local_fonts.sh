#!/usr/bin/env bash


# check arguments: quit when no arg
if [ $# -ne 1 ]; then
  echo -e "\033[31m === No arguments expected! === \n\033[0m"
  echo -e "\033[32m Available args: lm, gel\033[0m"
  echo -e "\033[32m   - lm: Latin Modern Sans\033[0m"
  echo -e "\033[32m   - gel: Gelasio\033[0m"
  echo -e "\033[32m   - nu: Nunito\033[0m"
  echo -e "\033[32m   - mon: Montserrat\033[0m"
  exit 1
fi

# check if arg valid
valid_args=("lm" "gel" "nu" "mon")
if [[ ! " ${valid_args[@]} " =~ " $1 " ]]; then
  echo -e "\033[31m === Invalid argument! === \n\033[0m"
  echo -e "\033[32m Available args: lm, gel\033[0m"
  echo -e "\033[32m   - lm: Latin Modern Sans\033[0m"
  echo -e "\033[32m   - gel: Gelasio\033[0m"
  echo -e "\033[32m   - nu: Nunito\033[0m"
  echo -e "\033[32m   - mon: Montserrat\033[0m"
  exit 1
fi

# check if "main_files" exists
if [ ! -d "./main_files" ]; then
  echo -e "\033[31m === \"main_files\" directory not found! Run \"./preview.sh\" first === \n\033[0m"
  exit 1
fi

# if arg is lm
if [ "$1" == "lm" ]; then
  cp -r ./assets/fonts/latinmodern-sans/ ./main_files/libs/revealjs/dist/theme/fonts/
  echo -e "\033[32m === Moved Latin Modern Sans to main_files === \n\033[0m"
  exit 0
fi

# if arg is gel
if [ "$1" == "gel" ]; then
  cp -r ./assets/fonts/gelasio/ ./main_files/libs/revealjs/dist/theme/fonts/
  echo -e "\033[32m === Moved Gelasio to main_files === \n"
  exit 0
fi

# if arg is nu
if [ "$1" == "nu" ]; then
  cp -r ./assets/fonts/nunito/ ./main_files/libs/revealjs/dist/theme/fonts/
  echo -e "\033[32m === Moved Nuito to main_files === \n"
  exit 0
fi

# if arg is mon
if [ "$1" == "mon" ]; then
  cp -r ./assets/fonts/montserrat/ ./main_files/libs/revealjs/dist/theme/fonts/
  echo -e "\033[32m === Moved Montserrat to main_files === \n"
  exit 0
fi

