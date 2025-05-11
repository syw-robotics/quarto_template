#!/usr/bin/env bash

if [ "$1" = "pdf" ]; then
    quarto render main.qmd --to pdf
elif [ "$1" = "html" ]; then
    quarto render main.qmd --to html
else
    echo "Error: Invalid arg. Valid options are 'pdf' and 'html'." >&2
    exit 1
fi    
