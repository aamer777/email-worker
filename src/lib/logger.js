// ───────────────────────────────────────────────────────────────
//  Logger آمن — لا يطبع المفاتيح أو البريد الكامل
// ───────────────────────────────────────────────────────────────

// قائمة مفاتيح حساسة لا تُطبع أبداً
const SENSITIVE_KEYS = [
  "key", "secret", "token", "password", "pin", "api_key",
  "authorization", "x-api-key", "cookie",
];

function redact(value) {
  if (typeof value !== "string") return value;
  // إخفاء البريد جزئياً: a***@example.com
  if (value.includes("@")) {
    const [u, d] = value.split("@");
    return (u[0] || "") + "***@" + d;
  }
  // إخفاء أي string طويل (محتمل token)
  if (value.length > 30) return value.slice(0, 6) + "...";
  return value;
}

function sanitize(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    const lk = k.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lk.includes(s))) {
      clean[k] = "[REDACTED]";
    } else if (lk === "email" || lk === "to" || lk === "from") {
      clean[k] = redact(v);
    } else {
      clean[k] = typeof v === "object" ? sanitize(v) : v;
    }
  }
  return clean;
}

export function logInfo(event, data = {}) {
  console.log(JSON.stringify({
    level: "info",
    event,
    time:  new Date().toISOString(),
    ...sanitize(data),
  }));
}

export function logError(event, data = {}) {
  console.error(JSON.stringify({
    level: "error",
    event,
    time:  new Date().toISOString(),
    ...sanitize(data),
  }));
}

export function logWarn(event, data = {}) {
  console.warn(JSON.stringify({
    level: "warn",
    event,
    time:  new Date().toISOString(),
    ...sanitize(data),
  }));
}
