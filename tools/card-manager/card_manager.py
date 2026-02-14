#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import html
import json
import multiprocessing
import re
import shutil
import subprocess
import sys
import threading
from dataclasses import dataclass, field
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import List, Optional, Tuple
from urllib.parse import quote


DEFAULT_REMOTE_URL = "https://github.com/YJ8188/WebStackPage.github.io.git"
DEFAULT_DEPLOY_DOMAIN = "hq168.dpdns.org"
MANAGER_CONFIG_FILE = "manager-config.json"

import tkinter as tk
from tkinter import filedialog, messagebox, simpledialog, ttk


@dataclass
class CardItem:
    title: str = ""
    url: str = ""
    desc: str = ""
    logo: str = "assets/images/logos/default.svg"


@dataclass
class SectionItem:
    name: str
    start_marker: str
    end_marker: str
    h4_line: str
    indent: str
    start_pos: int
    end_pos: int
    cards: List[CardItem] = field(default_factory=list)


@dataclass
class NavItem:
    title: str = ""
    href: str = ""
    icon_class: str = "linecons-star"
    label_text: str = ""
    label_class: str = "label label-info pull-right hidden-collapsed"
    target: str = ""
    indent: str = "                    "
    li_start: int = -1
    li_end: int = -1


@dataclass
class MenuMeta:
    open_start: int
    open_end: int
    close_start: int
    close_end: int


def detect_newline_style(text: str) -> str:
    return "\r\n" if "\r\n" in text else "\n"


def normalize_comment_name(raw_name: str) -> str:
    return re.sub(r"\s+", " ", raw_name.strip())


def find_matching_tag_bounds(source: str, start_pos: int, tag_name: str) -> Tuple[int, int]:
    token_re = re.compile(rf"<{tag_name}\b[^>]*>|</{tag_name}>", re.IGNORECASE)
    depth = 0
    for match in token_re.finditer(source, start_pos):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return match.start(), match.end()
        else:
            depth += 1
    return -1, -1


def find_matching_div_end(source: str, start_pos: int) -> int:
    token_re = re.compile(r"<div\b[^>]*>|</div>", re.IGNORECASE)
    depth = 0
    for match in token_re.finditer(source, start_pos):
        token = match.group(0)
        if token.startswith("</"):
            depth -= 1
            if depth == 0:
                return match.end()
        else:
            depth += 1
    return -1


def is_inside_html_comment(text: str, position: int) -> bool:
    last_open = text.rfind("<!--", 0, position)
    last_close = text.rfind("-->", 0, position)
    return last_open != -1 and last_open > last_close


def extract_first(pattern: str, text: str, default: str = "") -> str:
    match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
    if not match:
        return default
    if match.lastindex and match.lastindex > 1:
        for index in range(1, match.lastindex + 1):
            value = match.group(index)
            if value:
                return value.strip()
    return match.group(1).strip()


def strip_html_tags(value: str) -> str:
    no_tags = re.sub(r"<[^>]+>", "", value)
    return html.unescape(no_tags).strip()


def get_attr(tag_text: str, attr_name: str) -> str:
    pattern = rf"\b{re.escape(attr_name)}\s*=\s*(['\"])(.*?)\1"
    match = re.search(pattern, tag_text, re.IGNORECASE | re.DOTALL)
    if not match:
        return ""
    return match.group(2).strip()


def parse_cards(section_inner: str) -> List[CardItem]:
    cards: List[CardItem] = []
    card_start_pattern = re.compile(r"<div\s+class=\"col-sm-3\"", re.IGNORECASE)

    pos = 0
    while True:
        start_match = card_start_pattern.search(section_inner, pos)
        if not start_match:
            break

        start = start_match.start()
        if is_inside_html_comment(section_inner, start):
            pos = start_match.end()
            continue

        end = find_matching_div_end(section_inner, start)
        if end == -1:
            break

        block = section_inner[start:end]
        onclick_url = extract_first(r"onclick\s*=\s*\"[^\"]*window\.open\('([^']+)'", block, "")
        fallback_url = extract_first(r"data-original-title\s*=\s*\"([^\"]+)\"", block, "")
        url = onclick_url or fallback_url
        title = strip_html_tags(extract_first(r"<strong>(.*?)</strong>", block, ""))
        desc = strip_html_tags(extract_first(r"<p\s+class=\"overflowClip_2\">(.*?)</p>", block, ""))
        logo = extract_first(r"<img[^>]+data-src\s*=\s*\"([^\"]+)\"", block, "")
        if not logo:
            logo = extract_first(r"<img[^>]+src\s*=\s*\"([^\"]+)\"", block, "assets/images/logos/default.svg")

        cards.append(CardItem(title=title or "未命名卡片", url=url, desc=desc, logo=logo or "assets/images/logos/default.svg"))
        pos = end

    return cards


def parse_sections(index_html: str) -> List[SectionItem]:
    comment_pattern = re.compile(r"<!--\s*(.*?)\s*-->", re.DOTALL)
    comments = list(comment_pattern.finditer(index_html))
    sections: List[SectionItem] = []
    consumed_until = -1

    for comment in comments:
        if comment.start() < consumed_until:
            continue
        comment_name = normalize_comment_name(comment.group(1))
        if not comment_name or comment_name.upper().startswith("END"):
            continue

        end_pattern = re.compile(rf"<!--\s*END\s*{re.escape(comment_name)}\s*-->", re.IGNORECASE)
        end_comment = end_pattern.search(index_html, comment.end())
        if not end_comment:
            continue

        section_inner = index_html[comment.end(): end_comment.start()]
        if "<div class=\"col-sm-3\"" not in section_inner:
            continue

        h4_line = ""
        indent = "            "
        for line in section_inner.splitlines():
            if "<h4" in line.lower() and "</h4>" in line.lower():
                h4_line = line.strip()
                indent_match = re.match(r"\s*", line)
                if indent_match:
                    indent = indent_match.group(0)
                break

        if not h4_line:
            continue

        sections.append(
            SectionItem(
                name=comment_name,
                start_marker=comment.group(0),
                end_marker=end_comment.group(0),
                h4_line=h4_line,
                indent=indent,
                start_pos=comment.start(),
                end_pos=end_comment.end(),
                cards=parse_cards(section_inner),
            )
        )
        consumed_until = end_comment.end()

    return sections


def parse_nav_items(index_html: str) -> Tuple[List[NavItem], Optional[MenuMeta]]:
    items: List[NavItem] = []
    menu_open_match = re.search(r"<ul\s+id=\"main-menu\"[^>]*>", index_html, re.IGNORECASE)
    if not menu_open_match:
        return items, None

    open_start = menu_open_match.start()
    open_end = menu_open_match.end()
    close_start, close_end = find_matching_tag_bounds(index_html, open_start, "ul")
    if close_start == -1:
        return items, None

    menu_inner = index_html[open_end:close_start]
    li_token_re = re.compile(r"<li\b[^>]*>|</li>", re.IGNORECASE)

    start_stack: List[int] = []
    for token in li_token_re.finditer(menu_inner):
        value = token.group(0)
        if value.startswith("</"):
            if not start_stack:
                continue
            block_start_rel = start_stack.pop()
            block_end_rel = token.end()
            li_block = menu_inner[block_start_rel:block_end_rel]

            if re.search(r"<ul\b", li_block, re.IGNORECASE):
                continue

            a_open_match = re.search(r"<a\b[^>]*>", li_block, re.IGNORECASE | re.DOTALL)
            if not a_open_match:
                continue

            a_open = a_open_match.group(0)
            href = get_attr(a_open, "href")
            if not href or href.lower().startswith("javascript"):
                continue

            title = strip_html_tags(extract_first(r"<span\s+class=\"title\">(.*?)</span>", li_block, ""))
            if not title:
                continue

            icon_tag = extract_first(r"(<i\b[^>]*></i>)", li_block, "")
            icon_class = get_attr(icon_tag, "class") or "linecons-star"

            label_match = re.search(
                r"<span\s+class=\"([^\"]*\blabel\b[^\"]*)\"[^>]*>(.*?)</span>",
                li_block,
                re.IGNORECASE | re.DOTALL,
            )
            label_class = ""
            label_text = ""
            if label_match:
                label_class = label_match.group(1).strip()
                label_text = strip_html_tags(label_match.group(2))

            target = get_attr(a_open, "target")
            indent_match = re.search(r"^([ \t]*)<li\b", li_block, re.MULTILINE)
            indent = indent_match.group(1) if indent_match else "                    "

            items.append(
                NavItem(
                    title=title,
                    href=href,
                    icon_class=icon_class,
                    label_text=label_text,
                    label_class=label_class or "label label-info pull-right hidden-collapsed",
                    target=target,
                    indent=indent,
                    li_start=open_end + block_start_rel,
                    li_end=open_end + block_end_rel,
                )
            )
        else:
            start_stack.append(token.start())

    return items, MenuMeta(open_start=open_start, open_end=open_end, close_start=close_start, close_end=close_end)


def js_single_quote_safe(value: str) -> str:
    return value.replace("\\", "\\\\").replace("'", "\\'")


def render_card(card: CardItem, indent: str) -> str:
    title = html.escape(card.title or "未命名卡片")
    desc = html.escape(card.desc or "")
    logo = html.escape(card.logo or "assets/images/logos/default.svg", quote=True)
    url_attr = html.escape(card.url or "#", quote=True)
    url_js = js_single_quote_safe(card.url or "#")
    return (
        f"{indent}    <div class=\"col-sm-3\">\n"
        f"{indent}        <div class=\"xe-widget xe-conversations box2 label-info\"\n"
        f"{indent}            onclick=\"window.open('{url_js}', '_blank')\" data-toggle=\"tooltip\"\n"
        f"{indent}            data-placement=\"bottom\" title=\"\" data-original-title=\"{url_attr}\">\n"
        f"{indent}            <div class=\"xe-comment-entry\">\n"
        f"{indent}                <a class=\"xe-user-img\">\n"
        f"{indent}                    <img data-src=\"{logo}\" class=\"lozad img-circle\" width=\"40\">\n"
        f"{indent}                </a>\n"
        f"{indent}                <div class=\"xe-comment\">\n"
        f"{indent}                    <a href=\"#\" class=\"xe-user-name overflowClip_1\">\n"
        f"{indent}                        <strong>{title}</strong>\n"
        f"{indent}                    </a>\n"
        f"{indent}                    <p class=\"overflowClip_2\">{desc}</p>\n"
        f"{indent}                </div>\n"
        f"{indent}            </div>\n"
        f"{indent}        </div>\n"
        f"{indent}    </div>"
    )


def render_section(section: SectionItem, newline: str) -> str:
    indent = section.indent or "            "
    parts: List[str] = [section.start_marker, newline, f"{indent}{section.h4_line}{newline}{newline}"]
    if section.cards:
        for index, card in enumerate(section.cards):
            if index % 4 == 0:
                parts.append(f"{indent}<div class=\"row\">{newline}")
            parts.append(render_card(card, indent))
            parts.append(newline)
            if index % 4 == 3 or index == len(section.cards) - 1:
                parts.append(f"{indent}</div>{newline}{newline}")
    else:
        parts.append(f"{indent}<div class=\"row\">{newline}{indent}</div>{newline}{newline}")
    parts.append(f"{indent}<br />{newline}{indent}{section.end_marker}")
    return "".join(parts)


def render_nav_item(item: NavItem, newline: str) -> str:
    indent = item.indent or "                    "
    a_indent = indent + "    "
    attrs = [f'href="{html.escape(item.href or "#", quote=True)}"']
    if (item.href or "").startswith("#"):
        attrs.append('class="smooth"')
    if item.target:
        attrs.append(f'target="{html.escape(item.target, quote=True)}"')

    lines = [
        f"{indent}<li>",
        f"{a_indent}<a {' '.join(attrs)}>",
        f"{a_indent}    <i class=\"{html.escape(item.icon_class or 'linecons-star', quote=True)}\"></i>",
        f"{a_indent}    <span class=\"title\">{html.escape(item.title or '未命名导航')}</span>",
    ]
    if item.label_text:
        label_class = html.escape(item.label_class or "label label-info pull-right hidden-collapsed", quote=True)
        lines.append(f"{a_indent}    <span class=\"{label_class}\">{html.escape(item.label_text)}</span>")
    lines.extend([f"{a_indent}</a>", f"{indent}</li>"])
    return newline.join(lines)


def rebuild_sections(original_html: str, sections: List[SectionItem]) -> str:
    ordered = sorted(sections, key=lambda item: item.start_pos)
    newline = detect_newline_style(original_html)
    out: List[str] = []
    cursor = 0
    for section in ordered:
        out.append(original_html[cursor:section.start_pos])
        out.append(render_section(section, newline))
        cursor = section.end_pos
    out.append(original_html[cursor:])
    return "".join(out)


def rebuild_nav_links(original_html: str, nav_items: List[NavItem], menu_meta: Optional[MenuMeta]) -> str:
    if not menu_meta:
        return original_html
    newline = detect_newline_style(original_html)
    text = original_html
    offset = 0
    existing = sorted((item for item in nav_items if item.li_start >= 0), key=lambda n: n.li_start)
    for item in existing:
        replacement = render_nav_item(item, newline)
        start = item.li_start + offset
        end = item.li_end + offset
        text = text[:start] + replacement + text[end:]
        offset += len(replacement) - (item.li_end - item.li_start)
    new_items = [item for item in nav_items if item.li_start < 0]
    if new_items:
        block = newline.join(render_nav_item(item, newline) for item in new_items) + newline
        pos = menu_meta.close_start + offset
        text = text[:pos] + block + text[pos:]
    return text


def run_command(command: List[str], cwd: Path) -> Tuple[bool, str]:
    try:
        proc = subprocess.run(
            command,
            cwd=str(cwd),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            check=False,
        )
        return proc.returncode == 0, proc.stdout.strip()
    except Exception as exc:
        return False, f"命令执行异常: {exc}"


def find_git_root(start_path: Path) -> Optional[Path]:
    current = start_path.resolve()
    if current.is_file():
        current = current.parent
    for directory in [current, *current.parents]:
        if (directory / ".git").exists():
            return directory
    return None


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


def save_manager_config(config: dict) -> None:
    path = manager_config_path()
    path.write_text(json.dumps(config, ensure_ascii=False, indent=2), encoding="utf-8")


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


def resolve_embedded_workspace() -> Optional[Path]:
    if not getattr(sys, "frozen", False):
        return None
    base = Path(getattr(sys, "_MEIPASS", ""))
    candidate = base / "workspace_bundle"
    if (candidate / "index.html").exists():
        return candidate
    return None


def prepare_default_workspace() -> Tuple[Path, str]:
    config = load_manager_config()
    bound_repo = str(config.get("bound_repo_root", "")).strip()
    if bound_repo:
        bound_path = Path(bound_repo)
        if (bound_path / "index.html").exists():
            return bound_path, "本地仓库（已绑定）"

    embedded = resolve_embedded_workspace()
    if embedded:
        workspace = app_home_dir() / "workspace"
        index_file = workspace / "index.html"
        if not index_file.exists():
            shutil.copytree(embedded, workspace, dirs_exist_ok=True)
        return workspace, "内置工作区"

    local_repo = find_git_root(Path.cwd()) or Path.cwd()
    if (local_repo / "index.html").exists():
        return local_repo, "当前目录仓库"

    return Path.cwd(), "当前目录"


def get_origin_remote_url(repo_root: Path) -> str:
    ok, output = run_command(["git", "remote", "get-url", "origin"], repo_root)
    if not ok:
        return ""
    return output.strip()


def get_git_config_value(repo_root: Path, key: str, global_scope: bool = False) -> str:
    command = ["git", "config"]
    if global_scope:
        command.append("--global")
    command.append(key)
    ok, output = run_command(command, repo_root)
    if not ok:
        return ""
    return output.strip()


def set_git_config_value(repo_root: Path, key: str, value: str) -> Tuple[bool, str]:
    return run_command(["git", "config", key, value], repo_root)


def parse_github_username(remote_url: str) -> str:
    normalized = remote_url.strip()
    if not normalized:
        return ""
    match = re.search(r"github\.com[:/]+([^/]+)/", normalized, re.IGNORECASE)
    if not match:
        return ""
    return match.group(1).strip()


def has_common_history_with_origin_master(repo_root: Path) -> Tuple[bool, str]:
    ok_fetch, out_fetch = run_command(["git", "fetch", "origin", "master"], repo_root)
    if not ok_fetch:
        return False, out_fetch
    ok_base, out_base = run_command(["git", "merge-base", "master", "origin/master"], repo_root)
    return ok_base and bool(out_base.strip()), out_base


def collect_module_status(index_html: str, repo_root: Path) -> List[Tuple[str, str, str]]:
    checks: List[Tuple[str, str, str]] = []

    has_crypto = bool(re.search(r"id\s*=\s*['\"]数字货币['\"]", index_html))
    has_gold = bool(re.search(r"id\s*=\s*['\"]金价行情['\"]", index_html))
    has_crypto_link = "#数字货币" in index_html
    has_gold_link = "#金价行情" in index_html
    has_crypto_placeholder = "数字货币板块占位符" in index_html
    has_gold_placeholder = "金价行情板块占位符" in index_html

    crypto_status = "正常" if (has_crypto or (has_crypto_link and has_crypto_placeholder)) else ("仅入口" if has_crypto_link else "缺失")
    gold_status = "正常" if (has_gold or (has_gold_link and has_gold_placeholder)) else ("仅入口" if has_gold_link else "缺失")

    checks.append((
        "数字货币模块",
        crypto_status,
        "检查 #数字货币 的入口与锚点是否完整",
    ))
    checks.append((
        "金价行情模块",
        gold_status,
        "检查 #金价行情 的入口与锚点是否完整",
    ))
    checks.append((
        "ERP入口链接",
        "正常" if ("erp-ant.html" in index_html or "erp.html" in index_html) else "缺失",
        "检测首页 ERP 跳转入口",
    ))

    file_checks = [
        ("ERP主页面", repo_root / "erp-ant.html"),
        ("ERP备用页面", repo_root / "erp.html"),
        ("登录页面", repo_root / "login.html"),
        ("金价脚本", repo_root / "assets/js/metalsData.js"),
    ]
    for title, path in file_checks:
        checks.append((title, "存在" if path.exists() else "缺失", str(path.relative_to(repo_root)).replace("\\", "/")))

    return checks


def run_webview_window(url: str, title: str) -> None:
    try:
        import webview
    except Exception:
        raise RuntimeError("缺少 pywebview 运行依赖")

    window = webview.create_window(title, url=url, width=1366, height=900, min_size=(900, 600))
    webview.start(gui="edgechromium", debug=False)


class RepoRequestHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, directory: str, **kwargs):
        super().__init__(*args, directory=directory, **kwargs)

    def log_message(self, format: str, *args) -> None:
        return


class CardManagerApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("WebStack H5 一体化管理器（Win EXE）")
        self.root.geometry("1320x860")

        self.config = load_manager_config()
        self.repo_root, self.workspace_source = prepare_default_workspace()
        self.index_path = self.repo_root / "index.html"
        self.online_base_url = build_online_base_url(self.repo_root)

        self.original_html: str = ""
        self.sections: List[SectionItem] = []
        self.nav_items: List[NavItem] = []
        self.menu_meta: Optional[MenuMeta] = None

        self.current_section_idx: Optional[int] = None
        self.current_card_idx: Optional[int] = None
        self.current_nav_idx: Optional[int] = None
        self.repo_url_var = tk.StringVar()
        self.nav_filter_var = tk.StringVar()
        self.workspace_target_var = tk.StringVar()
        runtime_mode = str(self.config.get("runtime_mode", "online")).strip().lower()
        self.runtime_mode_var = tk.StringVar(value=runtime_mode if runtime_mode in ("online", "local") else "online")
        self.online_base_var = tk.StringVar(value=self.online_base_url)
        self.preview_server: Optional[ThreadingHTTPServer] = None
        self.preview_server_thread: Optional[threading.Thread] = None
        self.preview_port: Optional[int] = None

        self.repo_url_var.set(DEFAULT_REMOTE_URL)

        self._build_ui()
        if self.index_path.exists():
            self.path_var.set(str(self.index_path))
            self.load_index_file(initial=True)
        else:
            self.path_var.set("")
            self.log("未找到默认 index.html，请先点击“选择 index.html”。")

        self.refresh_workspace_target()
        self.update_runtime_mode_ui()

        self.root.protocol("WM_DELETE_WINDOW", self.on_close)

    def _build_ui(self) -> None:
        top = ttk.Frame(self.root, padding=10)
        top.pack(fill="x")

        self.path_var = tk.StringVar()
        self.path_entry = ttk.Entry(top, textvariable=self.path_var)
        self.path_entry.pack(side="left", fill="x", expand=True)

        ttk.Button(top, text="选择 index.html", command=self.choose_index_file).pack(side="left", padx=6)
        ttk.Button(top, text="重新加载", command=self.load_index_file).pack(side="left", padx=6)
        ttk.Button(top, text="保存", command=self.save_to_index).pack(side="left", padx=6)
        ttk.Button(top, text="手动推送 master", command=self.push_to_master).pack(side="left", padx=6)

        self.auto_push_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(top, text="保存后自动推送 GitHub(master)", variable=self.auto_push_var).pack(side="left", padx=8)

        repo_row = ttk.Frame(self.root, padding=(10, 0, 10, 8))
        repo_row.pack(fill="x")
        ttk.Label(repo_row, text="推送仓库").pack(side="left")
        self.repo_url_entry = ttk.Entry(repo_row, textvariable=self.repo_url_var)
        self.repo_url_entry.pack(side="left", fill="x", expand=True, padx=8)
        ttk.Button(repo_row, text="读取 origin", command=self.load_origin_url).pack(side="left", padx=4)
        ttk.Button(repo_row, text="应用到 origin", command=self.apply_origin_url).pack(side="left", padx=4)

        workspace_row = ttk.Frame(self.root, padding=(10, 0, 10, 8))
        workspace_row.pack(fill="x")
        ttk.Label(workspace_row, text="当前编辑目标").pack(side="left")
        ttk.Label(workspace_row, textvariable=self.workspace_target_var, foreground="#1f4e79").pack(
            side="left", fill="x", expand=True, padx=(8, 8)
        )
        ttk.Button(workspace_row, text="绑定本地仓库目录", command=self.bind_local_repo).pack(side="left", padx=4)
        ttk.Button(workspace_row, text="重置为内置工作区", command=self.reset_to_embedded_workspace).pack(side="left", padx=4)

        notebook = ttk.Notebook(self.root)
        notebook.pack(fill="both", expand=True, padx=10, pady=(0, 8))

        card_tab = ttk.Frame(notebook)
        nav_tab = ttk.Frame(notebook)
        overview_tab = ttk.Frame(notebook)
        runtime_tab = ttk.Frame(notebook)
        notebook.add(card_tab, text="卡片管理")
        notebook.add(nav_tab, text="导航管理")
        notebook.add(overview_tab, text="一体总览")
        notebook.add(runtime_tab, text="内置应用")

        self._build_card_tab(card_tab)
        self._build_nav_tab(nav_tab)
        self._build_overview_tab(overview_tab)
        self._build_runtime_tab(runtime_tab)

        log_frame = ttk.LabelFrame(self.root, text="执行日志", padding=8)
        log_frame.pack(fill="both", expand=False, padx=10, pady=(0, 10))
        self.log_text = tk.Text(log_frame, height=10, wrap="word")
        self.log_text.pack(fill="both", expand=True)

    def _build_card_tab(self, parent: ttk.Frame) -> None:
        paned = ttk.PanedWindow(parent, orient="horizontal")
        paned.pack(fill="both", expand=True)

        left = ttk.Frame(paned, width=460)
        right = ttk.Frame(paned)
        paned.add(left, weight=2)
        paned.add(right, weight=3)

        ttk.Label(left, text="分组 / 卡片树").pack(anchor="w")
        self.card_tree = ttk.Treeview(left, show="tree")
        self.card_tree.pack(fill="both", expand=True, pady=6)
        self.card_tree.bind("<<TreeviewSelect>>", self.on_card_tree_select)

        row = ttk.Frame(left)
        row.pack(fill="x")
        ttk.Button(row, text="新增卡片", command=self.add_card).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="删除卡片", command=self.delete_card).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="上移", command=lambda: self.move_card(-1)).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="下移", command=lambda: self.move_card(1)).pack(side="left")

        form = ttk.LabelFrame(right, text="卡片属性", padding=10)
        form.pack(fill="x")

        self.card_section_var = tk.StringVar()
        self.card_title_var = tk.StringVar()
        self.card_url_var = tk.StringVar()
        self.card_desc_var = tk.StringVar()
        self.card_logo_var = tk.StringVar()

        self._form_row(form, "分组", self.card_section_var, readonly=True)
        self._form_row(form, "名称", self.card_title_var)
        self._form_row(form, "链接", self.card_url_var)
        self._form_row(form, "描述", self.card_desc_var)
        self._form_row(form, "Logo", self.card_logo_var)

        actions = ttk.Frame(form)
        actions.pack(fill="x", pady=(8, 0))
        ttk.Button(actions, text="选择 Logo", command=self.choose_logo).pack(side="left")
        ttk.Button(actions, text="应用卡片修改", command=self.apply_card_form).pack(side="left", padx=8)

    def _build_nav_tab(self, parent: ttk.Frame) -> None:
        paned = ttk.PanedWindow(parent, orient="horizontal")
        paned.pack(fill="both", expand=True)

        left = ttk.Frame(paned, width=460)
        right = ttk.Frame(paned)
        paned.add(left, weight=2)
        paned.add(right, weight=3)

        ttk.Label(left, text="左侧导航（支持叶子项，含金价/数字货币/ERP入口）").pack(anchor="w")
        filter_row = ttk.Frame(left)
        filter_row.pack(fill="x", pady=(4, 2))
        ttk.Label(filter_row, text="筛选").pack(side="left")
        filter_entry = ttk.Entry(filter_row, textvariable=self.nav_filter_var)
        filter_entry.pack(side="left", fill="x", expand=True, padx=6)
        filter_entry.bind("<KeyRelease>", lambda _event: self.refresh_nav_tree())
        self.nav_tree = ttk.Treeview(left, columns=("href",), show="tree headings")
        self.nav_tree.heading("#0", text="标题")
        self.nav_tree.heading("href", text="链接")
        self.nav_tree.column("#0", width=220)
        self.nav_tree.column("href", width=220)
        self.nav_tree.pack(fill="both", expand=True, pady=6)
        self.nav_tree.bind("<<TreeviewSelect>>", self.on_nav_select)

        row = ttk.Frame(left)
        row.pack(fill="x")
        ttk.Button(row, text="新增导航", command=self.add_nav).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="删除导航", command=self.delete_nav).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="上移", command=lambda: self.move_nav(-1)).pack(side="left", padx=(0, 6))
        ttk.Button(row, text="下移", command=lambda: self.move_nav(1)).pack(side="left")

        form = ttk.LabelFrame(right, text="导航属性", padding=10)
        form.pack(fill="x")

        self.nav_title_var = tk.StringVar()
        self.nav_href_var = tk.StringVar()
        self.nav_icon_var = tk.StringVar()
        self.nav_label_var = tk.StringVar()
        self.nav_target_var = tk.StringVar()

        self._form_row(form, "标题", self.nav_title_var)
        self._form_row(form, "链接", self.nav_href_var)
        self._form_row(form, "图标类", self.nav_icon_var)
        self._form_row(form, "标签", self.nav_label_var)
        self._form_row(form, "target", self.nav_target_var)

        ttk.Label(
            form,
            text="说明：支持菜单叶子节点；锚点链接请填 #工作常用 这种格式。",
            foreground="#555",
        ).pack(anchor="w", pady=(8, 6))
        ttk.Button(form, text="应用导航修改", command=self.apply_nav_form).pack(anchor="w")

    def _build_overview_tab(self, parent: ttk.Frame) -> None:
        top = ttk.Frame(parent)
        top.pack(fill="x", pady=8, padx=8)
        ttk.Button(top, text="刷新模块总览", command=self.refresh_overview).pack(side="left")
        ttk.Label(top, text="用于检查 金价/数字货币/ERP 及相关页面是否就绪", foreground="#555").pack(side="left", padx=10)

        self.overview_tree = ttk.Treeview(parent, columns=("module", "status", "detail"), show="headings")
        self.overview_tree.heading("module", text="模块")
        self.overview_tree.heading("status", text="状态")
        self.overview_tree.heading("detail", text="说明")
        self.overview_tree.column("module", width=220, anchor="w")
        self.overview_tree.column("status", width=120, anchor="center")
        self.overview_tree.column("detail", width=720, anchor="w")
        self.overview_tree.pack(fill="both", expand=True, pady=(0, 8), padx=8)

    def _build_runtime_tab(self, parent: ttk.Frame) -> None:
        mode_row = ttk.Frame(parent)
        mode_row.pack(fill="x", padx=8, pady=(8, 4))

        ttk.Label(mode_row, text="运行模式").pack(side="left")
        ttk.Radiobutton(
            mode_row,
            text="在线运行（默认）",
            variable=self.runtime_mode_var,
            value="online",
            command=self.on_runtime_mode_change,
        ).pack(side="left", padx=(8, 6))
        ttk.Radiobutton(
            mode_row,
            text="本地预览（可选）",
            variable=self.runtime_mode_var,
            value="local",
            command=self.on_runtime_mode_change,
        ).pack(side="left", padx=6)

        online_row = ttk.Frame(parent)
        online_row.pack(fill="x", padx=8, pady=(0, 4))
        ttk.Label(online_row, text="在线地址").pack(side="left")
        self.online_base_entry = ttk.Entry(online_row, textvariable=self.online_base_var)
        self.online_base_entry.pack(side="left", fill="x", expand=True, padx=(8, 6))
        ttk.Button(online_row, text="从 CNAME 读取", command=self.reload_online_base_url).pack(side="left")

        bar = ttk.Frame(parent)
        bar.pack(fill="x", padx=8, pady=8)

        self.start_server_btn = ttk.Button(bar, text="启动本地预览服务", command=self.ensure_preview_server)
        self.start_server_btn.pack(side="left", padx=(0, 6))
        ttk.Button(bar, text="首页", command=self.open_home_app).pack(side="left", padx=3)
        ttk.Button(bar, text="数字货币", command=self.open_crypto_app).pack(side="left", padx=3)
        ttk.Button(bar, text="金价行情", command=self.open_gold_app).pack(side="left", padx=3)
        ttk.Button(bar, text="ERP系统", command=self.open_erp_app).pack(side="left", padx=3)
        ttk.Button(bar, text="登录页", command=self.open_login_app).pack(side="left", padx=3)
        self.stop_server_btn = ttk.Button(bar, text="停止本地服务", command=self.stop_preview_server)
        self.stop_server_btn.pack(side="left", padx=(10, 0))

        self.preview_status_var = tk.StringVar(value="模式：在线运行")
        ttk.Label(parent, textvariable=self.preview_status_var, foreground="#444").pack(anchor="w", padx=10)

        tips = (
            "说明：默认使用线上地址（与你网站一致），不依赖 localhost。\n"
            "需要调试本地改动时再切换“本地预览（可选）”。"
        )
        ttk.Label(parent, text=tips, foreground="#555", justify="left").pack(anchor="w", padx=10, pady=8)

    def _form_row(self, parent: ttk.Frame, label: str, var: tk.StringVar, readonly: bool = False) -> ttk.Entry:
        row = ttk.Frame(parent)
        row.pack(fill="x", pady=4)
        ttk.Label(row, text=label, width=8).pack(side="left")
        state = "readonly" if readonly else "normal"
        entry = ttk.Entry(row, textvariable=var, state=state)
        entry.pack(side="left", fill="x", expand=True)
        return entry

    def log(self, message: str) -> None:
        stamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.insert("end", f"[{stamp}] {message}\n")
        self.log_text.see("end")

    def persist_config(self) -> None:
        self.config["runtime_mode"] = self.runtime_mode_var.get().strip().lower()
        save_manager_config(self.config)

    def is_embedded_workspace(self, path: Path) -> bool:
        workspace_root = (app_home_dir() / "workspace").resolve()
        try:
            path.resolve().relative_to(workspace_root)
            return True
        except Exception:
            return path.resolve() == workspace_root

    def refresh_workspace_target(self) -> None:
        source = self.workspace_source
        if self.is_embedded_workspace(self.repo_root):
            source = "内置工作区"
        elif str(self.config.get("bound_repo_root", "")).strip() == str(self.repo_root):
            source = "本地仓库（已绑定）"
        self.workspace_target_var.set(f"{source}：{self.repo_root}")

    def reload_online_base_url(self) -> None:
        self.online_base_url = build_online_base_url(self.repo_root)
        self.online_base_var.set(self.online_base_url)
        self.log(f"在线地址已更新：{self.online_base_url}")

    def on_runtime_mode_change(self) -> None:
        self.persist_config()
        self.update_runtime_mode_ui()

    def update_runtime_mode_ui(self) -> None:
        mode = self.runtime_mode_var.get().strip().lower()
        if mode == "local":
            self.start_server_btn.configure(state="normal")
            self.stop_server_btn.configure(state="normal")
            if self.preview_port:
                self.preview_status_var.set(f"模式：本地预览（运行中 http://127.0.0.1:{self.preview_port}）")
            else:
                self.preview_status_var.set("模式：本地预览（服务未启动）")
            return

        self.stop_preview_server(silent=True)
        self.start_server_btn.configure(state="disabled")
        self.stop_server_btn.configure(state="disabled")
        self.preview_status_var.set(f"模式：在线运行（{self.online_base_var.get().strip()}）")

    def bind_local_repo(self) -> None:
        selected = filedialog.askdirectory(title="选择本地仓库目录（包含 index.html）", initialdir=str(self.repo_root))
        if not selected:
            return
        target = Path(selected)
        index = target / "index.html"
        if not index.exists():
            messagebox.showerror("绑定失败", "所选目录不包含 index.html，请重新选择。")
            return

        self.config["bound_repo_root"] = str(target)
        save_manager_config(self.config)

        self.workspace_source = "本地仓库（已绑定）"
        self.repo_root = target
        self.index_path = index
        self.path_var.set(str(index))
        self.reload_online_base_url()
        self.refresh_workspace_target()
        self.stop_preview_server(silent=True)
        self.load_index_file(initial=True)
        self.log(f"已绑定仓库目录：{target}")

    def reset_to_embedded_workspace(self) -> None:
        if not getattr(sys, "frozen", False):
            messagebox.showinfo("提示", "当前为源码模式，重置仅在 EXE 内置模式下可用。")
            return
        self.config.pop("bound_repo_root", None)
        save_manager_config(self.config)

        self.repo_root, self.workspace_source = prepare_default_workspace()
        self.index_path = self.repo_root / "index.html"
        self.path_var.set(str(self.index_path))
        self.reload_online_base_url()
        self.refresh_workspace_target()
        self.stop_preview_server(silent=True)
        self.load_index_file(initial=True)
        self.log("已切换回内置工作区。")

    def build_online_url(self, page: str, anchor: str = "") -> str:
        base = self.online_base_var.get().strip().rstrip("/")
        if not base:
            base = build_online_base_url(self.repo_root)
        if not re.match(r"^https?://", base, flags=re.IGNORECASE):
            base = "https://" + base
        url = f"{base}/{page}"
        if anchor:
            url += "#" + quote(anchor, safe="")
        return url

    def open_url_in_webview(self, title: str, url: str) -> None:
        try:
            process = multiprocessing.Process(target=run_webview_window, args=(url, title), daemon=False)
            process.start()
            self.log(f"已打开内置窗口：{title} -> {url}")
        except Exception as exc:
            messagebox.showerror("打开失败", f"内置窗口启动失败：{exc}")

    def ensure_git_identity(self, git_root: Path, target_origin: str) -> bool:
        local_name = get_git_config_value(git_root, "user.name")
        local_email = get_git_config_value(git_root, "user.email")
        global_name = get_git_config_value(git_root, "user.name", global_scope=True)
        global_email = get_git_config_value(git_root, "user.email", global_scope=True)

        if (local_name or global_name) and (local_email or global_email):
            return True

        username = parse_github_username(target_origin) or "WebStackUser"
        suggested_email = f"{username}@users.noreply.github.com"

        final_name = local_name or global_name or username
        final_email = local_email or global_email or suggested_email

        if not final_name:
            final_name = simpledialog.askstring("Git 身份配置", "请输入 Git 用户名（提交作者）") or "WebStackUser"
        if not final_email:
            final_email = simpledialog.askstring("Git 身份配置", "请输入 Git 邮箱（提交作者）") or suggested_email

        ok1, out1 = set_git_config_value(git_root, "user.name", final_name)
        ok2, out2 = set_git_config_value(git_root, "user.email", final_email)
        if not (ok1 and ok2):
            self.log(out1)
            self.log(out2)
            messagebox.showerror(
                "Git 配置失败",
                "提交前自动配置作者信息失败。\n"
                "请先在命令行执行：\n"
                "git config --global user.name " + '"你的名字"' + "\n"
                "git config --global user.email " + '"你的邮箱"',
            )
            return False

        self.log(f"已自动配置 Git 提交身份：{final_name} <{final_email}>")
        return True

    def load_origin_url(self) -> None:
        git_root = find_git_root(self.index_path.parent if self.index_path else self.repo_root) or self.repo_root
        remote = get_origin_remote_url(git_root)
        if not remote:
            if not self.repo_url_var.get().strip():
                self.repo_url_var.set(DEFAULT_REMOTE_URL)
            self.log("未读取到 origin 地址，已使用默认仓库地址。")
            return
        self.repo_url_var.set(remote)
        self.log(f"当前 origin：{remote}")

    def apply_origin_url(self) -> None:
        git_root = find_git_root(self.index_path.parent if self.index_path else self.repo_root)
        if not git_root:
            messagebox.showerror("失败", "未找到 Git 仓库，无法设置 origin。")
            return

        target_url = self.repo_url_var.get().strip()
        if not target_url:
            messagebox.showwarning("提示", "请先填写仓库地址。")
            return

        ok, output = run_command(["git", "remote", "set-url", "origin", target_url], git_root)
        if not ok:
            messagebox.showerror("失败", f"设置 origin 失败：{output}")
            return

        self.log(f"origin 已切换为：{target_url}")
        messagebox.showinfo("完成", "origin 仓库地址已更新。")

    def refresh_overview(self) -> None:
        if not hasattr(self, "overview_tree"):
            return

        for node in self.overview_tree.get_children():
            self.overview_tree.delete(node)

        rows = collect_module_status(self.original_html or "", self.repo_root)
        for title, status, detail in rows:
            self.overview_tree.insert("", "end", values=(title, status, detail))

    def ensure_preview_server(self) -> bool:
        if self.runtime_mode_var.get().strip().lower() != "local":
            self.preview_status_var.set("当前为在线运行模式，无需本地服务")
            return False

        if self.preview_server is not None and self.preview_port is not None:
            self.preview_status_var.set(f"模式：本地预览（运行中 http://127.0.0.1:{self.preview_port}）")
            return True

        host = "127.0.0.1"
        try:
            handler_factory = lambda *args, **kwargs: RepoRequestHandler(*args, directory=str(self.repo_root), **kwargs)
            server = ThreadingHTTPServer((host, 0), handler_factory)
        except Exception as exc:
            messagebox.showerror("启动失败", f"本地服务启动失败：{exc}")
            return False

        self.preview_server = server
        self.preview_port = int(server.server_address[1])

        def serve() -> None:
            try:
                server.serve_forever(poll_interval=0.5)
            except Exception:
                pass

        self.preview_server_thread = threading.Thread(target=serve, daemon=True)
        self.preview_server_thread.start()
        self.preview_status_var.set(f"模式：本地预览（运行中 http://127.0.0.1:{self.preview_port}）")
        self.log(f"内置服务已启动：http://127.0.0.1:{self.preview_port}")
        return True

    def stop_preview_server(self, silent: bool = False) -> None:
        if self.preview_server is None:
            if not silent:
                self.preview_status_var.set("模式：本地预览（服务未启动）")
            return

        try:
            self.preview_server.shutdown()
            self.preview_server.server_close()
        except Exception:
            pass

        self.preview_server = None
        self.preview_server_thread = None
        self.preview_port = None
        if silent:
            return
        self.preview_status_var.set("模式：本地预览（服务已停止）")
        self.log("内置服务已停止")

    def build_preview_url(self, page: str, anchor: str = "") -> Optional[str]:
        if not self.ensure_preview_server():
            return None
        assert self.preview_port is not None
        url = f"http://127.0.0.1:{self.preview_port}/{page}"
        if anchor:
            url += "#" + quote(anchor, safe="")
        return url

    def open_web_app(self, title: str, page: str, anchor: str = "") -> None:
        mode = self.runtime_mode_var.get().strip().lower()
        if mode == "local":
            url = self.build_preview_url(page, anchor)
        else:
            url = self.build_online_url(page, anchor)
        if not url:
            return
        self.open_url_in_webview(title, url)

    def open_home_app(self) -> None:
        self.open_web_app("WebStack 首页", "index.html")

    def open_crypto_app(self) -> None:
        self.open_web_app("WebStack 数字货币", "index.html", "数字货币")

    def open_gold_app(self) -> None:
        self.open_web_app("WebStack 金价行情", "index.html", "金价行情")

    def open_erp_app(self) -> None:
        page = "erp-ant.html" if (self.repo_root / "erp-ant.html").exists() else "erp.html"
        self.open_web_app("WebStack ERP系统", page)

    def open_login_app(self) -> None:
        self.open_web_app("WebStack 登录", "login.html")

    def on_close(self) -> None:
        self.stop_preview_server()
        self.root.destroy()

    def choose_index_file(self) -> None:
        chosen = filedialog.askopenfilename(
            title="选择 index.html",
            filetypes=[("HTML", "*.html"), ("All Files", "*.*")],
            initialdir=str(self.repo_root),
        )
        if not chosen:
            return
        self.path_var.set(chosen)
        self.load_index_file()

    def load_index_file(self, initial: bool = False) -> None:
        raw_path = self.path_var.get().strip()
        if not raw_path:
            if not initial:
                messagebox.showwarning("提示", "请先选择 index.html")
            return
        path = Path(raw_path)
        if not path.exists():
            if not initial:
                messagebox.showerror("加载失败", f"文件不存在：{path}")
            return

        try:
            content = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            content = path.read_text(encoding="utf-8", errors="replace")

        self.index_path = path
        self.repo_root = find_git_root(path.parent) or path.parent
        if self.is_embedded_workspace(self.repo_root):
            self.workspace_source = "内置工作区"
        elif str(self.config.get("bound_repo_root", "")).strip() == str(self.repo_root):
            self.workspace_source = "本地仓库（已绑定）"
        else:
            self.workspace_source = "手动选择目录"

        self.online_base_url = build_online_base_url(self.repo_root)
        self.online_base_var.set(self.online_base_url)

        self.stop_preview_server(silent=True)
        self.update_runtime_mode_ui()
        self.original_html = content
        self.sections = parse_sections(content)
        self.nav_items, self.menu_meta = parse_nav_items(content)

        self.refresh_card_tree()
        self.refresh_nav_tree()
        self.refresh_overview()
        self.load_origin_url()
        self.refresh_workspace_target()
        self.log(f"已加载文件：{path}")
        self.log(f"卡片分组：{len(self.sections)}；卡片总数：{sum(len(s.cards) for s in self.sections)}")
        self.log(f"可编辑导航项：{len(self.nav_items)}")

    def refresh_card_tree(self) -> None:
        for node in self.card_tree.get_children():
            self.card_tree.delete(node)
        for s_idx, section in enumerate(self.sections):
            sid = f"s-{s_idx}"
            self.card_tree.insert("", "end", iid=sid, text=f"[{section.name}]", open=True)
            for c_idx, card in enumerate(section.cards):
                cid = f"c-{s_idx}-{c_idx}"
                self.card_tree.insert(sid, "end", iid=cid, text=card.title or f"未命名卡片{c_idx + 1}")
        self.current_section_idx = None
        self.current_card_idx = None
        self.clear_card_form()

    def refresh_nav_tree(self) -> None:
        for node in self.nav_tree.get_children():
            self.nav_tree.delete(node)
        keyword = self.nav_filter_var.get().strip().lower()
        for index, nav in enumerate(self.nav_items):
            if keyword and keyword not in nav.title.lower() and keyword not in nav.href.lower():
                continue
            self.nav_tree.insert("", "end", iid=f"n-{index}", text=nav.title, values=(nav.href,))
        self.current_nav_idx = None
        self.clear_nav_form()

    def clear_card_form(self) -> None:
        self.card_section_var.set("")
        self.card_title_var.set("")
        self.card_url_var.set("")
        self.card_desc_var.set("")
        self.card_logo_var.set("")

    def clear_nav_form(self) -> None:
        self.nav_title_var.set("")
        self.nav_href_var.set("")
        self.nav_icon_var.set("")
        self.nav_label_var.set("")
        self.nav_target_var.set("")

    def on_card_tree_select(self, _event: tk.Event) -> None:
        selected = self.card_tree.selection()
        if not selected:
            return
        iid = selected[0]
        if iid.startswith("s-"):
            s_idx = int(iid.split("-")[1])
            section = self.sections[s_idx]
            self.current_section_idx = s_idx
            self.current_card_idx = None
            self.card_section_var.set(section.name)
            self.card_title_var.set("")
            self.card_url_var.set("")
            self.card_desc_var.set("")
            self.card_logo_var.set("")
            return

        if iid.startswith("c-"):
            _, s_text, c_text = iid.split("-")
            s_idx, c_idx = int(s_text), int(c_text)
            card = self.sections[s_idx].cards[c_idx]
            self.current_section_idx = s_idx
            self.current_card_idx = c_idx
            self.card_section_var.set(self.sections[s_idx].name)
            self.card_title_var.set(card.title)
            self.card_url_var.set(card.url)
            self.card_desc_var.set(card.desc)
            self.card_logo_var.set(card.logo)

    def on_nav_select(self, _event: tk.Event) -> None:
        selected = self.nav_tree.selection()
        if not selected:
            return
        iid = selected[0]
        if not iid.startswith("n-"):
            return
        index = int(iid.split("-")[1])
        if not (0 <= index < len(self.nav_items)):
            return
        self.current_nav_idx = index
        nav = self.nav_items[index]
        self.nav_title_var.set(nav.title)
        self.nav_href_var.set(nav.href)
        self.nav_icon_var.set(nav.icon_class)
        self.nav_label_var.set(nav.label_text)
        self.nav_target_var.set(nav.target)


# __APPEND_BLOCK__
    def add_card(self) -> None:
        if not self.sections:
            messagebox.showwarning("提示", "当前没有可用分组。")
            return
        section_idx = self.current_section_idx if self.current_section_idx is not None else 0
        section = self.sections[section_idx]
        section.cards.append(CardItem(title="新卡片", url="https://", desc="请填写简介", logo="assets/images/logos/default.svg"))
        self.refresh_card_tree()
        self.log(f"已新增卡片到分组：{section.name}")

    def delete_card(self) -> None:
        if self.current_section_idx is None or self.current_card_idx is None:
            messagebox.showwarning("提示", "请先选中卡片。")
            return
        section = self.sections[self.current_section_idx]
        if not (0 <= self.current_card_idx < len(section.cards)):
            return
        removed = section.cards.pop(self.current_card_idx)
        self.refresh_card_tree()
        self.log(f"已删除卡片：{removed.title}")

    def move_card(self, delta: int) -> None:
        if self.current_section_idx is None or self.current_card_idx is None:
            messagebox.showwarning("提示", "请先选中卡片。")
            return
        section = self.sections[self.current_section_idx]
        old_idx = self.current_card_idx
        new_idx = old_idx + delta
        if new_idx < 0 or new_idx >= len(section.cards):
            return
        section.cards[old_idx], section.cards[new_idx] = section.cards[new_idx], section.cards[old_idx]
        self.current_card_idx = new_idx
        self.refresh_card_tree()
        self.log("卡片顺序已调整")

    def apply_card_form(self) -> None:
        if self.current_section_idx is None or self.current_card_idx is None:
            messagebox.showwarning("提示", "请先选中卡片后再应用。")
            return
        card = self.sections[self.current_section_idx].cards[self.current_card_idx]
        card.title = self.card_title_var.get().strip() or "未命名卡片"
        card.url = self.card_url_var.get().strip() or "#"
        card.desc = self.card_desc_var.get().strip()
        card.logo = self.card_logo_var.get().strip() or "assets/images/logos/default.svg"
        self.refresh_card_tree()
        self.log(f"已更新卡片：{card.title}")

    def choose_logo(self) -> None:
        chosen = filedialog.askopenfilename(
            title="选择 Logo",
            filetypes=[("Image", "*.png;*.jpg;*.jpeg;*.svg;*.webp;*.gif"), ("All Files", "*.*")],
            initialdir=str(self.repo_root),
        )
        if not chosen:
            return
        chosen_path = Path(chosen)
        try:
            rel = chosen_path.relative_to(self.repo_root)
            self.card_logo_var.set(str(rel).replace("\\", "/"))
        except ValueError:
            self.card_logo_var.set(str(chosen_path).replace("\\", "/"))

    def add_nav(self) -> None:
        self.nav_items.append(
            NavItem(
                title="新导航",
                href="#工作常用",
                icon_class="linecons-star",
                label_text="",
                label_class="label label-info pull-right hidden-collapsed",
                target="",
                li_start=-1,
                li_end=-1,
            )
        )
        self.refresh_nav_tree()
        self.log("已新增导航项（保存后写入 index.html）")

    def delete_nav(self) -> None:
        if self.current_nav_idx is None:
            messagebox.showwarning("提示", "请先选中导航项。")
            return
        removed = self.nav_items.pop(self.current_nav_idx)
        self.refresh_nav_tree()
        self.log(f"已删除导航：{removed.title}")

    def move_nav(self, delta: int) -> None:
        if self.current_nav_idx is None:
            messagebox.showwarning("提示", "请先选中导航项。")
            return
        old_idx = self.current_nav_idx
        new_idx = old_idx + delta
        if new_idx < 0 or new_idx >= len(self.nav_items):
            return
        self.nav_items[old_idx], self.nav_items[new_idx] = self.nav_items[new_idx], self.nav_items[old_idx]
        self.current_nav_idx = new_idx
        self.refresh_nav_tree()
        self.log("导航顺序已调整")

    def apply_nav_form(self) -> None:
        if self.current_nav_idx is None:
            messagebox.showwarning("提示", "请先选中导航项后再应用。")
            return
        nav = self.nav_items[self.current_nav_idx]
        nav.title = self.nav_title_var.get().strip() or "未命名导航"
        nav.href = self.nav_href_var.get().strip() or "#"
        nav.icon_class = self.nav_icon_var.get().strip() or "linecons-star"
        nav.label_text = self.nav_label_var.get().strip()
        nav.target = self.nav_target_var.get().strip()
        self.refresh_nav_tree()
        self.log(f"已更新导航：{nav.title}")

    def save_to_index(self) -> None:
        if not self.original_html:
            messagebox.showwarning("提示", "请先加载 index.html")
            return
        if self.current_section_idx is not None and self.current_card_idx is not None:
            self.apply_card_form()
        if self.current_nav_idx is not None:
            self.apply_nav_form()

        rebuilt = rebuild_sections(self.original_html, self.sections)
        rebuilt = rebuild_nav_links(rebuilt, self.nav_items, self.menu_meta)

        backup_path = self.index_path.with_suffix(self.index_path.suffix + ".bak")
        try:
            backup_path.write_text(self.original_html, encoding="utf-8")
            self.index_path.write_text(rebuilt, encoding="utf-8")
        except Exception as exc:
            messagebox.showerror("保存失败", f"写入文件失败：{exc}")
            return

        self.original_html = rebuilt
        self.log(f"保存成功：{self.index_path}")
        self.log(f"备份文件：{backup_path.name}")
        self.load_index_file(initial=True)

        if self.auto_push_var.get():
            self.push_to_master(from_auto=True)
        else:
            messagebox.showinfo("完成", "已保存到 index.html")

    def push_to_master(self, from_auto: bool = False) -> None:
        # 防止用户只调整了树顺序但未点击保存，导致推送的还是旧文件
        try:
            if self.original_html and self.index_path and self.index_path.exists():
                if messagebox.askyesno("推送前确认", "推送前是否先自动保存当前修改到 index.html？"):
                    self.save_to_index()
        except Exception:
            # 兜底：保存失败也继续走原推送流程，让用户看到具体 Git 报错
            pass

        git_root = find_git_root(self.index_path.parent)
        if not git_root:
            git_root = self.repo_root
            self.log("未找到 Git 仓库，正在初始化本地仓库...")
            init_steps = [
                ["git", "init"],
                ["git", "branch", "-M", "master"],
            ]
            for step in init_steps:
                ok, output = run_command(step, git_root)
                if output:
                    self.log(output)
                if not ok:
                    messagebox.showerror("推送失败", f"初始化仓库失败：{' '.join(step)}")
                    return

        current_origin = get_origin_remote_url(git_root)
        target_origin = self.repo_url_var.get().strip() or current_origin

        if not target_origin:
            messagebox.showerror("推送失败", "未检测到 origin 仓库地址，请先填写。")
            return

        if current_origin != target_origin:
            if not from_auto:
                proceed = messagebox.askyesno(
                    "仓库切换确认",
                    f"当前 origin:\n{current_origin or '（空）'}\n\n将切换为:\n{target_origin}\n\n是否继续？",
                )
                if not proceed:
                    self.log("已取消切换仓库并推送。")
                    return

            if current_origin:
                ok, output = run_command(["git", "remote", "set-url", "origin", target_origin], git_root)
            else:
                ok, output = run_command(["git", "remote", "add", "origin", target_origin], git_root)
            if not ok:
                messagebox.showerror("推送失败", f"设置 origin 失败：{output}")
                return
            self.log(f"origin 已切换为：{target_origin}")

        self.repo_url_var.set(target_origin)

        if not self.ensure_git_identity(git_root, target_origin):
            return

        has_common_history, history_detail = has_common_history_with_origin_master(git_root)
        if not has_common_history:
            if self.is_embedded_workspace(git_root):
                messagebox.showerror(
                    "推送失败",
                    "当前是内置工作区，且与远程 master 无共同提交历史，无法直接推送。\n\n"
                    "请先点击右上角“绑定本地仓库目录”，选择你的真实项目目录后再推送。\n\n"
                    f"当前目录：{git_root}",
                )
                self.log("推送中止：内置工作区与远程仓库无共同历史，请先绑定本地仓库目录。")
                return
            self.log(f"历史检查提示：{history_detail}")

        ok, branch_output = run_command(["git", "branch", "--show-current"], git_root)
        if ok:
            branch = branch_output.strip()
            if branch and branch != "master" and not from_auto:
                if not messagebox.askyesno("分支提示", f"当前分支是 {branch}，是否继续推送到 origin/master？"):
                    self.log("已取消推送。")
                    return

        commit_msg = f"chore(index): update via manager {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        self.log(f"开始推送到 GitHub master：{target_origin}")
        commands = [
            ["git", "add", "-A"],
            ["git", "commit", "-m", commit_msg],
            ["git", "push", "origin", "master"],
        ]
        for command in commands:
            ok, output = run_command(command, git_root)
            self.log("$ " + " ".join(command))
            if output:
                self.log(output)
            if not ok:
                if command[1] == "commit" and "nothing to commit" in output.lower():
                    self.log("没有新改动，继续执行 push。")
                    continue
                if command[1] == "push" and ("fetch first" in output.lower() or "non-fast-forward" in output.lower()):
                    self.log("检测到远程领先，尝试自动 rebase 后再次推送...")
                    ok_rebase, out_rebase = run_command(["git", "pull", "--rebase", "origin", "master"], git_root)
                    if out_rebase:
                        self.log(out_rebase)
                    if ok_rebase:
                        ok_retry, out_retry = run_command(["git", "push", "origin", "master"], git_root)
                        self.log("$ git push origin master")
                        if out_retry:
                            self.log(out_retry)
                        if ok_retry:
                            break
                    messagebox.showerror(
                        "推送失败",
                        "远程分支领先，本地自动同步后仍推送失败。\n"
                        "请先绑定真实仓库目录，或手动执行 git pull --rebase 后再推送。",
                    )
                    return
                detail = output if output else "（命令未返回输出）"
                messagebox.showerror(
                    "Git 操作失败",
                    f"命令失败：{' '.join(command)}\n\n详细信息：\n{detail}",
                )
                return
        ts = int(datetime.now().timestamp())
        verify_url = f"{self.build_online_url('index.html')}?v={ts}"
        self.log(f"推送完成，线上验证地址：{verify_url}")
        messagebox.showinfo(
            "完成",
            "已推送到 origin/master。\n\n"
            f"线上验证地址：\n{verify_url}\n\n"
            "如果页面暂未更新，请按 Ctrl+F5 强刷，或等待 1~5 分钟缓存刷新。",
        )


def self_check(repo_root: Path) -> int:
    index_path = repo_root / "index.html"
    if not index_path.exists():
        print("[自检] 未找到 index.html")
        return 1
    content = index_path.read_text(encoding="utf-8", errors="replace")
    sections = parse_sections(content)
    nav_items, menu_meta = parse_nav_items(content)
    print(f"[自检] 分组数量: {len(sections)}")
    print(f"[自检] 卡片数量: {sum(len(item.cards) for item in sections)}")
    print(f"[自检] 导航数量: {len(nav_items)}")
    for module_name, module_status, _ in collect_module_status(content, repo_root):
        print(f"[自检] {module_name}: {module_status}")
    try:
        import webview  # noqa: F401
        print("[自检] 内置WebView: 可用")
    except Exception:
        print("[自检] 内置WebView: 不可用（请安装 WebView2 + pywebview 依赖）")

    rebuilt = rebuild_sections(content, sections)
    rebuilt = rebuild_nav_links(rebuilt, nav_items, menu_meta)
    if not rebuilt:
        print("[自检] 失败：重建内容为空")
        return 2
    print("[自检] 通过")
    return 0


def main() -> int:
    multiprocessing.freeze_support()
    if "--self-check" in sys.argv:
        return self_check(Path.cwd())
    root = tk.Tk()
    app = CardManagerApp(root)
    app.log("欢迎使用 WebStack H5 管理器。")
    app.log("流程建议：加载 index -> 编辑导航/卡片 -> 保存 -> 自动/手动推送 master")
    root.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
