// ───────────────────────────────────────────────────────────────
//  CORS — قائمة origins مسموح بها فقط
// ───────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  "https://withgo.app",
  "https://www.withgo.app",
];

export function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.includes(origin);
}

export function corsHeaders(origin) {
  // إذا الـ origin مسموح → نُرجعه. وإلا نُرجع الأول (للحماية)
  const allow = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin":      allow,
    "Access-Control-Allow-Methods":     "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":     "Content-Type, X-App-Token",
    "Access-Control-Max-Age":           "86400",
    "Vary":                             "Origin",
    "X-Content-Type-Options":           "nosniff",
    "Referrer-Policy":                  "no-referrer",
  };
}
