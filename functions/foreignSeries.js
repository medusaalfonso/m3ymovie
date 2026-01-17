import fs from "fs";
import path from "path";

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

export async function handler() {
  try {
    const filePath = path.join(process.cwd(), "functions/data/foreign-series.txt");
    const content = fs.readFileSync(filePath, "utf-8");

    const lines = content
      .split("\n")
      .map(l => l.trim())
      .filter(Boolean);

    const map = {};

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
          title: seriesTitle,
          image,
          episodes: []
        };
      }

      map[seriesTitle].episodes.push({
        title: epTitle,
        hlsUrl,
        subs: parseSubs(subsRaw)
      });
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
