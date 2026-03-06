from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional, Tuple


class SupabaseError(RuntimeError):
    pass


def repo_root_from_here() -> Path:
    """返回资源根目录。

    - 源码运行：返回仓库根目录
    - PyInstaller(onefile) 运行：返回解包目录 sys._MEIPASS
    """

    if getattr(sys, "frozen", False):
        base = Path(getattr(sys, "_MEIPASS", "")).resolve()
        if str(base) and base.exists():
            return base

        # onefile 模式下，若 _MEIPASS 异常不可用，则退回到 exe 所在目录。
        # build_erp_native_exe.bat 会把 supabase-config.js 复制到 dist\...\assets\js。
        exe_dir = Path(getattr(sys, "executable", "")).resolve().parent
        if (exe_dir / "assets" / "js" / "supabase-config.js").exists():
            return exe_dir
    # tools/erp-native/supabase_native.py -> repo root
    return Path(__file__).resolve().parents[2]


def user_config_path() -> Path:
    return Path.home() / ".webstack-erp-native" / "config.json"


def load_user_config() -> Optional[Tuple[str, str]]:
    path = user_config_path()
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(data, dict):
        return None
    url = str(data.get("supabaseUrl") or "").strip()
    key = str(data.get("supabaseKey") or "").strip()
    if url and key:
        return url, key
    return None


def load_supabase_config(repo_root: Optional[Path] = None) -> Tuple[str, str]:
    # 1) 优先读取用户本地覆盖配置（方便以后换仓库/换项目）
    user_cfg = load_user_config()
    if user_cfg:
        return user_cfg

    # 2) 再读取打包/仓库里的 supabase-config.js
    root = repo_root or repo_root_from_here()
    candidates = [
        root / "assets" / "js" / "supabase-config.js",
        root / "supabase-config.js",
    ]

    config_file = next((p for p in candidates if p.exists()), None)
    if not config_file:
        raise SupabaseError(
            "找不到 Supabase 配置文件。\n"
            "请确认已打包包含 assets/js/supabase-config.js，\n"
            "或在用户目录创建覆盖配置：%USERPROFILE%\\.webstack-erp-native\\config.json"
        )

    text = config_file.read_text(encoding="utf-8", errors="ignore")
    url_match = re.search(r"\bconst\s+supabaseUrl\s*=\s*'([^']+)'", text)
    key_match = re.search(r"\bconst\s+supabaseKey\s*=\s*'([^']+)'", text)
    if not url_match or not key_match:
        raise SupabaseError("解析 supabaseUrl/supabaseKey 失败，请检查 assets/js/supabase-config.js")

    return url_match.group(1).strip(), key_match.group(1).strip()


def _json_loads_best_effort(raw: bytes) -> Any:
    try:
        return json.loads(raw.decode("utf-8"))
    except Exception:
        try:
            return json.loads(raw.decode("utf-8", errors="ignore"))
        except Exception:
            return None


@dataclass
class AuthSession:
    access_token: str
    refresh_token: str
    token_type: str
    expires_at: int
    user_id: str
    email: str

    @property
    def is_expired(self) -> bool:
        return int(time.time()) >= int(self.expires_at)


class SupabaseNativeClient:
    def __init__(self, supabase_url: str, supabase_key: str, session: Optional[AuthSession] = None):
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_key = supabase_key
        self.session = session

    def _base_headers(self) -> Dict[str, str]:
        headers = {
            "apikey": self.supabase_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        # GoTrue/Auth 与 PostgREST 都可以接受 Bearer token。
        if self.session and self.session.access_token:
            headers["Authorization"] = f"Bearer {self.session.access_token}"
        else:
            # 未登录时，用 anon key 也能访问部分 endpoint（尤其 auth）。
            headers["Authorization"] = f"Bearer {self.supabase_key}"
        return headers

    def _request(self, method: str, url: str, *, headers: Optional[Dict[str, str]] = None, body: Any = None) -> Any:
        final_headers = self._base_headers()
        if headers:
            final_headers.update(headers)

        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")

        req = urllib.request.Request(url, data=data, headers=final_headers, method=method.upper())
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                raw = resp.read()
                if not raw:
                    return None
                return _json_loads_best_effort(raw)
        except urllib.error.HTTPError as exc:
            raw = exc.read() if hasattr(exc, "read") else b""
            payload = _json_loads_best_effort(raw) if raw else None
            message = None
            if isinstance(payload, dict):
                message = payload.get("msg") or payload.get("message") or payload.get("error_description")
                if not message and payload.get("error"):
                    message = str(payload.get("error"))
            message = message or f"HTTP {exc.code}"
            raise SupabaseError(message) from exc
        except urllib.error.URLError as exc:
            raise SupabaseError("网络连接失败，请检查网络后重试") from exc

    # -------------------- Auth --------------------
    def sign_in_with_password(self, email: str, password: str) -> AuthSession:
        url = f"{self.supabase_url}/auth/v1/token?grant_type=password"
        payload = self._request("POST", url, body={"email": email, "password": password})
        if not isinstance(payload, dict):
            raise SupabaseError("登录失败：返回数据异常")

        access_token = str(payload.get("access_token") or "")
        refresh_token = str(payload.get("refresh_token") or "")
        token_type = str(payload.get("token_type") or "bearer")
        expires_at = payload.get("expires_at")
        expires_in = payload.get("expires_in")
        if not expires_at:
            try:
                expires_at = int(time.time()) + int(expires_in)
            except Exception:
                expires_at = int(time.time()) + 3600

        user = payload.get("user") or {}
        user_id = str(user.get("id") or "")
        user_email = str(user.get("email") or email)

        if not access_token or not refresh_token or not user_id:
            raise SupabaseError("登录失败：缺少必要的 token/user 信息")

        self.session = AuthSession(
            access_token=access_token,
            refresh_token=refresh_token,
            token_type=token_type,
            expires_at=int(expires_at),
            user_id=user_id,
            email=user_email,
        )
        return self.session

    def refresh_session(self) -> AuthSession:
        if not self.session or not self.session.refresh_token:
            raise SupabaseError("无法刷新会话：缺少 refresh_token")

        url = f"{self.supabase_url}/auth/v1/token?grant_type=refresh_token"
        payload = self._request("POST", url, body={"refresh_token": self.session.refresh_token})
        if not isinstance(payload, dict):
            raise SupabaseError("刷新会话失败：返回数据异常")

        access_token = str(payload.get("access_token") or "")
        refresh_token = str(payload.get("refresh_token") or self.session.refresh_token)
        expires_at = payload.get("expires_at")
        expires_in = payload.get("expires_in")
        if not expires_at:
            try:
                expires_at = int(time.time()) + int(expires_in)
            except Exception:
                expires_at = int(time.time()) + 3600

        user = payload.get("user") or {}
        user_id = str(user.get("id") or self.session.user_id)
        user_email = str(user.get("email") or self.session.email)

        self.session = AuthSession(
            access_token=access_token or self.session.access_token,
            refresh_token=refresh_token,
            token_type=str(payload.get("token_type") or self.session.token_type),
            expires_at=int(expires_at),
            user_id=user_id,
            email=user_email,
        )
        return self.session

    # -------------------- PostgREST --------------------
    def rest_select(self, table: str, *, select: str = "*", filters: Optional[Dict[str, str]] = None, order: str = "") -> Any:
        params: Dict[str, str] = {"select": select}
        if filters:
            for key, value in filters.items():
                params[key] = value
        if order:
            params["order"] = order

        qs = urllib.parse.urlencode(params, safe=",.*()")
        url = f"{self.supabase_url}/rest/v1/{table}?{qs}"
        return self._request("GET", url)

    def rest_insert(self, table: str, rows: Any) -> Any:
        url = f"{self.supabase_url}/rest/v1/{table}"
        headers = {
            "Prefer": "return=representation",
        }
        return self._request("POST", url, headers=headers, body=rows)

    def rest_update(self, table: str, patch: Dict[str, Any], *, filters: Dict[str, str]) -> Any:
        qs = urllib.parse.urlencode(filters, safe=",.*()")
        url = f"{self.supabase_url}/rest/v1/{table}?{qs}"
        headers = {
            "Prefer": "return=representation",
        }
        return self._request("PATCH", url, headers=headers, body=patch)

    def rest_delete(self, table: str, *, filters: Dict[str, str]) -> Any:
        qs = urllib.parse.urlencode(filters, safe=",.*()")
        url = f"{self.supabase_url}/rest/v1/{table}?{qs}"
        return self._request("DELETE", url)
