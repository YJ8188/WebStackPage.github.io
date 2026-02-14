#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import json
import shutil
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tkinter import filedialog, messagebox
import tkinter as tk


MANAGER_CONFIG_FILE = "manager-config.json"


def app_home_dir() -> Path:
    base = Path.home() / ".webstack-desktop"
    base.mkdir(parents=True, exist_ok=True)
    return base


def app_config_path() -> Path:
    return app_home_dir() / "config.json"


def manager_config_path() -> Path:
    return app_home_dir() / MANAGER_CONFIG_FILE


def load_bound_repo() -> Path | None:
    path = manager_config_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    repo = str(data.get("bound_repo_root", "")).strip()
    if not repo:
        return None
    candidate = Path(repo)
    if (candidate / "index.html").exists():
        return candidate
    return None


def resolve_embedded_workspace() -> Path | None:
    if not getattr(sys, "frozen", False):
        return None
    base = Path(getattr(sys, "_MEIPASS", ""))
    candidate = base / "workspace_bundle"
    if (candidate / "index.html").exists():
        return candidate
    return None


def prepare_default_workspace() -> Path | None:
    embedded = resolve_embedded_workspace()
    if not embedded:
        return None
    workspace = app_home_dir() / "workspace"
    index_file = workspace / "index.html"
    if not index_file.exists():
        shutil.copytree(embedded, workspace, dirs_exist_ok=True)
    return workspace


def load_last_repo() -> Path | None:
    path = app_config_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    repo = data.get("repo_root", "")
    if not repo:
        return None
    candidate = Path(repo)
    if (candidate / "index.html").exists():
        return candidate
    return None


def save_last_repo(repo_root: Path) -> None:
    path = app_config_path()
    payload = {"repo_root": str(repo_root)}
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def guess_repo_root() -> Path | None:
    candidates: list[Path] = []

    if getattr(sys, "frozen", False):
        candidates.append(Path(sys.executable).resolve().parent)
    else:
        candidates.append(Path(__file__).resolve().parents[2])

    candidates.append(Path.cwd())

    for candidate in candidates:
        if (candidate / "index.html").exists() and (candidate / "assets").exists():
            return candidate

    return None


def choose_repo_root() -> Path | None:
    root = tk.Tk()
    root.withdraw()
    root.update()
    selected = filedialog.askdirectory(title="请选择 WebStack 项目根目录（包含 index.html）")
    root.destroy()

    if not selected:
        return None
    folder = Path(selected)
    if not (folder / "index.html").exists():
        popup = tk.Tk()
        popup.withdraw()
        messagebox.showerror("目录错误", "所选目录不包含 index.html，请重新选择。")
        popup.destroy()
        return None
    return folder


def build_shell_html(erp_page: str) -> str:
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>WebStack Desktop</title>
  <style>
    html, body {{ height: 100%; margin: 0; font-family: "Segoe UI", "Microsoft YaHei", sans-serif; background: #f5f6fa; }}
    .top {{ display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: #1f2937; color: #fff; }}
    .top .title {{ font-weight: 600; margin-right: 8px; }}
    .top button {{ border: 0; background: #374151; color: #fff; border-radius: 6px; padding: 7px 10px; cursor: pointer; }}
    .top button:hover {{ background: #4b5563; }}
    .top .active {{ background: #2563eb; }}
    .status {{ margin-left: auto; color: #cbd5e1; font-size: 12px; }}
    .container {{ height: calc(100% - 52px); }}
    iframe {{ width: 100%; height: 100%; border: 0; background: #fff; }}
  </style>
</head>
<body>
  <div class="top">
    <span class="title">WebStack Desktop</span>
    <button id="btn-home" onclick="openView('index.html')">首页</button>
    <button id="btn-crypto" onclick="openView('index.html#数字货币')">数字货币</button>
    <button id="btn-gold" onclick="openView('index.html#金价行情')">金价行情</button>
    <button id="btn-erp" onclick="openView('{erp_page}')">ERP系统</button>
    <button id="btn-login" onclick="openView('login.html')">登录页</button>
    <span class="status" id="status"></span>
  </div>
  <div class="container">
    <iframe id="appFrame" src="index.html"></iframe>
  </div>
  <script>
    const frame = document.getElementById('appFrame');
    const statusEl = document.getElementById('status');
    const buttons = ['btn-home','btn-crypto','btn-gold','btn-erp','btn-login'].map(id => document.getElementById(id));

    function setActive(targetId) {{
      buttons.forEach(btn => btn.classList.remove('active'));
      const target = document.getElementById(targetId);
      if (target) target.classList.add('active');
    }}

    function openView(url) {{
      frame.src = url;
      if (url.includes('#数字货币')) setActive('btn-crypto');
      else if (url.includes('#金价行情')) setActive('btn-gold');
      else if (url.startsWith('{erp_page}')) setActive('btn-erp');
      else if (url.startsWith('login.html')) setActive('btn-login');
      else setActive('btn-home');
      statusEl.textContent = '当前页面：' + url;
    }}

    setActive('btn-home');
    statusEl.textContent = '当前页面：index.html';
  </script>
</body>
</html>
"""


def make_handler(repo_root: Path, shell_html: str):
    shell_bytes = shell_html.encode("utf-8")

    class RuntimeHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(repo_root), **kwargs)

        def do_GET(self):
            if self.path in ("/__desktop__", "/__desktop__/", "/desktop", "/desktop/"):
                self.send_response(200)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(shell_bytes)))
                self.end_headers()
                self.wfile.write(shell_bytes)
                return
            super().do_GET()

        def log_message(self, format: str, *args) -> None:
            return

    return RuntimeHandler


def start_server(repo_root: Path) -> tuple[ThreadingHTTPServer, int]:
    erp_page = "erp-ant.html" if (repo_root / "erp-ant.html").exists() else "erp.html"
    shell_html = build_shell_html(erp_page)
    handler = make_handler(repo_root, shell_html)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = int(server.server_address[1])

    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def run_desktop(url: str) -> None:
    try:
        import webview
        window = webview.create_window("WebStack Desktop", url=url, width=1440, height=900, min_size=(980, 700))
        webview.start(gui="edgechromium", debug=False)
    except Exception as exc:
        popup = tk.Tk()
        popup.withdraw()
        messagebox.showerror("运行失败", f"内置窗口启动失败：{exc}")
        popup.destroy()


def main() -> int:
    repo_root = load_bound_repo() or load_last_repo() or guess_repo_root() or prepare_default_workspace()
    if repo_root is None:
        repo_root = choose_repo_root()
    if repo_root is None:
        popup = tk.Tk()
        popup.withdraw()
        messagebox.showerror("启动失败", "未找到可运行的 WebStack 工作区，请先通过 WebStackManager 绑定仓库目录。")
        popup.destroy()
        return 1

    save_last_repo(repo_root)
    server, port = start_server(repo_root)
    url = f"http://127.0.0.1:{port}/__desktop__"

    try:
        run_desktop(url)
    finally:
        try:
            server.shutdown()
            server.server_close()
        except Exception:
            pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
