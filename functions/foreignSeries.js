import fs from "fs";
import path from "path";
import crypto from "crypto";

function parseSubs(subsRaw) {
  if (!subsRaw) return [];

  const parts = subsRaw
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

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

// Generate a short unique ID from a string
function generateId(str, prefix = 'fe') {
  const hash = crypto.createHash('md5').update(str).digest('hex');
  return `${prefix}_${hash.substring(0, 8)}`;
}

export async function handler() {
  try {
    const filePath = path.join(process.cwd(), "functions/data/foreign-series.txt");
    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const map = {};
    let globalEpisodeIndex = 0;

    for (const line of lines) {
      const parts = line.split("|").map(v => v.trim());

      const seriesTitle = parts[0];
      const epTitle = parts[1];
      const hlsUrl = parts[2];
      const image = parts[3] || "";
      const subsRaw = parts[4] || "";

      if (!seriesTitle || !epTitle || !hlsUrl) continue;

      if (!map[seriesTitle]) {
        map[seriesTitle] = {
          id: generateId(seriesTitle, 'fs'), // Generate series ID
          title: seriesTitle,
          image,
          episodes: []
        };
      }

      map[seriesTitle].episodes.push({
        id: generateId(`${seriesTitle}_${epTitle}_${globalEpisodeIndex}`, 'fe'), // Generate episode ID
        title: epTitle,
        hlsUrl,
        url: hlsUrl, // Add url field for compatibility
        subs: parseSubs(subsRaw)
      });
      
      globalEpisodeIndex++;
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.values(map))
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: e.message })
    };
  }
}
