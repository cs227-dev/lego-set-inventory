import React, { useState } from "react";
import SetInventory from "./SetInventory.jsx";
import { useSetInventory, normalize } from "./lib/useSetInventory.js";

const C = { backdrop: "#E4E1DA", panel: "#FAF9F6", edge: "#D3CFC6", ink: "#17171A", muted: "#807C74", azure: "#0A6EA8", flag: "#C2371B" };
const mono = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";
const display = "'Archivo', 'Helvetica Neue', Arial, sans-serif";

export default function App() {
  const [query, setQuery] = useState("");
  const [setNum, setSetNum] = useState(null); // null = show the demo set
  const { set, minifigs, bricks, stage, error, retry } = useSetInventory(setNum);

  const live = setNum !== null;
  const loading = live && !error && stage !== "done";

  const load = () => {
    const t = query.trim();
    if (t) setSetNum(normalize(t));
  };

  return (
    <div style={{ background: C.backdrop, minHeight: "100%" }}>
      {/* search bar */}
      <div style={{ background: C.panel, borderBottom: `1px solid ${C.edge}` }}>
        <div className="max-w-6xl mx-auto px-5 py-3 flex flex-wrap items-center gap-2">
          <span style={{ fontFamily: mono, fontSize: 10.5, letterSpacing: "0.08em", color: C.azure }}>SET NUMBER</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="75192-1"
            className="px-2.5 py-1.5 flex-1 min-w-[140px]"
            style={{ fontFamily: mono, fontSize: 13, background: "transparent", border: `1px solid ${C.edge}`, borderRadius: 2, color: C.ink, outline: "none" }}
          />
          <button
            onClick={load}
            className="px-3 py-1.5"
            style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", background: C.ink, color: C.panel, border: "none", borderRadius: 2, cursor: "pointer" }}
          >
            Load
          </button>
          {live && (
            <button
              onClick={() => { setSetNum(null); setQuery(""); }}
              className="px-3 py-1.5"
              style={{ fontFamily: mono, fontSize: 11, letterSpacing: "0.07em", textTransform: "uppercase", background: "transparent", color: C.muted, border: `1px solid ${C.edge}`, borderRadius: 2, cursor: "pointer" }}
            >
              Back to demo
            </button>
          )}
        </div>
      </div>

      {/* status strip */}
      {(loading || error) && (
        <div className="max-w-6xl mx-auto px-5 pt-4">
          <div className="p-3" style={{ background: C.panel, border: `1px solid ${error ? C.flag : C.edge}`, borderRadius: 3 }}>
            {error ? (
              <div>
                <div style={{ fontFamily: display, fontSize: 13, color: C.ink }}>{error}</div>
                <button onClick={retry} className="mt-2 px-2.5 py-1" style={{ fontFamily: mono, fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.07em", background: "transparent", border: `1px solid ${C.flag}`, color: C.flag, borderRadius: 2, cursor: "pointer" }}>
                  Try again
                </button>
              </div>
            ) : (
              <span style={{ fontFamily: mono, fontSize: 11, color: C.muted, letterSpacing: "0.06em" }}>
                LOADING {setNum} — {stage === "idle" ? "set details" : stage === "set" ? "characters" : "brick inventory"}…
              </span>
            )}
          </div>
        </div>
      )}

      {/* demo notice */}
      {!live && (
        <div className="max-w-6xl mx-auto px-5 pt-4">
          <div className="p-3" style={{ background: C.panel, border: `1px solid ${C.edge}`, borderRadius: 3 }}>
            <span style={{ fontFamily: mono, fontSize: 11, color: C.muted, letterSpacing: "0.05em" }}>
              SHOWING SAMPLE DATA — enter a set number above to load a real inventory.
            </span>
          </div>
        </div>
      )}

      {live && set && !error ? (
        <SetInventory setInfo={set} minifigs={minifigs} bricks={bricks} pending={stage !== "done"} />
      ) : (
        !live && <SetInventory />
      )}
    </div>
  );
}
