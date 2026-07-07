"""Create a deck or package the CLI from the same set of shared resources."""
import shutil
import sys
import tarfile
from pathlib import Path


def build(command, root, target):
    shared = [
        "_quarto.yaml", "preview.sh", "export_portable_html.sh", "export_pdf.sh",
        "assets/export_reveal_pdf.mjs", "assets/include_after_body.js", "assets/slides.css",
        "assets/ieee.csl", "assets/filters", "assets/fonts", "assets/themes/base",
        "assets/layout/serve.py", "assets/layout/editor.js", "assets/layout/editor.css",
        "assets/layout/shortcuts.js", "assets/layout/playback.js", "assets/layout/playback.html",
        "assets/layout/citations.js", "assets/layout/vendor", "assets/layout/tracknest",
    ]
    shared.extend(p.relative_to(root) for p in sorted((root / "assets/themes").glob("*.scss")))
    if target.resolve().is_relative_to(root / "assets") or target.resolve().is_relative_to(root / "starter"):
        raise ValueError("Choose a destination outside the template resources.")

    if command == "pack":
        with target.open("xb") as output:
            try:
                with tarfile.open(fileobj=output, mode="w:gz", dereference=True) as archive:
                    for rel in [*shared, "starter", "bin/qpre", "bin/scaffold.py", "clear.sh"]:
                        archive.add(root / rel, arcname=Path("qpre") / rel)
            except BaseException:
                target.unlink()
                raise
        print(f"Created {target}")
        return

    target.mkdir(parents=True)
    try:
        shutil.copytree(root / "starter", target, dirs_exist_ok=True)
        for rel in shared:
            src, dest = root / rel, target / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if rel == "assets/fonts":
                dest.symlink_to(src.resolve(strict=True), target_is_directory=True)
            elif src.is_dir():
                shutil.copytree(src, dest)
            else:
                shutil.copy2(src, dest)
        (target / "assets/ref.bib").touch()
        (target / "assets/layout/edits.js").write_text("window.slideEdits = {};\n", encoding="utf-8")
    except BaseException:
        shutil.rmtree(target)
        raise
    print(f"Created {target}\nEdit sections/intro.qmd or run ./preview.sh --edit in the project.")


if __name__ == "__main__":
    try:
        build(sys.argv[1], Path(sys.argv[2]).resolve(), Path(sys.argv[3]))
    except (OSError, ValueError) as error:
        sys.exit(f"qpre: {error}")
