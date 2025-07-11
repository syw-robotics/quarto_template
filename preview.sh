#!/usr/bin/env bash

echo -e "\033[32m\nIf error about *.css occurs, run ./local_fonts.sh \033[0m"
quarto preview main.qmd --port 6111
