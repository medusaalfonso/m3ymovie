const fs = require("fs/promises");
const path = require("path");
const { json, getCookie, verifySession } = require("./_lib.js");

function isBunnyEmbed(url) {
  const u = String(url || "").toLowerCase();
  return u.includes("player.mediadelivery.net/embed/");
}

function isVideasEmbed(url) {
  const u = String(url || "").toLowerCase();
  return u.includes("videas.fr/embed/");
}

function detectKind(url) {
  const u = String(url || "").toLowerCase();
  if (isBunnyEmbed(u)) return "bunny_embed";
  if (isVideasEmbed(u)) return "videas_embed";
  if (u.includes(".m3u8")) return "hls";
  if (u.includes(".mp4")) return "mp4";
  // fallback: many sources redirect to HLS
  return "hls";
}

// Parse movies from catalog.txt
// Format: Title | URL | Image | Category
function parseMoviesFromFile(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const movies = [];
  
  lines.forEach((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 2) return;
    
    movies.push({
      id: `m_file_${idx}`,
      title: parts[0] || '',
      url: parts[1] || '',
      image: parts[2] || '',
      category: parts[3] || 'أفلام'
    });
  });
  
  return movies;
}

// Parse episodes from series.txt
// Format: Series Name | Episode Name | URL | Poster | Genre | Subs
function parseEpisodesFromFile(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const episodes = [];
  
  lines.forEach((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 3) return;
    
    const seriesName = parts[0] || '';
    const episodeName = parts[1] || '';
    const url = parts[2] || '';
    const poster = parts[3] || '';
    const genre = parts[4] || '';
    const subsRaw = parts[5] || '';
    
    if (!seriesName) return;
    
    // Parse subs
    const subs = subsRaw ? subsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    
    episodes.push({
      id: `e_file_${idx}`,
      title: episodeName,
      seriesTitle: seriesName,
      url: url,
      image: poster,
      genre: genre,
      subs: subs.map((s, i) => ({
        lang: `s${i+1}`,
        label: `SUB ${i+1}`,
        url: s
      }))
    });
  });
  
  return episodes;
}

// Parse foreign episodes from foreign-series.txt
// Format: Series Name | Episode Name | URL | Poster | Subs
function parseForeignEpisodesFromFile(text) {
  const crypto = require('crypto');
  
  function generateId(str, prefix = 'fe') {
    const hash = crypto.createHash('md5').update(str).digest('hex');
    return `${prefix}_${hash.substring(0, 8)}`;
  }
  
  function parseSubs(subsRaw) {
    if (!subsRaw) return [];
    const parts = subsRaw.split(",").map(s => s.trim()).filter(Boolean);
    
    return parts.map((p, idx) => {
      // labeled: "en:https://...vtt"
      if (!p.startsWith("http") && p.includes(":")) {
        const firstColon = p.indexOf(":");
        const lang = p.slice(0, firstColon).trim();
        const url = p.slice(firstColon + 1).trim();
        return {
          lang: (lang || `s${idx + 1}`).toLowerCase(),
          label: (lang || `SUB${idx + 1}`).toUpperCase(),
          url
        };
      }
      
      // plain url: "https://...vtt"
      return {
        lang: `s${idx + 1}`,
        label: `SUB ${idx + 1}`,
        url: p
      };
    });
  }
  
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const episodes = [];
  let globalEpisodeIndex = 0;
  
  lines.forEach((line) => {
    const parts = line.split('|').map(p => p.trim());
    if (parts.length < 3) return;
    
    const seriesTitle = parts[0] || '';
    const epTitle = parts[1] || '';
    const hlsUrl = parts[2] || '';
    const image = parts[3] || '';
    const subsRaw = parts[4] || '';
    
    if (!seriesTitle || !epTitle || !hlsUrl) return;
    
    episodes.push({
      id: generateId(`${seriesTitle}_${epTitle}_${globalEpisodeIndex}`, 'fe'),
      title: `${seriesTitle} — ${epTitle}`,
      url: hlsUrl,
      image: image,
      subs: parseSubs(subsRaw)
    });
    
    globalEpisodeIndex++;
  });
  
  return episodes;
}

// Redis helper function
async function redisCommand(command, ...args) {
  const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
  const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
  
  if (!REDIS_URL || !REDIS_TOKEN) return null;
  
  try {
    const response = await fetch(`${REDIS_URL}/${command}/${args.map(a => encodeURIComponent(a)).join('/')}`, {
      headers: { 'Authorization': `Bearer ${REDIS_TOKEN}` }
    });
    const data = await response.json();
    return data.result;
  } catch (e) {
    console.error('Redis error:', e);
    return null;
  }
}

// Convert Redis HGETALL array to object
function parseRedisHash(arr) {
  if (!arr || arr.length === 0) return null;
  const obj = {};
  for (let i = 0; i < arr.length; i += 2) {
    obj[arr[i]] = arr[i + 1];
  }
  return obj;
}

exports.handler = async (event) => {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });
    try { verifySession(cookie); }
    catch { return json(401, { error: "Invalid session" }); }

    const id = (event.queryStringParameters?.id || "").trim();
    if (!id) return json(400, { error: "Missing id" });

    // ============================================
    // Handle Movie IDs (m_*)
    // ============================================
    if (id.startsWith("m_")) {
      
      // Check if it's a file-based ID (m_file_X)
      if (id.startsWith("m_file_")) {
        const moviesPath = path.join(__dirname, "data", "catalog.txt");
        const raw = await fs.readFile(moviesPath, "utf-8");
        const movies = parseMoviesFromFile(raw);
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
      
      // Otherwise, it's a Redis-based ID (from admin upload)
      const redisData = await redisCommand('HGETALL', `movie:${id}`);
      const movie = parseRedisHash(redisData);
      
      if (movie && movie.url) {
        const kind = detectKind(movie.url);
        return json(200, {
          title: movie.title || "",
          url: movie.url,
          kind,
          image: movie.image || "",
          category: movie.category || ""
        });
      }
      
      return json(404, { error: "Not found" });
    }

    // ============================================
    // Handle Episode IDs (e_*)
    // ============================================
    if (id.startsWith("e_")) {
      
      // Check if it's a file-based ID (e_file_X)
      if (id.startsWith("e_file_")) {
        const seriesPath = path.join(__dirname, "data", "series.txt");
        const raw = await fs.readFile(seriesPath, "utf-8");
        const episodes = parseEpisodesFromFile(raw);
        const ep = episodes.find(x => x.id === id);
        
        if (!ep) return json(404, { error: "Not found" });

        const kind = detectKind(ep.url);
        return json(200, {
          title: `${ep.seriesTitle} — ${ep.title}`,
          url: ep.url,
          kind,
          image: ep.image || "",
          subs: ep.subs || []
        });
      }
      
      // Otherwise, it's a Redis-based ID (from admin upload)
      const redisData = await redisCommand('HGETALL', `episode:${id}`);
      const episode = parseRedisHash(redisData);
      
      if (episode && episode.url) {
        const kind = detectKind(episode.url);
        
        // Parse subs if stored as JSON string
        let subs = [];
        if (episode.subs) {
          try {
            subs = JSON.parse(episode.subs);
          } catch (e) {
            subs = [];
          }
        }
        
        return json(200, {
          title: episode.title || "",
          url: episode.url,
          kind,
          subs: subs
        });
      }
      
      return json(404, { error: "Not found" });
    }

    // ============================================
    // Handle Foreign Episode IDs (fe_*)
    // ============================================
    if (id.startsWith("fe_")) {
      // First, try Redis (admin uploads)
      const redisData = await redisCommand('HGETALL', `episode:${id}`);
      const episode = parseRedisHash(redisData);
      
      if (episode && episode.url) {
        const kind = detectKind(episode.url);
        
        // Parse subs if stored as JSON string
        let subs = [];
        if (episode.subs) {
          try {
            subs = JSON.parse(episode.subs);
          } catch (e) {
            subs = [];
          }
        }
        
        return json(200, {
          title: episode.title || "",
          url: episode.url,
          kind,
          subs: subs
        });
      }
      
      // If not in Redis, check foreign-series.txt file
      const foreignPath = path.join(__dirname, "data", "foreign-series.txt");
      try {
        const content = await fs.readFile(foreignPath, "utf-8");
        const foreignEpisodes = parseForeignEpisodesFromFile(content);
        const foundEp = foreignEpisodes.find(x => x.id === id);
        
        if (foundEp) {
          const kind = detectKind(foundEp.url);
          return json(200, {
            title: foundEp.title || "",
            url: foundEp.url,
            kind,
            subs: foundEp.subs || []
          });
        }
      } catch (e) {
        // File doesn't exist or error reading it, continue
      }
      
      return json(404, { error: "Not found" });
    }

    return json(400, { error: "Invalid id format" });
    
  } catch (e) {
    console.error('Stream error:', e);
    return json(500, { error: e.message || String(e) });
  }
};
