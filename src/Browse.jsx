import React, { useState, useEffect, useMemo, useCallback } from "react";
import { fetchThemes, fetchThemeSets } from "./lib/rebrickable.js";

export const C = {
  backdrop: "#E4E1DA",
  panel: "#FAF9F6",
  panelEdge: "#D3CFC6",
  ink: "#17171A",
  inkSoft: "#4A4842",
  muted: "#807C74",
  azure: "#0A6EA8",
  flag: "#C2371B",
};
export const display = "'Archivo', 'Helvetica Neue', Arial, sans-serif";
export const mono = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

export const Stamp = ({ children, tone = C.muted }) => (
  <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.06em", color: tone, fontWeight: 500, overflowWrap: "anywhere" }}>
    {children}
  </span>
);

const DECADES = [
  ["All years", null, null],
  ["2020s", 2020, 2029],
  ["2010s", 2010, 2019],
  ["2000s", 2000, 2009],
  ["1990s", 1990, 1999],
  ["1980s", 1980, 1989],
  ["Pre-1980", 1949, 1979],
];

/** Total themes beneath a node, used to hint at how deep a branch goes. */
function countDescendants(theme) {
  let n = theme.children.length;
  for (const c of theme.children) n += countDescendants(c);
  return n;
}

export default function Browse({ onOpenSet, activeSetNum }) {
  const [tree, setTree] = useState(null);
  const [treeError, setTreeError] = useState(null);
  const [path, setPath] = useState([]); // breadcrumb of theme objects
  const [decade, setDecade] = useState(0);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  const [sets, setSets] = useState([]);
  const [count, setCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [setsError, setSetsError] = useState(null);

  const current = path.length ? path[path.length - 1] : null;

  useEffect(() => {
    let live = true;
    fetchThemes()
      .then((t) => live && setTree(t))
      .catch((e) => live && setTreeError(e.message || "Could not load themes."));
    return () => { live = false; };
  }, []);

  // Debounce typing into a set search so results follow along as you type.
  useEffect(() => {
    const id = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(id);
  }, [query]);

  // Reset paging whenever the theme, decade or search changes.
  useEffect(() => { setPage(1); }, [current?.id, decade, search]);

  const loadSets = useCallback(
    async (targetPage) => {
      if (!current) { setSets([]); setCount(0); setHasMore(false); return; }
      setLoading(true);
      setSetsError(null);
      const [, minYear, maxYear] = DECADES[decade];
      try {
        const r = await fetchThemeSets(current.id, { minYear, maxYear, search, page: targetPage });
        setCount(r.count);
        setHasMore(r.hasMore);
        setSets((prev) => (targetPage === 1 ? r.results : [...prev, ...r.results]));
      } catch (e) {
        setSetsError(e.message || "Could not load sets for this theme.");
        if (targetPage === 1) setSets([]);
      } finally {
        setLoading(false);
      }
    },
    [current, decade, search]
  );

  useEffect(() => { loadSets(page); }, [loadSets, page]);

  const children = current ? current.children : tree?.roots || [];
  const shownChildren = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return children;
    return children.filter((c) => c.name.toLowerCase().includes(q));
  }, [children, query]);

  const chip = (on) => ({
    fontFamily: mono, fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase",
    padding: "5px 9px", borderRadius: 2, cursor: "pointer",
    border: `1px solid ${on ? C.ink : "rgba(0,0,0,0.15)"}`,
    background: on ? C.ink : "transparent", color: on ? C.panel : C.inkSoft,
  });

  if (treeError) {
    return (
      <div className="p-4" style={{ background: C.panel, border: `1px solid ${C.flag}`, borderRadius: 3 }}>
        <span style={{ fontFamily: display, fontSize: 13, color: C.ink }}>{treeError}</span>
      </div>
    );
  }

  if (!tree) {
    return <div className="py-20 text-center"><Stamp>LOADING THEMES</Stamp></div>;
  }

  return (
    <div>
      {/* breadcrumb */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mb-4">
        <button
          onClick={() => { setPath([]); setQuery(""); setSearch(""); }}
          style={{ ...chip(path.length === 0), textTransform: "none" }}
        >
          All themes
        </button>
        {path.map((t, i) => (
          <React.Fragment key={t.id}>
            <span style={{ color: C.muted, fontFamily: mono, fontSize: 11 }}>›</span>
            <button
              onClick={() => setPath(path.slice(0, i + 1))}
              style={{ ...chip(i === path.length - 1), textTransform: "none" }}
            >
              {t.name}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {DECADES.map((d, i) => (
          <button key={d[0]} onClick={() => setDecade(i)} style={chip(decade === i)}>{d[0]}</button>
        ))}
        <span className="flex-1" />
        {query && (
          <button onClick={() => setQuery("")} style={chip(false)} title="Clear">Clear</button>
        )}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={current ? `Search ${current.name}` : "Filter themes"}
          className="px-2.5 py-1.5"
          style={{ fontFamily: mono, fontSize: 12, background: "transparent", border: `1px solid ${C.panelEdge}`,
                   borderRadius: 2, color: C.ink, outline: "none", minWidth: 160 }}
        />
      </div>

      {/* subthemes */}
      {shownChildren.length > 0 && (
        <div className="mb-7">
          <div className="pb-2 mb-2.5" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
            <Stamp>{current ? "SUBTHEMES" : "THEMES"} · {shownChildren.length}</Stamp>
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))" }}>
            {shownChildren.map((t) => {
              const deep = countDescendants(t);
              return (
                <button
                  key={t.id}
                  onClick={() => { setPath([...path, t]); setQuery(""); setSearch(""); }}
                  className="text-left p-3 transition-colors"
                  style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3, cursor: "pointer" }}
                >
                  <div style={{ fontFamily: display, fontWeight: 600, fontSize: 13, color: C.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}>
                    {t.name}
                  </div>
                  <div className="mt-1">
                    <Stamp>{deep > 0 ? `${deep} subtheme${deep === 1 ? "" : "s"}` : "sets only"}</Stamp>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* sets in the current theme */}
      {current && (
        <div>
          <div className="pb-2 mb-2.5 flex items-center justify-between gap-2" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
            <Stamp>
              SETS IN {current.name.toUpperCase()} · {loading && page === 1 ? "…" : count}
              {decade !== 0 ? ` · ${DECADES[decade][0]}` : ""}
              {search ? ` · “${search}”` : ""}
            </Stamp>
            {children.length > 0 && count === 0 && !loading && (
              <Stamp tone={C.azure}>PICK A SUBTHEME ABOVE</Stamp>
            )}
          </div>

          {setsError && (
            <div className="p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.flag}`, borderRadius: 3 }}>
              <span style={{ fontFamily: display, fontSize: 12.5, color: C.ink }}>{setsError}</span>
            </div>
          )}

          {loading && page === 1 ? (
            <div className="py-14 text-center"><Stamp>LOADING SETS</Stamp></div>
          ) : sets.length === 0 && !setsError ? (
            <div className="py-14 text-center">
              <Stamp>
                {decade !== 0 || search
                  ? "NO SETS MATCH THESE FILTERS — TRY ALL YEARS"
                  : children.length
                  ? "NO SETS FILED DIRECTLY UNDER THIS THEME"
                  : "NO SETS IN THIS THEME"}
              </Stamp>
            </div>
          ) : (
            <>
              <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))" }}>
                {sets.map((s) => (
                  <SetCard key={s.set_num} set={s} active={s.set_num === activeSetNum} onOpen={onOpenSet} />
                ))}
              </div>
              {hasMore && (
                <div className="mt-4 text-center">
                  <button onClick={() => setPage((p) => p + 1)} disabled={loading} style={chip(false)}>
                    {loading ? "Loading…" : `Show more (${count - sets.length} left)`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function SetCard({ set, active, onOpen }) {
  const [hover, setHover] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => { setBroken(false); }, [set.set_img_url]);

  return (
    <button
      onClick={() => onOpen(set.set_num)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="text-left p-3 flex flex-col w-full transition-all"
      style={{
        background: C.panel,
        border: `1px solid ${active ? C.ink : C.panelEdge}`,
        borderRadius: 3,
        cursor: "pointer",
        boxShadow: hover ? "0 6px 18px rgba(0,0,0,0.09)" : "0 1px 2px rgba(0,0,0,0.05)",
        transform: hover ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      <div className="flex items-center justify-center mb-2.5" style={{ height: 96 }}>
        {set.set_img_url && !broken ? (
          <img
            key={set.set_img_url}
            src={set.set_img_url}
            alt={set.name}
            loading="lazy"
            onError={() => setBroken(true)}
            style={{ maxHeight: 96, maxWidth: "100%", objectFit: "contain" }}
          />
        ) : (
          <Stamp>NO IMAGE</Stamp>
        )}
      </div>
      <div style={{ fontFamily: display, fontWeight: 600, fontSize: 12.5, color: C.ink, lineHeight: 1.3, overflowWrap: "anywhere" }}>
        {set.name}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <Stamp>{set.set_num}</Stamp>
        <Stamp>{set.year}</Stamp>
      </div>
      <div className="mt-0.5">
        <Stamp tone={C.inkSoft}>{(set.num_parts || 0).toLocaleString()} parts</Stamp>
      </div>
    </button>
  );
}
