// ───────────────────────────────────────────────────────────────
//  Token Crypto — توليد وتحقق توكنات مشفّرة بـ HMAC
//
//  هيكل التوكن:  base64url(payload).base64url(signature)
//  payload:     { uid, email, exp, jti }
//  signature:   HMAC-SHA256(payload, HMAC_SECRET)
// ───────────────────────────────────────────────────────────────

function b64urlEncode(bytes) {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = "=".repeat((4 - (str.length % 4)) % 4);
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return new Uint8Array(sig);
}

async function hmacVerify(secret, message, signature) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "HMAC", key,
    signature,
    new TextEncoder().encode(message),
  );
}

/**
 * إنشاء توكن مع صلاحية محددة
 * @param {object} payload - البيانات (uid, email, ...)
 * @param {string} secret  - HMAC secret
 * @param {number} ttlSec  - مدة الصلاحية بالثواني
 */
export async function createToken(payload, secret, ttlSec) {
  const fullPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    jti: crypto.randomUUID(),  // معرّف فريد للاستخدام مرة واحدة
  };

  const payloadB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify(fullPayload))
  );
  const sig    = await hmac(secret, payloadB64);
  const sigB64 = b64urlEncode(sig);

  return {
    token: `${payloadB64}.${sigB64}`,
    jti:   fullPayload.jti,
    exp:   fullPayload.exp,
  };
}

/**
 * التحقق من توكن — يُرجع payload أو null إن لم يكن صالحاً
 */
export async function verifyToken(token, secret) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;

  // تحقق من التوقيع
  let valid;
  try {
    valid = await hmacVerify(secret, payloadB64, b64urlDecode(sigB64));
  } catch (_) {
    return null;
  }
  if (!valid) return null;

  // فكّ payload
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch (_) {
    return null;
  }

  // تحقق من الصلاحية
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    return null;
  }

  return payload;
}

/**
 * توليد رمز 6 أرقام عشوائي آمن
 */
export function generateNumericCode(digits = 6) {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const view  = new DataView(bytes.buffer);
  const n     = view.getUint32(0, false);
  const max   = 10 ** digits;
  const min   = 10 ** (digits - 1);
  return String(min + (n % (max - min))).padStart(digits, "0");
}
