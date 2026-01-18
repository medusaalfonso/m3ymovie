export default async (req, context) => {
  try {
    const url = new URL(req.url);
    const target = url.searchParams.get("url");
    if (!target) {
      return new Response("Missing url", { status: 400 });
    }

    // Only allow https
    if (!/^https:\/\//i.test(target)) {
      return new Response("Invalid url", { status: 400 });
    }

    const r = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/vtt,*/*"
      }
    });

    if (!r.ok) {
      return new Response("Failed to fetch subtitle", { status: 502 });
    }

    const vtt = await r.text();

    return new Response(vtt, {
      status: 200,
      headers: {
        "Content-Type": "text/vtt; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (e) {
    return new Response("Server error", { status: 500 });
  }
};
