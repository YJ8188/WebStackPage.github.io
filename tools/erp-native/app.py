from __future__ import annotations

import json
import threading
import time
import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import messagebox, ttk
from typing import Any, Dict, Optional

from supabase_native import AuthSession, SupabaseNativeClient, SupabaseError, load_supabase_config


APP_NAME = "WebStack ERP Native"


def app_home_dir() -> Path:
    base = Path.home() / ".webstack-erp-native"
    base.mkdir(parents=True, exist_ok=True)
    return base


def session_file() -> Path:
    return app_home_dir() / "session.json"


def save_session(session: AuthSession) -> None:
    session_file().write_text(
        json.dumps(
            {
                "access_token": session.access_token,
                "refresh_token": session.refresh_token,
                "token_type": session.token_type,
                "expires_at": session.expires_at,
                "user_id": session.user_id,
                "email": session.email,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def load_session() -> Optional[AuthSession]:
    path = session_file()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None

    if not isinstance(data, dict):
        return None

    required = ["access_token", "refresh_token", "expires_at", "user_id", "email"]
    if not all(data.get(k) for k in required):
        return None

    return AuthSession(
        access_token=str(data["access_token"]),
        refresh_token=str(data["refresh_token"]),
        token_type=str(data.get("token_type") or "bearer"),
        expires_at=int(data["expires_at"]),
        user_id=str(data["user_id"]),
        email=str(data["email"]),
    )


@dataclass
class AppState:
    client: SupabaseNativeClient


class LoginFrame(ttk.Frame):
    def __init__(self, master: tk.Widget, on_login: callable, client: SupabaseNativeClient):
        super().__init__(master, padding=18)
        self.on_login = on_login
        self.client = client

        ttk.Label(self, text="登录", font=("Microsoft YaHei", 16, "bold")).grid(row=0, column=0, columnspan=2, sticky="w")
        ttk.Label(self, text="使用与网页端相同的账号密码（Supabase）", foreground="#444").grid(
            row=1, column=0, columnspan=2, sticky="w", pady=(4, 18)
        )

        ttk.Label(self, text="邮箱").grid(row=2, column=0, sticky="e", padx=(0, 8), pady=6)
        self.email_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.email_var, width=34).grid(row=2, column=1, sticky="w", pady=6)

        ttk.Label(self, text="密码").grid(row=3, column=0, sticky="e", padx=(0, 8), pady=6)
        self.password_var = tk.StringVar()
        ttk.Entry(self, textvariable=self.password_var, width=34, show="*").grid(row=3, column=1, sticky="w", pady=6)

        self.status_var = tk.StringVar(value="")
        ttk.Label(self, textvariable=self.status_var, foreground="#b91c1c").grid(
            row=4, column=0, columnspan=2, sticky="w", pady=(8, 0)
        )

        self.login_btn = ttk.Button(self, text="登录", command=self._do_login)
        self.login_btn.grid(row=5, column=0, columnspan=2, sticky="ew", pady=(14, 0))

        self.columnconfigure(1, weight=1)

    def _do_login(self) -> None:
        email = (self.email_var.get() or "").strip()
        password = self.password_var.get() or ""
        if not email or not password:
            self.status_var.set("请输入邮箱和密码")
            return

        self.status_var.set("登录中...")
        self.login_btn.state(["disabled"])

        def worker():
            try:
                session = self.client.sign_in_with_password(email, password)
                save_session(session)
            except SupabaseError as exc:
                self.after(0, lambda: self._set_error(str(exc)))
                return
            except Exception:
                self.after(0, lambda: self._set_error("登录失败，请稍后重试"))
                return
            self.after(0, lambda: self.on_login(session))

        threading.Thread(target=worker, daemon=True).start()

    def _set_error(self, msg: str) -> None:
        self.status_var.set(msg)
        self.login_btn.state(["!disabled"])


class MainFrame(ttk.Frame):
    def __init__(self, master: tk.Widget, state: AppState, on_logout: callable):
        super().__init__(master, padding=10)
        self.state = state
        self.on_logout = on_logout

        top = ttk.Frame(self)
        top.pack(fill="x")

        ttk.Label(top, text=f"{APP_NAME}", font=("Microsoft YaHei", 14, "bold")).pack(side="left")
        self.user_label = ttk.Label(top, text=f"已登录：{state.client.session.email if state.client.session else ''}")
        self.user_label.pack(side="left", padx=16)

        ttk.Button(top, text="刷新", command=self.refresh).pack(side="right", padx=(6, 0))
        ttk.Button(top, text="退出登录", command=self.logout).pack(side="right")

        body = ttk.Notebook(self)
        body.pack(fill="both", expand=True, pady=(10, 0))

        self.customers_tab = CustomersTab(body, state)
        body.add(self.customers_tab, text="客户")

        self.orders_tab = OrdersTab(body, state)
        body.add(self.orders_tab, text="订单")

        self.status_var = tk.StringVar(value="")
        ttk.Label(self, textvariable=self.status_var, foreground="#444").pack(anchor="w", pady=(8, 0))

        self._poll_stop = threading.Event()
        self._start_polling()

    def destroy(self):
        self._poll_stop.set()
        super().destroy()

    def _start_polling(self) -> None:
        def poll():
            while not self._poll_stop.is_set():
                time.sleep(10)
                if self._poll_stop.is_set():
                    break
                self.after(0, self.refresh)

        threading.Thread(target=poll, daemon=True).start()

    def refresh(self) -> None:
        try:
            self.customers_tab.refresh()
            self.orders_tab.refresh()
            self.status_var.set(f"最后刷新：{time.strftime('%Y-%m-%d %H:%M:%S')}")
        except SupabaseError as exc:
            self.status_var.set(f"刷新失败：{exc}")
        except Exception:
            self.status_var.set("刷新失败：未知错误")

    def logout(self) -> None:
        try:
            if session_file().exists():
                session_file().unlink(missing_ok=True)  # type: ignore[arg-type]
        except Exception:
            pass
        self.on_logout()


class CustomersTab(ttk.Frame):
    def __init__(self, master: ttk.Notebook, state: AppState):
        super().__init__(master, padding=10)
        self.state = state

        bar = ttk.Frame(self)
        bar.pack(fill="x")
        ttk.Button(bar, text="新增客户", command=self.add_customer).pack(side="left")
        ttk.Button(bar, text="删除选中", command=self.delete_selected).pack(side="left", padx=6)
        ttk.Button(bar, text="刷新", command=self.refresh).pack(side="right")

        columns = ("id", "name", "phone", "status")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", height=16)
        for c, t, w in (
            ("id", "ID", 140),
            ("name", "客户名称", 240),
            ("phone", "电话", 140),
            ("status", "状态", 90),
        ):
            self.tree.heading(c, text=t)
            self.tree.column(c, width=w, anchor="w")

        self.tree.pack(fill="both", expand=True, pady=(10, 0))

        self.refresh()

    def refresh(self) -> None:
        client = self.state.client
        if not client.session:
            return
        rows = client.rest_select(
            "erp_customers",
            select="id,name,phone,status,created_at",
            filters={"user_id": f"eq.{client.session.user_id}"},
            order="created_at.desc",
        )

        for iid in self.tree.get_children():
            self.tree.delete(iid)

        for r in rows or []:
            self.tree.insert("", "end", values=(r.get("id"), r.get("name"), r.get("phone"), r.get("status")))

    def add_customer(self) -> None:
        client = self.state.client
        if not client.session:
            return

        name = simple_input(self, "新增客户", "客户名称")
        if not name:
            return
        phone = simple_input(self, "新增客户", "电话（可选）") or ""

        client.rest_insert(
            "erp_customers",
            [
                {
                    "user_id": client.session.user_id,
                    "name": name,
                    "phone": phone,
                    "status": "active",
                }
            ],
        )
        self.refresh()

    def _selected_customer_id(self) -> Optional[str]:
        sel = self.tree.selection()
        if not sel:
            return None
        values = self.tree.item(sel[0], "values")
        return str(values[0]) if values else None

    def delete_selected(self) -> None:
        client = self.state.client
        if not client.session:
            return
        cid = self._selected_customer_id()
        if not cid:
            messagebox.showinfo("提示", "请先选中一条客户")
            return
        if not messagebox.askyesno("确认", "确定删除该客户吗？"):
            return
        client.rest_delete(
            "erp_customers",
            filters={
                "id": f"eq.{cid}",
                "user_id": f"eq.{client.session.user_id}",
            },
        )
        self.refresh()


class OrdersTab(ttk.Frame):
    def __init__(self, master: ttk.Notebook, state: AppState):
        super().__init__(master, padding=10)
        self.state = state

        bar = ttk.Frame(self)
        bar.pack(fill="x")
        ttk.Button(bar, text="刷新", command=self.refresh).pack(side="right")

        columns = ("order_number", "total_amount", "status", "payment_status")
        self.tree = ttk.Treeview(self, columns=columns, show="headings", height=16)
        for c, t, w in (
            ("order_number", "订单号", 180),
            ("total_amount", "金额", 100),
            ("status", "订单状态", 120),
            ("payment_status", "支付状态", 120),
        ):
            self.tree.heading(c, text=t)
            self.tree.column(c, width=w, anchor="w")

        self.tree.pack(fill="both", expand=True, pady=(10, 0))
        self.refresh()

    def refresh(self) -> None:
        client = self.state.client
        if not client.session:
            return
        rows = client.rest_select(
            "erp_orders",
            select="id,order_number,total_amount,status,payment_status,created_at",
            filters={"user_id": f"eq.{client.session.user_id}"},
            order="created_at.desc",
        )

        for iid in self.tree.get_children():
            self.tree.delete(iid)

        for r in rows or []:
            self.tree.insert(
                "",
                "end",
                values=(r.get("order_number"), r.get("total_amount"), r.get("status"), r.get("payment_status")),
            )


def simple_input(parent: tk.Widget, title: str, label: str) -> Optional[str]:
    win = tk.Toplevel(parent)
    win.title(title)
    win.transient(parent.winfo_toplevel())
    win.grab_set()
    win.resizable(False, False)

    ttk.Label(win, text=label).grid(row=0, column=0, padx=10, pady=10, sticky="w")
    var = tk.StringVar()
    entry = ttk.Entry(win, textvariable=var, width=34)
    entry.grid(row=1, column=0, padx=10, pady=(0, 10), sticky="ew")
    entry.focus_set()

    result: Dict[str, Any] = {"value": None}

    def ok():
        result["value"] = (var.get() or "").strip()
        win.destroy()

    def cancel():
        win.destroy()

    btns = ttk.Frame(win)
    btns.grid(row=2, column=0, padx=10, pady=(0, 10), sticky="e")
    ttk.Button(btns, text="取消", command=cancel).pack(side="right")
    ttk.Button(btns, text="确定", command=ok).pack(side="right", padx=(0, 6))

    win.columnconfigure(0, weight=1)
    win.bind("<Return>", lambda _e: ok())
    win.bind("<Escape>", lambda _e: cancel())
    parent.winfo_toplevel().wait_window(win)
    return result["value"]


class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title(APP_NAME)
        self.geometry("980x640")
        self.minsize(920, 600)

        supabase_url, supabase_key = load_supabase_config()
        session = load_session()
        self.client = SupabaseNativeClient(supabase_url, supabase_key, session=session)

        self.container = ttk.Frame(self)
        self.container.pack(fill="both", expand=True)

        self.login_frame: Optional[LoginFrame] = None
        self.main_frame: Optional[MainFrame] = None

        self._bootstrap()

    def _bootstrap(self) -> None:
        # 尝试自动刷新 token
        if self.client.session and self.client.session.is_expired:
            try:
                self.client.refresh_session()
                save_session(self.client.session)
            except Exception:
                self.client.session = None

        if self.client.session:
            self.show_main()
        else:
            self.show_login()

    def show_login(self) -> None:
        self._clear_frames()
        self.login_frame = LoginFrame(self.container, self._on_login, self.client)
        self.login_frame.pack(fill="both", expand=True)

    def show_main(self) -> None:
        self._clear_frames()
        self.main_frame = MainFrame(self.container, AppState(self.client), self._on_logout)
        self.main_frame.pack(fill="both", expand=True)
        self.main_frame.refresh()

    def _clear_frames(self) -> None:
        if self.login_frame:
            self.login_frame.destroy()
            self.login_frame = None
        if self.main_frame:
            self.main_frame.destroy()
            self.main_frame = None

    def _on_login(self, session: AuthSession) -> None:
        self.client.session = session
        self.show_main()

    def _on_logout(self) -> None:
        self.client.session = None
        self.show_login()


def main() -> int:
    try:
        app = App()
    except SupabaseError as exc:
        messagebox.showerror("启动失败", str(exc))
        return 1
    except Exception:
        messagebox.showerror("启动失败", "程序初始化失败")
        return 1

    app.mainloop()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

