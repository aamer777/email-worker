// ───────────────────────────────────────────────────────────────
//  Validation — تحقق صارم من المدخلات
// ───────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(s) {
  return typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s.trim());
}

export function isNonEmptyString(s, maxLen = 5000) {
  return typeof s === "string"
      && s.trim().length > 0
      && s.length <= maxLen;
}

/**
 * يقطع النص ويزيل التحكم characters الخطيرة
 */
export function sanitizeText(s, maxLen = 5000) {
  if (typeof s !== "string") return "";
  return s
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")  // حذف control chars
    .slice(0, maxLen)
    .trim();
}

/**
 * فحص honeypot — حقل مخفي يجب أن يكون فارغاً
 * إذا امتلأ = بوت
 */
export function isBotByHoneypot(body) {
  return !!(body && (body.website || body.url || body.phone_number));
}

/**
 * يفك JSON body بأمان
 */
export async function parseJsonBody(request, maxSize = 16384) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json");
  }

  const text = await request.text();
  if (text.length > maxSize) {
    throw new Error("Request body too large");
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new Error("Invalid JSON body");
  }
}
