import { json, redisGet, redisDel, signSession } from "./_lib.js";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });

    const { code } = JSON.parse(event.body || "{}");
    const cleaned = (code || "").trim().toUpperCase();

    if (!cleaned || cleaned.length < 8) {
      return json(400, { error: "Invalid code" });
    }

    const key = `code:${cleaned}`;
    const found = await redisGet(key);

    if (!found) return json(401, { error: "Code not found or expired" });

    // single-use: remove immediately
    await redisDel(key);

    // Create session
    const token = signSession({
      type: "viewer",
      issuedAt: Date.now(),
    });

    // Cookie settings
    const cookie = [
      `session=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Max-Age=7200"
    ].join("; ");

    return json(200, { ok: true }, { "Set-Cookie": cookie });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
