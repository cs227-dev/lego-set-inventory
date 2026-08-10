import { useState, useEffect, useCallback } from "react";
import { fetchSet, fetchMinifigs, fetchBricks, ApiError } from "./rebrickable";

/**
 * Staged load. The set header lands in one request, the roster in a handful,
 * and the brick inventory last — so the screen is useful long before the
 * rarity lookups finish. Nothing here blocks on the slowest call.
 *
 *   const { set, minifigs, bricks, stage, error, retry } = useSetInventory("75192-1");
 */
export function useSetInventory(setNum) {
  const [set, setSet] = useState(null);
  const [minifigs, setMinifigs] = useState([]);
  const [bricks, setBricks] = useState([]);
  const [stage, setStage] = useState("idle"); // idle | set | minifigs | bricks | done
  const [error, setError] = useState(null);
  const [nonce, setNonce] = useState(0);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!setNum) return;
    let live = true;

    setSet(null);
    setMinifigs([]);
    setBricks([]);
    setError(null);
    setStage("idle");

    (async () => {
      try {
        const s = await fetchSet(normalize(setNum));
        if (!live) return;
        setSet(s);
        setStage("set");

        const figs = await fetchMinifigs(s.set_num);
        if (!live) return;
        setMinifigs(figs);
        setStage("minifigs");

        const parts = await fetchBricks(s.set_num);
        if (!live) return;
        setBricks(parts);
        setStage("done");
      } catch (e) {
        if (!live) return;
        setError(describe(e, setNum));
        setStage("error");
      }
    })();

    return () => {
      live = false;
    };
  }, [setNum, nonce]);

  return { set, minifigs, bricks, stage, error, retry };
}

/** Rebrickable wants the variant suffix. "75192" and "75192-1" both work here. */
export function normalize(setNum) {
  const t = String(setNum).trim();
  return /-\d+$/.test(t) ? t : `${t}-1`;
}

/** Say what happened and what to do about it. */
function describe(e, setNum) {
  if (e instanceof ApiError) {
    if (e.routing) return e.message;
    if (e.status === 404) return `Rebrickable has no set numbered ${normalize(setNum)}. Check the number on rebrickable.com.`;
    if (e.status === 429) return "Rebrickable is rate limiting these requests. Wait a moment and load again.";
    if (e.status === 403) return "The proxy rejected that path. Add it to the allowlist in worker.js.";
    return e.message;
  }
  return "Could not load this set. Check that the proxy is running.";
}

/* ---------------------------------------------------------------------------
   Wiring the prototype

   1. Delete the SET / MINIFIGS / BRICKS constants from set-inventory.jsx.
   2. At the top of the component:

        const { set, minifigs, bricks, stage, error, retry } = useSetInventory(setNum);
        if (error) return <LoadError message={error} onRetry={retry} />;
        if (!set) return <Skeleton />;

   3. Render the Bricks tab against `stage === "done"`; until then show the
      count as pending rather than a wrong number.

   4. Prefer the real photo, keep the SVG as the fallback:

        {part.img
          ? <img src={part.img} alt={part.name} loading="lazy"
                 onError={(e) => { e.currentTarget.style.display = "none"; }} />
          : <BrickGlyph cat={part.cat} color={part.color} />}

      Minifig components are photographed loose, so they won't stack into a
      figure — keep the SVG renderer for the exploded diagram and use photos
      only in the component rail.

   5. `num_sets` can come back null when the rarity call fails. Treat null as
      unknown in RarityTag, not as rare — a false "1 set" badge is worse than
      no badge.
--------------------------------------------------------------------------- */
