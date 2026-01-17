const fs = require("fs/promises");
const path = require("path");
const { json, getCookie, verifySession } = require("./_lib.js");

function hashId(s) {
  s = String(s || "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
function makeMovieId(title, url) { return "m_" + hashId(title + "|" + url); }
function makeEpisodeId(seriesTitle, epLabel, url) { return "e_" + hashId(seriesTitle + "|" + epLabel + "|" + url); }

function cleanParts(line) {
  return line.split("|").map(p => p.trim()).filter(p => p.length > 0);
}

function isBunnyEmbed(url) {
  const u = String(url || "").toLowerCase();
  return u.includes("player.mediadelivery.net/embed/");
}

function detectKind(url) {
  const u = String(url || "").toLowerCase();
  if (isBunnyEmbed(u)) return "bunny_embed";
  if (u.includes(".m3u8")) return "hls";
  if (u.includes(".mp4")) return "mp4";
  // fallback: many sources redirect to HLS
  return "hls";
}

function parseMovies(text) {
  // Movie format:
  // Title | VIDEO_URL (m3u8 OR mp4 OR bunny embed) | Image_URL (optional) | Category (optional)
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];
  for (const line of lines) {
    const parts = cleanParts(line);
    if (parts.length < 2) continue;

    const title = parts[0];
    const url = parts[1];
    const image = parts[2] || "";
    const category = parts[3] || "أفلام";

    if (!title || !url) continue;

    items.push({ id: makeMovieId(title, url), title, url, image, category });
  }
  return items;
}

function extractEpisodeNumber(epLabel) {
  const m = String(epLabel || "").match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
}

function parseEpisodes(text) {
  // Series format:
  // Series Name | Episode 17 | VIDEO_URL | SeriesImageURL | Genre
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const eps = [];
  for (const line of lines) {
    const parts = cleanParts(line);
    if (parts.length < 3) continue;

    const seriesTitle = parts[0];
    const epLabel = parts[1];
    const url = parts[2];

    if (!seriesTitle || !epLabel || !url) continue;

    const epNum = extractEpisodeNumber(epLabel);
    const epTitle = epNum != null ? `الحلقة ${String(epNum).padStart(2, "0")}` : epLabel;

    eps.push({
      id: makeEpisodeId(seriesTitle, epLabel, url),
      title: `${seriesTitle} — ${epTitle}`,
      url
    });
  }
  return eps;
}

exports.handler = async (event) => {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });
    try { verifySession(cookie); }
    catch { return json(401, { error: "Invalid session" }); }

    const id = (event.queryStringParameters?.id || "").trim();
    if (!id) return json(400, { error: "Missing id" });

    const moviesPath = path.join(__dirname, "data", "catalog.txt");
    const seriesPath = path.join(__dirname, "data", "series.txt");

    if (id.startsWith("m_")) {
      const raw = await fs.readFile(moviesPath, "utf-8");
      const movies = parseMovies(raw);
      const item = movies.find(x => x.id === id);
      if (!item) return json(404, { error: "Not found" });

      const kind = detectKind(item.url);

      return json(200, {
        title: item.title,
        url: item.url,
        kind,
        image: item.image || "",
        category: item.category || ""
      });
    }

    if (id.startsWith("e_")) {
      const raw = await fs.readFile(seriesPath, "utf-8");
      const eps = parseEpisodes(raw);
      const ep = eps.find(x => x.id === id);
      if (!ep) return json(404, { error: "Not found" });

      const kind = detectKind(ep.url);

      return json(200, {
        title: ep.title,
        url: ep.url,
        kind
      });
    }

    return json(400, { error: "Invalid id" });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
