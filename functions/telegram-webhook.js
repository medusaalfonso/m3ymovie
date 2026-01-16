const { json, makeCode, redisSet } = require("./_lib.js");

// --- Telegram helpers ---
async function tg(method, token, body) {
  const url = `https://api.telegram.org/bot${token}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Telegram ${method} failed: ${JSON.stringify(data)}`);
  return data;
}

function isMemberStatus(status) {
  // member | administrator | creator are allowed
  return status === "member" || status === "administrator" || status === "creator";
}

async function checkRequiredChannelMembership(env, userId) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const channel = env.REQUIRED_CHANNEL; // @username or -100...
  if (!channel) return { ok: true };    // if not set, skip check

  try {
    const r = await tg("getChatMember", botToken, {
      chat_id: channel,
      user_id: userId,
    });

    const status = r.result?.status;
    if (isMemberStatus(status)) return { ok: true, status };

    return { ok: false, status: status || "unknown" };
  } catch (e) {
    // Common causes: bot not in channel / not admin / wrong channel id
    return { ok: false, error: e.message || String(e) };
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    // Optional secret token check (recommended)
    const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (secret) {
      const got = event.headers["x-telegram-bot-api-secret-token"];
      if (got !== secret) return json(401, { error: "Bad Telegram secret token" });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) return json(500, { error: "Missing TELEGRAM_BOT_TOKEN" });

    const update = JSON.parse(event.body || "{}");
    const msg = update.message || update.edited_message;
    if (!msg?.chat?.id) return json(200, { ok: true });

    const chatId = msg.chat.id;
    const userId = msg.from?.id;
    const text = (msg.text || "").trim();

    // /start
    if (text === "/start") {
      await tg("sendMessage", botToken, {
        chat_id: chatId,
        text: "🎬 مرحباً!\n\nللحصول على رمز الدخول ارسل:\n/code",
      });
      return json(200, { ok: true });
    }

    // /code
    if (text === "/code") {
      if (!userId) {
        await tg("sendMessage", botToken, {
          chat_id: chatId,
          text: "حدث خطأ: لم يتم التعرف على المستخدم.",
        });
        return json(200, { ok: true });
      }

      // ✅ Membership check
      const check = await checkRequiredChannelMembership(process.env, userId);

      if (!check.ok) {
        // If you have a public channel, you can set a join link in env:
        // CHANNEL_JOIN_URL=https://t.me/YourChannelUsername
        const joinUrl = process.env.CHANNEL_JOIN_URL || "";

        let message = "⚠️ لازم تكون مشترك في القناة أولاً للحصول على رمز الدخول.";
        if (check.error) {
          message += "\n\n(ملاحظة للمشرف: تأكد أن البوت داخل القناة وعنده صلاحية Admin، وأن REQUIRED_CHANNEL صحيح.)";
        }

        const reply_markup = joinUrl
          ? { inline_keyboard: [[{ text: "✅ اشترك في القناة", url: joinUrl }]] }
          : undefined;

        await tg("sendMessage", botToken, {
          chat_id: chatId,
          text: message,
          ...(reply_markup ? { reply_markup } : {}),
        });

        return json(200, { ok: true });
      }

      // Create code
      const code = makeCode();

      // Store in Redis (10 minutes) - your existing helper
      await redisSet(`code:${code}`, JSON.stringify({ userId, createdAt: Date.now() }), 600);

      const siteUrl = process.env.SITE_URL || "";

      const message =
`🎬 *رمز الدخول الخاص بك*
اضغط زر النسخ ✅ ثم ارجع للموقع

\`${code}\`

⏳ صالح لمدة 10 دقائق (مرة واحدة)`;

      const reply_markup = {
        inline_keyboard: [
          [{ text: "📋 نسخ الرمز", copy_text: { text: code } }],
          ...(siteUrl ? [[{ text: "🌐 فتح الموقع", url: siteUrl }]] : []),
        ],
      };

      await tg("sendMessage", botToken, {
        chat_id: chatId,
        text: message,
        parse_mode: "Markdown",
        reply_markup,
      });

      return json(200, { ok: true });
    }

    // default help
    await tg("sendMessage", botToken, {
      chat_id: chatId,
      text: "استخدم /code للحصول على رمز الدخول.",
    });

    return json(200, { ok: true });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
