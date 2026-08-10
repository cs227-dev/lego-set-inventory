/**
 * Rebrickable client — talks to the proxy, returns objects shaped exactly like
 * the mock constants in set-inventory.jsx.
 */

const BASE = import.meta.env?.VITE_PROXY_URL || "/api/rebrickable";

const memo = new Map(); // in-process cache; the worker holds the durable one

async function get(path, params = {}) {
  // The path rides as a query parameter so the proxy is a plain file with no
  // dynamic-route matching. Trailing slash is stripped here and restored there.
  const clean = path.replace(/\/+$/, "");
  const search = new URLSearchParams({ path: clean, ...params }).toString();
  const url = `${BASE}?${search}`;
  if (memo.has(url)) return memo.get(url);

  const p = (async () => {
    const res = await fetch(url);
    if (res.status === 429) {
      const wait = Number(res.headers.get("Retry-After") || 2) * 1000;
      await sleep(wait);
      memo.delete(url);
      return get(path, params);
    }
    // A routing failure returns an HTML error page, not JSON. Without this
    // check a missing proxy is indistinguishable from a missing set.
    const isJson = (res.headers.get("Content-Type") || "").includes("json");
    if (!isJson) {
      throw new ApiError(
        `The API proxy did not respond at ${BASE}. The serverless function may not be deployed.`,
        res.ok ? 502 : res.status,
        path,
        true
      );
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(body.error || `Request failed (${res.status})`, res.status, path);
    }
    return res.json();
  })();

  memo.set(url, p);
  p.catch(() => memo.delete(url)); // don't cache failures
  return p;
}

export class ApiError extends Error {
  constructor(message, status, path, routing = false) {
    super(message);
    this.status = status;
    this.path = path;
    this.routing = routing; // true = never reached the API
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Walk `next` until the list is complete. Catalog lists are short; cap anyway. */
async function getAll(path, params = {}, maxPages = 20) {
  let out = [];
  let page = 1;
  while (page <= maxPages) {
    const data = await get(path, { ...params, page, page_size: 500 });
    out = out.concat(data.results || []);
    if (!data.next) break;
    page += 1;
  }
  return out;
}

/**
 * Bounded concurrency. The published throttle is 100 calls per 60 seconds, so
 * 2 in flight with a 700ms gap lands around 1.6/s — under the ceiling with room
 * for the browser's own retries. Raise only if you've confirmed your headroom.
 */
async function mapLimit(items, limit, fn, gapMs = 700) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      if (gapMs) await sleep(gapMs);
    }
  });
  await Promise.all(workers);
  return out;
}

/* ----------------------------------------------------------- slot deriving */

/**
 * The API never says "this part is a torso". Two signals, in order:
 *   1. part_cat_id, matched against the live category list (names are stable,
 *      IDs are not worth hard-coding).
 *   2. the part name, which follows a consistent "Minifig <Slot>, ..." pattern.
 * Anything unmatched is an accessory — which is the correct default, since
 * that bucket is genuinely open-ended (blasters, staffs, cups, tools).
 */
let categoryIndex = null;

async function loadCategories() {
  if (categoryIndex) return categoryIndex;
  const cats = await getAll("part_categories/");
  categoryIndex = new Map();
  for (const c of cats) {
    const n = c.name.toLowerCase();
    if (n.includes("head") && !n.includes("headwear") && !n.includes("hair")) categoryIndex.set(c.id, "head");
    else if (n.includes("hair") || n.includes("headwear") || n.includes("hat")) categoryIndex.set(c.id, "hair");
    else if (n.includes("torso")) categoryIndex.set(c.id, "torso");
    else if (n.includes("leg")) categoryIndex.set(c.id, "legs");
  }
  return categoryIndex;
}

const NAME_RULES = [
  [/minifig,? (hair|headgear|headwear|hat|helmet|cap|hood)/i, "hair"],
  [/minifig,? head\b/i, "head"],
  [/minifig,? torso\b/i, "torso"],
  [/minifig,? (leg|hip)/i, "legs"],
];

export function slotOf(part, catIndex) {
  const byCat = catIndex?.get(part.part_cat_id);
  if (byCat) return byCat;
  for (const [re, slot] of NAME_RULES) if (re.test(part.name || "")) return slot;
  return "accessory";
}

/* -------------------------------------------------------------- rarity */

/**
 * num_sets lives on the part/color pairing, not the part alone — a torso mould
 * in one printing can be a one-off while the mould itself is everywhere.
 * One call per unique part+color, deduped across the whole set.
 */
const rarityCache = new Map();

async function rarityFor(partNum, colorId) {
  const key = `${partNum}:${colorId}`;
  if (rarityCache.has(key)) return rarityCache.get(key);
  try {
    const d = await get(`parts/${encodeURIComponent(partNum)}/colors/${colorId}/`);
    const n = d.num_sets ?? 0;
    rarityCache.set(key, n);
    return n;
  } catch {
    rarityCache.set(key, null); // unknown, not zero — the UI must tell these apart
    return null;
  }
}

/**
 * The inventory endpoints already return num_sets on each row, so in the normal
 * case this costs zero extra requests. Only rows missing the field fall back to
 * the part/color lookup — which is what makes a 10-figure set load in ~13 calls
 * instead of ~60.
 */
async function attachRarity(rows) {
  const missing = rows.filter((r) => r.num_sets == null);
  if (missing.length === 0) return rows;

  const unique = [...new Map(missing.map((r) => [`${r.part_num}:${r.color_id}`, r])).values()];
  const counts = await mapLimit(unique, 2, (r) => rarityFor(r.part_num, r.color_id));
  const index = new Map(unique.map((r, i) => [`${r.part_num}:${r.color_id}`, counts[i]]));

  return rows.map((r) =>
    r.num_sets != null ? r : { ...r, num_sets: index.get(`${r.part_num}:${r.color_id}`) }
  );
}

/**
 * Rarity band. num_sets can legitimately be null when a lookup failed, and
 * `null <= 3` is true in JS — so unknown must be checked before any comparison
 * or every unknown part renders as the rarest thing in the set.
 */
export function rarityBand(numSets) {
  if (numSets == null) return "unknown";
  if (numSets <= 3) return "rare";
  if (numSets <= 12) return "uncommon";
  return "common";
}

/* ------------------------------------------------------------ public API */

export async function fetchSet(setNum) {
  const s = await get(`sets/${setNum}/`);
  // The set payload carries theme_id, not the name — resolve it so the header
  // reads "Star Wars" instead of "171". A failed lookup just drops the label.
  let theme = null;
  try {
    if (s.theme_id != null) theme = (await get(`themes/${s.theme_id}/`)).name;
  } catch {
    theme = null;
  }
  return {
    set_num: s.set_num,
    name: s.name,
    year: s.year,
    theme,
    theme_id: s.theme_id,
    num_parts: s.num_parts,
    set_img_url: s.set_img_url,
  };
}

export async function fetchBricks(setNum, { includeSpares = false } = {}) {
  const rows = await getAll(`sets/${setNum}/parts/`, { inc_part_details: 1, inc_minifig_parts: 0 });
  const mapped = rows
    .filter((r) => includeSpares || !r.is_spare)
    .map((r) => ({
      part_num: r.part.part_num,
      name: r.part.name,
      cat: catBucket(r.part.name),
      part_cat_id: r.part.part_cat_id,
      img: r.part.part_img_url,
      color: `#${r.color.rgb}`,
      color_id: r.color.id,
      color_name: r.color.name,
      is_trans: r.color.is_trans,
      quantity: r.quantity,
      element_id: r.element_id,
      num_sets: r.num_sets, // present on inventory rows; attachRarity only fills gaps
    }));
  return attachRarity(mapped);
}

export async function fetchMinifigs(setNum) {
  const [figs, catIndex] = await Promise.all([getAll(`sets/${setNum}/minifigs/`), loadCategories()]);

  const withParts = await mapLimit(figs, 3, async (f) => {
    const rows = await getAll(`minifigs/${f.set_num}/parts/`, { inc_part_details: 1 });
    const parts = rows
      .filter((r) => !r.is_spare)
      .map((r) => ({
        slot: slotOf(r.part, catIndex),
        part_num: r.part.part_num,
        name: r.part.name,
        img: r.part.part_img_url,
        color: `#${r.color.rgb}`,
        color_id: r.color.id,
        color_name: r.color.name,
        quantity: r.quantity,
        num_sets: r.num_sets,
      }));
    return {
      set_num: f.set_num,
      set_name: f.set_name,
      quantity: f.quantity,
      set_img_url: f.set_img_url,
      parts,
    };
  });

  // Rarity across every figure at once, so shared parts cost one call total.
  const flat = withParts.flatMap((f) => f.parts);
  const rated = await attachRarity(flat);
  let k = 0;
  return withParts.map((f) => ({ ...f, parts: f.parts.map(() => rated[k++]) }));
}

export async function fetchInventory(setNum) {
  const [set, minifigs, bricks] = await Promise.all([
    fetchSet(setNum),
    fetchMinifigs(setNum),
    fetchBricks(setNum),
  ]);
  return { set, minifigs, bricks };
}

export async function searchSets(query) {
  const data = await get("sets/", { search: query, page_size: 20 });
  return (data.results || []).filter((s) => s.num_parts > 0);
}

/* Bucket for the brick glyph. Purely cosmetic — name matching is fine here. */
function catBucket(name = "") {
  const n = name.toLowerCase();
  if (/technic/.test(n)) return "technic";
  if (/\bslope|wedge\b/.test(n)) return "slope";
  if (/\btile\b/.test(n)) return "tile";
  if (/round|dish|cone|cylinder/.test(n)) return "round";
  if (/\bplate\b/.test(n)) return "plate";
  if (/\bbrick\b/.test(n)) return "brick";
  return "other";
}
