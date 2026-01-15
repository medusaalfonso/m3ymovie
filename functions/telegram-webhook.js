import { json, makeCode, redisSet } from "./_lib.js";

async function sendTelegramMessage(chatId, message) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) throw new Error("Missing TELEGRAM_BOT_TOKEN");

  const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    }),
  });

  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram sendMessage failed: ${JSON.stringify(data)}`);
}

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // optional secret token check
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
      await sendTelegramMessage(chatId, "Hi! Send /code to get a one-time access code.");
      return json(200, { ok: true });
    }

    if (text === "/code") {
      const code = makeCode();

      // Store for 10 minutes (single use)
      await redisSet(`code:${code}`, JSON.stringify({ chatId, createdAt: Date.now() }), 600);

      await sendTelegramMessage(
        chatId,
        `Your access code (valid 10 minutes, single-use):\n\n${code}\n\nOpen the website and paste it.`
      );

      return json(200, { ok: true });
    }

    await sendTelegramMessage(chatId, "Use /code to get an access code.");
    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
