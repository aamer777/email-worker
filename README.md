# 🚀 withgo Email Worker — دليل النشر الآمن

نظام إرسال بريد آمن بالكامل عبر **Cloudflare Workers**:
- ✅ مفاتيح API محفوظة في **Cloudflare Secrets** (لا تظهر في أي مكان)
- ✅ Rate limiting لمنع الإساءة
- ✅ توكنات HMAC للاستعادة (استخدام مرة واحدة)
- ✅ Logging آمن (بدون كشف أي PII حساسة)

---

## 📦 البنية

```
email-worker/
├── src/
│   ├── index.js                  ← Router الرئيسي
│   ├── handlers/
│   │   ├── contact.js            ← POST /api/contact
│   │   ├── pin-request.js        ← POST /api/pin/request
│   │   ├── pin-verify.js         ← POST /api/pin/verify
│   │   └── health.js             ← GET  /api/health
│   └── lib/
│       ├── cors.js               ← CORS مع origin allowlist
│       ├── crypto.js             ← توليد توكنات + HMAC
│       ├── logger.js             ← Logging آمن (يخفي PII)
│       ├── rate-limit.js         ← Rate limiting عبر KV
│       ├── resend.js             ← Resend API client
│       ├── templates.js          ← قوالب HTML
│       └── validate.js           ← تحقق من المدخلات
├── wrangler.toml                 ← إعدادات Cloudflare
└── package.json
```

---

## 🛠️ النشر — خطوة بخطوة

### 1. إنشاء حساب Cloudflare (مجاناً)

اذهب إلى [dash.cloudflare.com](https://dash.cloudflare.com) وأنشئ حساباً.

### 2. تثبيت Wrangler (CLI)

```bash
npm install -g wrangler
wrangler login
```

### 3. تثبيت dependencies

```bash
cd email-worker
npm install
```

### 4. إنشاء KV Namespaces

```bash
# لتخزين عدّادات Rate Limit
wrangler kv namespace create RATE_LIMIT

# لتخزين توكنات استعادة PIN
wrangler kv namespace create PIN_TOKENS
```

كل أمر سيُرجع شيئاً مثل:
```
{ binding = "RATE_LIMIT", id = "abc123def456..." }
```

**انسخ الـ `id`** وضعه في `wrangler.toml` بدل `REPLACE_WITH_KV_ID_AFTER_CREATE`.

### 5. رفع الـ Secrets (لا تكتبها في أي ملف!)

```bash
# مفتاح Resend
wrangler secret put RESEND_API_KEY
# سيطلب منك إدخال المفتاح — الصق: re_U3CdJ2z6_...

# مفتاح HMAC (للتوقيع — ولّد واحداً عشوائياً 32 بايت)
wrangler secret put HMAC_SECRET
# الصق سلسلة عشوائية طويلة — مثلاً:
openssl rand -hex 32
# 7f8a2b1c9d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a
```

### 6. النشر

```bash
wrangler deploy
```

ستحصل على رابط مثل:
```
https://withgo-email-worker.<your-username>.workers.dev
```

### 7. اختبار

```bash
# Health check
curl https://withgo-email-worker.<your-username>.workers.dev/api/health
```

يجب يرجع:
```json
{
  "ok": true,
  "service": "withgo email worker",
  "hasResendKey": true,
  "hasHmacSecret": true,
  "hasRateLimitKV": true,
  "hasTokensKV": true
}
```

---

## 🔐 ضمانات الأمان

### ✅ ما يحدث على السيرفر فقط
- مفتاح Resend API
- HMAC secret (لتوقيع التوكنات)
- مقارنة الرموز (constant-time)
- توليد التوكنات والـ codes
- Rate limiting

### ✅ ما يصل للعميل (Frontend)
- `jti` (معرّف فريد للجلسة — غير حساس)
- رسائل خطأ عامة (بدون تفاصيل داخلية)
- حالة النجاح/الفشل فقط

### ✅ ضد Spam/Abuse
| الحماية | الحد |
|---|---|
| Contact form | 3 رسائل / 15 دقيقة لكل IP |
| PIN request | 3 / ساعة لكل IP + 1 / 15 دقيقة لكل بريد |
| PIN verify | 10 محاولات / 10 دقائق |
| Token attempts | 5 محاولات لكل توكن قبل إبطاله |
| Honeypot fields | البوتات تُحجب صامتاً |

### ✅ ضد Token Reuse
- كل توكن له `jti` فريد (UUID)
- بعد التحقق الناجح → `used = true`
- KV يحذف التوكن خلال 60 ثانية من الاستخدام
- محاولة استخدام توكن مستخدم → 410 Gone

### ✅ ضد Timing Attacks
- مقارنة hash الرمز بـ `constant-time comparison`
- نفس وقت الاستجابة سواء كان الرمز صحيحاً أو خاطئاً

---

## 🧹 ربط الكود الأمامي

في `app.js` غيّر الـ proxy URL:

```js
const EMAIL_PROXY = "https://withgo-email-worker.<your-username>.workers.dev";

// نموذج التواصل
fetch(`${EMAIL_PROXY}/api/contact`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    senderName, senderEmail, subject, message, senderPhoto
  })
});

// طلب استعادة PIN
const r = await fetch(`${EMAIL_PROXY}/api/pin/request`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, userName, userPhoto })
});
const { jti } = await r.json();
// احفظ jti لاستخدامه في الخطوة التالية

// التحقق من الرمز
const v = await fetch(`${EMAIL_PROXY}/api/pin/verify`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ jti, code: enteredCode })
});
const result = await v.json();
// result.ok === true → الرمز صحيح
```

---

## 📊 المراقبة

```bash
# عرض الـ logs الحية
wrangler tail

# عرض إحصائيات الاستخدام
# (من خلال dashboard.cloudflare.com → Workers → withgo-email-worker)
```

---

## 🆚 ميزات على Vercel السابق

| | Vercel (السابق) | Cloudflare Workers (الجديد) |
|---|---|---|
| Free tier | محدودة | 100K طلب/يوم |
| Secrets | Environment Vars (نص واضح) | Encrypted Secrets |
| Rate limiting | لا يوجد | مدمج عبر KV |
| Single-use tokens | لا يوجد | ✅ |
| Token signing | لا | HMAC-SHA256 |
| Logging آمن | لا | ✅ (يخفي PII) |
| Latency | ~200ms | ~30ms (Edge) |
| Deployment Protection | يحجب الإنتاج! | لا يوجد |
