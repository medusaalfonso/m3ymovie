import { json, getCookie, verifySession } from "./_lib.js";

export async function handler(event) {
  try {
    const cookie = getCookie(event, "session");
    if (!cookie) return json(200, { loggedIn: false });

    try {
      const payload = verifySession(cookie);
      return json(200, { loggedIn: true, payload });
    } catch {
      return json(200, { loggedIn: false });
    }
  } catch (e) {
    return json(500, { error: e.message || String(e) });
  }
}
