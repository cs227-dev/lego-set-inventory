import React, { useState, useMemo, useEffect } from "react";
import Browse from "./Browse.jsx";
import SearchResults from "./SearchResults.jsx";
import { fetchPartColorSets } from "./lib/rebrickable.js";

/* ============================================================================
   SET INVENTORY — drill-down prototype

   All data below is MOCK, but shaped exactly like the Rebrickable v3 JSON so
   you can swap in real calls without touching the components:

     GET /api/v3/lego/sets/{set_num}/                 -> set
     GET /api/v3/lego/sets/{set_num}/parts/           -> inventory (bricks)
     GET /api/v3/lego/sets/{set_num}/minifigs/        -> minifig roster
     GET /api/v3/lego/minifigs/{fig_num}/parts/       -> per-figure components
     GET /api/v3/lego/parts/{part_num}/colors/        -> num_sets (rarity)

   Part numbers and fig numbers here are placeholders for layout purposes.
   ========================================================================== */

const C = {
  backdrop: "#E4E1DA",
  panel: "#FAF9F6",
  panelEdge: "#D3CFC6",
  ink: "#17171A",
  inkSoft: "#4A4842",
  muted: "#807C74",
  azure: "#0A6EA8",
  flag: "#C2371B",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;800&family=JetBrains+Mono:wght@400;500;700&display=swap');
`;
const display = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
const mono = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

/* ---------------------------------------------------------------- mock data */

/* ------------------------------------------------------------------ helpers */

// In the real API, derive the slot from part_cat_id or the part name prefix
// ("Minifig Head", "Minifig Torso", "Minifig Hair", ...). Everything that
// doesn't match a body slot is an accessory.
const SLOT_ORDER = ["hair", "head", "torso", "skirt", "legs", "accessory"];

/**
 * Mini-dolls are a different mould entirely — taller, narrower, with slimmer
 * limbs — so drawing them with minifig proportions looks wrong. The part names
 * tell us which family we're in.
 */
function figFamily(fig) {
  return (fig?.parts || []).some((p) => /mini\s?doll/i.test(p.name || "")) ? "minidoll" : "minifig";
}
const SLOT_LABEL = { hair: "Headgear", head: "Head", torso: "Torso", skirt: "Skirt", legs: "Legs", accessory: "Accessory" };

// num_sets is null when a rarity lookup failed. `null <= 3` is true in JS, so
// the unknown case must be handled before any comparison — otherwise every part
// with a failed lookup is badged as the rarest thing in the set.
function rarity(numSets) {
  if (numSets == null) return { label: "Rarity unknown", tone: C.muted, note: null, rare: false };
  if (numSets <= 3) return { label: "Rare", tone: C.flag, note: `${numSets} set${numSets === 1 ? "" : "s"}`, rare: true };
  if (numSets <= 12) return { label: "Uncommon", tone: C.azure, note: `${numSets} sets`, rare: false };
  return { label: "Common", tone: C.muted, note: `${numSets} sets`, rare: false };
}

/**
 * A rare part that appears in more than one set is a navigation opportunity:
 * the other sets are the interesting bit. Unique parts (1 set) have nowhere to
 * go, so they get no control.
 */
function OtherSets({ part, onOpenSet }) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(null);
  const [err, setErr] = useState(null);

  const eligible = onOpenSet && part.num_sets != null && part.num_sets > 1 && part.num_sets <= 3 && part.color_id != null;

  useEffect(() => {
    if (!open || sets) return;
    let live = true;
    fetchPartColorSets(part.part_num, part.color_id)
      .then((r) => live && setSets(r))
      .catch((e) => live && setErr(e.message || "Could not load sets."));
    return () => { live = false; };
  }, [open, sets, part.part_num, part.color_id]);

  if (!eligible) return null;

  return (
    <span className="block mt-1">
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase",
                 background: "transparent", border: "none", padding: 0, cursor: "pointer",
                 color: C.azure, textDecoration: "underline" }}
      >
        {open ? "Hide other sets" : `Also in ${part.num_sets - 1} other set${part.num_sets - 1 === 1 ? "" : "s"}`}
      </button>
      {open && (
        <span className="block mt-1">
          {err ? (
            <Stamp tone={C.flag}>{err}</Stamp>
          ) : !sets ? (
            <Stamp>LOADING</Stamp>
          ) : (
            sets.map((s) => (
              <button
                key={s.set_num}
                onClick={() => onOpenSet(s.set_num)}
                className="block text-left w-full px-2 py-1 mt-1"
                style={{ border: `1px solid ${C.panelEdge}`, borderRadius: 2, background: "transparent", cursor: "pointer" }}
              >
                <span style={{ fontFamily: display, fontSize: 11, color: C.ink, overflowWrap: "anywhere" }}>{s.name}</span>
                <span className="flex gap-2 mt-0.5"><Stamp>{s.set_num}</Stamp><Stamp>{s.year}</Stamp></span>
              </button>
            ))
          )}
        </span>
      )}
    </span>
  );
}

/** Single source of truth for "should this be flagged". */
const isRare = (numSets) => numSets != null && numSets <= 3;

const sortSlots = (parts) =>
  [...parts].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    // Guarded: a missing matchMedia would otherwise crash the whole panel.
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

/* ------------------------------------------------------- minifig geometry */
/* Each body slot draws at a fixed y. Exploding just adds a vertical offset,
   so the same renderer serves the card thumbnail and the detail diagram. */

const GEO = {
  hair: { y: 30, explode: -46 },
  head: { y: 56, explode: -18 },
  torso: { y: 92, explode: 0 },
  skirt: { y: 146, explode: 22 },
  legs: { y: 152, explode: 34 },
  accessory: { y: 108, explode: 70 },
};

function SlotShape({ slot, color, cx = 100, dy = 0, family = "minifig" }) {
  const stroke = "rgba(0,0,0,0.34)";
  const g = GEO[slot] || GEO.accessory;
  const y = g.y + dy;
  const doll = family === "minidoll";

  // Hands and neck read as skin; approximating them from the torso colour
  // looks wrong on printed torsos, so they stay neutral.
  const skin = "#F6D7B3";

  if (slot === "hair")
    return doll ? (
      // Mini-doll hair is longer and falls past the shoulders.
      <g>
        <path d={`M ${cx - 19} ${y + 20} q -5 -28 19 -28 q 24 0 19 28 q -5 -10 -19 -10 q -14 0 -19 10 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx - 20} ${y + 16} q -6 30 2 46 l 9 -3 q -6 -20 -2 -40 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
        <path d={`M ${cx + 20} ${y + 16} q 6 30 -2 46 l -9 -3 q 6 -20 2 -40 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
      </g>
    ) : (
      <g>
        <path d={`M ${cx - 21} ${y + 22} q -3 -26 21 -26 q 24 0 21 26 q -6 -9 -21 -9 q -15 0 -21 9 z`} fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    );

  if (slot === "head")
    return doll ? (
      // Narrower, more rounded, with a slim neck.
      <g>
        <rect x={cx - 4} y={y - 5} width="8" height="6" rx="1.5" fill={skin} stroke={stroke} strokeWidth="0.7" />
        <path d={`M ${cx - 12} ${y + 12} q 0 -13 12 -13 q 12 0 12 13 q 0 15 -12 15 q -12 0 -12 -15 z`} fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    ) : (
      <g>
        <rect x={cx - 5} y={y - 6} width="10" height="6" rx="1.5" fill={skin} stroke={stroke} strokeWidth="0.8" />
        <rect x={cx - 16} y={y} width="32" height="30" rx="7" fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    );

  if (slot === "torso")
    return doll ? (
      // Slim tapered torso, arms held close to the body.
      <g>
        <path d={`M ${cx - 11} ${y + 4} h 22 l 3 12 v 26 q 0 4 -4 4 h -20 q -4 0 -4 -4 v -26 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx - 13} ${y + 8} q -7 3 -8 20 l 6 2 q 2 -14 5 -16 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
        <path d={`M ${cx + 13} ${y + 8} q 7 3 8 20 l -6 2 q -2 -14 -5 -16 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
        <circle cx={cx - 17} cy={y + 32} r="3.4" fill={skin} stroke={stroke} strokeWidth="0.7" />
        <circle cx={cx + 17} cy={y + 32} r="3.4" fill={skin} stroke={stroke} strokeWidth="0.7" />
      </g>
    ) : (
      <g>
        <path d={`M ${cx - 14} ${y} h 28 l 5 8 v 34 q 0 5 -5 5 h -28 q -5 0 -5 -5 v -34 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx - 19} ${y + 6} q -11 4 -13 22 l 9 3 q 3 -15 8 -18 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx + 19} ${y + 6} q 11 4 13 22 l -9 3 q -3 -15 -8 -18 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <circle cx={cx - 26} cy={y + 34} r="4.5" fill={skin} stroke={stroke} strokeWidth="0.8" />
        <circle cx={cx + 26} cy={y + 34} r="4.5" fill={skin} stroke={stroke} strokeWidth="0.8" />
      </g>
    );

  if (slot === "skirt")
    return (
      <g>
        <path d={`M ${cx - 13} ${y} h 26 l 10 32 q -23 5 -46 0 z`} fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    );

  if (slot === "legs")
    return doll ? (
      // Long, slim, slightly tapered — no separate hip block.
      <g>
        <rect x={cx - 12} y={y} width="24" height="9" rx="2.5" fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx - 11} ${y + 9} h 9 l -1 34 h -8 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
        <path d={`M ${cx + 2} ${y + 9} h 9 l 1 34 h -8 z`} fill={color} stroke={stroke} strokeWidth="0.9" />
      </g>
    ) : (
      <g>
        <rect x={cx - 17} y={y} width="34" height="10" rx="2" fill={color} stroke={stroke} strokeWidth="1" />
        <rect x={cx - 17} y={y + 10} width="15" height="30" rx="2" fill={color} stroke={stroke} strokeWidth="1" />
        <rect x={cx + 2} y={y + 10} width="15" height="30" rx="2" fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    );

  return (
    <g>
      <rect x={cx - 2.5} y={y} width="5" height="30" rx="2" fill={color} stroke={stroke} strokeWidth="0.8" />
      <rect x={cx - 6} y={y + 22} width="12" height="7" rx="2" fill={color} stroke={stroke} strokeWidth="0.8" />
    </g>
  );
}

/**
 * Animals aren't minifigures, so Rebrickable lists them as ordinary inventory
 * parts. They read as characters though, so they're lifted out of the brick
 * grid into the roster. Name matching is a heuristic — anything missed simply
 * stays in the Bricks tab, which is a harmless failure mode.
 */
const CREATURE_RE = new RegExp(
  "\\b(animal|dog|puppy|cat|kitten|horse|foal|pony|bird|parrot|owl|falcon|fish|shark|dolphin|" +
  "frog|snake|spider|scorpion|dragon|bat|monkey|ape|bear|panda|rabbit|bunny|hedgehog|turtle|" +
  "tortoise|crab|lobster|butterfly|mouse|rat|hamster|goat|cow|calf|pig|piglet|sheep|lamb|" +
  "chicken|hen|rooster|duck|penguin|lizard|crocodile|alligator|dinosaur|wolf|fox|deer|elephant|" +
  "lion|tiger|leopard|giraffe|zebra|camel|llama|alpaca|squirrel|raccoon|hippo|rhino|octopus|" +
  "whale|seal|walrus|otter|bee|snail|worm|creature|beast)\\b",
  "i"
);

/**
 * Anatomy words. A name whose leading phrase ends in one of these describes a
 * component — "Dinosaur Tail", "Animal Body Part", "Horse Barding" — not a
 * creature you could stand on a baseplate. Only the leading phrase is checked,
 * so "Bird, Parrot with Wings Folded" stays a bird: its wings are described
 * after the comma, as a property of a whole animal.
 */
const CREATURE_PART_RE = new RegExp(
  "\\b(tails?|wings?|legs?|arms?|heads?|horns?|jaws?|fins?|ears?|eyes?|tooth|teeth|tongues?|" +
  "necks?|torsos?|hips?|claws?|antennae?|bodies|body|bardings?|saddles?|bridles?|harnesss?|" +
  "shells?|sections?|halves|half|parts?|pieces?|upper|lower|base|attachments?|accessor(y|ies)|" +
  "patterns?|prints?)\\b\\s*$",
  "i"
);

/**
 * The head noun being named: everything before the first comma or bracket, then
 * before any preposition. "Horse with Moveable Legs" is a horse; "Dinosaur Tail"
 * is a tail. Without the preposition step, any creature described by its limbs
 * would be mistaken for a limb.
 */
const leadingPhrase = (name = "") =>
  name.split(/\s*[,([]/)[0].split(/\s+(?:with|and|for|on|in|w\/)\s+/i)[0].trim();

const isCreature = (part) => {
  const name = part?.name || "";
  if (!CREATURE_RE.test(name)) return false;
  return !CREATURE_PART_RE.test(leadingPhrase(name));
};

/** Wrap a creature part so it can be rendered by the same roster card. */
const creatureAsFigure = (part) => ({
  set_num: part.part_num,
  set_name: part.name.replace(/^Animal,?\s*/i, "").split(/\s*[,(]/)[0],
  set_img_url: part.img || null,
  quantity: part.quantity,
  isCreature: true,
  parts: [{ ...part, slot: "accessory" }],
});

const BODY = new Set(["hair", "head", "torso", "skirt", "legs"]);
const hasBody = (fig) => (fig?.parts || []).some((p) => BODY.has(p.slot));

function Minifig({ fig, exploded = false, height = 150, showAccessory = true }) {
  // If no part resolved to a body slot, this is a figure family the matcher
  // doesn't know. Show the catalogue photo rather than an empty frame.
  if (!hasBody(fig) && fig?.set_img_url) {
    return (
      <img
        src={fig.set_img_url}
        alt={fig.set_name}
        style={{ height, width: "auto", objectFit: "contain" }}
        loading="lazy"
      />
    );
  }
  const family = figFamily(fig);
  const parts = sortSlots(fig.parts).filter((p) => showAccessory || p.slot !== "accessory");
  // Tall enough to contain the exploded spread; clipped so a lifted headwear
  // piece can never paint over the card above it.
  return (
    <svg viewBox="0 -54 200 300" style={{ height, width: "auto", overflow: "hidden" }} aria-label={fig.set_name}>
      {parts.map((p) => {
        const g = GEO[p.slot] || GEO.accessory;
        const cx = p.slot === "accessory" ? 152 : 100;
        return (
          <g
            key={p.part_num}
            style={{
              transform: `translateY(${exploded ? g.explode : 0}px)`,
              transition: "transform 520ms cubic-bezier(.2,.7,.2,1)",
            }}
          >
            <SlotShape slot={p.slot} color={p.color} cx={cx} family={family} />
          </g>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------- brick glyph */

function BrickGlyph({ cat, color, size = 40 }) {
  const stroke = "rgba(0,0,0,0.3)";
  const studs = (n, y, w) =>
    Array.from({ length: n }, (_, i) => (
      <rect key={i} x={6 + i * (w / n) + (w / n - 6) / 2} y={y} width="6" height="3.5" rx="1" fill={color} stroke={stroke} strokeWidth="0.7" />
    ));

  const shapes = {
    brick: (
      <>
        {studs(4, 9, 36)}
        <rect x="6" y="12" width="36" height="18" rx="1.5" fill={color} stroke={stroke} strokeWidth="1" />
      </>
    ),
    plate: (
      <>
        {studs(4, 15, 36)}
        <rect x="6" y="18" width="36" height="8" rx="1.5" fill={color} stroke={stroke} strokeWidth="1" />
      </>
    ),
    tile: <rect x="6" y="18" width="36" height="9" rx="1.5" fill={color} stroke={stroke} strokeWidth="1" />,
    slope: (
      <>
        {studs(2, 11, 18)}
        <path d="M 6 14 h 18 l 18 16 h -36 z" fill={color} stroke={stroke} strokeWidth="1" />
      </>
    ),
    round: (
      <>
        <ellipse cx="24" cy="16" rx="7" ry="3" fill={color} stroke={stroke} strokeWidth="0.8" />
        <ellipse cx="24" cy="24" rx="14" ry="7" fill={color} stroke={stroke} strokeWidth="1" />
      </>
    ),
    technic: (
      <>
        <rect x="5" y="17" width="38" height="11" rx="5.5" fill={color} stroke={stroke} strokeWidth="1" />
        <circle cx="13" cy="22.5" r="3" fill={C.backdrop} stroke={stroke} strokeWidth="0.8" />
        <circle cx="24" cy="22.5" r="3" fill={C.backdrop} stroke={stroke} strokeWidth="0.8" />
        <circle cx="35" cy="22.5" r="3" fill={C.backdrop} stroke={stroke} strokeWidth="0.8" />
      </>
    ),
    other: (
      <>
        {studs(2, 12, 20)}
        <path d="M 7 15 h 20 v 10 h 14 v 6 h -34 z" fill={color} stroke={stroke} strokeWidth="1" />
      </>
    ),
  };

  return (
    <svg viewBox="0 0 48 40" style={{ width: size, height: (size * 40) / 48 }} aria-hidden="true">
      {shapes[cat] || shapes.other}
    </svg>
  );
}

/* -------------------------------------------------------------- primitives */

/** Real photo, falling back to the drawn shape if the image 404s or is absent. */
function PartImage({ src, alt, size = 34, fallback = null }) {
  const [broken, setBroken] = useState(false);
  // Reset on src change, or one failed image poisons every later part shown
  // in the same slot.
  useEffect(() => { setBroken(false); }, [src]);
  if (!src || broken) return fallback;
  return (
    <img
      key={src}
      src={src}
      alt={alt || ""}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ width: size, height: size, objectFit: "contain", display: "block" }}
    />
  );
}

/**
 * Figure photo that degrades gracefully. Rebrickable does not have a photo for
 * every minifigure — licensed themes are patchier than others — and a URL that
 * exists can still fail to load. Either way, fall back to the drawn figure
 * rather than showing a broken frame.
 */
function FigurePhoto({ fig, height, fallback }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [fig?.set_img_url]);
  if (!fig?.set_img_url || broken) return fallback;
  return (
    <img
      key={fig.set_img_url}
      src={fig.set_img_url}
      alt={fig.set_name}
      loading="lazy"
      onError={() => setBroken(true)}
      style={{ height, width: "auto", objectFit: "contain" }}
    />
  );
}

function Stamp({ children, tone = C.muted }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 10.5,
        letterSpacing: "0.06em",
        color: tone,
        fontWeight: 500,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

function RarityTag({ numSets }) {
  const r = rarity(numSets);
  const rare = r.rare;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5"
      style={{
        fontFamily: mono,
        fontSize: 9.5,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: rare ? "#fff" : r.tone,
        background: rare ? C.flag : "transparent",
        border: `1px solid ${rare ? C.flag : "rgba(0,0,0,0.14)"}`,
        borderRadius: 2,
        whiteSpace: "nowrap",
      }}
    >
      {r.note ? `${r.label} · ${r.note}` : r.label}
    </span>
  );
}

/* ------------------------------------------------------------ figure cards */

function FigureCard({ fig, active, onSelect }) {
  const [hover, setHover] = useState(false);
  const rareCount = fig.parts.filter((p) => isRare(p.num_sets)).length;

  return (
    <button
      onClick={() => onSelect(fig)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left w-full p-4 flex flex-col items-center transition-all"
      style={{
        background: C.panel,
        border: `1px solid ${active ? C.ink : C.panelEdge}`,
        borderRadius: 3,
        boxShadow: active ? `0 0 0 1px ${C.ink}` : hover ? "0 6px 18px rgba(0,0,0,0.09)" : "0 1px 2px rgba(0,0,0,0.05)",
        transform: hover && !active ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div className="h-[150px] flex items-end justify-center w-full">
        {hover ? (
          <Minifig fig={fig} exploded height={148} />
        ) : (
          <FigurePhoto fig={fig} height={148} fallback={<Minifig fig={fig} height={148} />} />
        )}
      </div>
      <div className="mt-4 w-full">
        <div style={{ fontFamily: display, fontWeight: 600, fontSize: 13.5, color: C.ink, letterSpacing: "-0.01em" }}>
          {fig.set_name}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <Stamp>{fig.set_num}</Stamp>
          <Stamp tone={C.muted}>{fig.parts.length} parts</Stamp>
        </div>
        {rareCount > 0 && (
          <div className="mt-2">
            <span style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.08em", color: C.flag, textTransform: "uppercase" }}>
              ▲ {rareCount} rare
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------- signature: exploded call-out */

function ExplodedDiagram({ fig, onOpenSet }) {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(reduced);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    setShowPhoto(Boolean(fig.set_img_url));
    setOpen(reduced);
    const t = setTimeout(() => setOpen(true), reduced ? 0 : 90);
    return () => clearTimeout(t);
  }, [fig.set_num, fig.set_img_url, reduced]);

  const parts = sortSlots(fig.parts);
  const family = figFamily(fig);

  // Anchor y for each label, pushed apart so adjacent rows never overlap.
  const MIN_GAP = 15;
  const anchors = {};
  {
    let last = -Infinity;
    for (const p of parts) {
      const g = GEO[p.slot] || GEO.accessory;
      const base = g.y + (open ? g.explode : 0) + (p.slot === "torso" ? 24 : p.slot === "legs" ? 20 : 14);
      const y = Math.max(base, last + MIN_GAP);
      anchors[p.part_num] = y;
      last = y;
    }
  }
  const [showPhoto, setShowPhoto] = useState(Boolean(fig.set_img_url));

  return (
    <div className="flex flex-col xl:flex-row gap-5 xl:gap-3">
      {/* diagram */}
      <div className="flex-shrink-0 flex flex-col items-center justify-center self-center" style={{ minWidth: 200 }}>
        {fig.set_img_url && (
          <div className="mb-2 flex gap-1">
            {["Diagram", "Photo"].map((label, i) => {
              const on = (i === 1) === showPhoto;
              return (
                <button key={label} onClick={() => setShowPhoto(i === 1)}
                  style={{ fontFamily: mono, fontSize: 9.5, letterSpacing: "0.07em", textTransform: "uppercase",
                           padding: "3px 7px", borderRadius: 2, cursor: "pointer",
                           border: `1px solid ${on ? C.ink : "rgba(0,0,0,0.15)"}`,
                           background: on ? C.ink : "transparent", color: on ? C.panel : C.muted }}>
                  {label}
                </button>
              );
            })}
          </div>
        )}
        {showPhoto ? (
          <FigurePhoto fig={fig} height={300}
            fallback={<div className="flex flex-col items-center gap-2 py-8"><Stamp>NO PHOTO IN CATALOGUE</Stamp><Minifig fig={fig} height={240} /></div>} />
        ) : (
        <svg viewBox="0 -56 210 400" style={{ height: 340, width: 210, overflow: "hidden" }}>
          {parts.map((p) => {
            const g = GEO[p.slot] || GEO.accessory;
            const cx = p.slot === "accessory" ? 148 : 88;
            const dy = open ? g.explode : 0;
            const dim = focus && focus !== p.part_num;
            const anchorY = anchors[p.part_num];
            return (
              <g
                key={p.part_num}
                style={{
                  opacity: dim ? 0.28 : 1,
                  transition: "opacity 200ms ease",
                }}
                onMouseEnter={() => setFocus(p.part_num)}
                onMouseLeave={() => setFocus(null)}
              >
                <g
                  style={{
                    transform: `translateY(${dy}px)`,
                    transition: reduced ? "none" : "transform 620ms cubic-bezier(.16,.8,.24,1)",
                  }}
                >
                  <SlotShape slot={p.slot} color={p.color} cx={cx} family={family} />
                </g>
                {/* leader line out to the label rail */}
                <line
                  x1={cx + (p.slot === "accessory" ? 12 : 40)}
                  y1={anchorY}
                  x2={196}
                  y2={anchorY}
                  stroke={focus === p.part_num ? C.ink : "rgba(0,0,0,0.2)"}
                  strokeWidth="0.9"
                  strokeDasharray="2 2.5"
                  style={{ opacity: open ? 1 : 0, transition: "opacity 400ms ease 300ms" }}
                />
                <circle cx={196} cy={anchorY} r="2" fill={focus === p.part_num ? C.ink : "rgba(0,0,0,0.32)"} style={{ opacity: open ? 1 : 0, transition: "opacity 400ms ease 300ms" }} />
                <text
                  x={190}
                  y={anchorY - 5}
                  textAnchor="end"
                  style={{ fontFamily: mono, fontSize: 8.5, fill: C.muted, letterSpacing: "0.05em", opacity: open ? 1 : 0, transition: "opacity 400ms ease 380ms" }}
                >
                  {SLOT_LABEL[p.slot]?.toUpperCase()}
                </text>
              </g>
            );
          })}
        </svg>
        )}
      </div>

      {/* component rail */}
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="pb-2 mb-1" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
          <Stamp>COMPONENTS · {parts.length}</Stamp>
        </div>
        {parts.map((p) => (
          <div
            key={p.part_num}
            onMouseEnter={() => setFocus(p.part_num)}
            onMouseLeave={() => setFocus(null)}
            className="py-2.5 flex items-start gap-3 transition-colors"
            style={{
              borderBottom: `1px solid rgba(0,0,0,0.06)`,
              background: focus === p.part_num ? "rgba(10,110,168,0.05)" : "transparent",
            }}
          >
            <span className="flex-shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ width: 34, height: 34, borderRadius: 2, background: "#fff", border: "1px solid rgba(0,0,0,0.10)" }}>
              <PartImage
                src={p.img}
                alt={p.name}
                size={32}
                fallback={
                  <span style={{ width: 16, height: 16, borderRadius: 2, background: p.color,
                                 border: "1px solid rgba(0,0,0,0.22)", display: "block" }} />
                }
              />
            </span>
            <div className="flex-1" style={{ minWidth: 0 }}>
              <div style={{ fontFamily: display, fontSize: 12.5, fontWeight: 500, color: C.ink, lineHeight: 1.3,
                            overflowWrap: "anywhere", wordBreak: "break-word" }}>
                {p.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Stamp tone={C.inkSoft}>{p.part_num}</Stamp>
                <RarityTag numSets={p.num_sets} />
              </div>
              <OtherSets part={p} onOpenSet={onOpenSet} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- brick inventory */

const CATS = ["all", "brick", "plate", "tile", "slope", "round", "technic", "other"];

function BrickInventory({ rows: ALL = [], onOpenSet }) {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("quantity");
  const [rareOnly, setRareOnly] = useState(false);

  const rows = useMemo(() => {
    let r = ALL.filter((b) => (cat === "all" || b.cat === cat) && (!rareOnly || isRare(b.num_sets)));
    r.sort((a, b) =>
      sort === "quantity" ? b.quantity - a.quantity : sort === "rarity" ? (a.num_sets ?? Infinity) - (b.num_sets ?? Infinity) : a.name.localeCompare(b.name)
    );
    return r;
  }, [ALL, cat, sort, rareOnly]);

  const btn = (on) => ({
    fontFamily: mono,
    fontSize: 10,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    padding: "5px 9px",
    borderRadius: 2,
    border: `1px solid ${on ? C.ink : "rgba(0,0,0,0.15)"}`,
    background: on ? C.ink : "transparent",
    color: on ? C.panel : C.inkSoft,
  });

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {CATS.map((c) => (
          <button key={c} onClick={() => setCat(c)} style={btn(cat === c)}>
            {c}
          </button>
        ))}
        <span className="w-3" />
        <button onClick={() => setRareOnly(!rareOnly)} style={{ ...btn(rareOnly), borderColor: rareOnly ? C.flag : "rgba(0,0,0,0.15)", background: rareOnly ? C.flag : "transparent", color: rareOnly ? "#fff" : C.inkSoft }}>
          ▲ rare only
        </button>
        <span className="flex-1" />
        <Stamp>SORT</Stamp>
        {["quantity", "rarity", "name"].map((s) => (
          <button key={s} onClick={() => setSort(s)} style={btn(sort === s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {rows.map((b) => (
          <div
            key={b.part_num}
            className="p-3 flex items-center gap-3"
            style={{ background: C.panel, border: `1px solid ${isRare(b.num_sets) ? C.flag : C.panelEdge}`, borderRadius: 3 }}
          >
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 46, height: 40 }}>
              <PartImage src={b.img} alt={b.name} size={42} fallback={<BrickGlyph cat={b.cat} color={b.color} />} />
            </div>
            <div className="min-w-0 flex-1">
              <div style={{ fontFamily: display, fontSize: 12.5, fontWeight: 500, color: C.ink, lineHeight: 1.25,
                            overflowWrap: "anywhere", wordBreak: "break-word" }}>{b.name}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Stamp tone={C.inkSoft}>{b.part_num}</Stamp>
                <Stamp>{b.color_name}</Stamp>
              </div>
              {isRare(b.num_sets) && (
                <div className="mt-1.5">
                  <RarityTag numSets={b.num_sets} />
                  <OtherSets part={b} onOpenSet={onOpenSet} />
                </div>
              )}
            </div>
            <div
              className="flex-shrink-0 text-right"
              style={{ fontFamily: mono, fontWeight: 700, fontSize: 17, color: C.ink }}
            >
              ×{b.quantity}
            </div>
          </div>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="py-16 text-center" style={{ fontFamily: display, fontSize: 13, color: C.muted }}>
          No parts match these filters. Clear the rare filter or pick another category.
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- creature */

function CreatureDetail({ fig }) {
  const part = fig.parts[0];
  return (
    <div>
      <div className="flex items-center justify-center p-3 mb-4"
           style={{ background: "#fff", border: `1px solid rgba(0,0,0,0.08)`, borderRadius: 3, minHeight: 180 }}>
        <PartImage src={part.img} alt={part.name} size={170}
          fallback={<span style={{ width: 60, height: 60, borderRadius: 4, background: part.color, border: "1px solid rgba(0,0,0,0.2)", display: "block" }} />} />
      </div>
      <div className="pb-2 mb-1" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
        <Stamp>SINGLE MOULDED ELEMENT</Stamp>
      </div>
      <div className="py-2.5">
        <div style={{ fontFamily: display, fontSize: 12.5, fontWeight: 500, color: C.ink, lineHeight: 1.3 }}>{part.name}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Stamp tone={C.inkSoft}>{part.part_num}</Stamp>
          <Stamp>{part.color_name}</Stamp>
          <RarityTag numSets={part.num_sets} />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ set overview */

function SetOverview({ setInfo, minifigs, bricks, creatures, rareTotal, pending }) {
  const stat = (label, value) => (
    <div key={label} className="py-2" style={{ borderBottom: `1px solid rgba(0,0,0,0.07)` }}>
      <div><Stamp>{label.toUpperCase()}</Stamp></div>
      <div style={{ fontFamily: display, fontSize: 15, fontWeight: 600, color: C.ink, marginTop: 2 }}>{value}</div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row gap-6">
      <div className="md:w-[58%]">
        <div
          className="flex items-center justify-center p-4"
          style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3, minHeight: 260 }}
        >
          {/* FigurePhoto covers both a missing URL and one that fails to load. */}
          <FigurePhoto
            fig={{ set_img_url: setInfo.set_img_url, set_name: setInfo.name }}
            height={420}
            fallback={<Stamp>SET IMAGE UNAVAILABLE</Stamp>}
          />
        </div>
      </div>

      <div className="md:w-[42%]">
        <div className="p-5" style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3 }}>
          {stat("Set number", setInfo.set_num)}
          {stat("Released", setInfo.year ?? "—")}
          {setInfo.theme && stat("Theme", setInfo.theme)}
          {stat("Total pieces", (setInfo.num_parts ?? 0).toLocaleString())}
          {stat("Distinct elements", pending ? "counting…" : bricks.length.toLocaleString())}
          {stat("Characters", `${minifigs.length} figure${minifigs.length === 1 ? "" : "s"}${creatures.length ? ` · ${creatures.length} animal${creatures.length === 1 ? "" : "s"}` : ""}`)}
          <div className="pt-3">
            <Stamp>RARE ELEMENTS</Stamp>
            <div style={{ fontFamily: display, fontSize: 15, fontWeight: 600, color: rareTotal > 0 ? C.flag : C.ink, marginTop: 2 }}>
              {pending ? "checking…" : rareTotal > 0 ? `${rareTotal} appear in 3 sets or fewer` : "None — all common tooling"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shell */

export default function SetInventory({
  setInfo = null,
  minifigs = [],
  bricks = [],
  pending = false,
  onOpenSet = null,
  openSignal = 0,
  searchState = null,
  onClearSearch = null,
  browsable = false,
}) {
  const [tab, setTab] = useState(browsable ? "browse" : "set");

  // Opening a set from Browse should land on that set, not leave the user
  // staring at the theme list wondering whether the click registered.
  useEffect(() => {
    if (openSignal > 0) setTab("set");
  }, [openSignal]);

  // A name search opens its own tab; the nonce makes repeat searches navigate.
  useEffect(() => {
    if (searchState) setTab("search");
  }, [searchState?.nonce]);
  const [selected, setSelected] = useState(null);

  const creatures = useMemo(() => bricks.filter(isCreature).map(creatureAsFigure), [bricks]);
  const plainBricks = useMemo(() => bricks.filter((b) => !isCreature(b)), [bricks]);
  const roster = useMemo(() => [...minifigs, ...creatures], [minifigs, creatures]);

  useEffect(() => { setSelected((cur) => roster.find((f) => f.set_num === cur?.set_num) || roster[0] || null); }, [roster]);

  const rareTotal =
    minifigs.reduce((n, f) => n + f.parts.filter((p) => isRare(p.num_sets)).length, 0) +
    bricks.filter((b) => isRare(b.num_sets)).length;

  const tabStyle = (on) => ({
    fontFamily: display,
    fontWeight: on ? 700 : 500,
    fontSize: 12,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    padding: "10px 2px",
    marginRight: 26,
    color: on ? C.ink : C.muted,
    borderBottom: `2px solid ${on ? C.ink : "transparent"}`,
    background: "transparent",
  });

  return (
    <div style={{ background: C.backdrop, minHeight: "100%", color: C.ink }}>
      <style>{FONTS}</style>

      <div className="max-w-6xl mx-auto px-5 py-8">
        {/* header */}
        <header className="mb-7">
          <Stamp tone={C.azure}>SET INVENTORY</Stamp>
          {!setInfo ? (
            <>
              <h1 style={{ fontFamily: display, fontWeight: 800, fontSize: "clamp(28px, 5vw, 44px)",
                           letterSpacing: "-0.03em", lineHeight: 1, margin: "8px 0 0" }}>
                Explore the LEGO catalogue
              </h1>
              <div className="mt-3">
                <Stamp tone={C.inkSoft}>
                  Pick a set from Browse, or type a set number above, to see its parts and characters.
                </Stamp>
              </div>
            </>
          ) : (
          <>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1
              style={{
                fontFamily: display,
                fontWeight: 800,
                fontSize: "clamp(30px, 6vw, 52px)",
                letterSpacing: "-0.03em",
                lineHeight: 0.95,
                margin: 0,
              }}
            >
              {setInfo.name}
            </h1>
            <span style={{ fontFamily: mono, fontSize: 16, fontWeight: 500, color: C.inkSoft }}>{setInfo.set_num}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Stamp tone={C.inkSoft}>{setInfo.year}</Stamp>
            {setInfo.theme && <Stamp tone={C.inkSoft}>{setInfo.theme}</Stamp>}
            <Stamp tone={C.inkSoft}>{setInfo.num_parts.toLocaleString()} parts</Stamp>
            <Stamp tone={C.inkSoft}>{minifigs.length} minifigs</Stamp>
            {rareTotal > 0 && (
              <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.06em", color: C.flag, fontWeight: 500 }}>
                ▲ {rareTotal} rare elements
              </span>
            )}
          </div>
          </>
          )}
        </header>

        {/* tabs */}
        <nav className="mb-6" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
          {browsable && (
            <button
              style={tabStyle(tab === "browse")}
              onClick={() => { setTab("browse"); if (onClearSearch) onClearSearch(); }}
            >
              Browse
            </button>
          )}
          {searchState && (
            <button style={tabStyle(tab === "search")} onClick={() => setTab("search")}>
              Search
            </button>
          )}
          <button style={tabStyle(tab === "set")} onClick={() => setTab("set")} disabled={!setInfo}
                  title={setInfo ? "" : "Load a set first"}>
            Set
          </button>
          <button style={tabStyle(tab === "characters")} onClick={() => setTab("characters")}>
            Characters{setInfo ? ` · ${pending && roster.length === 0 ? "…" : roster.length}` : ""}
          </button>
          <button style={tabStyle(tab === "bricks")} onClick={() => setTab("bricks")}>
            Bricks{setInfo ? ` · ${pending ? "…" : plainBricks.length}` : ""}
          </button>
        </nav>

        {tab === "browse" ? (
          <Browse onOpenSet={onOpenSet} activeSetNum={setInfo?.set_num} />
        ) : tab === "search" && searchState ? (
          <SearchResults
            key={searchState.nonce}
            mode={searchState.mode}
            query={searchState.query}
            onOpenSet={onOpenSet}
            activeSetNum={setInfo?.set_num}
          />
        ) : !setInfo ? (
          <div className="py-20 text-center">
            <Stamp>NO SET LOADED</Stamp>
            <div className="mt-3">
              <button onClick={() => { setTab("browse"); if (onClearSearch) onClearSearch(); }}
                style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase",
                         padding: "7px 12px", borderRadius: 2, cursor: "pointer", border: "none",
                         background: C.ink, color: C.panel }}>
                Browse the catalogue
              </button>
            </div>
          </div>
        ) : tab === "set" ? (
          <SetOverview
            setInfo={setInfo}
            minifigs={minifigs}
            bricks={plainBricks}
            creatures={creatures}
            rareTotal={rareTotal}
            pending={pending}
          />
        ) : tab === "characters" ? (
          !selected ? (
            <div className="py-20 text-center"><Stamp>{pending ? "LOADING CHARACTERS" : "NO CHARACTERS IN THIS SET"}</Stamp></div>
          ) : (
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-[54%]">
                <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                  {roster.map((f) => (
                    <FigureCard key={f.set_num} fig={f} active={selected?.set_num === f.set_num} onSelect={setSelected} />
                  ))}
                </div>
              </div>

              <div className="lg:w-[46%]">
                <div
                  className="p-5 lg:sticky lg:top-5"
                  style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
                >
                  <div className="mb-4">
                    <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", margin: 0 }}>
                      {selected.set_name}
                    </h2>
                    <div className="mt-1 flex items-center gap-2">
                      <Stamp>{selected.set_num}</Stamp>
                      {selected.isCreature && <Stamp tone={C.azure}>ANIMAL</Stamp>}
                    </div>
                  </div>
                  {selected.isCreature ? (
                    <CreatureDetail key={selected.set_num} fig={selected} />
                  ) : (
                    <ExplodedDiagram key={selected.set_num} fig={selected} onOpenSet={onOpenSet} />
                  )}
                </div>
              </div>
            </div>
          )
        ) : (
          <BrickInventory rows={plainBricks} onOpenSet={onOpenSet} />
        )}

        <footer className="mt-10 pt-4" style={{ borderTop: `1px solid ${C.panelEdge}` }}>
          <Stamp>INVENTORY DATA FROM REBRICKABLE</Stamp>
        </footer>
      </div>
    </div>
  );
}
