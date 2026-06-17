// ═══════════════════════════════════════════════════════════════
//  POST /api/contact — نموذج التواصل مع الإدارة
//
//  الحمايات:
//    ✅ Rate limit: 3 رسائل / 15 دقيقة لكل IP
//    ✅ Honeypot field
//    ✅ Input validation شاملة
//    ✅ يُرسل لـ hello@withgo.app فقط
// ═══════════════════════════════════════════════════════════════
import { parseJsonBody, isEmail, isNonEmptyString, sanitizeText, isBotByHoneypot } from "../lib/validate.js";
import { rateLimit, getClientId } from "../lib/rate-limit.js";
import { sendEmail } from "../lib/resend.js";
import { contactTemplate } from "../lib/templates.js";
import { logInfo, logWarn } from "../lib/logger.js";

const ADMIN_EMAIL    = "hello@withgo.app";
const MAX_NAME_LEN   = 100;
const MAX_SUBJ_LEN   = 200;
const MAX_MSG_LEN    = 5000;
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WIN = 900;  // 15 دقيقة

export async function handleContact(request, env, ctx) {
  // ─── 1. Rate limit ─────────────────────────────────────────────
  const clientId = getClientId(request);
  const rl = await rateLimit(env.RATE_LIMIT, clientId, "contact",
                             RATE_LIMIT_MAX, RATE_LIMIT_WIN);
  if (!rl.allowed) {
    return new Response(JSON.stringify({
      error:      "تجاوزت حد الإرسال — حاول بعد قليل",
      retryAfter: rl.retryAfter,
    }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After":  String(rl.retryAfter),
      },
    });
  }

  // ─── 2. Parse + validate body ──────────────────────────────────
  let body;
  try {
    body = await parseJsonBody(request);
  } catch (e) {
    return jsonError(e.message, 400);
  }

  // honeypot check (silent fail = تظاهر بالنجاح للبوت)
  if (isBotByHoneypot(body)) {
    logWarn("honeypot_triggered", { ip: clientId.slice(0,12) });
    return new Response(JSON.stringify({ ok: true, id: "spam-discarded" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const senderName  = sanitizeText(body.senderName,  MAX_NAME_LEN);
  const senderEmail = sanitizeText(body.senderEmail, 254);
  const senderPhoto = typeof body.senderPhoto === "string" ? body.senderPhoto.slice(0, 500) : "";
  const subject     = sanitizeText(body.subject,     MAX_SUBJ_LEN);
  const message     = sanitizeText(body.message,     MAX_MSG_LEN);

  if (!isNonEmptyString(senderName, MAX_NAME_LEN))   return jsonError("اسم المرسل مطلوب",       400);
  if (!isEmail(senderEmail))                          return jsonError("بريد المرسل غير صالح",  400);
  if (!isNonEmptyString(subject, MAX_SUBJ_LEN))      return jsonError("الموضوع مطلوب",          400);
  if (!isNonEmptyString(message, MAX_MSG_LEN))       return jsonError("نص الرسالة مطلوب",       400);

  // ─── 3. بناء البريد وإرساله ────────────────────────────────────
  const tpl = contactTemplate({ senderName, senderEmail, senderPhoto, subject, message });

  let messageId;
  try {
    messageId = await sendEmail({
      to:      ADMIN_EMAIL,
      subject: tpl.subject,
      html:    tpl.html,
      text:    tpl.text,
      replyTo: senderEmail,
      apiKey:  env.RESEND_API_KEY,
    });
  } catch (e) {
    return jsonError("تعذّر إرسال الرسالة — حاول لاحقاً", 502);
  }

  logInfo("contact_sent", {
    name:  senderName.slice(0, 30),
    email: senderEmail,
    id:    messageId,
  });

  return new Response(JSON.stringify({
    ok:        true,
    id:        messageId,
    remaining: rl.remaining,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function jsonError(message, status) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
