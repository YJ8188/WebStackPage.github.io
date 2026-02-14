#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""WebStack ERP Desktop

目标：把现有 H5 ERP（erp-ant.html/erp.html + login.html）包装成 Windows 桌面程序。

说明：
- 默认使用线上地址（读取项目根目录 CNAME；没有则回退到 hq168.dpdns.org）。
- 可复用 manager-config.json 里的 runtime_mode（online/local）。
- local 模式下会启动本地 HTTP 服务（127.0.0.1 随机端口）加载内置页面。
"""

from __future__ import annotations

import json
import re
import shutil
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


DEFAULT_DEPLOY_DOMAIN = "hq168.dpdns.org"
MANAGER_CONFIG_FILE = "manager-config.json"


def app_home_dir() -> Path:
    base = Path.home() / ".webstack-desktop"
    base.mkdir(parents=True, exist_ok=True)
    return base


def manager_config_path() -> Path:
    return app_home_dir() / MANAGER_CONFIG_FILE


def load_manager_config() -> dict:
    path = manager_config_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


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


def read_cname_domain(repo_root: Path) -> str:
    cname_file = repo_root / "CNAME"
    if not cname_file.exists():
        return ""
    try:
        raw = cname_file.read_text(encoding="utf-8", errors="ignore").strip()
    except Exception:
        return ""
    domain = raw.splitlines()[0].strip()
    if not domain:
        return ""
    if domain.startswith("http://") or domain.startswith("https://"):
        domain = re.sub(r"^https?://", "", domain, flags=re.IGNORECASE)
    return domain.rstrip("/")


def build_online_base_url(repo_root: Path) -> str:
    domain = read_cname_domain(repo_root) or DEFAULT_DEPLOY_DOMAIN
    return f"https://{domain}"


def make_handler(repo_root: Path):
    class RuntimeHandler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(repo_root), **kwargs)

        def log_message(self, format: str, *args) -> None:
            return

    return RuntimeHandler


def start_server(repo_root: Path) -> tuple[ThreadingHTTPServer, int]:
    handler = make_handler(repo_root)
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    port = int(server.server_address[1])
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server, port


def choose_erp_page(repo_root: Path) -> str:
    if (repo_root / "erp-ant.html").exists():
        return "erp-ant.html"
    if (repo_root / "erp.html").exists():
        return "erp.html"
    return "erp.html"


def run_webview(url: str) -> None:
    import webview

    webview.create_window(
        "何哥 ERP（桌面版）",
        url=url,
        width=1440,
        height=900,
        min_size=(980, 700),
    )
    webview.start(gui="edgechromium", debug=False)


def main() -> int:
    config = load_manager_config()
    runtime_mode = str(config.get("runtime_mode", "online")).strip().lower()
    bound_repo = str(config.get("bound_repo_root", "")).strip()
    repo_root = Path(bound_repo) if bound_repo else None
    if repo_root and not (repo_root / "index.html").exists():
        repo_root = None

    repo_root = repo_root or prepare_default_workspace() or Path.cwd()
    erp_page = choose_erp_page(repo_root)

    if runtime_mode == "local":
        server, port = start_server(repo_root)
        url = f"http://127.0.0.1:{port}/{erp_page}"
        try:
            run_webview(url)
        finally:
            try:
                server.shutdown()
                server.server_close()
            except Exception:
                pass
        return 0

    online_base = build_online_base_url(repo_root)
    url = f"{online_base}/{erp_page}"
    run_webview(url)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

