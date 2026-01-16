const fs = require("fs/promises");
const path = require("path");
const { json, getCookie, verifySession } = require("./_lib.js");

function hashId(s) {
  s = String(s || "").toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

function makeMovieId(title, url) {
  return "m_" + hashId(title + "|" + url);
}
function makeSeriesId(seriesTitle) {
  return "s_" + hashId(seriesTitle);
}
function makeEpisodeId(seriesTitle, epLabel, url) {
  return "e_" + hashId(seriesTitle + "|" + epLabel + "|" + url);
}

function parseMovies(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const items = [];

  for (const line of lines) {
    const parts = line.split("|").map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;

    const title = parts[0];
    const url = parts[1];
    const image = parts[2] || "";

    if (!title || !url) continue;

    items.push({
      id: makeMovieId(title, url),
      title,
      url,
      image,
      type: "movie"
    });
  }
  return items;
}

function extractEpisodeNumber(epLabel) {
  // Works with: "EP Episode 01", "Episode 2", "EP 03", etc.
  const m = String(epLabel || "").match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
}

function parseSeries(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Map seriesTitle -> {id,title,episodes:[]}
  const map = new Map();

  for (const line of lines) {
    const parts = line.split("|").map(p => p.trim()).filter(Boolean);
    if (parts.length < 3) continue;

    const seriesTitle = parts[0];
    const epLabel = parts[1];      // "EP  Episode 01"
    const url = parts[2];

    if (!seriesTitle || !epLabel || !url) continue;

    const seriesId = makeSeriesId(seriesTitle);
    const epNum = extractEpisodeNumber(epLabel);
    const episodeTitle = epNum ? `الحلقة ${String(epNum).padStart(2, "0")}` : epLabel;

    const episode = {
      id: makeEpisodeId(seriesTitle, epLabel, url),
      seriesId,
      seriesTitle,
      title: episodeTitle,
      ep: epNum,
      url
    };

    if (!map.has(seriesTitle)) {
      map.set(seriesTitle, { id: seriesId, title: seriesTitle, episodes: [] });
    }
    map.get(seriesTitle).episodes.push(episode);
  }

  // Sort episodes and create final list
  const out = [];
  for (const s of map.values()) {
    s.episodes.sort((a, b) => {
      if (a.ep == null && b.ep == null) return a.title.localeCompare(b.title);
      if (a.ep == null) return 1;
      if (b.ep == null) return -1;
      return a.ep - b.ep;
    });
    out.push({
      id: s.id,
      title: s.title,
      count: s.episodes.length,
      episodes: s.episodes
    });
  }

  // Sort series alphabetically
  out.sort((a, b) => a.title.localeCompare(b.title, "ar"));
  return out;
}

exports.handler = async (event) => {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });
    try { verifySession(cookie); }
    catch { return json(401, { error: "Invalid session" }); }

    const moviesPath = path.join(__dirname, "data", "catalog.txt");
    const seriesPath = path.join(__dirname, "data", "series.txt");

    const [moviesRaw, seriesRaw] = await Promise.all([
      fs.readFile(moviesPath, "utf-8").catch(() => ""),
      fs.readFile(seriesPath, "utf-8").catch(() => "")
    ]);

    const movies = moviesRaw ? parseMovies(moviesRaw) : [];
    const series = seriesRaw ? parseSeries(seriesRaw) : [];

    return json(200, { movies, series });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
