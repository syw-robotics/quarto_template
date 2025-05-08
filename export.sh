#!/usr/bin/env bash

if [ "$1" = "pdf" ]; then
    quarto render main.qmd --to pdf
elif [ "$1" = "html" ]; then
    quarto render main.qmd --to html
elif [ "$1" = "pptx" ]; then
    quarto render main.qmd --to pptx
else
    quarto render main.qmd
fi    
