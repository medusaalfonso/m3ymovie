import { json, getCookie, verifySession } from "./_lib.js";
import fs from "fs/promises";

function parseCatalog(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const items = [];
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 2) continue;

    const title = parts[0].trim();
    const url = parts.slice(1).join("|").trim(); // لو الرابط فيه | بالغلط

    if (!title || !url) continue;

    items.push({
      id: makeId(title, url),
      title,
      url,
      type: "movie"
    });
  }
  return items;
}

function makeId(title, url) {
  // ID ثابت بدون مكتبات
  const s = (title + "|" + url).toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "m_" + h.toString(16);
}

export async function handler(event) {
  try {
    // حماية بنفس سيشن موقعك (اللي يدخل بكود تيليجرام)
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });
    try { verifySession(cookie); } catch { return json(401, { error: "Invalid session" }); }

    const raw = await fs.readFile(new URL("./data/catalog.txt", import.meta.url), "utf-8");
    const items = parseCatalog(raw);

    return json(200, { items });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
