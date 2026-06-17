// ═══════════════════════════════════════════════════════════════
//  POST /api/pin/verify — التحقق من رمز PIN
//
//  Body: { jti, code }
//
//  المنطق:
//    1. يجلب record من KV حسب jti
//    2. يفحص: لم ينتهي، لم يُستخدم، عدد المحاولات < 5
//    3. يقارن hash(code) مع hash المخزن (constant-time)
//    4. عند النجاح: يضع used=true → لا يمكن إعادة الاستخدام
//    5. يُرجع للعميل: success + بيانات يحتاجها (email)
// ═══════════════════════════════════════════════════════════════
import { parseJsonBody, sanitizeText } from "../lib/validate.js";
import { rateLimit, getClientId } from "../lib/rate-limit.js";
import { logInfo, logWarn } from "../lib/logger.js";

const MAX_ATTEMPTS    = 5;
const RATE_VERIFY_MAX = 10;
const RATE_VERIFY_WIN = 600;  // 10 دقائق

export async function handlePinVerify(request, env, ctx) {
  // ─── 1. Parse + validate ───────────────────────────────────────
  let body;
  try { body = await parseJsonBody(request); }
  catch (e) { return jsonError(e.message, 400); }

  const jti  = sanitizeText(body.jti,  100);
  const code = sanitizeText(body.code, 10);

  if (!/^[a-f0-9-]{36}$/i.test(jti)) return jsonError("jti غير صالح", 400);
  if (!/^\d{4,8}$/.test(code))       return jsonError("رمز غير صالح", 400);

  // ─── 2. Rate limit للمحاولات ───────────────────────────────────
  const ip = getClientId(request);
  const rl = await rateLimit(env.RATE_LIMIT, ip, "pin-verify",
                             RATE_VERIFY_MAX, RATE_VERIFY_WIN);
  if (!rl.allowed) {
    return new Response(JSON.stringify({
      error:      "تجاوزت حد المحاولات — حاول بعد قليل",
      retryAfter: rl.retryAfter,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(rl.retryAfter) },
    });
  }

  // ─── 3. جلب record من KV ──────────────────────────────────────
  const key    = `token:${jti}`;
  const record = await env.PIN_TOKENS.get(key, { type: "json" });

  if (!record) {
    logWarn("pin_verify_no_record", { jti: jti.slice(0,8), ip: ip.slice(0,12) });
    return jsonError("الرمز منتهي الصلاحية أو غير موجود", 404);
  }

  // ─── 4. التحقق من الحالة ──────────────────────────────────────
  if (record.used) {
    logWarn("pin_verify_already_used", { jti: jti.slice(0,8) });
    return jsonError("هذا الرمز استُخدم مسبقاً", 410);
  }

  if (record.exp && Math.floor(Date.now() / 1000) > record.exp) {
    await env.PIN_TOKENS.delete(key);
    return jsonError("الرمز منتهي الصلاحية", 410);
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await env.PIN_TOKENS.delete(key);
    logWarn("pin_verify_max_attempts", { jti: jti.slice(0,8) });
    return jsonError("تجاوزت عدد المحاولات — اطلب رمزاً جديداً", 429);
  }

  // ─── 5. مقارنة الرمز (constant-time) ──────────────────────────
  const expectedHash = await sha256Hex(`${code}|${record.email}|${env.HMAC_SECRET}`);

  if (!timingSafeEqual(expectedHash, record.codeHash)) {
    // زيادة عدد المحاولات
    record.attempts = (record.attempts || 0) + 1;
    await env.PIN_TOKENS.put(key, JSON.stringify(record), {
      expirationTtl: Math.max(60, record.exp - Math.floor(Date.now() / 1000)),
    });

    logWarn("pin_verify_wrong_code", {
      jti: jti.slice(0,8),
      attempts: record.attempts,
    });
    return jsonError("الرمز غير صحيح", 401);
  }

  // ─── 6. نجاح — تعطيل التوكن لمنع إعادة الاستخدام ──────────────
  record.used     = true;
  record.usedAt   = Math.floor(Date.now() / 1000);
  await env.PIN_TOKENS.put(key, JSON.stringify(record), {
    // نحتفظ به دقيقة فقط بعد الاستخدام (للحماية من race conditions)
    expirationTtl: 60,
  });

  logInfo("pin_verify_success", { jti: jti.slice(0,8), email: record.email });

  return new Response(JSON.stringify({
    ok:    true,
    email: record.email,
  }), {
    status:  200,
    headers: { "Content-Type": "application/json" },
  });
}

// مقارنة constant-time لمنع timing attacks
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0")).join("");
}

function jsonError(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
