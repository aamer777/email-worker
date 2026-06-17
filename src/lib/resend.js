// ───────────────────────────────────────────────────────────────
//  Email Sender — Resend API (Server-Side فقط)
// ───────────────────────────────────────────────────────────────
import { logError, logInfo } from "./logger.js";

const RESEND_URL = "https://api.resend.com/emails";
const FROM       = "خزنة يومي 🛡️ <hello@withgo.app>";

/**
 * إرسال بريد عبر Resend
 * @param {object} params {to, subject, html, text, replyTo, apiKey}
 */
export async function sendEmail({ to, subject, html, text, replyTo, apiKey }) {
  if (!apiKey) {
    throw new Error("Missing Resend API key");
  }

  const payload = {
    from:    FROM,
    to:      Array.isArray(to) ? to : [to],
    subject,
    html,
    text:    text || stripHtml(html),
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch(RESEND_URL, {
    method:  "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type":  "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    logError("resend_failed", {
      status: res.status,
      code:   data.statusCode,
      name:   data.name,
      msg:    data.message,
    });
    throw new Error(`Resend ${res.status}: ${data.message || data.name || "unknown"}`);
  }

  logInfo("email_sent", { id: data.id, to });
  return data.id;
}

function stripHtml(html) {
  return String(html || "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
