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

function normalizeTrackingNumber(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function statusToChinese(statusCode: string): string {
  const map: Record<string, string> = {
    NotFound: "暂无轨迹",
    InfoReceived: "已下单",
    InTransit: "运输中",
    OutForDelivery: "派送中",
    AvailableForPickup: "待取件",
    Delivered: "已签收",
    Exception: "运输异常",
    Expired: "已过期",
    Pending: "待处理",
  };
  return map[statusCode] || statusCode || "状态未知";
}

function normalizeTimeline(trackInfo: Record<string, unknown>): Array<Record<string, string>> {
  const tracking = (trackInfo.tracking as Record<string, unknown>) || {};
  const providers = Array.isArray(tracking.providers) ? tracking.providers : [];
  const events: Array<Record<string, unknown>> = [];

  providers.forEach((provider) => {
    const providerObj = (provider as Record<string, unknown>) || {};
    const providerEvents = Array.isArray(providerObj.events) ? providerObj.events : [];
    providerEvents.forEach((event) => events.push((event as Record<string, unknown>) || {}));
  });

  const normalizeText = (value: unknown): string => String(value ?? "").trim();
  const toTimestamp = (value: string): number => {
    if (!value) {
      return 0;
    }
    const ts = Date.parse(value);
    return Number.isFinite(ts) ? ts : 0;
  };

  const normalized = events.map((event) => {
    const time = normalizeText(
      event.time_utc ?? event.time_iso ?? event.time ?? event.created_at ?? event.date
    );
    const status = normalizeText(event.status ?? event.sub_status ?? event.event ?? "状态更新");
    const description = normalizeText(
      event.description ?? event.content ?? event.context ?? event.sub_status_descr
    );
    const location = normalizeText(
      event.location ??
        [event.city, event.state, event.country].filter(Boolean).join(" ")
    );

    return { time, status, description, location };
  });

  normalized.sort((left, right) => toTimestamp(right.time) - toTimestamp(left.time));
  return normalized.slice(0, 40);
}

async function call17Track(
  endpoint: string,
  token: string,
  payload: Array<Record<string, unknown>>
): Promise<Record<string, unknown>> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "17token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as Record<string, unknown>)?.["message"] as string || "17TRACK 请求失败");
  }
  return (data as Record<string, unknown>) || {};
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, message: "仅支持 POST 请求" }, 405);
  }

  const apiKey = Deno.env.get("TRACK17_API_KEY");
  if (!apiKey) {
    return jsonResponse({ ok: false, message: "服务端未配置 TRACK17_API_KEY" }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const trackingNumber = normalizeTrackingNumber((body as Record<string, unknown>)?.trackingNumber);
    const shippingCompany = String((body as Record<string, unknown>)?.shippingCompany ?? "").trim();
    const param = String((body as Record<string, unknown>)?.param ?? "").trim();

    if (!trackingNumber) {
      return jsonResponse({ ok: false, message: "缺少快递单号" }, 400);
    }

    const payloadItem: Record<string, unknown> = { number: trackingNumber };
    if (param) {
      payloadItem.param = param;
    }

    const payload = [payloadItem];
    const registerEndpoint = "https://api.17track.net/track/v2.2/register";
    const detailEndpoint = "https://api.17track.net/track/v2.2/gettrackinfo";

    const registerData = await call17Track(registerEndpoint, apiKey, payload);
    const registerResultData = (registerData.data as Record<string, unknown>) || {};
    const registerRejected = Array.isArray(registerResultData.rejected) ? registerResultData.rejected : [];
    const rejectedRecord = (registerRejected[0] as Record<string, unknown>) || null;

    if (rejectedRecord?.error) {
      const rejectError = rejectedRecord.error as Record<string, unknown>;
      const code = String(rejectError.code ?? "");
      if (code !== "-18010016") {
        const rejectMessage = String(rejectError.message || "17TRACK 注册单号失败");
        return jsonResponse({ ok: false, message: rejectMessage });
      }
    }

    const detailData = await call17Track(detailEndpoint, apiKey, payload);
    const detailResultData = (detailData.data as Record<string, unknown>) || {};
    const accepted = Array.isArray(detailResultData.accepted) ? detailResultData.accepted : [];
    const rejected = Array.isArray(detailResultData.rejected) ? detailResultData.rejected : [];

    if (accepted.length === 0) {
      const firstRejected = (rejected[0] as Record<string, unknown>) || {};
      const rejectError = (firstRejected.error as Record<string, unknown>) || {};
      const rejectMessage = String(rejectError.message || "未获取到物流信息");
      return jsonResponse({ ok: false, message: rejectMessage });
    }

    const first = (accepted[0] as Record<string, unknown>) || {};
    const trackInfo = (first.track_info as Record<string, unknown>) || {};
    const latestStatus = (trackInfo.latest_status as Record<string, unknown>) || {};
    const latestEventRaw = (trackInfo.latest_event as Record<string, unknown>) || {};
    const tracking = (trackInfo.tracking as Record<string, unknown>) || {};
    const providers = Array.isArray(tracking.providers) ? tracking.providers : [];
    const firstProvider = ((providers[0] as Record<string, unknown>)?.provider as Record<string, unknown>) || {};

    const timeline = normalizeTimeline(trackInfo);
    const latestStatusCode = String(latestStatus.status || "");
    const latestStatusText = statusToChinese(latestStatusCode);
    const latestEvent = {
      time: String(
        latestEventRaw.time_utc ??
          latestEventRaw.time_iso ??
          latestEventRaw.time ??
          latestEventRaw.date ??
          ""
      ),
      status: String(latestEventRaw.status ?? latestEventRaw.sub_status ?? latestStatusCode ?? ""),
      description: String(
        latestEventRaw.description ?? latestEventRaw.content ?? latestEventRaw.sub_status_descr ?? ""
      ),
      location: String(
        latestEventRaw.location ??
          [latestEventRaw.city, latestEventRaw.state, latestEventRaw.country].filter(Boolean).join(" ")
      ),
    };

    return jsonResponse({
      ok: true,
      trackingNumber,
      shippingCompany,
      provider: "17TRACK",
      providerName: String(firstProvider.name || "17TRACK"),
      carrier: first.carrier ?? null,
      latestStatusCode,
      latestStatusText,
      latestEvent,
      timeline,
    });
  } catch (error) {
    const message = String((error as Error)?.message || error || "物流查询服务异常");
    return jsonResponse({ ok: false, message }, 500);
  }
});
