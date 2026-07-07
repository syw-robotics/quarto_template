"""Serve the rendered main deck and persist its visual edits on loopback."""
import json
import hashlib
import math
import os
import re
import subprocess
import sys
import tempfile
import webbrowser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Lock, Thread

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "assets/layout/edits.js"
PREFIX = "window.slideEdits = "
lock = Lock()
MEDIA = ROOT / "assets/layout/media"
source_lock = Lock()


def headings(lines):
    """ATX headings outside Markdown examples and HTML comments."""
    fence = ""
    comment = False
    for i, line in enumerate(lines):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence:
            if line.strip().startswith(fence) and not line.strip().strip(fence[0]):
                fence = ""
        elif comment:
            comment = "-->" not in line
        elif marker:
            fence = marker[1]
        elif line.lstrip().startswith("<!--"):
            comment = "-->" not in line
        elif match := re.match(r"^ {0,3}(#{1,6})[ \t]+", line):
            yield i, len(match[1])


def slide_sources():
    main = ROOT / "main.qmd"
    manuscript = main.read_bytes().decode("utf-8")
    meta = re.match(r"\A---[ \t]*\r?\n.*?^---[ \t]*(?:\r?\n|$)", manuscript, re.M | re.S)
    if not meta:
        raise ValueError("Missing title metadata in main.qmd")
    pages = {"title-slide": (main, 0, meta.end(), 1, manuscript)}
    titles, sections = [], []
    for name in re.findall(r"^\s*\{\{<\s*include\s+(sections/[^\s>]+\.qmd)\s*>\}\}\s*$", manuscript[meta.end():], re.M):
        path = (ROOT / name).resolve()
        if not path.is_relative_to(ROOT / "sections"):
            raise ValueError("Invalid section path")
        source = path.read_bytes().decode("utf-8")
        lines = source.splitlines(keepends=True)
        starts = [0]
        for line in lines:
            starts.append(starts[-1] + len(line))
        headers = list(headings(lines))
        slides = [i for i, level in headers if level == 2]
        for i, _ in headers:
            titles.append(lines[i].strip())
        for i, end in zip(slides, slides[1:] + [len(lines)]):
            sections.append((path, starts[i], starts[end], i + 1, source))
    # Pandoc resolves inline Markdown, explicit anchors and duplicate titles just as in the deck.
    result = subprocess.run(["quarto", "pandoc", "-f", "markdown", "-t", "json"], cwd=ROOT,
                            input="\n\n".join(titles), capture_output=True, text=True, check=True)
    ids = [b["c"][1][0] for b in json.loads(result.stdout)["blocks"] if b["t"] == "Header" and b["c"][0] == 2]
    if len(ids) != len(sections) or len(set(ids)) != len(ids):
        raise ValueError("Cannot uniquely locate slide headings")
    pages.update(zip(ids, sections))
    return pages


def atomic_text(path, text):
    with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="", dir=path.parent, delete=False) as tmp:
        tmp.write(text)
    os.chmod(tmp.name, path.stat().st_mode & 0o777)
    os.replace(tmp.name, path)


def media_extension(head):
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if head.startswith(b"\xff\xd8\xff"):
        return "jpg"
    if head.startswith((b"GIF87a", b"GIF89a")):
        return "gif"
    if head.startswith(b"RIFF") and head[8:12] == b"WEBP":
        return "webp"
    if head.startswith(b"\x1a\x45\xdf\xa3") and b"webm" in head:
        return "webm"
    if head[4:8] == b"ftyp":
        if head[8:12] in (b"avif", b"avis"):
            return "avif"
        return "mov" if head[8:12] == b"qt  " else "mp4"


def valid_object(spec):
    if not isinstance(spec, dict):
        return False
    strings = {"kind", "content", "color", "align", "src", "fit", "label", "caption", "status", "border", "borderRadius"}
    numbers = {"left", "top", "width", "height", "size", "weight", "leading"}
    for prop, value in spec.items():
        if spec.get("kind") == "text" and prop in {"italic", "lines"} and valid_change(prop, value):
            continue
        if spec.get("kind") == "background" and prop == "decoration" and isinstance(value, str):
            continue
        if spec.get("kind") == "element":
            if prop in ("source", "viewBox") and isinstance(value, str):
                continue
            if prop == "parts" and isinstance(value, dict) and all(
                key.isdecimal() and isinstance(patch, dict) and all(valid_change(k, v) for k, v in patch.items())
                for key, patch in value.items()
            ):
                continue
        if prop in strings and isinstance(value, str):
            continue
        if prop in numbers and type(value) in (float, int) and math.isfinite(value):
            continue
        if prop == "bottom" and isinstance(value, bool):
            continue
        return False
    if not {"left", "top"} <= spec.keys() or ("width" in spec and spec["width"] <= 0):
        return False
    if spec.get("kind") == "text":
        return {"content", "color", "align", "size", "weight", "leading"} <= spec.keys()
    if "width" not in spec:
        return False
    if spec.get("kind") == "background":
        return "decoration" in spec and spec.get("height", 0) > 0
    if spec.get("kind") == "element":
        return isinstance(spec.get("source"), str) and spec.get("height", 0) > 0
    return spec.get("kind") in ("img", "video") and bool(spec.get("src")) and spec.get("height", 0) > 0


def valid_change(prop, value):
    if prop in {"family", "group", "boxStyle"}:
        return isinstance(value, str)
    if prop == "crop":
        return (isinstance(value, list) and len(value) == 4 and
                all(type(n) in (int, float) and 0 <= n < 100 for n in value) and
                value[0] + value[2] < 100 and value[1] + value[3] < 100)
    if prop in {"boxWidth", "boxHeight", "radius", "angle"}:
        return type(value) in (int, float) and math.isfinite(value) and (prop == "angle" or value >= 0)
    if prop in {"deleted", "italic"}:
        return isinstance(value, bool)
    if prop == "lines":
        return isinstance(value, str) and (value == "none" or bool(value.split())
            and set(value.split()) <= {"underline", "line-through", "overline", "blink"})
    if prop == "text":
        return isinstance(value, str)
    if prop == "runs":
        return isinstance(value, list) and all(isinstance(run, str) for run in value)
    if prop == "align":
        return value in ("left", "center", "right")
    return prop in {"size", "weight", "zoom", "x", "y"} and type(value) in (int, float) and math.isfinite(value)


def valid_setting(prop, value):
    if prop == "citationPreview":
        return value == "rendered"
    if re.fullmatch(r"h[1-6]Weight", prop):
        return value in ("normal", "bold")
    if re.fullmatch(r"h[1-6]Style", prop):
        return value in ("normal", "italic")
    if re.fullmatch(r"h[1-6]Lines", prop):
        return value in ("none", "underline", "line-through", "underline line-through")
    if prop == "footerSync":
        return isinstance(value, bool)
    if prop == "logo":
        return isinstance(value, str) and bool(re.fullmatch(r"assets/layout/media/[0-9a-f]{64}\.(png|jpg|gif|webp|avif)", value))
    if re.fullmatch(r"h[1-6]Size", prop):
        return type(value) is int and 8 <= value <= 240
    if prop == "en" or re.fullmatch(r"h[1-6]En", prop):
        return value in ("Montserrat", "Gelasio", "Latin Modern Sans", "Newsreader", "Nunito", "PT Serif")
    if prop == "zh" or re.fullmatch(r"h[1-6]Zh", prop):
        return value in ("Noto Sans CJK SC", "LXGW WenKai", "Source Han Sans SC")
    return False


class Editor(SimpleHTTPRequestHandler):
    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def slide_source(self, data, write):
        with source_lock:
            pages = slide_sources()
            if data["id"] not in pages:
                return self.send_json(409, {"error": "找不到当前页的源码，请刷新并核对标题。"})
            path, start, end, line, original = pages[data["id"]]
            name = path.relative_to(ROOT).as_posix()
            previous = original[start:end].replace("\r\n", "\n")
            if not write:
                return self.send_json(200, {"file": name, "line": line, "source": previous})
            if data["file"] != name or data["previous"] != previous:
                return self.send_json(409, {"error": "本页源码已在其他窗口修改。请复制当前草稿，再重新打开源码。"})
            source = data["source"]
            if not isinstance(source, str):
                raise ValueError
            if path == ROOT / "main.qmd":
                if not re.fullmatch(r"---[ \t]*\n.*?^---[ \t]*\n*", source, re.M | re.S):
                    return self.send_json(400, {"error": "封面源码需要保留首尾的 YAML 分隔线 ---。"})
            elif not re.match(r"^ {0,3}##[ \t]+\S", source):
                return self.send_json(400, {"error": "本页源码需要以二级标题（## 标题）开头。"})
            if not source.endswith("\n"):
                source += "\n"
            if end < len(original) and not source.endswith("\n\n"):
                source += "\n"
            if "\r\n" in original:
                source = source.replace("\n", "\r\n")
            updated = original[:start] + source + original[end:]
            if path.read_bytes().decode("utf-8") != original:
                return self.send_json(409, {"error": "文件已更改，请重新打开源码。"})
            atomic_text(path, updated)
            try:
                args = ["quarto", "render", "main.qmd", "--to", "revealjs"]
                if metadata := getattr(self.server, "preview_metadata", None):
                    args.extend(["--metadata-file", str(metadata)])
                subprocess.run(args, cwd=ROOT, capture_output=True, text=True, check=True)
            except (OSError, subprocess.CalledProcessError) as exc:
                # Keep the draft in the browser and avoid overwriting an intervening external edit.
                if path.read_bytes().decode("utf-8") == updated:
                    atomic_text(path, original)
                detail = getattr(exc, "stderr", "") or str(exc)
                return self.send_json(422, {"error": "渲染失败，请修正草稿后重试。\n" + detail[-2000:]})
            return self.send_json(200, {"index": list(pages).index(data["id"])})

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self):
        path = Path(self.translate_path(self.path))
        requested = self.headers.get("Range")
        if not requested or path.suffix.lower() not in {".mp4", ".m4v", ".webm", ".mov", ".ogv"} or not path.is_file():
            return super().do_GET()
        size = path.stat().st_size
        match = re.fullmatch(r"bytes=(\d*)-(\d*)", requested)
        if not match or not any(match.groups()):
            return self.send_error(416)
        first, last = match.groups()
        start = int(first) if first else max(0, size - int(last))
        end = min(int(last), size - 1) if first and last else size - 1
        if start > end:
            return self.send_error(416)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(str(path)))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        remaining = end - start + 1
        self.send_header("Content-Length", str(remaining))
        self.end_headers()
        with path.open("rb") as src:
            src.seek(start)
            while remaining:
                data = src.read(min(remaining, 65536))
                if not data:
                    break
                try:
                    self.wfile.write(data)
                except (BrokenPipeError, ConnectionResetError):
                    return  # The player cancelled this range after a seek or slide change.
                remaining -= len(data)

    def do_POST(self):
        origin = f"http://127.0.0.1:{self.server.server_port}"
        if (self.path not in ("/save-layout", "/insert-media", "/slide-source", "/save-source") or self.headers.get("Origin") != origin
                or self.headers.get("Host") != origin.split("//")[1]):
            return self.send_error(403)
        try:
            length = int(self.headers.get("Content-Length", 0))
            if self.path == "/insert-media":
                return self.upload(length)
            if not 0 < length <= 2_000_000:
                return self.send_error(413)
            data = json.loads(self.rfile.read(length))
            if self.path in ("/slide-source", "/save-source"):
                return self.slide_source(data, self.path == "/save-source")
            edits = data["edits"]
            if not isinstance(edits, dict) or not isinstance(data["previous"], dict):
                raise ValueError
            for key, edit in edits.items():
                if not isinstance(json.loads(key), list) or not isinstance(edit, dict):
                    raise ValueError
                if key == '["settings"]':
                    if not all(valid_setting(prop, value) for prop, value in edit.items()):
                        raise ValueError
                    continue
                for prop, value in edit.items():
                    if prop == "logoSrc" and json.loads(key)[-2:] == ["footer", "logo"] and (value == "" or valid_setting("logo", value)):
                        continue
                    if prop == "add" and valid_object(value):
                        continue
                    if not valid_change(prop, value):
                        raise ValueError
            encoded = json.dumps(edits, ensure_ascii=False, indent=2, allow_nan=False)
        except (OSError, subprocess.CalledProcessError):
            return self.send_json(500, {"error": "无法读取工程源码，请检查本地文件和 Quarto。"})
        except (TypeError, KeyError, ValueError):
            return self.send_error(400)
        with lock:
            current = LAYOUT.read_text().strip().removeprefix(PREFIX).removesuffix(";")
            if json.loads(current) != data["previous"]:
                return self.send_error(409, "Layout changed in another session")
            atomic_text(LAYOUT, PREFIX + encoded + ";\n")
        self.send_response(204)
        self.end_headers()

    def upload(self, length):
        if not 0 < length <= 512 * 1024**2:
            return self.send_error(413)
        head = self.rfile.read(min(length, 512))
        ext = media_extension(head)
        if not ext:
            return self.send_error(415)
        MEDIA.mkdir(exist_ok=True)
        digest = hashlib.sha256()
        with tempfile.NamedTemporaryFile(dir=MEDIA, delete=False) as tmp:
            path = Path(tmp.name)
            try:
                chunk = head
                while length:
                    if not chunk:
                        return self.send_error(400)
                    digest.update(chunk)
                    tmp.write(chunk)
                    length -= len(chunk)
                    if length:
                        chunk = self.rfile.read(min(length, 1024**2))
                tmp.flush()
                dest = MEDIA / f"{digest.hexdigest()}.{ext}"
                os.replace(path, dest)
            finally:
                path.unlink(missing_ok=True)
        body = json.dumps({"src": dest.relative_to(ROOT).as_posix()}).encode()
        self.send_response(201)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def translate_path(self, path):
        requested = Path(super().translate_path(path))
        path = requested.resolve()
        fonts = ROOT / "assets/fonts"
        if requested.is_relative_to(fonts) and path.is_relative_to(fonts.resolve()):
            return str(path)
        if path == ROOT / "main.html" or any(path.is_relative_to(ROOT / folder) for folder in ("main_files", "assets")):
            return str(path)
        return str(ROOT / "_no_such_editor_resource")

    def list_directory(self, path):
        return self.send_error(403)


if __name__ == "__main__":
    os.chdir(ROOT)
    preview = sys.argv[1:2] == ["--preview"]
    port = int(sys.argv[1]) if not preview and len(sys.argv) > 1 else 0
    with ThreadingHTTPServer(("127.0.0.1", port), Editor) as server:
        url = f"http://127.0.0.1:{server.server_port}/main.html?edit"
        if preview:
            with tempfile.TemporaryDirectory() as directory:
                metadata = Path(directory) / "preview.yml"
                server.preview_metadata = metadata
                metadata.write_text(f"""include-in-header:
  - text: '<meta name="slide-editor-port" content="{server.server_port}">'
""")
                Thread(target=server.serve_forever, daemon=True).start()
                args = sys.argv[2:]
                if "--port" not in args:
                    args = ["--port", "6111", *args]
                sys.exit(subprocess.call(["quarto", "preview", "main.qmd", "--metadata-file", str(metadata), *args]))
        print(f"幻灯片编辑器  {url}", flush=True)
        webbrowser.open(url)
        server.serve_forever()
