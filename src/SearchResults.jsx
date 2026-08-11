import React, { useState, useEffect } from "react";
import { searchSetsByName, searchMinifigs, fetchMinifigSets } from "./lib/rebrickable.js";
import { SetCard, Stamp, C, display, mono } from "./Browse.jsx";

/**
 * Two search modes over one layout. Sets resolve in a single request; characters
 * need a second call per figure to answer "which sets is this in", so that runs
 * lazily when a character is expanded rather than for every result up front.
 */
export default function SearchResults({ mode, query, onOpenSet, activeSetNum }) {
  const [state, setState] = useState({ loading: true, error: null, results: [], count: 0 });

  useEffect(() => {
    if (!query) return;
    let live = true;
    setState({ loading: true, error: null, results: [], count: 0 });

    const run = mode === "character" ? searchMinifigs(query) : searchSetsByName(query);
    run
      .then((r) => live && setState({ loading: false, error: null, results: r.results, count: r.count }))
      .catch((e) => live && setState({ loading: false, error: e.message || "Search failed.", results: [], count: 0 }));

    return () => { live = false; };
  }, [mode, query]);

  const { loading, error, results, count } = state;

  return (
    <div>
      <div className="pb-2 mb-3" style={{ borderBottom: `1px solid ${C.panelEdge}` }}>
        <Stamp>
          {mode === "character" ? "CHARACTERS" : "SETS"} MATCHING “{query}”
          {loading ? " · …" : ` · ${count}`}
        </Stamp>
      </div>

      {error && (
        <div className="p-3 mb-3" style={{ background: C.panel, border: `1px solid ${C.flag}`, borderRadius: 3 }}>
          <span style={{ fontFamily: display, fontSize: 12.5, color: C.ink }}>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center"><Stamp>SEARCHING</Stamp></div>
      ) : results.length === 0 && !error ? (
        <div className="py-16 text-center">
          <Stamp>NOTHING MATCHED — TRY FEWER WORDS</Stamp>
        </div>
      ) : mode === "character" ? (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))" }}>
          {results.map((f) => (
            <CharacterResult key={f.fig_num} fig={f} onOpenSet={onOpenSet} activeSetNum={activeSetNum} />
          ))}
        </div>
      ) : (
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))" }}>
          {results.map((s) => (
            <SetCard key={s.set_num} set={s} active={s.set_num === activeSetNum} onOpen={onOpenSet} />
          ))}
        </div>
      )}
    </div>
  );
}

function CharacterResult({ fig, onOpenSet, activeSetNum }) {
  const [open, setOpen] = useState(false);
  const [sets, setSets] = useState(null);
  const [err, setErr] = useState(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!open || sets) return;
    let live = true;
    fetchMinifigSets(fig.fig_num)
      .then((r) => live && setSets(r))
      .catch((e) => live && setErr(e.message || "Could not load sets."));
    return () => { live = false; };
  }, [open, sets, fig.fig_num]);

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 3 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-3 flex items-start gap-3"
        style={{ background: "transparent", border: "none", cursor: "pointer" }}
      >
        <span className="flex-shrink-0 flex items-center justify-center"
              style={{ width: 46, height: 58, background: "#fff", borderRadius: 2, border: "1px solid rgba(0,0,0,0.08)" }}>
          {fig.img && !broken ? (
            <img src={fig.img} alt={fig.name} loading="lazy" onError={() => setBroken(true)}
                 style={{ maxHeight: 54, maxWidth: 42, objectFit: "contain" }} />
          ) : (
            <Stamp>—</Stamp>
          )}
        </span>
        <span className="flex-1" style={{ minWidth: 0 }}>
          <span style={{ fontFamily: display, fontWeight: 600, fontSize: 12.5, color: C.ink, lineHeight: 1.3,
                         overflowWrap: "anywhere", display: "block" }}>
            {fig.name}
          </span>
          <span className="mt-1 flex items-center gap-2 flex-wrap">
            <Stamp>{fig.fig_num}</Stamp>
            <Stamp tone={C.azure}>{open ? "HIDE SETS" : "SHOW SETS"}</Stamp>
          </span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3">
          {err ? (
            <Stamp tone={C.flag}>{err}</Stamp>
          ) : !sets ? (
            <Stamp>LOADING SETS</Stamp>
          ) : sets.length === 0 ? (
            <Stamp>NOT IN ANY CATALOGUED SET</Stamp>
          ) : (
            <div className="flex flex-col gap-1">
              {sets.map((s) => (
                <button
                  key={s.set_num}
                  onClick={() => onOpenSet(s.set_num)}
                  className="text-left px-2 py-1.5"
                  style={{
                    background: s.set_num === activeSetNum ? "rgba(10,110,168,0.08)" : "transparent",
                    border: `1px solid ${C.panelEdge}`, borderRadius: 2, cursor: "pointer",
                  }}
                >
                  <span style={{ fontFamily: display, fontSize: 11.5, color: C.ink, overflowWrap: "anywhere" }}>
                    {s.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <Stamp>{s.set_num}</Stamp>
                    <Stamp>{s.year}</Stamp>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
