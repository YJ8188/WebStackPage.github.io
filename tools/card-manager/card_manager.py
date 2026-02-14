#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import html
import re
import subprocess
import sys
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Tuple

import tkinter as tk
from tkinter import filedialog, messagebox, ttk


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
    depth = 0
    block_start_rel = -1

    for token in li_token_re.finditer(menu_inner):
        value = token.group(0)
        if value.startswith("</"):
            depth -= 1
            if depth == 0 and block_start_rel >= 0:
                block_end_rel = token.end()
                li_block = menu_inner[block_start_rel:block_end_rel]

                if re.search(r"<ul\b", li_block, re.IGNORECASE):
                    block_start_rel = -1
                    continue

                a_open_match = re.search(r"<a\b[^>]*>", li_block, re.IGNORECASE | re.DOTALL)
                if not a_open_match:
                    block_start_rel = -1
                    continue

                a_open = a_open_match.group(0)
                href = get_attr(a_open, "href")
                if not href or href.lower().startswith("javascript"):
                    block_start_rel = -1
                    continue

                title = strip_html_tags(extract_first(r"<span\s+class=\"title\">(.*?)</span>", li_block, ""))
                if not title:
                    block_start_rel = -1
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

                block_start_rel = -1
        else:
            if depth == 0:
                block_start_rel = token.start()
            depth += 1

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


class CardManagerApp:
    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.root.title("WebStack H5 导航/卡片管理器（Win EXE）")
        self.root.geometry("1320x860")

        self.repo_root = find_git_root(Path.cwd()) or Path.cwd()
        self.index_path = self.repo_root / "index.html"

        self.original_html: str = ""
        self.sections: List[SectionItem] = []
        self.nav_items: List[NavItem] = []
        self.menu_meta: Optional[MenuMeta] = None

        self.current_section_idx: Optional[int] = None
        self.current_card_idx: Optional[int] = None
        self.current_nav_idx: Optional[int] = None

        self._build_ui()
        if self.index_path.exists():
            self.path_var.set(str(self.index_path))
            self.load_index_file(initial=True)
        else:
            self.path_var.set("")
            self.log("未找到默认 index.html，请先点击“选择 index.html”。")

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

        notebook = ttk.Notebook(self.root)
        notebook.pack(fill="both", expand=True, padx=10, pady=(0, 8))

        card_tab = ttk.Frame(notebook)
        nav_tab = ttk.Frame(notebook)
        notebook.add(card_tab, text="卡片管理")
        notebook.add(nav_tab, text="导航管理")

        self._build_card_tab(card_tab)
        self._build_nav_tab(nav_tab)

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

        ttk.Label(left, text="左侧导航（可编辑直连项）").pack(anchor="w")
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
            text="说明：默认管理无子菜单的导航项；锚点链接请填 #工作常用 这种格式。",
            foreground="#555",
        ).pack(anchor="w", pady=(8, 6))
        ttk.Button(form, text="应用导航修改", command=self.apply_nav_form).pack(anchor="w")

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
        self.original_html = content
        self.sections = parse_sections(content)
        self.nav_items, self.menu_meta = parse_nav_items(content)

        self.refresh_card_tree()
        self.refresh_nav_tree()
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
        for index, nav in enumerate(self.nav_items):
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
        git_root = find_git_root(self.index_path.parent)
        if not git_root:
            messagebox.showerror("推送失败", "未找到 .git 仓库，无法推送。")
            return

        ok, branch_output = run_command(["git", "branch", "--show-current"], git_root)
        if ok:
            branch = branch_output.strip()
            if branch and branch != "master" and not from_auto:
                if not messagebox.askyesno("分支提示", f"当前分支是 {branch}，是否继续推送到 origin/master？"):
                    self.log("已取消推送。")
                    return

        commit_msg = f"chore(index): update via manager {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        self.log("开始推送到 GitHub master...")
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
                messagebox.showerror("Git 操作失败", f"命令失败：{' '.join(command)}")
                return
        messagebox.showinfo("完成", "已推送到 origin/master")


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

    rebuilt = rebuild_sections(content, sections)
    rebuilt = rebuild_nav_links(rebuilt, nav_items, menu_meta)
    if not rebuilt:
        print("[自检] 失败：重建内容为空")
        return 2
    print("[自检] 通过")
    return 0


def main() -> int:
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
