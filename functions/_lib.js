import jwt from "jsonwebtoken";
import crypto from "crypto";

/** Basic response helpers */
export function json(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

export function getCookie(event, name) {
  const raw = event.headers?.cookie || event.headers?.Cookie;
  if (!raw) return null;

  const parts = raw.split(";").map((p) => p.trim());
  for (const p of parts) {
    const [k, ...v] = p.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** One-time code generator (easy to type) */
export function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(12);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out.match(/.{1,4}/g).join("-");
}

/** Upstash Redis (REST) */
function mustEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export async function redisGet(key) {
  const url = mustEnv("UPSTASH_REDIS_REST_URL");
  const token = mustEnv("UPSTASH_REDIS_REST_TOKEN");

  const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result ?? null;
}

export async function redisSet(key, value, ttlSeconds) {
  const url = mustEnv("UPSTASH_REDIS_REST_URL");
  const token = mustEnv("UPSTASH_REDIS_REST_TOKEN");

  const res = await fetch(
    `${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}?EX=${ttlSeconds}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await res.json();
  return data.result;
}

export async function redisDel(key) {
  const url = mustEnv("UPSTASH_REDIS_REST_URL");
  const token = mustEnv("UPSTASH_REDIS_REST_TOKEN");

  const res = await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  return data.result;
}

/** Session JWT */
export function signSession(payload) {
  const secret = mustEnv("SESSION_JWT_SECRET");
  return jwt.sign(payload, secret, { expiresIn: "2h" });
}

export function verifySession(token) {
  const secret = mustEnv("SESSION_JWT_SECRET");
  return jwt.verify(token, secret);
}

export function unixNowSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function dirnamePath(path) {
  // "/a/b/c.m3u8" -> "/a/b/"
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "/";
  return path.slice(0, idx + 1);
}

/**
 * BunnyCDN Token Auth V2 (path-based)
 * We sign a DIRECTORY token_path (best for HLS) so segments are covered too.
 *
 * NOTE: Bunny expects URL-safe base64 of SHA256(raw) where "raw" input is:
 *   securityKey + signedPath + expires + (optional query string without encoding)
 *
 * We use query params: token_path=/dir/
 * and sign the same.
 */
export function signBunnyTokenV2({ securityKey, signedPath, expires, extraParams = {} }) {
  // sort parameters by key (stable)
  const qp = Object.entries(extraParams)
    .filter(([k]) => k !== "token" && k !== "expires")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&");

  const hashable = `${securityKey}${signedPath}${expires}${qp ? qp : ""}`;

  const raw = crypto.createHash("sha256").update(hashable).digest(); // bytes
  const b64 = Buffer.from(raw).toString("base64");

  // URL safe base64: + -> -, / -> _, strip =
  return b64.replace(/\n/g, "").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
