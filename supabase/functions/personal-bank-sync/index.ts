import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: CORS_HEADERS,
  });
}

function normalizeDateText(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  if (!Number.isFinite(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function buildMockEntries(
  bankName: string,
  startDate: string,
  endDate: string,
): Array<Record<string, unknown>> {
  const end = new Date(endDate || Date.now());
  const start = new Date(startDate || end);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const midDate = new Date(start.getTime() + Math.floor(totalDays / 2) * 86400000);

  return [
    {
      statement_date: `${normalizeDateText(start)} 09:30:00`,
      statement_type: "debit",
      amount: 188.6,
      currency: "CNY",
      description: `${bankName} 账单消费（测试）`,
      source_channel: "mock_connector",
      external_ref: `mock:${normalizeDateText(start)}:1`,
      ext_payload: { stage: "start" },
    },
    {
      statement_date: `${normalizeDateText(midDate)} 14:20:00`,
      statement_type: "credit",
      amount: 1200,
      currency: "CNY",
      description: `${bankName} 账单入账（测试）`,
      source_channel: "mock_connector",
      external_ref: `mock:${normalizeDateText(midDate)}:2`,
      ext_payload: { stage: "middle" },
    },
    {
      statement_date: `${normalizeDateText(end)} 20:05:00`,
      statement_type: "debit",
      amount: 66.8,
      currency: "CNY",
      description: `${bankName} 手续费（测试）`,
      source_channel: "mock_connector",
      external_ref: `mock:${normalizeDateText(end)}:3`,
      ext_payload: { stage: "end" },
    },
  ];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "仅支持 POST 请求" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const provider = String((body as Record<string, unknown>)?.provider ?? "").trim();
    const bankName = String((body as Record<string, unknown>)?.bank_name ?? "").trim() || "未命名银行";
    const startDate = normalizeDateText((body as Record<string, unknown>)?.start_date);
    const endDate = normalizeDateText((body as Record<string, unknown>)?.end_date);

    if (!provider) {
      return jsonResponse({ ok: false, message: "缺少 provider" }, 400);
    }
    if (!startDate || !endDate) {
      return jsonResponse({ ok: false, message: "缺少有效的开始/结束日期" }, 400);
    }

    const mockEnabled = String(Deno.env.get("PERSONAL_BANK_SYNC_MOCK") ?? "0") === "1";
    if (mockEnabled) {
      return jsonResponse({
        ok: true,
        message: "已使用 Mock 模式返回测试账单，可用于前端联调",
        entries: buildMockEntries(bankName, startDate, endDate),
      });
    }

    return jsonResponse({
      ok: true,
      message: "暂未配置真实银行接口，建议使用“自动模式（接口失败回退账本）”",
      entries: [],
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: (error as Error)?.message || "个人账单同步函数执行异常",
    }, 500);
  }
});
