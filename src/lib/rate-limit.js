// ───────────────────────────────────────────────────────────────
//  Rate Limiter — يحدّ من الطلبات لكل IP عبر KV
// ───────────────────────────────────────────────────────────────
import { logWarn } from "./logger.js";

/**
 * @param {KVNamespace} kv         — KV namespace للتخزين
 * @param {string}      identifier — IP أو أي معرّف فريد
 * @param {string}      action     — اسم الإجراء (contact, pin-request...)
 * @param {number}      max        — أقصى عدد طلبات
 * @param {number}      windowSec  — نافذة زمنية بالثواني
 * @returns {Promise<{allowed:boolean, remaining:number, retryAfter:number}>}
 */
export async function rateLimit(kv, identifier, action, max, windowSec) {
  const key = `rl:${action}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);

  // قراءة السجل الحالي
  const raw = await kv.get(key, { type: "json" });

  let record;
  if (!raw || (now - raw.start) >= windowSec) {
    // نافذة جديدة
    record = { count: 1, start: now };
  } else {
    record = { count: raw.count + 1, start: raw.start };
  }

  // حفظ مع TTL = النافذة
  await kv.put(key, JSON.stringify(record), {
    expirationTtl: windowSec,
  });

  const allowed = record.count <= max;
  const remaining = Math.max(0, max - record.count);
  const retryAfter = allowed ? 0 : (record.start + windowSec - now);

  if (!allowed) {
    logWarn("rate_limit_exceeded", {
      action,
      identifier: identifier.slice(0, 12) + "...",
      count: record.count,
      max,
    });
  }

  return { allowed, remaining, retryAfter };
}

/**
 * يُرجع معرّف العميل (IP من Cloudflare headers)
 */
export function getClientId(request) {
  return request.headers.get("CF-Connecting-IP")
      || request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
      || "unknown";
}
