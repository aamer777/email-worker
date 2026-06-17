// ═══════════════════════════════════════════════════════════════════
//  📨 withgo-email-worker — Cloudflare Worker for withgo.app
//
//  السمات الأمنية:
//    ✅ Origin Validation — يقبل فقط withgo.app
//    ✅ Rate Limiting — 5 طلبات/15 دقيقة لكل IP (عبر KV)
//    ✅ Token-based PIN Recovery — توكن مشفّر + صلاحية 15 دقيقة
//    ✅ Single-use Tokens — لا يمكن إعادة استخدامها
//    ✅ Honeypot field للحماية من البوتات
//    ✅ Input validation شاملة
//    ✅ Logging آمن (بدون PII حساسة)
//
//  Endpoints:
//    POST /api/contact         → نموذج تواصل (rate-limited)
//    POST /api/pin/request     → طلب استعادة PIN (يُرسل توكن للبريد)
//    POST /api/pin/verify      → التحقق من التوكن
//    GET  /api/health          → فحص صحة الخدمة
//
//  Secrets المطلوبة (عبر `wrangler secret put`):
//    - RESEND_API_KEY
//    - HMAC_SECRET (مفتاح توقيع التوكنات — random 32 bytes)
//
//  KV Namespaces المطلوبة:
//    - RATE_LIMIT     → عداد الطلبات
//    - PIN_TOKENS     → توكنات الاستعادة (مع TTL)
// ═══════════════════════════════════════════════════════════════════

import { handleContact }    from "./handlers/contact.js";
import { handlePinRequest } from "./handlers/pin-request.js";
import { handlePinVerify }  from "./handlers/pin-verify.js";
import { handleHealth }     from "./handlers/health.js";
import { corsHeaders, isAllowedOrigin } from "./lib/cors.js";
import { logError } from "./lib/logger.js";

export default {
  async fetch(request, env, ctx) {
    const url    = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    // ─── 1. CORS preflight ───────────────────────────────────────
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status:  204,
        headers: corsHeaders(origin),
      });
    }

    // ─── 2. Origin allowlist ─────────────────────────────────────
    if (request.method !== "GET" && !isAllowedOrigin(origin)) {
      logError("forbidden_origin", { origin: origin.slice(0, 50) });
      return jsonResponse(
        { error: "Origin not allowed" },
        403,
        origin
      );
    }

    // ─── 3. Routing ──────────────────────────────────────────────
    try {
      let response;

      if (url.pathname === "/api/health" && request.method === "GET") {
        response = await handleHealth(request, env);
      }
      else if (url.pathname === "/api/contact" && request.method === "POST") {
        response = await handleContact(request, env, ctx);
      }
      else if (url.pathname === "/api/pin/request" && request.method === "POST") {
        response = await handlePinRequest(request, env, ctx);
      }
      else if (url.pathname === "/api/pin/verify" && request.method === "POST") {
        response = await handlePinVerify(request, env, ctx);
      }
      else {
        response = jsonResponse({ error: "Not found" }, 404, origin);
      }

      // إضافة CORS headers لكل رد
      Object.entries(corsHeaders(origin)).forEach(([k, v]) => {
        response.headers.set(k, v);
      });

      return response;

    } catch (err) {
      // لا نُسرّب stack trace أو تفاصيل داخلية للعميل
      logError("unhandled", { path: url.pathname, msg: err.message });
      return jsonResponse(
        { error: "Internal server error" },
        500,
        origin
      );
    }
  },
};

function jsonResponse(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}
