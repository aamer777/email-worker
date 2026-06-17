// ───────────────────────────────────────────────────────────────
//  Email Templates — قوالب HTML احترافية (ذهبي/بنفسجي)
// ───────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function arabicTime() {
  return new Date().toLocaleString("ar-SA", {
    weekday: "long", year: "numeric", month: "long",
    day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/**
 * القالب الرئيسي — يحوي header/sender card/body/footer
 */
function baseTemplate({ senderName, senderEmail, senderPhoto, subject, bodyHtml }) {
  const photo = senderPhoto && /^https?:\/\//.test(senderPhoto)
    ? senderPhoto
    : "https://withgo.app/ar/og-image.png";

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0a0618;">
<div style="margin:0;padding:0;background:#0a0618;font-family:'Segoe UI',Tahoma,Arial,sans-serif;direction:rtl;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;">
    <div style="background:linear-gradient(160deg,#12082a 0%,#1a0820 60%,#2d1200 100%);border:1px solid rgba(245,166,35,0.25);border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.5);">
      <div style="padding:22px 24px;text-align:center;border-bottom:1px solid rgba(245,166,35,0.18);">
        <div style="font-size:32px;line-height:1;"><img src="https://withgo.app/ar/logo.png" width="80" height="80" style="display:inline-block;" alt="شعار">
</div>
        <div style="color:#f5a623;font-size:18px;font-weight:800;margin-top:8px;">خزنة يومي </div>
        <div style="color:rgba(255,255,255,0.45);font-size:12px;margin-top:2px;"> هو درعك لحماية - ارقامك -وملفاتك - ومواعيدك </div>
      <div style="padding:18px 24px;background:rgba(10,6,24,0.4);">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border:0;"><tbody><tr>
          <td style="padding-left:14px;vertical-align:middle;">
            <img src="${esc(photo)}" width="56" height="56" style="border-radius:50%;border:2px solid #f5a623;display:block;" alt="">
          </td>
          <td style="vertical-align:middle;">
            <div style="color:#f5f0ff;font-size:15px;font-weight:800;">👤 ${esc(senderName)}</div>
            <div style="color:#f5a623;font-size:12px;margin-top:3px;">${esc(senderEmail)}</div>
          </td>
        </tr></tbody></table>
      </div>
      <div style="padding:18px 24px 8px;">
        <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:700;letter-spacing:0.5px;">الموضوع</div>
        <div style="color:#ffd700;font-size:17px;font-weight:800;margin-top:4px;">${esc(subject)}</div>
      </div>
      <div style="padding:8px 24px 20px;">
        <div style="color:rgba(255,255,255,0.4);font-size:11px;font-weight:700;letter-spacing:0.5px;margin-bottom:6px;">نص الرسالة</div>
        <div style="background:rgba(245,166,35,0.06);border:1px solid rgba(245,166,35,0.15);border-radius:14px;padding:16px;color:#e8e2f5;font-size:14px;line-height:1.9;">${bodyHtml}</div>
      </div>
      <div style="padding:14px 24px;border-top:1px solid rgba(245,166,35,0.15);text-align:center;">
        <div style="color:rgba(255,255,255,0.35);font-size:11px;">🕒 ${esc(arabicTime())}</div>
        <div style="color:rgba(255,255,255,0.3);font-size:11px;margin-top:6px;">👨‍💻 مطوّر عامر — مكة · خزنة يومي v4.0</div>
      </div>
    </div>
  </div>
</div>
</body>
</html>`;
}

// ─── 1. رمز استعادة PIN ────────────────────────────────────────
export function pinRecoveryCodeTemplate({ to, userName, userPhoto, code, ttlMin }) {
  const bodyHtml = `
    <p style="margin:0 0 10px;">السلام عليكم <b style="color:#ffd700;">${esc(userName)}</b>،</p>
    <p style="margin:0 0 14px;">هذا رمز التحقق الخاص بك لاستعادة الرقم السرّي:</p>
    <div style="background:rgba(245,166,35,0.10);border:2px solid #f5a623;border-radius:14px;padding:18px;text-align:center;margin:14px 0;">
      <div style="font-size:42px;font-weight:900;letter-spacing:14px;color:#ffd700;font-family:'Courier New',monospace;direction:ltr;">${esc(code)}</div>
    </div>
    <div style="background:rgba(245,166,35,0.06);border-right:3px solid #f5a623;border-radius:0 8px 8px 0;padding:10px 14px;font-size:12px;color:#fcd34d;line-height:1.7;">
      ⏱️ صالح <b>${ttlMin} دقيقة</b> فقط · 🔒 لا تشاركه مع أي شخص
    </div>
    <p style="color:rgba(255,255,255,0.4);font-size:12px;margin:14px 0 0;">
      إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة بأمان.
    </p>`;

  return {
    subject: "🔑 رمز التحقق — استعادة قفل الصور",
    html:    baseTemplate({
      senderName:  userName,
      senderEmail: to,
      senderPhoto: userPhoto,
      subject:     "رمز التحقق",
      bodyHtml,
    }),
    text: `رمز التحقق: ${code} (صالح ${ttlMin} دقيقة) — خزنة يومي`,
  };
}

// ─── 2. نموذج تواصل ───────────────────────────────────────────
export function contactTemplate({ senderName, senderEmail, senderPhoto, subject, message }) {
  const bodyHtml = esc(message).replace(/\n/g, "<br>");
  return {
    subject: `[رسالة] ${subject} — ${senderName}`,
    html:    baseTemplate({
      senderName, senderEmail, senderPhoto,
      subject,
      bodyHtml,
    }),
    text: `من: ${senderName} <${senderEmail}>\nالموضوع: ${subject}\n\n${message}`,
  };
}
