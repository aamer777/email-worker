// ═══════════════════════════════════════════════════════════════
//  POST /api/pin/request — طلب استعادة PIN
//
//  المنطق الأمني:
//    1. يستقبل {email, userName, userPhoto}
//    2. يولّد رمز 6 أرقام عشوائي + توكن HMAC مرتبط به
//    3. يُخزّن hash(code) في KV مع TTL = 15 دقيقة
//    4. يُرسل الرمز للبريد فقط (لا يُرجعه في الرد)
//    5. يُرجع للعميل: jti (معرّف للمتابعة فقط)
//
//  الحمايات:
//    ✅ Rate limit: 3 طلبات / ساعة لكل IP + 1 / 15 دقيقة لكل بريد
//    ✅ توكنات للاستخدام مرة واحدة فقط (single-use)
//    ✅ Code hashing — لا يُخزّن الرمز كنص واضح
//    ✅ Constant-time comparison لمنع timing attacks
// ═══════════════════════════════════════════════════════════════
import { parseJsonBody, isEmail, sanitizeText, isBotByHoneypot } from "../lib/validate.js";
import { rateLimit, getClientId } from "../lib/rate-limit.js";
import { sendEmail } from "../lib/resend.js";
import { pinRecoveryCodeTemplate } from "../lib/templates.js";
import { generateNumericCode } from "../lib/crypto.js";
import { logInfo, logWarn } from "../lib/logger.js";

const TTL_SECONDS    = 15 * 60;   // 15 دقيقة
const RATE_IP_MAX    = 3;
const RATE_IP_WIN    = 3600;       // ساعة
const RATE_EMAIL_MAX = 1;
const RATE_EMAIL_WIN = 900;        // 15 دقيقة

export async function handlePinRequest(request, env, ctx) {
  // ─── 1. Parse ──────────────────────────────────────────────────
  let body;
  try { body = await parseJsonBody(request); }
  catch (e) { return jsonError(e.message, 400); }

  if (isBotByHoneypot(body)) {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const email     = sanitizeText(body.email, 254).toLowerCase();
  const userName  = sanitizeText(body.userName || "المستخدم", 100);
  const userPhoto = typeof body.userPhoto === "string" ? body.userPhoto.slice(0, 500) : "";

  if (!isEmail(email)) return jsonError("بريد غير صالح", 400);

  // ─── 2. Rate limit (IP + email) ────────────────────────────────
  const ip     = getClientId(request);
  const rlIp   = await rateLimit(env.RATE_LIMIT, ip,    "pin-req-ip",    RATE_IP_MAX,    RATE_IP_WIN);
  const rlMail = await rateLimit(env.RATE_LIMIT, email, "pin-req-email", RATE_EMAIL_MAX, RATE_EMAIL_WIN);

  if (!rlIp.allowed || !rlMail.allowed) {
    const retryAfter = Math.max(rlIp.retryAfter, rlMail.retryAfter);
    return new Response(JSON.stringify({
      error: "تجاوزت حد الطلبات — حاول بعد قليل",
      retryAfter,
    }), {
      status: 429,
      headers: { "Content-Type": "application/json", "Retry-After": String(retryAfter) },
    });
  }

  // ─── 3. توليد الرمز والـ JTI ───────────────────────────────────
  const code = generateNumericCode(6);
  const jti  = crypto.randomUUID();
  const exp  = Math.floor(Date.now() / 1000) + TTL_SECONDS;

  // hash الرمز قبل التخزين (لا يُحفظ نصّاً واضحاً)
  const codeHash = await sha256Hex(`${code}|${email}|${env.HMAC_SECRET}`);

  // ─── 4. حفظ في KV ─────────────────────────────────────────────
  await env.PIN_TOKENS.put(`token:${jti}`, JSON.stringify({
    email,
    codeHash,
    exp,
    used:     false,
    attempts: 0,
  }), {
    expirationTtl: TTL_SECONDS,
  });

  // ─── 5. إرسال البريد ──────────────────────────────────────────
  const tpl = pinRecoveryCodeTemplate({
    to:        email,
    userName,
    userPhoto,
    code,
    ttlMin:    TTL_SECONDS / 60,
  });

  try {
    await sendEmail({
      to:      email,
      subject: tpl.subject,
      html:    tpl.html,
      text:    tpl.text,
      apiKey:  env.RESEND_API_KEY,
    });
  } catch (e) {
    // نظف الـ KV إن فشل الإرسال
    await env.PIN_TOKENS.delete(`token:${jti}`);
    return jsonError("تعذّر إرسال البريد — حاول لاحقاً", 502);
  }

  logInfo("pin_request_sent", { email, jti: jti.slice(0,8) });

  // نُرجع jti فقط للعميل (لا الرمز ولا الـ hash)
  return new Response(JSON.stringify({
    ok:        true,
    jti,
    expiresIn: TTL_SECONDS,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
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
