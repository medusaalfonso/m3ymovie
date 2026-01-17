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
function makeSeriesId(seriesTitle) { return "s_" + hashId(seriesTitle); }
function makeEpisodeId(seriesTitle, epLabel, url) { return "e_" + hashId(seriesTitle + "|" + epLabel + "|" + url); }

function cleanParts(line) {
  return line.split("|").map(p => p.trim()).filter(p => p.length > 0);
}

/** Movies format:
 *  Title | VIDEO_URL (m3u8 OR mp4) | Image_URL (optional) | Category (optional)
 */
function parseMovies(text) {
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

    items.push({
      id: makeMovieId(title, url),
      title,
      url,
      image,
      category,
      type: "movie",
    });
  }

  return items;
}

function extractEpisodeNumber(epLabel) {
  const m = String(epLabel || "").match(/(\d{1,3})/);
  return m ? parseInt(m[1], 10) : null;
}

/** Series format:
 *  Series Name | Episode 17 | HLS_URL | SeriesImageURL | Genre
 */
function parseSeries(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const map = new Map();

  for (const line of lines) {
    const parts = cleanParts(line);
    if (parts.length < 3) continue;

    const seriesTitle = parts[0];
    const epLabel = parts[1];
    const url = parts[2];
    const seriesImage = parts[3] || "";
    const genre = parts[4] || "";

    if (!seriesTitle || !epLabel || !url) continue;

    if (!map.has(seriesTitle)) {
      map.set(seriesTitle, {
        id: makeSeriesId(seriesTitle),
        title: seriesTitle,
        image: seriesImage || "",
        genre: genre || "",
        episodes: [],
      });
    }

    const s = map.get(seriesTitle);
    if (!s.image && seriesImage) s.image = seriesImage;
    if (!s.genre && genre) s.genre = genre;

    const epNum = extractEpisodeNumber(epLabel);
    const epTitle = epNum != null ? `الحلقة ${String(epNum).padStart(2, "0")}` : epLabel;

    s.episodes.push({
      id: makeEpisodeId(seriesTitle, epLabel, url),
      seriesId: s.id,
      seriesTitle,
      title: epTitle,
      ep: epNum,
      url,
    });
  }

  const out = [];
  for (const s of map.values()) {
    s.episodes.sort((a, b) => {
      if (a.ep == null && b.ep == null) return a.title.localeCompare(b.title, "ar");
      if (a.ep == null) return 1;
      if (b.ep == null) return -1;
      return a.ep - b.ep;
    });

    out.push({
      id: s.id,
      title: s.title,
      image: s.image || "",
      genre: s.genre || "",
      count: s.episodes.length,
      episodes: s.episodes,
      type: "series",
    });
  }

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
      fs.readFile(seriesPath, "utf-8").catch(() => ""),
    ]);

    const movies = moviesRaw ? parseMovies(moviesRaw) : [];
    const series = seriesRaw ? parseSeries(seriesRaw) : [];

    const movieCategories = Array.from(
      new Set(movies.map(m => (m.category || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "ar"));

    const seriesGenres = Array.from(
      new Set(series.map(s => (s.genre || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, "ar"));

    return json(200, { movies, series, movieCategories, seriesGenres });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
};
