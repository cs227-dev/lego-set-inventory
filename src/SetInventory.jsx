import React, { useState, useMemo, useEffect } from "react";

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

const DEMO_SET = {
  set_num: "75192-1",
  name: "Millennium Falcon",
  year: 2017,
  theme: "Star Wars / Ultimate Collector Series",
  num_parts: 7541,
};

// Shape matches /minifigs/{fig}/parts/ results, plus a `slot` we derive
// ourselves (see slotOf below) and `num_sets` from the part-colors endpoint.
const DEMO_MINIFIGS = [
  {
    set_num: "fig-001842",
    set_name: "Han Solo, Classic",
    parts: [
      { slot: "hair", part_num: "23186", name: "Minifig Hair, Swept Back", color: "#3A2A1B", num_sets: 44 },
      { slot: "head", part_num: "3626cpr", name: "Minifig Head, Smirk / Raised Brow", color: "#F6D02F", num_sets: 2 },
      { slot: "torso", part_num: "973pb2841", name: "Minifig Torso, White Shirt, Black Vest", color: "#F2F2F2", num_sets: 3 },
      { slot: "legs", part_num: "970c00pb0851", name: "Minifig Legs, Blue Stripe", color: "#4A5A78", num_sets: 5 },
      { slot: "accessory", part_num: "15391", name: "Blaster, Short", color: "#2B2B2B", num_sets: 128 },
    ],
  },
  {
    set_num: "fig-001843",
    set_name: "Chewbacca",
    parts: [
      { slot: "head", part_num: "88860", name: "Minifig Head, Wookiee, Molded", color: "#7A4A22", num_sets: 12 },
      { slot: "torso", part_num: "973pb1789", name: "Minifig Torso, Fur, Bandolier", color: "#7A4A22", num_sets: 12 },
      { slot: "legs", part_num: "970c00pb0410", name: "Minifig Legs, Fur", color: "#6B3F1D", num_sets: 12 },
      { slot: "accessory", part_num: "18889", name: "Bowcaster", color: "#4A3121", num_sets: 9 },
    ],
  },
  {
    set_num: "fig-001844",
    set_name: "Princess Leia",
    parts: [
      { slot: "hair", part_num: "92081", name: "Minifig Hair, Buns", color: "#3A2A1B", num_sets: 7 },
      { slot: "head", part_num: "3626cpr9", name: "Minifig Head, Determined", color: "#F6D02F", num_sets: 6 },
      { slot: "torso", part_num: "973pb2842", name: "Minifig Torso, White Robe", color: "#F7F7F2", num_sets: 2 },
      { slot: "legs", part_num: "970c00pb0852", name: "Minifig Legs, White Robe", color: "#F7F7F2", num_sets: 2 },
    ],
  },
  {
    set_num: "fig-001845",
    set_name: "C-3PO",
    parts: [
      { slot: "head", part_num: "30366pb01", name: "Minifig Head, Droid, Molded", color: "#D6A825", num_sets: 18 },
      { slot: "torso", part_num: "973pb1180", name: "Minifig Torso, Droid Wiring", color: "#D6A825", num_sets: 18 },
      { slot: "legs", part_num: "970c00pb0288", name: "Minifig Legs, Droid", color: "#D6A825", num_sets: 18 },
    ],
  },
  {
    set_num: "fig-001846",
    set_name: "Rey",
    parts: [
      { slot: "hair", part_num: "36037", name: "Minifig Hair, Three Buns", color: "#5A3A20", num_sets: 3 },
      { slot: "head", part_num: "3626cpr14", name: "Minifig Head, Freckles", color: "#F6D02F", num_sets: 4 },
      { slot: "torso", part_num: "973pb2843", name: "Minifig Torso, Wrapped Tunic", color: "#C9B18B", num_sets: 3 },
      { slot: "legs", part_num: "970c00pb0853", name: "Minifig Legs, Tan Wrap", color: "#B49A72", num_sets: 3 },
      { slot: "accessory", part_num: "18694", name: "Staff", color: "#5A4632", num_sets: 21 },
    ],
  },
  {
    set_num: "fig-001847",
    set_name: "Finn",
    parts: [
      { slot: "head", part_num: "3626cpr21", name: "Minifig Head, Wide Grin", color: "#5C3A22", num_sets: 8 },
      { slot: "torso", part_num: "973pb2844", name: "Minifig Torso, Leather Jacket", color: "#4B3524", num_sets: 4 },
      { slot: "legs", part_num: "970c00pb0854", name: "Minifig Legs, Dark Tan", color: "#8A7351", num_sets: 6 },
    ],
  },
  {
    set_num: "fig-001848",
    set_name: "Old Han Solo",
    parts: [
      { slot: "hair", part_num: "98371", name: "Minifig Hair, Grey Swept", color: "#9A9A96", num_sets: 2 },
      { slot: "head", part_num: "3626cpr30", name: "Minifig Head, Lined, Beard", color: "#F6D02F", num_sets: 1 },
      { slot: "torso", part_num: "973pb2845", name: "Minifig Torso, Heavy Coat", color: "#3C3B39", num_sets: 1 },
      { slot: "legs", part_num: "970c00pb0855", name: "Minifig Legs, Dark Blue", color: "#39445C", num_sets: 4 },
    ],
  },
  {
    set_num: "fig-001849",
    set_name: "Mynock",
    parts: [
      { slot: "head", part_num: "37341", name: "Mynock Body, Moulded", color: "#4A4A4A", num_sets: 1 },
    ],
  },
];

// Shape matches /sets/{set}/parts/ results.
const DEMO_BRICKS = [
  { part_num: "3001", name: "Brick 2 x 4", cat: "brick", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 412, num_sets: 3140 },
  { part_num: "3020", name: "Plate 2 x 4", cat: "plate", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 288, num_sets: 2870 },
  { part_num: "3068b", name: "Tile 2 x 2", cat: "tile", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 205, num_sets: 2410 },
  { part_num: "3004", name: "Brick 1 x 2", cat: "brick", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 190, num_sets: 3020 },
  { part_num: "3040", name: "Slope 45° 2 x 1", cat: "slope", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 144, num_sets: 1980 },
  { part_num: "4073", name: "Plate Round 1 x 1", cat: "round", color: "#F2F2F2", color_name: "White", quantity: 132, num_sets: 2240 },
  { part_num: "32523", name: "Technic Beam 3", cat: "technic", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 96, num_sets: 890 },
  { part_num: "43722", name: "Wedge Plate 3 x 2 Right", cat: "slope", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 88, num_sets: 620 },
  { part_num: "2431", name: "Tile 1 x 4", cat: "tile", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 76, num_sets: 1740 },
  { part_num: "30414", name: "Brick Modified 1 x 4, Studs Side", cat: "brick", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 64, num_sets: 540 },
  { part_num: "98138", name: "Tile Round 1 x 1", cat: "round", color: "#3D6BB0", color_name: "Trans-Blue", quantity: 48, num_sets: 980 },
  { part_num: "64644", name: "Dish 8 x 8 Inverted, Radar", cat: "round", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 2, num_sets: 3 },
  { part_num: "22385", name: "Tile Wedge 2 x 4 Left", cat: "slope", color: "#F2F2F2", color_name: "White", quantity: 34, num_sets: 410 },
  { part_num: "75192p01", name: "Cockpit Canopy, Printed", cat: "other", color: "#B8CBD9", color_name: "Trans-Light Blue", quantity: 1, num_sets: 1 },
  { part_num: "44728", name: "Bracket 1 x 2 - 2 x 2", cat: "other", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 58, num_sets: 1120 },
  { part_num: "6141", name: "Plate Round 1 x 1 Open Stud", cat: "round", color: "#C2371B", color_name: "Red", quantity: 26, num_sets: 1890 },
  { part_num: "60481", name: "Slope 65° 2 x 1 x 2", cat: "slope", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 42, num_sets: 760 },
  { part_num: "41770", name: "Wedge Plate 4 x 2 Left", cat: "slope", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 40, num_sets: 690 },
  { part_num: "2412b", name: "Tile Grille 1 x 2", cat: "tile", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 38, num_sets: 1450 },
  { part_num: "87580", name: "Plate 2 x 2 Center Stud", cat: "plate", color: "#F2F2F2", color_name: "White", quantity: 30, num_sets: 880 },
  { part_num: "18674", name: "Plate Round 2 x 2 Center Stud", cat: "round", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 22, num_sets: 640 },
  { part_num: "4740", name: "Dish 2 x 2 Inverted", cat: "round", color: "#6C706E", color_name: "Dark Bluish Gray", quantity: 18, num_sets: 1290 },
  { part_num: "30602", name: "Slope Curved 2 x 2 Lip", cat: "slope", color: "#F2F2F2", color_name: "White", quantity: 16, num_sets: 720 },
  { part_num: "27925", name: "Tile Round Corner 2 x 2 Macaroni", cat: "tile", color: "#9BA19D", color_name: "Light Bluish Gray", quantity: 12, num_sets: 380 },
];

/* ------------------------------------------------------------------ helpers */

// In the real API, derive the slot from part_cat_id or the part name prefix
// ("Minifig Head", "Minifig Torso", "Minifig Hair", ...). Everything that
// doesn't match a body slot is an accessory.
const SLOT_ORDER = ["hair", "head", "torso", "skirt", "legs", "accessory"];
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

/** Single source of truth for "should this be flagged". */
const isRare = (numSets) => numSets != null && numSets <= 3;

const sortSlots = (parts) =>
  [...parts].sort((a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
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

function SlotShape({ slot, color, cx = 100, dy = 0 }) {
  const stroke = "rgba(0,0,0,0.32)";
  const g = GEO[slot] || GEO.accessory;
  const y = g.y + dy;

  if (slot === "hair")
    return (
      <g>
        <path
          d={`M ${cx - 21} ${y + 22} q -3 -26 21 -26 q 24 0 21 26 q -6 -9 -21 -9 q -15 0 -21 9 z`}
          fill={color}
          stroke={stroke}
          strokeWidth="1"
        />
      </g>
    );

  if (slot === "head")
    return (
      <g>
        <rect x={cx - 5} y={y - 6} width="10" height="6" rx="1.5" fill={color} stroke={stroke} strokeWidth="0.8" />
        <rect x={cx - 16} y={y} width="32" height="30" rx="7" fill={color} stroke={stroke} strokeWidth="1" />
      </g>
    );

  if (slot === "torso")
    return (
      <g>
        <path
          d={`M ${cx - 14} ${y} h 28 l 5 8 v 34 q 0 5 -5 5 h -28 q -5 0 -5 -5 v -34 z`}
          fill={color}
          stroke={stroke}
          strokeWidth="1"
        />
        <path d={`M ${cx - 19} ${y + 6} q -11 4 -13 22 l 9 3 q 3 -15 8 -18 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <path d={`M ${cx + 19} ${y + 6} q 11 4 13 22 l -9 3 q -3 -15 -8 -18 z`} fill={color} stroke={stroke} strokeWidth="1" />
        <circle cx={cx - 26} cy={y + 34} r="4.5" fill="#F6D02F" stroke={stroke} strokeWidth="0.8" />
        <circle cx={cx + 26} cy={y + 34} r="4.5" fill="#F6D02F" stroke={stroke} strokeWidth="0.8" />
      </g>
    );

  if (slot === "skirt")
    return (
      <g>
        <path
          d={`M ${cx - 15} ${y} h 30 l 9 34 q -24 5 -48 0 z`}
          fill={color}
          stroke={stroke}
          strokeWidth="1"
        />
      </g>
    );

  if (slot === "legs")
    return (
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
  const parts = sortSlots(fig.parts).filter((p) => showAccessory || p.slot !== "accessory");
  return (
    <svg viewBox="0 0 200 230" style={{ height, width: "auto", overflow: "visible" }} aria-label={fig.set_name}>
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
            <SlotShape slot={p.slot} color={p.color} cx={cx} />
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

function Stamp({ children, tone = C.muted }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: 10.5,
        letterSpacing: "0.06em",
        color: tone,
        fontWeight: 500,
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
        <Minifig fig={fig} exploded={hover && !active} height={148} />
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

function ExplodedDiagram({ fig }) {
  const reduced = usePrefersReducedMotion();
  const [open, setOpen] = useState(reduced);
  const [focus, setFocus] = useState(null);

  useEffect(() => {
    setOpen(reduced);
    const t = setTimeout(() => setOpen(true), reduced ? 0 : 90);
    return () => clearTimeout(t);
  }, [fig.set_num, reduced]);

  const parts = sortSlots(fig.parts);

  return (
    <div className="flex flex-col md:flex-row gap-6 md:gap-2">
      {/* diagram */}
      <div className="flex-shrink-0 flex items-center justify-center" style={{ minWidth: 200 }}>
        <svg viewBox="0 0 210 330" style={{ height: 330, width: 210, overflow: "visible" }}>
          {parts.map((p) => {
            const g = GEO[p.slot] || GEO.accessory;
            const cx = p.slot === "accessory" ? 148 : 88;
            const dy = open ? g.explode : 0;
            const dim = focus && focus !== p.part_num;
            const anchorY = g.y + dy + (p.slot === "torso" ? 24 : p.slot === "legs" ? 20 : 14);
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
                  <SlotShape slot={p.slot} color={p.color} cx={cx} />
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
      </div>

      {/* component rail */}
      <div className="flex-1 min-w-0">
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
            <span
              className="flex-shrink-0 mt-0.5"
              style={{
                width: 16,
                height: 16,
                borderRadius: 2,
                background: p.color,
                border: "1px solid rgba(0,0,0,0.22)",
              }}
            />
            <div className="min-w-0 flex-1">
              <div style={{ fontFamily: display, fontSize: 12.5, fontWeight: 500, color: C.ink, lineHeight: 1.3 }}>
                {p.name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <Stamp tone={C.inkSoft}>{p.part_num}</Stamp>
                <RarityTag numSets={p.num_sets} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------- brick inventory */

const CATS = ["all", "brick", "plate", "tile", "slope", "round", "technic", "other"];

function BrickInventory({ rows: ALL = DEMO_BRICKS }) {
  const [cat, setCat] = useState("all");
  const [sort, setSort] = useState("quantity");
  const [rareOnly, setRareOnly] = useState(false);

  const rows = useMemo(() => {
    let r = ALL.filter((b) => (cat === "all" || b.cat === cat) && (!rareOnly || isRare(b.num_sets)));
    r.sort((a, b) =>
      sort === "quantity" ? b.quantity - a.quantity : sort === "rarity" ? (a.num_sets ?? Infinity) - (b.num_sets ?? Infinity) : a.name.localeCompare(b.name)
    );
    return r;
  }, [cat, sort, rareOnly]);

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
            <div className="flex-shrink-0 flex items-center justify-center" style={{ width: 46 }}>
              <BrickGlyph cat={b.cat} color={b.color} />
            </div>
            <div className="min-w-0 flex-1">
              <div style={{ fontFamily: display, fontSize: 12.5, fontWeight: 500, color: C.ink, lineHeight: 1.25 }}>{b.name}</div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <Stamp tone={C.inkSoft}>{b.part_num}</Stamp>
                <Stamp>{b.color_name}</Stamp>
              </div>
              {isRare(b.num_sets) && (
                <div className="mt-1.5">
                  <RarityTag numSets={b.num_sets} />
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

/* --------------------------------------------------------------- shell */

export default function SetInventory({ setInfo = DEMO_SET, minifigs = DEMO_MINIFIGS, bricks = DEMO_BRICKS, pending = false }) {
  const [tab, setTab] = useState("characters");
  const [selected, setSelected] = useState(minifigs[0]);
  useEffect(() => { setSelected(minifigs[0]); }, [minifigs]);

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
        </header>

        {/* tabs */}
        <nav className="mb-6" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
          <button style={tabStyle(tab === "characters")} onClick={() => setTab("characters")}>
            Characters · {minifigs.length}
          </button>
          <button style={tabStyle(tab === "bricks")} onClick={() => setTab("bricks")}>
            Bricks · {pending ? "…" : bricks.length}
          </button>
        </nav>

        {!selected ? (
          <div className="py-20 text-center"><Stamp>LOADING INVENTORY</Stamp></div>
        ) : tab === "characters" ? (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* roster */}
            <div className="lg:w-[58%]">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))" }}>
                {minifigs.map((f) => (
                  <FigureCard key={f.set_num} fig={f} active={selected?.set_num === f.set_num} onSelect={setSelected} />
                ))}
              </div>
            </div>

            {/* detail */}
            <div className="lg:w-[42%]">
              <div
                className="p-5 lg:sticky lg:top-5"
                style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}
              >
                <div className="mb-4">
                  <h2 style={{ fontFamily: display, fontWeight: 700, fontSize: 20, letterSpacing: "-0.02em", margin: 0 }}>
                    {selected.set_name}
                  </h2>
                  <div className="mt-1">
                    <Stamp>{selected.set_num}</Stamp>
                  </div>
                </div>
                <ExplodedDiagram key={selected.set_num} fig={selected} />
              </div>
            </div>
          </div>
        ) : (
          <BrickInventory rows={bricks} />
        )}

        <footer className="mt-10 pt-4" style={{ borderTop: `1px solid ${C.panelEdge}` }}>
          <Stamp>
            PROTOTYPE · MOCK DATA SHAPED TO REBRICKABLE V3 · SWAP THE THREE CONSTANTS FOR FETCH CALLS
          </Stamp>
        </footer>
      </div>
    </div>
  );
}
