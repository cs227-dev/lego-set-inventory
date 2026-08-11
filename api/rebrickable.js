/**
 * Rebrickable proxy — Vercel serverless function.
 * Keeps the API key on the server and gives the browser a same-origin endpoint,
 * so there's no CORS problem and no key in the bundle.
 *
 * Set REBRICKABLE_KEY in the Vercel dashboard: Settings -> Environment Variables.
 */

export const config = { runtime: "edge" };

/*
 * Called as:  /api/rebrickable?path=sets/41122-1/&inc_part_details=1
 *
 * The path travels as a query parameter rather than as URL segments, so this
 * file needs no square brackets in its name and no catch-all routing — both of
 * which are easy to break when copying files between machines.
 */

const UPSTREAM = "https://rebrickable.com/api/v3/lego";

// Catalog reads only. Nothing here can touch a user account.
const ALLOWED = [
  /^sets\/[\w.-]+\/$/,
  /^sets\/[\w.-]+\/parts\/$/,
  /^sets\/[\w.-]+\/minifigs\/$/,
  /^minifigs\/$/,
  /^minifigs\/[\w.-]+\/parts\/$/,
  /^minifigs\/[\w.-]+\/sets\/$/,
  /^parts\/[\w.-]+\/$/,
  /^parts\/[\w.-]+\/colors\/$/,
  /^parts\/[\w.-]+\/colors\/\d+\/$/,
  /^parts\/[\w.-]+\/colors\/\d+\/sets\/$/,
  /^part_categories\/$/,
  /^themes\/$/,
  /^themes\/\d+\/$/,
  /^colors\/$/,
  /^sets\/$/,
];

const FORWARD = ["page", "page_size", "search", "inc_part_details", "inc_minifig_parts", "inc_color_details",
                 "ordering", "in_set_num", "theme_id", "min_year", "max_year", "min_parts", "max_parts"];

const json = (body, status) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export default async function handler(req) {
  if (req.method !== "GET") return json({ error: "Only GET is supported." }, 405);

  const key = process.env.REBRICKABLE_KEY;
  if (!key) {
    return json(
      { error: "No API key configured. Add REBRICKABLE_KEY in Vercel under Settings, Environment Variables, then redeploy." },
      500
    );
  }

  const url = new URL(req.url);
  const raw = (url.searchParams.get("path") || "").replace(/^\/+/, "").replace(/\/+$/, "");
  if (!raw) return json({ error: "Missing ?path= parameter." }, 400);
  const path = raw + "/"; // Rebrickable requires the trailing slash

  if (!ALLOWED.some((re) => re.test(path))) {
    return json({ error: `Path not available through this proxy: ${path}` }, 403);
  }

  const upstream = new URL(`${UPSTREAM}/${path}`);
  for (const k of FORWARD) {
    const v = url.searchParams.get(k);
    if (v !== null) upstream.searchParams.set(k, v);
  }

  let res;
  try {
    res = await fetch(upstream.toString(), {
      headers: { Authorization: `key ${key}`, Accept: "application/json" },
    });
  } catch {
    return json({ error: "Could not reach Rebrickable. Try again." }, 502);
  }

  if (res.status === 401 || res.status === 403) {
    return json({ error: "Rebrickable rejected the API key. Check REBRICKABLE_KEY is correct." }, 502);
  }
  if (res.status === 429) {
    return json({ error: "Rate limited upstream.", retry_after: res.headers.get("Retry-After") }, 429);
  }
  if (!res.ok) {
    return json({ error: `Rebrickable returned ${res.status}.` }, res.status);
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      // Catalog data barely changes; cache hard at the edge.
      "Cache-Control": "public, max-age=86400, s-maxage=2592000",
    },
  });
}
