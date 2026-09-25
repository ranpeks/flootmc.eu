import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const resendApiKey = Deno.env.get("RESEND_API_KEY");
const allowedOrigins = new Set(["https://flootmc.eu", "https://www.flootmc.eu"]);
const categoryNames: Record<string, string> = {
  plugin: "Zamówienie pluginu",
  bot: "Zamówienie bota Discord",
  website: "Zamówienie strony",
  anticheat: "Pytanie o AntiCheat",
  cooperation: "Współpraca",
  other: "Inne",
};
const lastSubmissionByIp = new Map<string, number>();

function json(body: unknown, status = 200, origin = "https://flootmc.eu") {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function textField(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function escapeHtml(value: string) {
  const entities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '\"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => entities[character] ?? character);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("Origin") ?? "";
  if (!allowedOrigins.has(origin)) return json({ success: false, message: "Nieprawidłowe źródło żądania." }, 403);
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin",
    },
  });
  if (req.method !== "POST") return json({ success: false, message: "Nieobsługiwana metoda." }, 405, origin);
  if (!resendApiKey) return json({ success: false, message: "Formularz jest chwilowo niedostępny. Napisz na kontakt@flootmc.eu." }, 503, origin);

  const contentLength = Number(req.headers.get("Content-Length") ?? 0);
  if (contentLength > 12_000) return json({ success: false, message: "Wiadomość jest zbyt długa." }, 413, origin);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ success: false, message: "Nieprawidłowe dane formularza." }, 400, origin);
  }

  // Bots that fill the visually hidden field are silently accepted without sending mail.
  if (textField(body.website, 500)) return json({ success: true, message: "Dziękujemy za wiadomość." }, 200, origin);

  const name = textField(body.name, 100);
  const email = textField(body.email, 254).toLowerCase();
  const subject = typeof body.subject === "string" ? body.subject : "";
  const message = textField(body.message, 5000);
  if (!name || !email || !categoryNames[subject] || !message) {
    return json({ success: false, message: "Uzupełnij wszystkie pola poprawnymi danymi." }, 400, origin);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ success: false, message: "Podaj poprawny adres email." }, 400, origin);
  }

  const forwardedFor = req.headers.get("x-forwarded-for") ?? "unknown";
  const clientKey = forwardedFor.split(",")[0].trim().slice(0, 80) || "unknown";
  const now = Date.now();
  const previous = lastSubmissionByIp.get(clientKey) ?? 0;
  if (now - previous < 30_000) return json({ success: false, message: "Odczekaj chwilę przed wysłaniem kolejnej wiadomości." }, 429, origin);
  lastSubmissionByIp.set(clientKey, now);
  if (lastSubmissionByIp.size > 2000) {
    for (const [key, timestamp] of lastSubmissionByIp) {
      if (now - timestamp > 60_000) lastSubmissionByIp.delete(key);
    }
  }

  const escaped = { name: escapeHtml(name), email: escapeHtml(email), subject: escapeHtml(categoryNames[subject]), message: escapeHtml(message) };
  const plainText = `Nowa wiadomość z portfolio FlootMC\n\nImię / nick: ${name}\nEmail: ${email}\nTemat: ${categoryNames[subject]}\n\nWiadomość:\n${message}`;
  const html = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Nowa wiadomość z portfolio</title></head><body style="margin:0;background:#0a0a0f;color:#e2e2e2;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0f;padding:24px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#12121a;border:1px solid #1e1e30;border-radius:16px"><tr><td style="padding:28px;font-size:16px;line-height:1.6;color:#e2e2e2"><h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:#ffffff">Nowa wiadomość z portfolio</h1><p style="margin:0 0 8px"><strong>Imię / nick:</strong> ${escaped.name}</p><p style="margin:0 0 8px"><strong>Email:</strong> ${escaped.email}</p><p style="margin:0 0 16px"><strong>Temat:</strong> ${escaped.subject}</p><h2 style="margin:0 0 8px;font-size:17px;line-height:1.4;color:#ffffff">Wiadomość</h2><p style="margin:0;white-space:pre-wrap;overflow-wrap:anywhere">${escaped.message}</p></td></tr></table></td></tr></table></body></html>`;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "FlootMC Kontakt <kontakt@flootmc.eu>",
        to: ["kontakt@flootmc.eu"],
        reply_to: email,
        subject: `[Portfolio] ${categoryNames[subject]}`,
        text: plainText,
        html,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return json({ success: false, message: "Nie udało się wysłać wiadomości. Spróbuj ponownie lub napisz na kontakt@flootmc.eu." }, response.status === 429 ? 429 : 502, origin);
    }
    return json({ success: true, message: "Dziękujemy za wiadomość. Została wysłana do FlootMC." }, 200, origin);
  } catch {
    return json({ success: false, message: "Nie udało się wysłać wiadomości. Spróbuj ponownie lub napisz na kontakt@flootmc.eu." }, 502, origin);
  }
});
