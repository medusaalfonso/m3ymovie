import { json, getCookie, verifySession, unixNowSeconds } from "./_lib.js";
import crypto from "crypto";

function signBunnyStreamToken({ securityKey, videoId, expires }) {
  // Bunny Stream token format:
  // SHA256(securityKey + videoId + expires)
  const hash = crypto
    .createHash("sha256")
    .update(securityKey + videoId + expires)
    .digest("hex");

  return hash;
}

export async function handler(event) {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(401, { error: "Not logged in" });

    try {
      verifySession(cookie);
    } catch {
      return json(401, { error: "Invalid session" });
    }

    const libraryId = process.env.BUNNY_STREAM_LIBRARY_ID;
    const videoId = process.env.BUNNY_STREAM_VIDEO_ID;
    const key = process.env.BUNNY_STREAM_TOKEN_KEY;

    if (!libraryId || !videoId || !key) {
      return json(500, { error: "Missing Bunny Stream env vars" });
    }

    const expires = unixNowSeconds() + 600; // 10 minutes

    const token = signBunnyStreamToken({
      securityKey: key,
      videoId,
      expires
    });

    const embedUrl =
      `https://iframe.mediadelivery.net/embed/${libraryId}/${videoId}` +
      `?token=${token}&expires=${expires}`;

    return json(200, { embedUrl });
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
