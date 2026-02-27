import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-sync-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const PROVIDER = "qq_mail";
const TABLE_NAME = "erp_mail_authorizations";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  });
}

function requiredEnv(name: string): string {
  const value = String(Deno.env.get(name) || "").trim();
  if (!value) throw new Error(`服务端缺少环境变量：${name}`);
  return value;
}

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeHost(value: unknown): string {
  const host = String(value ?? "").trim();
  return host || "imap.qq.com";
}

function normalizePort(value: unknown): number {
  const port = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(port)) return 993;
  return Math.min(65535, Math.max(1, port));
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveCryptoKey(secret: string): Promise<CryptoKey> {
  const secretBytes = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", secretBytes);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptAuthCode(plainText: string, secret: string): Promise<string> {
  const key = await deriveCryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(plainText);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plainBytes);
  return `${toBase64(iv)}.${toBase64(new Uint8Array(encrypted))}`;
}

async function decryptAuthCode(cipherText: string, secret: string): Promise<string> {
  const [ivText, bodyText] = String(cipherText || "").split(".");
  if (!ivText || !bodyText) throw new Error("授权码密文格式无效");
  const key = await deriveCryptoKey(secret);
  const iv = fromBase64(ivText);
  const body = fromBase64(bodyText);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, body);
  return new TextDecoder().decode(decrypted);
}

function maskEmail(email: string): string {
  const value = normalizeEmail(email);
  if (!value || !value.includes("@")) return "";
  const [name, domain] = value.split("@");
  if (!name) return `***@${domain || ""}`;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain || ""}`;
  return `${name.slice(0, 2)}***@${domain || ""}`;
}

function getRequestBody(body: unknown): Record<string, unknown> {
  return (body && typeof body === "object") ? (body as Record<string, unknown>) : {};
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

async function getAuthenticatedUserId(req: Request): Promise<string> {
  const authHeader = String(req.headers.get("Authorization") || "").trim();
  if (!authHeader) throw new Error("未登录或登录已过期");

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user?.id) throw new Error("用户鉴权失败，请重新登录");
  return String(data.user.id);
}

function verifySyncToken(req: Request): void {
  const expected = requiredEnv("QQ_MAIL_SYNC_TOKEN");
  const provided = String(req.headers.get("x-sync-token") || "").trim();
  if (!provided || provided !== expected) {
    throw new Error("同步令牌校验失败");
  }
}

function buildAdminClient() {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "仅支持 POST 请求" }, 405);
  }

  try {
    const bodyRaw = await req.json().catch(() => ({}));
    const body = getRequestBody(bodyRaw);
    const action = String(body.action || "status").trim().toLowerCase();
    const cryptoSecret = requiredEnv("QQ_MAIL_CRYPTO_KEY");
    const admin = buildAdminClient();

    if (action === "resolve") {
      verifySyncToken(req);
      const userId = String(body.user_id || "").trim();
      if (!isUuid(userId)) return jsonResponse({ ok: false, message: "user_id 格式错误" }, 400);

      const { data, error } = await admin
        .from(TABLE_NAME)
        .select("email_address, auth_cipher, imap_host, imap_port, is_enabled")
        .eq("user_id", userId)
        .eq("provider", PROVIDER)
        .single();
      if (error || !data) return jsonResponse({ ok: false, message: "未找到邮箱授权配置" }, 404);
      if (!data.is_enabled) return jsonResponse({ ok: false, message: "邮箱授权已停用" }, 400);
      const authCode = await decryptAuthCode(String(data.auth_cipher || ""), cryptoSecret);
      return jsonResponse({
        ok: true,
        data: {
          email_address: String(data.email_address || ""),
          auth_code: authCode,
          imap_host: String(data.imap_host || "imap.qq.com"),
          imap_port: Number(data.imap_port || 993),
          is_enabled: !!data.is_enabled,
        },
      });
    }

    if (action === "update_sync_status") {
      verifySyncToken(req);
      const userId = String(body.user_id || "").trim();
      if (!isUuid(userId)) return jsonResponse({ ok: false, message: "user_id 格式错误" }, 400);
      const syncStatus = String(body.sync_status || "").trim() || "unknown";
      const syncMessage = String(body.sync_message || "").trim().slice(0, 500);
      const syncAt = String(body.last_sync_at || "").trim() || new Date().toISOString();

      const { data, error } = await admin
        .from(TABLE_NAME)
        .update({
          last_sync_status: syncStatus,
          last_sync_message: syncMessage,
          last_sync_at: syncAt,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", PROVIDER)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ ok: false, message: "未找到邮箱授权配置，无法回写同步状态" }, 404);
      return jsonResponse({ ok: true });
    }

    const userId = await getAuthenticatedUserId(req);

    if (action === "status") {
      const { data, error } = await admin
        .from(TABLE_NAME)
        .select("email_address, imap_host, imap_port, is_enabled, updated_at, last_sync_at, last_sync_status, last_sync_message")
        .eq("user_id", userId)
        .eq("provider", PROVIDER)
        .maybeSingle();
      if (error) throw error;
      if (!data) return jsonResponse({ ok: true, data: null });
      return jsonResponse({
        ok: true,
        data: {
          email_address: String(data.email_address || ""),
          email_masked: maskEmail(String(data.email_address || "")),
          imap_host: String(data.imap_host || "imap.qq.com"),
          imap_port: Number(data.imap_port || 993),
          is_enabled: !!data.is_enabled,
          updated_at: data.updated_at || null,
          last_sync_at: data.last_sync_at || null,
          last_sync_status: data.last_sync_status || "",
          last_sync_message: data.last_sync_message || "",
        },
      });
    }

    if (action === "disable") {
      const { error } = await admin
        .from(TABLE_NAME)
        .update({
          is_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", PROVIDER);
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    if (action === "save") {
      const emailAddress = normalizeEmail(body.email_address);
      const authCode = String(body.auth_code || "").trim();
      const imapHost = normalizeHost(body.imap_host);
      const imapPort = normalizePort(body.imap_port);
      const isEnabled = body.is_enabled === undefined ? true : !!body.is_enabled;

      if (!emailAddress || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailAddress)) {
        return jsonResponse({ ok: false, message: "邮箱地址格式错误" }, 400);
      }
      if (!authCode) {
        return jsonResponse({ ok: false, message: "请输入QQ邮箱IMAP授权码" }, 400);
      }

      const authCipher = await encryptAuthCode(authCode, cryptoSecret);
      const nowIso = new Date().toISOString();
      const { error } = await admin
        .from(TABLE_NAME)
        .upsert({
          user_id: userId,
          provider: PROVIDER,
          email_address: emailAddress,
          auth_cipher: authCipher,
          imap_host: imapHost,
          imap_port: imapPort,
          is_enabled: isEnabled,
          updated_at: nowIso,
        }, { onConflict: "user_id,provider" });
      if (error) throw error;
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, message: "未知操作" }, 400);
  } catch (error) {
    const message = String((error as Error)?.message || error || "处理失败");
    const status = /未登录|鉴权失败/i.test(message) ? 401 : 500;
    return jsonResponse({ ok: false, message }, status);
  }
});
