import { json, makeCode, redisSet } from "./_lib.js";

async function sendTelegramMessage(chatId, text, options = {}) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const payload = {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    ...options,
  };

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // Optional secret token check (recommended)
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const got = event.headers["x-telegram-bot-api-secret-token"];
      if (got !== secret) return json(401, { error: "Bad Telegram secret token" });
    }

    const update = JSON.parse(event.body || "{}");
    const msg = update.message || update.edited_message;
    if (!msg || !msg.chat) return json(200, { ok: true });

    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();

    if (text === "/start") {
      const welcome = `🎬 <b>مرحباً!</b>\n\nللحصول على رمز الدخول اضغط /code`;
      await sendTelegramMessage(chatId, welcome, { parse_mode: "HTML" });
      return json(200, { ok: true });
    }

    if (text === "/code") {
      const code = makeCode();

      // Store for 10 minutes (single-use)
      await redisSet(`code:${code}`, JSON.stringify({ chatId, createdAt: Date.now() }), 600);

      // Message with clickable copy button + code block
      const message = `
<b>🎬 رمز الدخول الخاص بك</b>

اضغط الزر لنسخ الرمز ✅
أو اضغط على الرمز داخل المربع 👇

<code>${code}</code>

<i>⏳ صالح لمدة 10 دقائق (استخدام مرة واحدة)</i>
`.trim();

      const reply_markup = {
        inline_keyboard: [
          [
            // Telegram native "copy to clipboard" button
            { text: "📋 نسخ الرمز", copy_text: { text: code } },
          ],
          [
            // Optional: open your website (replace with your real site if you want)
            // { text: "🌐 فتح الموقع", url: "https://YOUR-SITE.netlify.app" },
          ],
        ],
      };

      await sendTelegramMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup,
      });

      return json(200, { ok: true });
    }

    const help = `استخدم الأمر <b>/code</b> للحصول على رمز الدخول.`;
    await sendTelegramMessage(chatId, help, { parse_mode: "HTML" });
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
