const fs = require("fs/promises");
const path = require("path");
const { json, getCookie, verifySession } = require("./_lib.js");

function makeId(title, url) {
  const s = (title + "|" + url).toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return "m_" + h.toString(16);
}

function parseCatalog(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const parts = line.split("|");
    if (parts.length < 2) continue;

    const title = parts[0].trim();
    const url = parts.slice(1).join("|").trim();

    if (!title || !url) continue;
    items.push({ id: makeId(title, url), title, url, type: "movie" });
  }
  return items;
}

exports.handler = async (event) => {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });
    try { verifySession(cookie); }
    catch { return json(401, { error: "Invalid session" }); }

    // ✅ Correct path for your setup: functions/data/catalog.txt
    // __dirname points to the deployed functions directory
    const filePath = path.join(__dirname, "data", "catalog.txt");
    const raw = await fs.readFile(filePath, "utf-8");

    const items = parseCatalog(raw);
    return json(200, { items });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
