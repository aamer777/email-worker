// ───────────────────────────────────────────────────────────────
//  GET /api/health — فحص حالة الخدمة
// ───────────────────────────────────────────────────────────────
export async function handleHealth(request, env) {
  const checks = {
    ok:           true,
    service:      "withgo email worker",
    version:      "1.0.0",
    time:         new Date().toISOString(),
    hasResendKey: !!env.RESEND_API_KEY,
    hasHmacSecret:!!env.HMAC_SECRET,
    hasRateLimitKV:!!env.RATE_LIMIT,
    hasTokensKV:  !!env.PIN_TOKENS,
  };

  const status = (checks.hasResendKey && checks.hasHmacSecret
               && checks.hasRateLimitKV && checks.hasTokensKV) ? 200 : 503;

  return new Response(JSON.stringify(checks), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
